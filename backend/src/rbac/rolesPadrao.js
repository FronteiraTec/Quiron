/**
 * As roles que toda incubadora ganha ao nascer, e o que cada uma concede.
 *
 * Este arquivo existe porque `criarRolesPadrao` criava as tres roles SEM
 * permissao nenhuma: o tenant nascia com "Administrador", "Mentor" e
 * "Colaborador" que nao concediam nada, e como vinham marcadas `sistema = TRUE`
 * nem dava para exclui-las.
 *
 * PRINCIPIO DOS CONJUNTOS: cada role reproduz o que aquele PAPEL ja conseguia
 * fazer antes do RBAC passar a valer. A migracao troca "papel autoriza" por
 * "permissao autoriza" sem tirar nada de ninguem — se alguem perder acesso no
 * dia da virada, o conjunto aqui e que esta errado, nao o enforcement.
 *
 * Isso significa herdar algumas frouxidoes do modelo antigo. O caso mais claro:
 * hoje NADA impede um mentor de editar a trilha do programa (o menu dele tem o
 * Construtor e nenhum service checava permissao), entao o Mentor nasce podendo
 * editar. Se a incubadora nao quiser isso, agora ha onde desmarcar — que e o
 * ponto de tudo isto.
 *
 * O ADMIN nao aparece na lista de chaves: recebe o catalogo inteiro, sempre
 * (ver `permissoesDaRole`). Assim uma chave nova nasce concedida ao admin e o
 * catalogo nunca cresce deixando o dono da incubadora para tras.
 */
const { achatarCatalogo } = require("./catalogoPermissoes")

const ADMINISTRADOR = "Administrador"
const MENTOR = "Mentor"
const COLABORADOR = "Colaborador"

/**
 * O que o papel 'mentor' fazia antes do RBAC valer: enxergar as startups que
 * acompanha, trabalhar a fila de entregas, e mexer no conteudo do programa.
 */
const PERMISSOES_MENTOR = [
  "startups.startups.visualizar",
  "startups.membros.visualizar",
  "startups.canvas.visualizar",
  "startups.gut.visualizar",
  "startups.cinco_w2h.visualizar",

  "avaliacoes.entregas.visualizar",
  "avaliacoes.entregas.baixar",
  "avaliacoes.avaliacoes.visualizar",
  "avaliacoes.avaliacoes.avaliar",

  // O menu do mentor tem Construtor e Biblioteca, e nada bloqueava a edicao.
  "programa.trilha.visualizar",
  "programa.trilha.editar",
  "programa.biblioteca.visualizar",
  "programa.biblioteca.editar",
  "programa.questionarios.visualizar",

  "eventos.agenda.visualizar",

  // Mensagens (migracao 012) nao existiam antes do RBAC, entao aqui nao ha
  // "conjunto anterior" a reproduzir — e uma escolha. O mentor nasce podendo
  // falar com as startups que acompanha e com pessoas especificas, que e o
  // trabalho dele; o megafone (toda a incubadora, uma role inteira) fica so com
  // o admin, que pode conceder depois se a incubadora quiser.
  "comunicacao.mensagens.enviar",
  "comunicacao.mensagens.enviar_startup",
  "comunicacao.mensagens.responder",

  // Tarefas (migracao 014) tambem nao existiam antes do RBAC, entao aqui
  // tambem nao ha "conjunto anterior" a reproduzir — e uma escolha. O mentor
  // nasce enxergando o quadro da equipe e podendo anotar o que precisa ser
  // feito: acompanhar startup gera tarefa ("cobrar o plano da Acme"), e um
  // quadro que ele so le seria um quadro que ele nao usa. Mexer na tarefa DOS
  // OUTROS (editar, excluir) fica com o admin — a propria, o responsavel
  // sempre pode, com ou sem chave (ver o catalogo).
  "tarefas.tarefas.visualizar",
  "tarefas.tarefas.criar",
]

/**
 * O que o papel 'usuario' (incubado) fazia: os modelos de gestao da propria
 * startup, os questionarios e a agenda.
 *
 * A Jornada nao esta aqui porque nao esta no catalogo: e a trilha vista sobre
 * os dados da propria startup, e exigir chave para a pessoa ver o proprio
 * progresso so criaria um jeito novo de trava-la fora do sistema.
 */
const PERMISSOES_COLABORADOR = [
  "startups.startups.visualizar",
  "startups.membros.visualizar",
  "startups.canvas.visualizar",
  "startups.canvas.editar",
  "startups.gut.visualizar",
  "startups.gut.criar",
  "startups.gut.excluir",
  "startups.cinco_w2h.visualizar",
  "startups.cinco_w2h.criar",
  "startups.cinco_w2h.excluir",

  "programa.questionarios.visualizar",
  "programa.biblioteca.visualizar",

  "eventos.agenda.visualizar",

  // De `tarefas`, NENHUMA CHAVE — o que nao e o mesmo que "sem acesso". O
  // quadro e a gestao INTERNA da incubadora, e o incubado nao faz parte da
  // equipe dela: sem `visualizar` ele nao enxerga o que a incubadora tem a
  // RESPEITO DELE. Mas se alguem da equipe lhe atribuir uma tarefa, ele a ve e
  // pode trabalha-la — isso nao passa por permissao (ver o catalogo e
  // tarefaService). Para poe-lo no quadro inteiro, basta marcar
  // `tarefas.tarefas.visualizar`.

  // De `comunicacao`, so RESPONDER: o incubado recebe os avisos da incubadora
  // (receber nao passa por permissao — ver o catalogo) e pode responder a quem
  // falou com ele, mas nao inicia conversa nem dispara aviso para os outros.
  // Para dar a ele o direito de iniciar, marque `comunicacao.mensagens.enviar`.
  "comunicacao.mensagens.responder",
]

const ROLES_PADRAO = [
  { nome: ADMINISTRADOR, descricao: "Acesso total a incubadora." },
  { nome: MENTOR, descricao: "Acompanha e avalia as startups do programa." },
  { nome: COLABORADOR, descricao: "Acesso operacional basico." },
]

/**
 * As chaves de uma role padrao. O Administrador recebe o catalogo inteiro,
 * calculado na hora — nao uma lista fixa que envelheceria a cada chave nova.
 *
 * @param {string} nome - nome da role padrao.
 * @returns {string[]} chaves de permissao.
 */
function permissoesDaRole(nome) {
  if (nome === ADMINISTRADOR) return achatarCatalogo().map((p) => p.chave)
  if (nome === MENTOR) return PERMISSOES_MENTOR
  if (nome === COLABORADOR) return PERMISSOES_COLABORADOR
  return []
}

/**
 * Qual role padrao corresponde a cada papel de `tenant_usuarios`.
 * Usado tanto pela migracao (alocar quem ja existe) quanto ao vincular um
 * usuario novo a incubadora.
 */
const ROLE_POR_PAPEL = {
  admin: ADMINISTRADOR,
  mentor: MENTOR,
  usuario: COLABORADOR,
}

module.exports = {
  ROLES_PADRAO,
  ROLE_POR_PAPEL,
  permissoesDaRole,
  ADMINISTRADOR,
  MENTOR,
  COLABORADOR,
}
