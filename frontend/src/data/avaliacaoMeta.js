/**
 * Metadados da avaliacao de entregas (rotulos, cores e icones).
 *
 * Mesma ideia do jornadaMeta, do outro lado do balcao: la o incubado ve o
 * estado do SEU passo ("Aguardando mentor"), aqui o mentor ve o estado da fila
 * ("Aguardando voce"). As cores sao as mesmas de proposito — o amarelo que o
 * incubado ve como "esperando" e o mesmo que puxa o olho do mentor.
 *
 * SITUACAO casa com o campo `situacao` derivado no backend
 * (entregaService.comSituacao): a ultima avaliacao, ou PENDENTE quando ainda
 * nao ha nenhuma.
 */
import {
  HourglassTop,
  CheckCircle,
  ErrorOutline,
  Cancel,
} from "@mui/icons-material"

export const SITUACAO = {
  PENDENTE: { label: "Aguardando voce", cor: "#f59e0b", icon: HourglassTop },
  APROVADO: { label: "Aprovado", cor: "#22c55e", icon: CheckCircle },
  AJUSTE: { label: "Ajuste pedido", cor: "#f97316", icon: ErrorOutline },
  REPROVADO: { label: "Reprovado", cor: "#ef4444", icon: Cancel },
}

/**
 * As tres decisoes que o mentor pode registrar, na ordem em que aparecem no
 * painel. "Pedir ajuste" no meio: e a devolutiva mais comum e a que mantem a
 * conversa aberta, entao nao fica escondida na ponta.
 */
export const DECISOES = [
  { valor: "APROVADO", label: "Aprovar", ajuda: "A entrega atende ao que o passo pedia." },
  { valor: "AJUSTE", label: "Pedir ajuste", ajuda: "Volta para a startup corrigir e reenviar." },
  { valor: "REPROVADO", label: "Reprovar", ajuda: "A entrega nao atende e nao sera retomada agora." },
]
