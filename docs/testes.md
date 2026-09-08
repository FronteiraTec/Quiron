# Testes

```bash
cd backend
npm test              # tudo (precisa de Postgres)
npm run test:unidade  # só senha e jwt, sem banco
```

## Rodar na máquina local

Os testes precisam de um Postgres alcançável e de um banco **cujo nome termine
em `_teste`**. O helper derruba o schema `public` inteiro a cada arquivo, e
recusa rodar contra qualquer outro nome — é o que impede um `npm test` com as
variáveis erradas de apagar sua base de trabalho.

Com o stack local de pé (o `docker-compose.build.yml` publica a porta em
`127.0.0.1`):

```bash
docker compose exec postgres psql -U quiron -d postgres -c "CREATE DATABASE quiron_teste;"

cd backend
DB_HOST=localhost DB_PORT=2060 DB_USER=quiron DB_PASSWORD=<a do seu .env> \
DB_NAME=quiron_teste JWT_SECRET=qualquer-coisa \
npm test
```

Vale guardar isso num `backend/.env.teste` e carregar com
`set -a; source .env.teste; set +a`.

## O que tem aqui

| Arquivo | Precisa de banco | O que cobre |
|---|---|---|
| `test/senha.test.js` | não | hash, verificação, token de reset |
| `test/jwt.test.js` | não | assinatura, expiração, adulteração, revogação |
| `test/auth.test.js` | sim | login, `/me`, exigência de token, resposta genérica |
| `test/autorizacao.test.js` | sim | **as regressões da auditoria** |

Os helpers ficam em `backend/apoio-teste/` e **não** dentro de `test/`: o Node
considera todo arquivo sob um diretório `test/` um arquivo de teste, e os
helpers apareceriam como testes vazios no relatório.

`--test-concurrency=1` no `npm test` não é enfeite: os arquivos compartilham um
banco só, e cada um o recria no `before`. Em paralelo eles se destruiriam.

## `autorizacao.test.js` falha de propósito

Esse arquivo afirma o comportamento **correto**, não o atual. Hoje:

```
# tests 43
# pass 27
# fail 16
```

As 16 falhas são os achados abertos da auditoria de 30/08/2026 — cada teste
nomeia o seu (`QRN-04`, `QRN-08`, ...). Elas são a definição de pronto do
trabalho de autorização: quando o último passar, o trabalho acabou, e o portão
impede o furo de voltar depois.

Enquanto isso, o `deploy.yml` não sobe nada — o job `subir` depende do `ci`.

Os 5 testes que **passam** dentro desse arquivo são os controles, e importam
tanto quanto os que falham:

- `colaborador CONTINUA lendo o Canvas da PROPRIA startup` — a correção do
  QRN-08 não pode fechar o acesso legítimo junto.
- `admin B nao lista as startups do tenant A` e os outros dois de isolamento —
  provam que onde o RBAC é chamado ele funciona, e que o fixture está montado
  certo. Sem eles, "tudo falha" poderia ser só um cenário quebrado.

## O cenário

`apoio-teste/cenario.js` monta duas incubadoras, quatro pessoas com papéis
diferentes, um forasteiro sem vínculo nenhum, duas startups na mesma
incubadora e uma entrega com o texto `SEGREDO-DA-STARTUP-UM`.

Os dois eixos que ele existe para testar:

- **entre incubadoras** — o `adminB` tem todas as chaves do tenant dele. Se um
  endpoint confia no `id_tenant` do pedido em vez de ler o tenant do recurso,
  ele passa. É um teste mais duro que o do forasteiro.
- **dentro da incubadora** — `startupUm` e `startupDois` no mesmo tenant, com o
  `colaboradorA` sendo membro só da primeira. É o par que revela se existe
  recorte por vínculo ou se basta ter a chave.

Montado pelos *services*, não por `INSERT` cru: um fixture em SQL testaria o
banco; pelos services ele passa pelos mesmos caminhos da aplicação, incluindo a
semeadura de roles padrão e do vocabulário de cadastro.
