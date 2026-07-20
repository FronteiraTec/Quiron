/**
 * Metadados da Jornada do incubado (rotulos, cores e icones).
 *
 * A jornada em si vem da API (/jornada) — este arquivo guarda apenas o que e
 * de apresentacao e nao pertence ao banco:
 *
 *   STATUS_PASSO / STATUS_ESTAGIO / STATUS_AREA -> como cada estado aparece
 *   AREAS_EMPRESA                               -> as areas do blueprint
 *   STATUS_CONCLUIDO / STATUS_INICIADO          -> quais estados contam
 *
 * Os estados do PASSO sao derivados no servidor a partir de entrega +
 * avaliacao (ver backend/src/services/jornadaService.js), e os nomes abaixo
 * precisam casar com os que ele devolve.
 *
 * AREAS_EMPRESA casa com trilha_no.area: e o que liga um passo da trilha a
 * area da empresa que ele constroi.
 */
import {
  RadioButtonUnchecked,
  Adjust,
  HourglassTop,
  ErrorOutline,
  CheckCircle,
  Lock,
  PlayCircle,
  TaskAlt,
  ReportProblemOutlined,
  GroupsOutlined,
  PublicOutlined,
  WidgetsOutlined,
  AccountTreeOutlined,
  CampaignOutlined,
  ShowChartOutlined,
  PaymentsOutlined,
} from "@mui/icons-material"

// ---------------------------------------------------------------------------
// Estados do PASSO (derivados de entrega + avaliacao).
// Um unico mapa: rotulo, cor, icone. Toda a UI consome daqui.
// ---------------------------------------------------------------------------
export const STATUS_PASSO = {
  NAO_INICIADA: { label: "A construir", cor: "#94a3b8", icon: RadioButtonUnchecked },
  RASCUNHO: { label: "Em obra", cor: "#6366f1", icon: Adjust },
  AGUARDANDO: { label: "Aguardando mentor", cor: "#f59e0b", icon: HourglassTop },
  AJUSTE: { label: "Precisa de ajuste", cor: "#f97316", icon: ErrorOutline },
  APROVADO: { label: "Construido", cor: "#22c55e", icon: CheckCircle },
}

// Estados do ESTAGIO.
export const STATUS_ESTAGIO = {
  BLOQUEADO: { label: "Bloqueado", cor: "#94a3b8", icon: Lock },
  EM_ANDAMENTO: { label: "Em andamento", cor: "#6366f1", icon: PlayCircle },
  CONCLUIDO: { label: "Concluido", cor: "#22c55e", icon: TaskAlt },
}

// Ordem dos estados considerados "entregues" (contam no progresso).
export const STATUS_CONCLUIDO = ["APROVADO"]
// Estados que ja tiveram alguma acao do incubado (nao estao mais zerados).
export const STATUS_INICIADO = ["RASCUNHO", "AGUARDANDO", "AJUSTE", "APROVADO"]

// ---------------------------------------------------------------------------
// Areas do "Blueprint" da empresa. E o eixo da SUBSTANCIA: a empresa vai
// ganhando forma conforme os passos (que apontam para uma area) sao aprovados.
// Cada passo tem um campo `area` que casa com um destes nomes.
// ---------------------------------------------------------------------------
export const AREAS_EMPRESA = [
  { nome: "Problema", icon: ReportProblemOutlined },
  { nome: "Cliente", icon: GroupsOutlined },
  { nome: "Mercado", icon: PublicOutlined },
  { nome: "Produto", icon: WidgetsOutlined },
  { nome: "Modelo", icon: AccountTreeOutlined },
  { nome: "Go-to-market", icon: CampaignOutlined },
  { nome: "Tracao", icon: ShowChartOutlined },
  { nome: "Financas", icon: PaymentsOutlined },
]

// Estado visual de uma area do Blueprint.
export const STATUS_AREA = {
  VAZIA: { label: "A construir", cor: "#94a3b8" }, // nenhum passo aprovado
  EM_OBRA: { label: "Em obra", cor: "#6366f1" }, // parte aprovada
  CONSTRUIDA: { label: "Construida", cor: "#22c55e" }, // tudo aprovado
}
