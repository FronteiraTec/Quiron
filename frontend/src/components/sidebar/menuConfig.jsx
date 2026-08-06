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
 *   id       -> identificador estavel (usado em favoritos/recentes/persistencia)
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
} from "@mui/icons-material"

// Larguras do menu (compartilhadas com a Navbar e o conteudo).
export const SIDEBAR_WIDTH = 300
export const SIDEBAR_MINI_WIDTH = 80

// ---------------------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------------------
const MENU_ADMIN = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  {
    id: "incubadora",
    texto: "Incubadora",
    icone: <Business />,
    filhos: [
      { id: "tenants", texto: "Tenants", icone: <Apartment />, rota: "/tenants" },
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
      { id: "rel-engajamento", texto: "Engajamento e eventos", icone: <Groups />, rota: "/relatorios/engajamento", permissao: "relatorios.engajamento.visualizar" },
    ],
  },
]

// ---------------------------------------------------------------------------
// MENTOR
// ---------------------------------------------------------------------------
const MENU_MENTOR = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
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
]

// ---------------------------------------------------------------------------
// USUARIO
// ---------------------------------------------------------------------------
const MENU_USUARIO = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  { id: "jornada", texto: "Minha Jornada", icone: <Timeline />, rota: "/jornada", novo: true },
  // O Blueprint/maturidade que era a tela "Minha Empresa" virou a aba
  // "Evolucao" aqui dentro — eram duas telas concorrentes sobre a startup.
  { id: "minha-startup", texto: "Minha Startup", icone: <RocketLaunch />, rota: "/minha-startup" },
  // A trilha, para o incubado, e a Jornada — as telas de Fases/Modulos/Tarefas
  // eram a visao administrativa dela e saíram.
  { id: "questionarios", texto: "Questionários", icone: <Quiz />, rota: "/questionarios" },
  { id: "eventos", texto: "Eventos", icone: <Event />, rota: "/eventos", badgeKey: "eventos" },
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
 * grupo pai. Usado pela busca rapida e por favoritos/recentes.
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
