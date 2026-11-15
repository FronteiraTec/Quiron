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
| `test/materialMentor.test.js` | não | normalização do Espaço do Mentor: corpo de cada tipo de material, link só http(s), origem única do compartilhamento |
| `test/espacoMentor.test.js` | sim | Espaço do Mentor ponta a ponta: biblioteca pessoal privada (inclusive na rota genérica de arquivos), compartilhamento só com startup acompanhada, o que o incubado recebe, integridade dos vínculos e auditoria |
| `test/materiaisIncubadora.test.js` | sim | materiais que a incubadora publica para os mentores: o mentor lê e baixa, não publica; o incubado não vê; arquivar tira de vista; trocar e excluir levam o arquivo antigo |
| `test/questionarioProva.test.js` | sim | questionário em modo prova: correção tudo-ou-nada (caixas só pontuam com exatamente as corretas, em branco é erro), gabarito incoerente recusado, o incubado abre a prova e recebe a nota sem o gabarito, o mentor vê a correção completa |
| `test/startupUuid.test.js` | sim | a startup pelo UUID na URL: abre a mesma startup que o id, vale nas rotas filhas, não é atalho de acesso, e as listas que viram link levam o UUID |
| `test/crmHistorico.test.js` | não | Mini CRM: frases e comparações do histórico (o que não mudou não vira evento), CPF/CNPJ, eventos de cada troca de status da tarefa |
| `test/crm.test.js` | sim | Mini CRM ponta a ponta: quem concede o benefício, só membro da startup entra (nem admin nem mentor), isolamento entre startups, cada mudança no histórico com antes/depois e autor da sessão, tarefas na linha do tempo, ganho/perda/reabertura, painel, histórico imutável (API e trigger), revogação que fecha o acesso e preserva os dados |
| `test/crmFaturamento.test.js` | sim | o faturamento da startup no cadastro dela: só soma as vendas ganhas (perdida, reaberta e excluída não entram), não devolve cliente nem negociação, exige `startups.faturamento.visualizar` (o mentor que acompanha não vê sem ela), startup sem CRM responde “não usa”, revogado continua mostrando o histórico |
| `test/reunioes.test.js` | sim | reuniões por vídeo (migração 027) contra um LiveKit falso local: quem cria e quem pode ser convidado, o convidado vê e a chave vê todas, o evento da reunião vai para a Agenda, o Google e a presença **só dos convidados** (e o evento comum continua indo para as startups), token só para convidado, com a sala aberta e por 10 min, webhook sem assinatura = 401, entradas e saídas sem duplicar no reenvio nem na ordem trocada, encerrar fecha a sala, a sala que fecha sozinha encerra a reunião, cancelar e excluir, isolamento da incubadora B, FK composta no banco, módulo some sem as variáveis |
| `test/reunioesGravacao.test.js` | sim | gravação e transcrição (migração 028), pela API e pelo lote, com um provedor falso e um conversor falso (sem `ffmpeg`):<br>• a chave de IA entra cifrada e nunca volta (resposta, listagem, auditoria), e não abre no contexto de outra incubadora;<br>• a `url_base` não aponta para a rede interna;<br>• sem transcrição configurada, a reunião não grava;<br>• o consentimento é só do convidado, e retirar fecha a gravação;<br>• os pedaços: dono, consentimento, janela de 10 min depois de encerrar, tipo, 512 KB, primeiros bytes, reenvio sem duplicar, disco cheio;<br>• encerrar (botão, webhook ou lote) cria o job;<br>• o lote respeita a janela, transcreve no nome certo e no horário certo, diz o que faltou e apaga o eco e o áudio;<br>• 429, 5xx e 401 têm cada um o seu destino;<br>• reprocessar e cancelar; job de worker morto recuperado; um job por incubadora;<br>• reunião esquecida aberta e retenção;<br>• FK composta |
| `test/reunioesUnidade.test.js` | não | as peças da transcrição sem banco: o plano de pedaços (pula silêncio, respeita o teto), as corridas, o eco, a janela da noite, a `url_base`, o filtro de segredos, a cifragem com contexto, os provedores OpenAI e Deepgram contra um HTTP falso (formato do pedido, leitura, cada erro) e a decisão do lote |
| `test/audioFfmpeg.test.js` | não (precisa de `ffmpeg`) | o `ffmpeg` de verdade: os pedaços juntos dão a gravação inteira, e a corrida depois de um buraco cai no lugar certo (WebM e Ogg). **Pulado onde não há `ffmpeg`** (na máquina local e na CI); roda na imagem: `docker compose run --rm --no-deps -v ./backend/test:/app/test:ro backend node --test test/audioFfmpeg.test.js` |
| `test/autorizacao.test.js` | sim | **as regressões da auditoria** |

Os helpers ficam em `backend/apoio-teste/` e **não** dentro de `test/`: o Node
considera todo arquivo sob um diretório `test/` um arquivo de teste, e os
helpers apareceriam como testes vazios no relatório.

`--test-concurrency=1` no `npm test` não é enfeite: os arquivos compartilham um
banco só, e cada um o recria no `before`. Em paralelo eles se destruiriam.

## `autorizacao.test.js` — as regressões da auditoria

Esse arquivo afirma o comportamento **correto** das rotas que a auditoria de
30/08/2026 achou sem checagem de autorização. Cada teste nomeia o seu achado
(`QRN-04`, `QRN-08`, ...).

Até 15/10/2026, 16 deles falhavam de propósito, e com eles a CI inteira — o
que travava todo deploy. Os cinco achados foram fechados nessa data:

| Achado | Onde foi corrigido |
|---|---|
| QRN-04 | `auditLogService`, `jornadaService`, `entregaService`, `avaliacaoService` |
| QRN-05 | `utils/senha.js` — `validarSenha`, usada em todo lugar que grava senha |
| QRN-07 | `rbacRepository.usuarioTemPermissao` — exige vínculo **ativo** |
| QRN-08 | `startupService.buscarComPermissao` — chave **e** vínculo com a startup |
| QRN-13 | `tenantService.atualizarUsuario` — confere o vínculo antes de escrever |

Daqui em diante, um vermelho neste arquivo é regressão: alguma rota voltou a
confiar no `id_tenant`/`id_startup` do pedido.

Alguns testes do arquivo são **controles**, e importam tanto quanto os outros:

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
| `src/data/espacoMentorMeta.test.js` | filtros, formatos e agrupamento por etapa do Espaço do Mentor (biblioteca, compartilhados e o que a Jornada mostra) |
| `src/components/espacoMentor/telasEspacoMentor.test.jsx` | o diálogo de compartilhar envia a etapa, o material, a finalidade e a orientação escolhidos (e não oferece o que o servidor recusaria); a Jornada lista e abre o material recebido; a aba "Materiais da incubadora" é leitura para o mentor e publicação para a coordenação |
| `src/data/crmMeta.test.js` | formatos do Mini CRM: data lida pelo texto, instante no fuso de quem lê, estado do prazo da tarefa, CPF/CNPJ |
| `src/components/crm/telasCrm.test.jsx` | a linha do tempo (autor, frase, texto da anotação, paginação pelo cursor) e o kanban (soma da coluna, mover entre etapas, soltar em Ganho pede o encerramento) |
| `src/components/startup/FaturamentoStartup.test.jsx` | a seção de faturamento no cadastro: frase (e não zeros) para startup sem CRM, totais e uma barra por mês, aviso de revogado, some sem a permissão |
| `src/data/reuniaoMeta.test.js` | reuniões: a sala abre 15 min antes (contada pelo que o servidor disse, não pelo relógio do navegador), "Sala aberta", horário de parede sem fuso, abas, formulário (fim depois da meia-noite, gravação ligada por padrão), o aviso de gravação, o rótulo da transcrição e os blocos da transcrição |
| `src/components/reunioes/sala/gravacao.test.js` | a gravação no navegador: a fila manda em ordem, um de cada vez, repete o mesmo pedaço com espera crescente, descarta o recusado, para de vez quando o servidor fecha a gravação, e avisa depois de um minuto sem envio; a sessão grava a ~24 kbps em pedaços de 10 s e fecha ao parar |
| `src/components/reunioes/telasReunioes.test.jsx` | o formulário manda o horário de parede e os convidados, "convidar a equipe da startup" acrescenta os membros dela, o anfitrião não é opção; na Agenda, o evento de uma reunião leva à sala e não à edição |

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
