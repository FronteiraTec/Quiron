# Quiron

Plataforma multi-inquilino para incubadoras: cadastro de startups, trilha de
programa, entregas e avaliação de mentor, agenda, mensagens, tarefas e
engajamento.

**Node 20 · Express · PostgreSQL 17 · React 18 (Vite) · Docker**

| | |
|---|---|
| Subir o projeto | [abaixo](#rodando-localmente) |
| Trabalhar em uma feature | [Branches](#branches) |
| Mudar o banco | [`database/README.md`](database/README.md) |
| Rodar os testes | [`docs/testes.md`](docs/testes.md) |
| Publicar numa VPS | [`docs/deploy.md`](docs/deploy.md) |
| Integrar o Google Agenda | [`docs/google-agenda.md`](docs/google-agenda.md) |

---

## Rodando localmente

Só precisa de **Docker Desktop** (ou Docker Engine + Compose v2). Node na
máquina é opcional — serve para rodar os testes fora do container.

### 1. O `.env`

```bash
cp .env.exemplo .env
```

Abra e ajuste para o perfil **local** — o arquivo tem os três perfis
comentados (local, dev, produção). O mínimo:

```bash
STACK=quiron
COMPOSE_FILE=docker-compose.yml:docker-compose.build.yml:docker-compose.dev.yml
COMPOSE_PATH_SEPARATOR=:
NODE_ENV=development
PORTA_LOCAL=80

IMAGEM_BACKEND=quiron-backend:local
IMAGEM_FRONTEND=quiron-frontend:local

DB_USER=quiron
DB_PASSWORD=uma-senha-qualquer
DB_NAME=quiron

JWT_SECRET=       # openssl rand -base64 48
SECRET_KEY=       # openssl rand -base64 32
FRONTEND_URL=http://localhost
```

A API **recusa subir** sem `JWT_SECRET`. É de propósito: antes havia um valor
padrão escrito no `docker-compose.yml` versionado, e quem lesse o repositório
conseguia assinar um token de administrador.

### 2. A rede da borda

Uma vez só, por máquina:

```bash
docker network create quiron-borda
```

No servidor é por ela que o Caddy alcança cada ambiente. Localmente não há
Caddy, mas a compose declara a rede como externa — sem ela, o `up` falha.

### 3. Subir

```bash
docker compose up -d --build
```

Abre em **http://localhost**. Com o override de dev, o banco nasce com a
incubadora e as contas de demonstração:

| Papel | E-mail | Senha |
|---|---|---|
| root | `root@quiron.com` | `Root@123` |
| admin | `admin@quiron.com` | `Admin@123` |
| incubado | `incubado@quiron.com` | `Incubado@123` |
| mentor | `mentor@quiron.com` | `Mentor@123` |

Essas contas existem só para navegar o sistema. Elas **não** vão para
produção — quem monta o seed é o `docker-compose.dev.yml`.

---

## O dia a dia

```bash
docker compose ps                      # o que está de pé
docker compose logs -f backend         # acompanhar a API
docker compose exec postgres psql -U quiron -d quiron
docker compose down                    # parar (os dados ficam)
docker compose down -v                 # parar E APAGAR banco e uploads
```

### Mudou o código? Precisa rebuildar.

O fonte é **copiado para dentro da imagem**, não montado. `docker compose
restart` reinicia o processo com o **código antigo** — e engana, porque o
container sobe saudável e o log parece normal.

```bash
docker compose up -d --build
```

Sinal de que você esqueceu: no log de subida do backend, a linha
`Catálogo de permissões sincronizado (N permissões)` mostra o `N` da versão
anterior.

Mudança só no `nginx/default.conf` é a exceção — ele é montado como volume,
então basta `docker compose restart nginx`.

### Mudou o banco?

Toda mudança é uma **migração nova** em `database/migrations/` **e** a mesma
mudança no `database/schema.sql`. A CI confere as duas coisas no PR. O passo a
passo e as regras estão em [`database/README.md`](database/README.md).

```bash
# database/migrations/019_o_que_voce_fez.sql
docker compose run --rm migracao --conferir   # o que falta, sem escrever
docker compose run --rm migracao              # aplica
```

---

## Branches

Duas branches permanentes:

```
main   →  produção        quiron.fronteiratec.com       protegida, só recebe merge
dev    →  desenvolvimento quiron-dev.fronteiratec.com   onde o trabalho se integra
```

**Toda branch nova sai da `dev`.** Nunca da `main`: a `main` só anda quando a
`dev` inteira é promovida, e uma feature que saiu dela nasce sem o que os
outros já integraram.

### Começando uma feature

```bash
git checkout dev
git pull                       # comece do que já está integrado
git checkout -b feat/nome-curto
```

Convenção de nome — o prefixo diz o que esperar do diff:

| Prefixo | Para |
|---|---|
| `feat/` | funcionalidade nova |
| `fix/` | correção de bug |
| `refactor/` | mudança interna, comportamento igual |
| `docs/` | documentação |
| `chore/` | build, CI, dependência |

Exemplos: `feat/relatorio-por-mentor`, `fix/data-volta-um-dia`,
`chore/atualiza-postgres`.

### Terminando

```bash
git push -u origin feat/nome-curto
```

Abra o Pull Request **para a `dev`** (não para a `main`). A CI roda e o merge
fica bloqueado enquanto ela estiver vermelha. Ela confere:

- testes do backend (incluindo as regressões de segurança) e do frontend;
- **o banco**: as migrações novas aplicam sobre a `dev`, nenhuma migração
  antiga foi editada, o número não colide, o `schema.sql` acompanhou;
- as imagens Docker constroem e os compose files são válidos.

Merge na `dev` → deploy automático em `quiron-dev.fronteiratec.com`, onde a
feature é verificada de verdade. O deploy faz backup do banco antes de migrar,
volta sozinho para a versão anterior se a nova não subir saudável, e confere
pela internet que a versão nova é a que responde. O que aconteceu fica no
resumo da execução, na aba **Actions**.

### Indo para produção

Quando a `dev` estiver validada, PR de `dev` → `main`. O merge dispara o
deploy de produção — com aprovação manual, se o *environment* `producao`
estiver configurado com *required reviewers*.

**Voltar uma versão:** aba **Actions › Deploy › Run workflow**, escolha o
ambiente e informe a versão (o SHA curto, que aparece no resumo de cada
deploy). Sobe em segundos, sem rebuild. Detalhes em [`docs/deploy.md`](docs/deploy.md).

```
feat/xyz ──┐
feat/abc ──┼──►  dev  ──►  main
fix/123  ──┘      │          │
                  ▼          ▼
        quiron-dev     quiron
```

### Correção urgente em produção

É a única exceção à regra de sair da `dev`:

```bash
git checkout main && git pull
git checkout -b hotfix/o-que-quebrou
# corrige, PR para main, deploy
git checkout dev && git merge main      # traz o hotfix de volta
```

O último passo é o que costuma ser esquecido — sem ele, o próximo merge de
`dev` em `main` desfaz a correção.

---

## Testes

```bash
cd backend
npm run test:unidade   # senha e jwt, sem banco
npm test               # tudo (precisa de um Postgres e de um banco *_teste)
```

Detalhes e o porquê do banco terminar em `_teste` estão em
[`docs/testes.md`](docs/testes.md).

A suíte precisa estar **verde** para qualquer coisa subir: o `deploy.yml`
depende da CI. O `test/autorizacao.test.js` guarda as regressões da auditoria
de segurança (`QRN-04`, `QRN-08`, …) — um vermelho ali é uma rota que voltou a
confiar no pedido em vez do recurso.

---

## Estrutura

```
backend/
  src/
    app.js          monta o Express (sem escutar porta — o teste importa isto)
    server.js       sobe o servidor e faz o trabalho de boot
    routes/         → controllers/ → services/ → repositories/ → banco
    middlewares/    autenticação e tratamento de erro
    rbac/           catálogo de permissões e roles padrão
  scripts/migrar.js aplicador de migrações
  test/             testes; helpers em apoio-teste/
frontend/
  src/              React + Vite; o axios usa baseURL "/api"
database/
  schema.sql        retrato completo — só no primeiro boot de um volume vazio
  migrations/       o que evolui um banco existente
  seed.sql          contas de demonstração (só em dev)
nginx/              roteamento interno de um ambiente
proxy/              Caddy: TLS e roteamento por domínio (só no servidor)
docs/               deploy, testes, Google Agenda
```

A regra das camadas: **controller** lê a requisição e devolve a resposta;
**service** tem a regra de negócio e a autorização; **repository** fala com o
banco. Autorização mora no service, nunca no controller — é o que garante que
a mesma regra valha por qualquer caminho que chegue nela.
