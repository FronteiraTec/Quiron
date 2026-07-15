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
  AccountTree,
  Timeline,
  ViewModule,
  Assignment,
  Quiz,
  Event,
  CalendarMonth,
  HowToReg,
  Grading,
  Inbox,
  RateReview,
  Feedback,
  Assessment,
  ReceiptLong,
  Policy,
  Person,
  Tune,
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
      { id: "usuarios", texto: "Usuarios", icone: <People />, rota: "/usuarios" },
      { id: "config", texto: "Configuracoes", icone: <Settings />, rota: "/configuracoes" },
    ],
  },
  {
    id: "startups",
    texto: "Startups",
    icone: <RocketLaunch />,
    filhos: [
      { id: "startups-lista", texto: "Lista de startups", icone: <RocketLaunch />, rota: "/startups" },
      { id: "startups-membros", texto: "Membros", icone: <Groups />, rota: "/startups/membros" },
      { id: "startups-mentores", texto: "Mentores", icone: <SupervisorAccount />, rota: "/mentores" },
    ],
  },
  {
    id: "programa",
    texto: "Programa",
    icone: <MenuBook />,
    filhos: [
      { id: "programa-builder", texto: "Construtor", icone: <AccountTree />, rota: "/programa", novo: true },
      { id: "fases", texto: "Fases", icone: <Timeline />, rota: "/fases" },
      { id: "modulos", texto: "Modulos", icone: <ViewModule />, rota: "/modulos" },
      { id: "tarefas", texto: "Tarefas", icone: <Assignment />, rota: "/tarefas", badgeKey: "tarefas" },
      { id: "questionarios", texto: "Questionarios", icone: <Quiz />, rota: "/questionarios" },
    ],
  },
  {
    id: "eventos",
    texto: "Eventos",
    icone: <Event />,
    filhos: [
      { id: "eventos-agenda", texto: "Agenda", icone: <CalendarMonth />, rota: "/eventos", badgeKey: "eventos" },
      { id: "eventos-presenca", texto: "Presenca", icone: <HowToReg />, rota: "/eventos/presenca" },
    ],
  },
  {
    id: "avaliacoes",
    texto: "Avaliacoes",
    icone: <Grading />,
    filhos: [
      { id: "entregas", texto: "Entregas", icone: <Inbox />, rota: "/entregas", badgeKey: "entregas" },
      { id: "avaliacoes-lista", texto: "Avaliacoes", icone: <RateReview />, rota: "/avaliacoes" },
    ],
  },
  {
    id: "relatorios",
    texto: "Relatorios",
    icone: <Assessment />,
    filhos: [
      { id: "logs", texto: "Logs", icone: <ReceiptLong />, rota: "/logs" },
      { id: "auditoria", texto: "Auditoria", icone: <Policy />, rota: "/auditoria" },
    ],
  },
  {
    id: "perfil",
    texto: "Perfil",
    icone: <Person />,
    filhos: [{ id: "preferencias", texto: "Preferencias", icone: <Tune />, rota: "/perfil" }],
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
      { id: "programa-builder", texto: "Construtor", icone: <AccountTree />, rota: "/programa", novo: true },
      { id: "fases", texto: "Fases", icone: <Timeline />, rota: "/fases" },
      { id: "tarefas", texto: "Tarefas", icone: <Assignment />, rota: "/tarefas", badgeKey: "tarefas" },
    ],
  },
  {
    id: "avaliacoes",
    texto: "Avaliacoes",
    icone: <Grading />,
    filhos: [
      { id: "entregas", texto: "Entregas", icone: <Inbox />, rota: "/entregas", badgeKey: "entregas" },
      { id: "feedback", texto: "Feedback", icone: <Feedback />, rota: "/feedback" },
    ],
  },
  { id: "eventos", texto: "Eventos", icone: <Event />, rota: "/eventos", badgeKey: "eventos" },
  { id: "perfil", texto: "Perfil", icone: <Person />, rota: "/perfil" },
]

// ---------------------------------------------------------------------------
// USUARIO
// ---------------------------------------------------------------------------
const MENU_USUARIO = [
  { id: "dashboard", texto: "Dashboard", icone: <Dashboard />, rota: "/" },
  { id: "minha-startup", texto: "Minha Startup", icone: <RocketLaunch />, rota: "/minha-startup" },
  {
    id: "programa",
    texto: "Programa",
    icone: <MenuBook />,
    filhos: [
      { id: "fases", texto: "Fases", icone: <Timeline />, rota: "/fases" },
      { id: "modulos", texto: "Modulos", icone: <ViewModule />, rota: "/modulos" },
      { id: "tarefas", texto: "Tarefas", icone: <Assignment />, rota: "/tarefas", badgeKey: "tarefas" },
      { id: "questionarios", texto: "Questionarios", icone: <Quiz />, rota: "/questionarios" },
    ],
  },
  { id: "eventos", texto: "Eventos", icone: <Event />, rota: "/eventos", badgeKey: "eventos" },
  { id: "perfil", texto: "Perfil", icone: <Person />, rota: "/perfil" },
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
      { id: "config", texto: "Configuracoes", icone: <Settings />, rota: "/configuracoes" },
    ],
  },
  {
    id: "perfil",
    texto: "Perfil",
    icone: <Person />,
    filhos: [{ id: "preferencias", texto: "Preferencias", icone: <Tune />, rota: "/perfil" }],
  },
]

const MENUS = { root: MENU_ROOT, admin: MENU_ADMIN, mentor: MENU_MENTOR, usuario: MENU_USUARIO }

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
