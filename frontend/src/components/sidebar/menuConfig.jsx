/**
 * Configuracao do menu lateral por papel (admin / mentor / usuario).
 *
 * Esta e a UNICA fonte de verdade da navegacao. Para editar o menu, mexa nos
 * arrays abaixo. Cada item tem o formato:
 *
 *   - item simples: { id, texto, icone, rota, badgeKey?, novo? }
 *   - grupo:        { id, texto, icone, filhos: [ ...itens simples ] }
 *
 * Campos:
 *   id       -> identificador estavel (usado em favoritos/persistencia)
 *   texto    -> rotulo exibido
 *   icone    -> elemento de icone (MUI icons)
 *   rota     -> caminho do react-router
 *   badgeKey -> chave em `badges` p/ mostrar contagem pendente (ex.: "tarefas")
 *   novo     -> true exibe um ponto "novo" ao lado do item
 *   permissao-> chave RBAC exigida para o item aparecer. Sem ela, o item e
 *               visivel a qualquer um que tenha o menu daquele papel.
 *
 * SOBRE `permissao`: e so para nao OFERECER o que responderia 403 — quem
 * autoriza e o backend, em `garantirPermissao`. Itens de dado proprio (Minha
 * Startup, Minha Jornada) nao levam chave: sao do usuario e nao passam por
 * RBAC. Configuracoes tambem nao, porque a gestao de permissoes precisa
 * continuar alcancavel mesmo se o admin errar a mao nas roles.
 *
 * Perfil/Preferencias nao ficam no menu: sao alcancados pelo rodape da sidebar
 * (SidebarFooter) e pelo UserPanel, que ja e o lugar da conta.
 */
import {
  Dashboard,
  Forum,
  Business,
  Apartment,
  People,
  Settings,
  RocketLaunch,
  Groups,
  SupervisorAccount,
  MenuBook,
  LocalLibrary,
  AccountTree,
  Timeline,
  Quiz,
  Event,
  CalendarMonth,
  HowToReg,
  Grading,
  Inbox,
  RateReview,
  Feedback,
  Assessment,
  TrendingUp,
  HourglassBottom,
  TaskAlt,
  EmojiEvents,
  CoPresent,
} from "@mui/icons-material"

// Larguras do menu (compartilhadas com a Navbar e o conteudo).
export const SIDEBAR_WIDTH = 300
export const SIDEBAR_MINI_WIDTH = 80

// Abrir/recolher: a Sidebar, a Navbar e o conteudo andam com a mesma curva e a
// mesma duracao. Com curvas diferentes as bordas se separam no meio do
// caminho e abre um vao na faixa preta do topo.
export const SIDEBAR_TRANSICAO = { duration: 225, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
const MENU_ADMIN = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  // Mensagens nao leva `permissao`: a caixa de entrada e do proprio usuario
  // (receber nao passa por RBAC — ver o catalogo). Quem pode ESCREVER ganha o
  // botao "Nova mensagem" dentro da tela, nao um item de menu diferente.
  { id: "mensagens", texto: "Mensagens", icone: <Forum />, rota: "/mensagens", novo: true },
  // Gestao interna da equipe. NAO leva `permissao`, pelo mesmo motivo de
  // Mensagens: quem e responsavel por uma tarefa a enxerga com chave ou sem —
  // e a chave `tarefas.tarefas.visualizar` amplia isso para o quadro INTEIRO,
  // nao e o que da acesso a tela. Esconder o item de quem nao a tem deixaria a
  // pessoa sem caminho ate a tarefa que lhe atribuiram.
  { id: "tarefas", texto: "Tarefas", icone: <TaskAlt />, rota: "/tarefas", novo: true },
  {
    id: "incubadora",
    texto: "Incubadora",
    icone: <Business />,
    // Sem "Tenants" aqui: a lista de incubadoras e do usuario root (/tenants e
    // uma RootRoute). Para o admin era um item que so levaria a bloqueio — a
    // incubadora dele se administra em Configuracoes.
    filhos: [
      { id: "usuarios", texto: "Usuários", icone: <People />, rota: "/usuarios", permissao: "usuarios.usuarios.visualizar" },
      { id: "config", texto: "Configurações", icone: <Settings />, rota: "/configuracoes" },
    ],
  },
  {
    id: "startups",
    texto: "Startups",
    icone: <RocketLaunch />,
    filhos: [
      { id: "startups-lista", texto: "Lista de startups", icone: <RocketLaunch />, rota: "/startups", permissao: "startups.startups.visualizar" },
      { id: "startups-membros", texto: "Membros", icone: <Groups />, rota: "/startups/membros", permissao: "startups.membros.visualizar" },
      { id: "startups-mentores", texto: "Mentores", icone: <SupervisorAccount />, rota: "/mentores", permissao: "startups.mentores.visualizar" },
    ],
  },
  {
    id: "programa",
    texto: "Programa",
    icone: <MenuBook />,
    filhos: [
      { id: "programa-builder", texto: "Construtor", icone: <AccountTree />, rota: "/programa", permissao: "programa.trilha.visualizar" },
      { id: "biblioteca", texto: "Biblioteca", icone: <LocalLibrary />, rota: "/biblioteca", permissao: "programa.biblioteca.visualizar" },
      { id: "questionarios", texto: "Questionários", icone: <Quiz />, rota: "/questionarios", permissao: "programa.questionarios.visualizar" },
      // O admin acompanha a incubadora inteira (ver mentorCompartilhamentoService):
      // daqui ele entrega material a qualquer startup e ve tudo o que os
      // mentores compartilharam.
      { id: "espaco-mentor", texto: "Espaço do Mentor", icone: <CoPresent />, rota: "/espaco-mentor", permissao: "mentoria.materiais.gerenciar" },
    ],
  },
  {
    id: "eventos",
    texto: "Eventos",
    icone: <Event />,
    filhos: [
      { id: "eventos-agenda", texto: "Agenda", icone: <CalendarMonth />, rota: "/eventos", badgeKey: "eventos" },
      { id: "eventos-presenca", texto: "Presença", icone: <HowToReg />, rota: "/eventos/presenca", permissao: "eventos.presenca.visualizar" },
    ],
  },
  // Engajamento (migracao 017). NAO leva `permissao`, pelo mesmo motivo de
  // Mensagens e Tarefas: a tela abre no painel da PROPRIA pessoa (nivel,
  // pontos, extrato, selos), que e dado dela e nao passa por RBAC. Esconder o
  // item de quem nao tem `engajamento.ranking.visualizar` deixaria a pessoa
  // sem caminho ate o proprio progresso — e o placar dos outros, esse sim, e
  // podado dentro da tela.
  { id: "engajamento", texto: "Engajamento", icone: <EmojiEvents />, rota: "/engajamento", novo: true },
  {
    id: "avaliacoes",
    texto: "Avaliações",
    icone: <Grading />,
    filhos: [
      { id: "entregas", texto: "Entregas", icone: <Inbox />, rota: "/entregas", badgeKey: "entregas", permissao: "avaliacoes.entregas.visualizar" },
      { id: "avaliacoes-lista", texto: "Avaliações", icone: <RateReview />, rota: "/avaliacoes", permissao: "avaliacoes.avaliacoes.visualizar" },
    ],
  },
  {
    id: "relatorios",
    texto: "Relatórios",
    icone: <Assessment />,
    // Relatorios de gestao do programa. Logs e Auditoria saíram daqui: eram
    // registro tecnico/de conformidade, nao material de decisao. A auditoria
    // virou aba em Configuracoes.
    filhos: [
      { id: "rel-progresso", texto: "Progresso das startups", icone: <TrendingUp />, rota: "/relatorios/progresso", permissao: "relatorios.progresso.visualizar" },
      { id: "rel-entregas", texto: "Entregas e avaliações", icone: <Inbox />, rota: "/relatorios/entregas", permissao: "relatorios.entregas.visualizar" },
      { id: "rel-gargalos", texto: "Gargalos do programa", icone: <Timeline />, rota: "/relatorios/gargalos", permissao: "relatorios.gargalos.visualizar" },
      { id: "rel-tempo", texto: "Tempo por etapa", icone: <HourglassBottom />, rota: "/relatorios/tempo", permissao: "relatorios.tempo.visualizar", novo: true },
      { id: "rel-engajamento", texto: "Engajamento e eventos", icone: <Groups />, rota: "/relatorios/engajamento", permissao: "relatorios.engajamento.visualizar" },
    ],
  },
]

// ---------------------------------------------------------------------------
// MENTOR
// ---------------------------------------------------------------------------
const MENU_MENTOR = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  // Mensagens nao leva `permissao`: a caixa de entrada e do proprio usuario
  // (receber nao passa por RBAC — ver o catalogo). Quem pode ESCREVER ganha o
  // botao "Nova mensagem" dentro da tela, nao um item de menu diferente.
  { id: "mensagens", texto: "Mensagens", icone: <Forum />, rota: "/mensagens", novo: true },
  // O mentor nasce com a chave do quadro inteiro (ver rolesPadrao): acompanhar
  // startup gera tarefa, e um quadro que ele so le seria um quadro que ele nao
  // usa. Sem `permissao` no item pelo mesmo motivo do admin: desmarcar a chave
  // reduz o que ele VE, nao tira dele a tela — ele continua com as tarefas que
  // lhe atribuirem.
  { id: "tarefas", texto: "Tarefas", icone: <TaskAlt />, rota: "/tarefas", novo: true },
  // O ambiente de trabalho do mentor (migracao 020): a biblioteca pessoal e o
  // que ele entrega a cada startup que acompanha. Item proprio, e nao dentro de
  // Programa: e a tela que o mentor abre todo dia, nao uma configuracao.
  { id: "espaco-mentor", texto: "Espaço do Mentor", icone: <CoPresent />, rota: "/espaco-mentor", permissao: "mentoria.materiais.gerenciar", novo: true },
  {
    id: "startups",
    texto: "Startups",
    icone: <RocketLaunch />,
    filhos: [
      { id: "minhas-startups", texto: "Minhas startups", icone: <RocketLaunch />, rota: "/startups" },
    ],
  },
  {
    id: "programa",
    texto: "Programa",
    icone: <MenuBook />,
    filhos: [
      { id: "programa-builder", texto: "Construtor", icone: <AccountTree />, rota: "/programa", permissao: "programa.trilha.visualizar" },
      { id: "biblioteca", texto: "Biblioteca", icone: <LocalLibrary />, rota: "/biblioteca", permissao: "programa.biblioteca.visualizar" },
    ],
  },
  {
    id: "avaliacoes",
    texto: "Avaliações",
    icone: <Grading />,
    filhos: [
      { id: "entregas", texto: "Entregas", icone: <Inbox />, rota: "/entregas", badgeKey: "entregas", permissao: "avaliacoes.entregas.visualizar" },
      { id: "feedback", texto: "Feedback", icone: <Feedback />, rota: "/feedback" },
    ],
  },
  { id: "eventos", texto: "Eventos", icone: <Event />, rota: "/eventos", badgeKey: "eventos" },
  { id: "engajamento", texto: "Engajamento", icone: <EmojiEvents />, rota: "/engajamento", novo: true },
]

// ---------------------------------------------------------------------------
// USUARIO
// ---------------------------------------------------------------------------
const MENU_USUARIO = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  // Mensagens nao leva `permissao`: a caixa de entrada e do proprio usuario
  // (receber nao passa por RBAC — ver o catalogo). Quem pode ESCREVER ganha o
  // botao "Nova mensagem" dentro da tela, nao um item de menu diferente.
  { id: "mensagens", texto: "Mensagens", icone: <Forum />, rota: "/mensagens", novo: true },
  { id: "jornada", texto: "Minha Jornada", icone: <Timeline />, rota: "/jornada", novo: true },
  // O incubado tambem tem a tela, e sem chave nenhuma: se alguem da equipe lhe
  // atribuir uma tarefa, e aqui que ele a encontra. Sem `visualizar` a lista
  // traz so o que e dele — o quadro interno da incubadora continua fora do
  // alcance, e a propria tela explica o recorte.
  { id: "tarefas", texto: "Tarefas", icone: <TaskAlt />, rota: "/tarefas" },
  // O Blueprint/maturidade que era a tela "Minha Empresa" virou a aba
  // "Evolucao" aqui dentro — eram duas telas concorrentes sobre a startup.
  { id: "minha-startup", texto: "Minha Startup", icone: <RocketLaunch />, rota: "/minha-startup" },
  // A trilha, para o incubado, e a Jornada — as telas de Fases/Modulos/Tarefas
  // eram a visao administrativa dela e saíram.
  { id: "questionarios", texto: "Questionários", icone: <Quiz />, rota: "/questionarios" },
  { id: "eventos", texto: "Eventos", icone: <Event />, rota: "/eventos", badgeKey: "eventos" },
  { id: "engajamento", texto: "Engajamento", icone: <EmojiEvents />, rota: "/engajamento", novo: true },
]

// ---------------------------------------------------------------------------
// ROOT (super-admin da plataforma: gerencia todas as incubadoras)
// ---------------------------------------------------------------------------
const MENU_ROOT = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  {
    id: "plataforma",
    texto: "Plataforma",
    icone: <Business />,
    filhos: [
      { id: "tenants", texto: "Incubadoras", icone: <Apartment />, rota: "/tenants" },
      { id: "config", texto: "Configurações", icone: <Settings />, rota: "/configuracoes" },
    ],
  },
]

const MENUS ={ root: MENU_ROOT, admin: MENU_ADMIN, mentor: MENU_MENTOR, usuario: MENU_USUARIO }

/**
 * Resolve o papel do usuario para escolher o menu.
 *
 * O usuario ROOT (super-admin da plataforma) tem prioridade e recebe o menu
 * global de gestao de incubadoras. Caso contrario, usamos `usuario.papel`
 * (tabela tenant_usuarios) e, na sua ausencia, caimos em "usuario".
 *
 * @param {{papel?: string, root?: boolean}} usuario
 * @returns {"root"|"admin"|"mentor"|"usuario"}
 */
export function resolverPapel(usuario) {
  if (usuario?.root) return "root"
  const papel = usuario?.papel
  if (papel === "admin" || papel === "mentor" || papel === "usuario") return papel
  return "usuario"
}

/**
 * Retorna a arvore de menu para o papel informado.
 * @param {"admin"|"mentor"|"usuario"} papel
 */
export function menuPorPapel(papel) {
  return MENUS[papel] || MENU_USUARIO
}

/**
 * Achata a arvore em uma lista de itens navegaveis (com rota), guardando o
 * grupo pai. Usado pela busca rapida e pelos favoritos.
 * @param {Array} menu
 */
export function achatarMenu(menu) {
  const itens = []
  for (const item of menu) {
    if (item.filhos) {
      for (const filho of item.filhos) {
        itens.push({ ...filho, grupoId: item.id, grupoTexto: item.texto })
      }
    } else {
      itens.push({ ...item, grupoId: null, grupoTexto: null })
    }
  }
  return itens
}
