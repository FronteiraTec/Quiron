# Testes

```bash
cd backend
npm test              # tudo (precisa de Postgres)
npm run test:unidade  # só senha e jwt, sem banco

cd ../frontend
npm test              # vitest, sem banco e sem servidor
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
| `test/documentoAula.test.js` | não | conversão do corpo antigo da AULA e validação do documento |
| `test/auth.test.js` | sim | login, `/me`, exigência de token, resposta genérica |
| `test/biblioteca.test.js` | sim | ciclo do documento da AULA, aula legada, autorização |
| `test/trilha.test.js` | sim | entrega do passo (os 4 campos juntos) e duplicação com subárvore |
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

Rodando o `npm test` inteiro, o total é maior (os arquivos novos entram na
conta) mas o número de falhas continua sendo **16** — todas dentro do
`autorizacao.test.js`. Qualquer falha fora dele é regressão de verdade.

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


## O frontend

`cd frontend && npm test` roda o **vitest** sobre `src/**/*.test.{js,jsx}`. Não
precisa de banco, de servidor nem de navegador de verdade (o ambiente é
`jsdom`).

| Arquivo | O que cobre |
|---|---|
| `src/hooks/useSalvamentoAutomatico.test.jsx` | debounce, gravações que se atropelam, falha de rede com repetição, aviso ao fechar a aba |
| `src/components/editor/documento.test.js` | quando um documento conta como vazio, o que vai para `initialContent`, resumo em texto |
| `src/components/sidebar/SidebarSearch.test.jsx` | o atalho `/` só rouba a tecla fora de campo de texto e fora de área editável |

### O que ele NÃO cobre, de propósito

O editor em si não é montado nos testes. O BlockNote roda sobre o ProseMirror,
que depende de medidas de layout (`getClientRects`, `Range`) que o `jsdom` não
implementa — montá-lo ali testaria os *stubs*, não o editor. E o que se estaria
verificando (atalho de markdown, menu `/`, arrastar bloco) é comportamento da
biblioteca, que ela já testa.

O que é **nosso** nesse caminho é que está coberto. Um exemplo de por que isso
importa: o menu `/` é da biblioteca, mas quem engolia a tecla antes dela era um
atalho do Quíron (ver `SidebarSearch.test.jsx`). Fora isso, a conversão do
formato antigo é testada no backend (`documentoAula.test.js`), a persistência
ponta a ponta em `biblioteca.test.js`, e o encaixe visual/de interação se
verifica abrindo a Biblioteca.
