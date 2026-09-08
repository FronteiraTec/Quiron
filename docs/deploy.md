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

**2 vCPU · 4 GB RAM · 80 GB SSD.** As imagens são construídas no GitHub
Actions, não no servidor, então a RAM é só para rodar: dois Postgres, dois
Node, três nginx e o Caddy cabem em 4 GB com folga para o cache de disco. Com
2 GB funciona, mas o primeiro `pg_dump` simultâneo a um pico de acesso vai
doer.

Para usuário no Brasil, prefira uma região em São Paulo — a diferença para a
Europa é de ~200 ms em cada requisição, e o app faz várias por tela. Vultr,
DigitalOcean e Magalu Cloud têm SP; Hetzner é mais barato mas só tem
Europa/EUA.

Ubuntu 24.04 LTS. Não precisa de painel, nem de banco gerenciado nesta escala.

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

```bash
sudo mkdir -p /opt/quiron && sudo chown deploy:deploy /opt/quiron
cd /opt/quiron

git clone https://github.com/FronteiraTec/Quiron.git prod
git clone https://github.com/FronteiraTec/Quiron.git dev
cd dev && git checkout develop && cd ..

# A rede por onde o Caddy alcança os dois ambientes.
docker network create quiron-borda
```

Os dois clones existem por causa dos arquivos que **não** estão na imagem: os
`docker-compose*.yml`, o `nginx/default.conf` e o `database/schema.sql` que o
Postgres monta no primeiro boot.

### O `.env` de produção

```bash
cd /opt/quiron/prod
cp .env.exemplo .env
nano .env
chmod 600 .env
```

Preencha assim — gere cada segredo, não invente:

```bash
STACK=quiron-prod
COMPOSE_FILE=docker-compose.yml
NODE_ENV=production
FRONTEND_URL=https://app.seudominio.com
MIGRACAO_PRIMEIRA_VEZ=baseline

DB_USER=quiron
DB_NAME=quiron
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 48)
SECRET_KEY=$(openssl rand -base64 32)
```

### O `.env` de dev

Igual, com quatro diferenças:

```bash
STACK=quiron-dev
COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
FRONTEND_URL=https://dev.seudominio.com
# e segredos DIFERENTES — um vazamento em dev não pode assinar token de prod
```

O `docker-compose.dev.yml` é o que monta o seed de demonstração. Ele traz as
contas de senha conhecida (`admin@quiron.com / Admin@123`): **troque-as no
primeiro acesso** mesmo em dev, porque `dev.seudominio.com` está na internet
aberta como qualquer outro endereço.

---

## 5. Subir o Caddy

```bash
cd /opt/quiron/prod/proxy
cat > .env <<'EOF'
EMAIL_ACME=voce@seudominio.com
DOMINIO_PROD=app.seudominio.com
DOMINIO_DEV=dev.seudominio.com
EOF

docker compose up -d
docker compose logs -f caddy    # espere "certificate obtained successfully"
```

Enquanto os ambientes não subirem, os dois domínios respondem 502 — é o
esperado. Se quiser experimentar o DNS sem gastar tentativa de certificado,
descomente o `acme_ca` de staging no `Caddyfile`.

---

## 6. GitHub

**Chave de deploy** — gere na sua máquina, sem passphrase:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/quiron_deploy -N "" -C "deploy quiron"
ssh-copy-id -i ~/.ssh/quiron_deploy.pub deploy@IP_DA_VPS
```

**Settings › Secrets and variables › Actions › Secrets:**

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP da VPS |
| `VPS_USUARIO` | `deploy` |
| `VPS_SSH_CHAVE` | conteúdo de `~/.ssh/quiron_deploy` (a **privada**, inteira) |

**Variables** (aba ao lado, não são segredos):

| Variable | Valor |
|---|---|
| `URL_PROD` | `https://app.seudominio.com` |
| `URL_DEV` | `https://dev.seudominio.com` |

**Branches** — crie a `develop` e proteja a `main`:

```bash
git checkout -b develop && git push -u origin develop
```

Em Settings › Branches, exija que a CI passe antes de qualquer merge na `main`.
É o que faz o portão de teste valer alguma coisa.

**Aprovação manual para produção** (recomendado) — Settings › Environments ›
`producao` › *Required reviewers*. Com isso um merge na `main` constrói a
imagem e **espera você clicar** antes de trocar o que está no ar.

---

## 7. A primeira subida

O deploy automático já funciona, mas a primeira vez vale fazer à mão para ver
o banco nascer:

```bash
cd /opt/quiron/prod
# aponte para uma imagem já publicada pela CI (veja a aba Packages do repo)
nano .env      # IMAGEM_BACKEND / IMAGEM_FRONTEND com a tag do commit

docker compose pull
docker compose up -d --wait postgres
docker compose run --rm migracao     # deve dizer "baseline gravado: 18 ..."
docker compose up -d --wait
docker compose ps
```

Abra `https://app.seudominio.com`. Depois repita em `/opt/quiron/dev`.

A partir daqui:

- **push na `develop`** → CI → imagem → `dev.seudominio.com`
- **merge na `main`** → CI → imagem → (aprovação) → `app.seudominio.com`

---

## 8. Operação

**Ver o que está rodando**
```bash
cd /opt/quiron/prod && docker compose ps
docker compose logs -f backend --tail=100
```

**Voltar para a versão anterior** — é o motivo de a tag ser o SHA do commit:
```bash
cd /opt/quiron/prod
nano .env                      # troque a tag nas duas linhas IMAGEM_*
docker compose up -d --wait
```
Segundos, sem build. Se a versão ruim tiver rodado uma migração, o rollback da
imagem **não** desfaz o banco — por isso migração que remove coluna merece um
deploy só dela.

**Migrações**
```bash
docker compose run --rm migracao --conferir   # o que falta, sem escrever
docker compose run --rm migracao              # aplica
```
Uma transação por arquivo: se a quinta falhar, as quatro anteriores ficam
aplicadas e a próxima execução retoma da quinta. Nunca edite uma migração já
aplicada — o runner compara o checksum e recusa, porque um arquivo alterado faz
os dois ambientes divergirem em silêncio.

**Backup** — instale no cron do servidor:
```bash
chmod +x /opt/quiron/prod/scripts/backup.sh
crontab -e
# 0 3 * * * /opt/quiron/prod/scripts/backup.sh prod >> /var/log/quiron-backup.log 2>&1
# 0 4 * * 0 /opt/quiron/dev/scripts/backup.sh dev   >> /var/log/quiron-backup.log 2>&1
```
Backup que só existe no mesmo servidor não é backup: mande uma cópia para fora
(`rclone`, `scp`, S3). E **teste a restauração uma vez** — o procedimento está
no cabeçalho do `scripts/backup.sh`.

**Acessar o banco** (ele não publica porta, e deve continuar assim):
```bash
docker compose exec postgres psql -U quiron -d quiron
```

---

## 9. Antes de abrir para o público

O deploy funciona hoje. A aplicação ainda não deveria receber gente de fora:
a auditoria de 30/08/2026 achou quatro rotas sem nenhuma checagem de
autorização, e a suíte de testes reproduz cada uma.

O que **esta configuração já resolveu**:

| | |
|---|---|
| QRN-01 | segredo do JWT fora do compose, sem fallback, obrigatório na subida |
| QRN-03 | Postgres não publica porta |
| QRN-10 | TLS automático no Caddy |
| QRN-11 | CSP, HSTS e `X-Frame-Options` na borda, cobrindo o SPA |
| QRN-12 | CORS restrito ao `FRONTEND_URL` |
| QRN-15 | `X-Forwarded-Host` fixado pela borda, não pelo visitante |
| QRN-19 | container do backend roda como `node`, `npm ci` no build |
| — | `database/schema.sql` voltou a aplicar: faltava a tabela `arquivo`, e ele abortava no meio |

O que **continua aberto** e falha na CI de propósito:

| | |
|---|---|
| QRN-04 | `/jornada`, `/entregas`, `/avaliacoes` e `/auditlogs` sem autorização |
| QRN-05 | cadastro público aceita senha de um caractere |
| QRN-07 | desativar usuário não revoga acesso |
| QRN-08 | incubado lê e edita o Canvas da startup vizinha |
| QRN-13 | admin edita perfil de usuário de outra incubadora |

```bash
cd backend && npm test
# 16 falhas em test/autorizacao.test.js — cada uma nomeia o achado
```

Enquanto essas falharem, o `deploy.yml` não sobe nada: o job `subir` depende do
`ci`. Isso é intencional — o portão está fazendo o trabalho dele.

Se quiser subir mesmo assim para testar a infraestrutura, coloque o `dev` atrás
do `basic_auth` do `Caddyfile` (já está lá, comentado) e deixe a `main` parada
até fechar os achados.
