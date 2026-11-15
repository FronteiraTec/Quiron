/**
 * Os marcadores do Mini CRM: situacao da oportunidade, status do cliente e da
 * tarefa, e o prazo da tarefa.
 *
 * Reaproveitam o desenho dos marcadores do quadro de tarefas (StatusTarefa: o
 * ponto na cor, o rotulo em cor de TEXTO) para o CRM ler como o resto do
 * sistema. A cor nunca anda sozinha: sempre vem com o rotulo, e o atraso vem
 * tambem com icone.
 */
import { Box, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Event, EventBusy, Schedule } from "@mui/icons-material"
import { StatusTarefa } from "../tarefas/MarcadoresTarefa"
import { SITUACAO, STATUS_CLIENTE, STATUS_TAREFA, dataHoraBR, situacaoVencimento } from "../../data/crmMeta"

export function SituacaoOportunidade({ situacao, etapa, cor, sx }) {
  // Aberta, o que interessa e a etapa; encerrada, o desfecho.
  if (situacao === "ABERTA" && etapa) return <StatusTarefa rotulo={etapa} cor={cor} sx={sx} />
  const meta = SITUACAO[situacao] || SITUACAO.ABERTA
  return <StatusTarefa rotulo={meta.rotulo} cor={meta.cor} sx={sx} />
}

export function StatusCliente({ status, sx }) {
  const meta = STATUS_CLIENTE[status] || STATUS_CLIENTE.LEAD
  return <StatusTarefa rotulo={meta.rotulo} cor={meta.cor} sx={sx} />
}

export function StatusTarefaCrm({ status, sx }) {
  const meta = STATUS_TAREFA[status] || STATUS_TAREFA.PENDENTE
  return <StatusTarefa rotulo={meta.rotulo} cor={meta.cor} sx={sx} />
}

/** Ambar legivel como texto nos dois temas (o mesmo do quadro de tarefas). */
const corAtencao = (t) => (t.palette.mode === "dark" ? "#fbbf24" : "#b45309")

/**
 * O prazo da tarefa com o peso do momento: atrasada em vermelho com fundo e
 * icone, hoje/amanha em ambar, o resto em cinza.
 */
export function VencimentoTarefa({ tarefa, mostrarVazio = false }) {
  const s = situacaoVencimento(tarefa)
  if (s.tipo === "sem-prazo") {
    return mostrarVazio ? (
      <Typography variant="caption" color="text.secondary">
        Sem prazo
      </Typography>
    ) : null
  }
  const atrasada = s.tipo === "atrasada"
  const atencao = s.tipo === "hoje" || s.tipo === "amanha" || s.tipo === "proxima"
  const Icone = atrasada ? EventBusy : atencao ? Schedule : Event
  const cor = atrasada ? "error.main" : atencao ? corAtencao : "text.secondary"

  return (
    <Tooltip title={`Prazo: ${dataHoraBR(tarefa.vencimento_ts)}`}>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          color: cor,
          whiteSpace: "nowrap",
          ...(atrasada && {
            px: 0.75,
            py: 0.125,
            borderRadius: 0.5,
            bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.2 : 0.1),
          }),
        }}
      >
        <Icone sx={{ fontSize: 14 }} aria-hidden />
        <Typography component="span" variant="caption" fontWeight={atrasada || atencao ? 700 : 500} sx={{ lineHeight: 1.4 }}>
          {s.rotulo}
        </Typography>
      </Box>
    </Tooltip>
  )
}
