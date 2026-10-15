# Hospedagem em VPS — dois ambientes

Um servidor, dois ambientes isolados, TLS automático e deploy pelo GitHub
Actions.

```
                    Internet
                       │
              ┌────────┴────────┐
              │  Caddy  :80/443 │   proxy/   ← sobe uma vez, serve os dois
              │  TLS automático │
              └────┬───────┬────┘
       app.dominio │       │ dev.dominio
              ┌────┴───┐ ┌─┴──────┐
              │ nginx  │ │ nginx  │   roteamento interno (/api, /credencial)
              │ front  │ │ front  │
              │ back   │ │ back   │
              │ postgres││postgres│   bancos e volumes SEPARADOS
              └────────┘ └────────┘
               quiron-prod  quiron-dev
```

Cada ambiente é o mesmo `docker-compose.yml` com um `.env` diferente. Nada é
compartilhado entre eles a não ser o Caddy e o kernel.

---

## 1. O que contratar

**2 GB de RAM bastam.** Medido em 30/08/2026 com a base de demonstração, por
ambiente:

| Container | Em uso |
|---|---|
| postgres | 61 MB (pico: recriação de schema + fixture) |
| backend (Node) | 60 MB |
| frontend (nginx) | 11 MB |
| nginx interno | 10 MB |
| **por ambiente** | **~145 MB** |

Dois ambientes ≈ 290 MB, mais ~40 MB de Caddy e ~400 MB de Ubuntu + daemon do
Docker. Sobra mais de 1 GB numa máquina de 2 GB.

Isso só é verdade porque **as imagens são construídas no GitHub Actions, não no
servidor**. Um `npm run build` do Vite sozinho passa de 1 GB e derrubaria a
máquina — se algum dia você construir no servidor, 2 GB não serve mais.

Duas condições que não são opcionais em 2 GB:

- **Swap de 4 GB** (passo 2). É o que transforma um pico em lentidão em vez de
  um processo morto.
- **Tetos de memória por container** (já no `docker-compose.yml`, valores no
  `.env.exemplo`). Sem eles, os dois ambientes disputam a mesma RAM e quem
  escolhe a vítima do OOM é o kernel — que pode matar o Postgres de produção
  por causa de um relatório rodado em dev.

**Disco: 50 GB é o mínimo confortável.** As imagens base somam ~790 MB
(postgres 453, backend 146, frontend 65, nginx 62, caddy 63) e cada deploy
traz um backend e um frontend novos, ~211 MB o par. O `deploy.yml` roda
`docker image prune -af --filter until=168h`, que mantém uma semana de versões
para rollback e recolhe o resto.

**HostGator** serve: os planos NVMe usam **KVM** com acesso root e disco a
partir de 50 GB, então Docker roda sem adaptação. O plano NVMe 2 (2 GB) é
suficiente para começar. Se preferir folga para não pensar no assunto, o de
4 GB dobra tudo e permite subir os tetos do `.env`.

Qualquer que seja o provedor, prefira uma região no **Brasil**: a diferença
para a Europa é de ~200 ms por requisição, e o app faz várias por tela.

**Ubuntu 22.04 ou 24.04 LTS**, tanto faz para este projeto — os passos abaixo
são idênticos nos dois, e ambos já usam cgroup v2, de que os tetos de memória
por container dependem. O 24.04 tem suporte até 2029 contra 2027 do 22.04;
se os dois estiverem na lista do provedor, pegue o 24.04. Não precisa de painel
nem de banco gerenciado nesta escala.

---

## 2. Primeiro provisionamento

Tudo abaixo roda uma vez, como `root`, logo depois de criar a máquina.

```bash
# --- usuário de trabalho (nunca faça deploy como root) --------------------
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys

# --- SSH: só chave, sem root ----------------------------------------------
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/'            /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# --- firewall: só 22, 80 e 443 --------------------------------------------
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# --- Docker ---------------------------------------------------------------
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# --- swap: 4 GB de rede de segurança --------------------------------------
# Sem isso, um pico de memória mata o Postgres pelo OOM killer em vez de
# ficar lento por um instante.
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# --- atualizações de segurança automáticas --------------------------------
apt update && apt install -y unattended-upgrades fail2ban
systemctl enable --now fail2ban
```

Saia e entre de novo como `deploy` daqui em diante.

---

## 3. DNS

No painel do seu domínio, dois registros `A` apontando para o IP do servidor:

| Tipo | Nome  | Valor        |
|------|-------|--------------|
| A    | `app` | IP da VPS    |
| A    | `dev` | IP da VPS    |

Espere propagar antes do passo 5 — o Caddy pede o certificado no primeiro
acesso, e se o DNS ainda não resolve, o Let's Encrypt recusa. São 5 tentativas
por domínio por semana; estourou, você espera até a semana virar.

```bash
dig +short app.seudominio.com   # tem que devolver o IP da VPS
```

---

## 4. Estrutura no servidor

Como está hoje (VPS HostGator; IP e porta do SSH estão nos secrets
`VPS_HOST` e `VPS_PORTA`, e não aqui — o repositório é público):

```
/opt/quiron/
  prod/                 quiron.fronteiratec.com
    .env                segredos e a versão no ar (IMAGEM_*) — só existe aqui
    .deploys            histórico: data e imagem de cada deploy
    docker-compose*.yml, nginx/, database/, scripts/
                        copiados a cada deploy, da mesma versão da imagem
    proxy/              o Caddy COMPARTILHADO — o deploy nunca toca
  dev/                  quiron-dev.fronteiratec.com (mesma estrutura, sem proxy/)
  backups/
    prod/  dev/         pre-deploy-*.dump (últimos 10) e o backup diário
```

Os diretórios `prod/` e `dev/` nasceram como clones do git, mas **o servidor
não usa mais git**: o repositório é privado e o servidor não tem credencial do
GitHub (nem deve ter). O `deploy.yml` copia os arquivos por SSH.

**O Caddy em `prod/proxy/` serve quatro sites**: os dois do Quiron, o
Desafio Empreende e a Vitrine. O bloco da Vitrine é reescrito pelo deploy dela.
Por isso o deploy do Quiron não copia `proxy/`, e mudanças no `Caddyfile` são
feitas à mão no servidor (o arquivo do repositório é um retrato).

### O `.env` de cada ambiente

Criado uma vez, à mão, a partir do `.env.exemplo`. O deploy só edita as duas
linhas `IMAGEM_*`. Variável nova no código? Adicione no `.env` dos dois
ambientes **antes** do merge — o compose recusa subir se uma obrigatória faltar,
e o deploy volta para a versão anterior.

---

## 5. O Caddy

Já está no ar. Para aplicar uma mudança no `Caddyfile`:

```bash
cd /opt/quiron/prod/proxy
nano Caddyfile
docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec caddy caddy reload   --config /etc/caddy/Caddyfile
```

`reload` não derruba conexão. Não use `docker compose up` aqui sem
necessidade: recriar o container tira os quatro sites do ar por alguns segundos.

---

## 6. GitHub

### Chave de deploy

Um par de chaves **só para o Actions**, sem passphrase. A pública vai no
`authorized_keys` do usuário `deploy` no servidor; a privada vira secret.

```bash
ssh-keygen -t ed25519 -f quiron_deploy -N "" -C "github-actions quiron"
# quiron_deploy.pub -> /home/deploy/.ssh/authorized_keys no servidor
# quiron_deploy     -> secret VPS_SSH_CHAVE (o arquivo inteiro)
```

### Secrets e variables

**Settings › Secrets and variables › Actions**

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP do servidor |
| `VPS_PORTA` | porta do SSH (não é a 22) |
| `VPS_USUARIO` | `deploy` |
| `VPS_SSH_CHAVE` | a chave **privada** inteira |
| `VPS_KNOWN_HOSTS` | a linha do servidor no known_hosts: `[IP]:PORTA ssh-ed25519 AAAA...` |

O `VPS_KNOWN_HOSTS` é a identidade do servidor. Com ele fixo, o Actions recusa
conectar se alguém se passar pelo IP. Se o servidor for reinstalado, a chave
muda: pegue a nova com `ssh-keyscan -p PORTA IP`, confira com quem administra
o servidor e atualize o secret.

| Variable | Valor |
|---|---|
| `URL_PROD` | `https://quiron.fronteiratec.com` |
| `URL_DEV` | `https://quiron-dev.fronteiratec.com` |

As imagens vão para o GHCR (`ghcr.io/fronteiratec/quiron-*`). Não precisa
criar token: o `GITHUB_TOKEN` do próprio job publica, e no deploy ele é usado
para o servidor baixar — num login temporário, apagado ao fim do job.

### Branches e aprovação

**Settings › Branches › Add rule** para `main` **e** para `dev`:

- *Require a pull request before merging*
- *Require status checks to pass* → marque os jobs da CI: `Testes do backend`,
  `Testes do frontend`, `Migracoes e schema.sql`, `As imagens constroem`,
  `Os compose files sao validos`
- *Require branches to be up to date before merging* — é o que faz a CI pegar
  duas migrações com o mesmo número vindas de PRs paralelos

**Settings › Environments › `producao` › Required reviewers** (recomendado):
um merge na `main` constrói, testa e **espera alguém aprovar** antes de trocar
o que está no ar.

---

## 7. O fluxo

```
PR para dev ──► CI (testes, banco, imagens) ──► merge
                                                  │
              ┌───────────────────────────────────┘
              ▼
   deploy.yml: CI de novo ─► imagens no GHCR ─► servidor:
                                                 1. baixa as imagens
                                                 2. backup do banco
                                                 3. migrações
                                                 4. troca os containers
                                                 5. confere /health
              ◄── volta sozinho se 4 ou 5 falhar
              ▼
   confere pela internet que /api/health responde com a versão nova
```

O resumo de cada execução (aba **Actions**) mostra o ambiente, a versão e as
migrações aplicadas. O ambiente também diz o que está no ar:

```bash
curl -s https://quiron.fronteiratec.com/api/health
# {"status":"ok","message":"API is running","versao":"abc1234"}
```

O que o deploy **não** desfaz sozinho: migração aplicada. Se a migração passou e
a versão nova não subiu, o deploy volta a imagem, mas o banco fica migrado — por
isso migração destrutiva vai em duas etapas
([`database/README.md`](../database/README.md)).

---

## 8. Operação

**Voltar uma versão** — Actions › Deploy › *Run workflow*, ambiente e versão
(o SHA curto de um deploy anterior; `tail /opt/quiron/prod/.deploys` lista).
Pula testes e build, porque a imagem daquela versão já existe. Ou, no servidor:

```bash
cd /opt/quiron/prod
bash scripts/deploy.sh ghcr.io/fronteiratec/quiron-backend:abc1234 \
                       ghcr.io/fronteiratec/quiron-frontend:abc1234
```

(No servidor, o pull do GHCR precisa de login: `docker login ghcr.io` com um
token `read:packages`, e `docker logout ghcr.io` ao fim.)

**Ver o que está rodando**
```bash
cd /opt/quiron/prod && docker compose ps
docker compose logs -f backend --tail=100
```

**Migrações**
```bash
docker compose run --rm migracao --conferir   # o que falta, sem escrever
```

**Backup diário** — no crontab do usuário `deploy`:
```
0 3 * * * /opt/quiron/prod/scripts/backup.sh prod >> /opt/quiron/backups/backup.log 2>&1
0 4 * * 0 /opt/quiron/dev/scripts/backup.sh  dev  >> /opt/quiron/backups/backup.log 2>&1
```
Backup que só existe no mesmo servidor não é backup: mande uma cópia para fora
(`rclone`, `scp`, S3). E **teste a restauração uma vez** — o procedimento está
em [`database/README.md`](../database/README.md#quando-algo-dá-errado-no-deploy).

**Acessar o banco** (ele não publica porta, e deve continuar assim):
```bash
docker compose exec postgres psql -U quiron -d quiron
```

---

## 9. Segurança

O que **esta configuração resolve**:

| | |
|---|---|
| QRN-01 | segredo do JWT fora do compose, sem fallback, obrigatório na subida |
| QRN-03 | Postgres não publica porta |
| QRN-04, 05, 07, 08, 13 | autorização por recurso e vínculo — fechados em 15/10/2026, com regressão em `test/autorizacao.test.js` |
| QRN-10 | TLS automático no Caddy |
| QRN-11 | CSP, HSTS e `X-Frame-Options` na borda, cobrindo o SPA |
| QRN-12 | CORS restrito ao `FRONTEND_URL` |
| QRN-15 | `X-Forwarded-Host` fixado pela borda, não pelo visitante |
| QRN-19 | container do backend roda como `node`, `npm ci` no build |

Pendência do servidor:

- **Login de root por senha.** O provisionamento (seção 2) desliga
  `PermitRootLogin` e `PasswordAuthentication`; neste servidor ainda estão
  ligados. Com a chave de deploy funcionando e uma chave pessoal no
  `authorized_keys`, desligue — e troque a senha de root.
