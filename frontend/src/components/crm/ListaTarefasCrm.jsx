/**
 * Lista compacta de tarefas do CRM — a da oportunidade, a do cliente e a do
 * painel. A caixa de marcar CONCLUI (ou reabre) na hora; clicar no titulo abre
 * a tarefa para editar.
 */
import { Box, Checkbox, Tooltip, Typography } from "@mui/material"
import { AvatarResponsavel, PrioridadeTarefa } from "../tarefas/MarcadoresTarefa"
import { StatusTarefaCrm, VencimentoTarefa } from "./MarcadoresCrm"
import { TAREFA_ABERTA } from "../../data/crmMeta"

export default function ListaTarefasCrm({ tarefas = [], onAbrir, onAlternarConclusao, mostrarVinculo = false, vazio = "Nenhuma tarefa." }) {
  if (tarefas.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
        {vazio}
      </Typography>
    )
  }

  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {tarefas.map((t) => {
        const aberta = TAREFA_ABERTA(t.status)
        const cancelada = t.status === "CANCELADA"
        const vinculo = t.oportunidade_titulo || t.cliente_nome
        return (
          <Box
            component="li"
            key={t.id_tarefa}
            sx={{ display: "flex", alignItems: "flex-start", gap: 0.5, py: 0.75, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
          >
            <Tooltip title={cancelada ? "Cancelada — reabra pelo painel da tarefa" : aberta ? "Concluir" : "Reabrir"}>
              <span>
                <Checkbox
                  size="small"
                  checked={t.status === "CONCLUIDA"}
                  disabled={cancelada || !onAlternarConclusao}
                  onChange={() => onAlternarConclusao?.(t, aberta ? "CONCLUIDA" : "PENDENTE")}
                  inputProps={{ "aria-label": aberta ? `Concluir a tarefa ${t.titulo}` : `Reabrir a tarefa ${t.titulo}` }}
                  sx={{ mt: -0.5 }}
                />
              </span>
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                component="button"
                type="button"
                onClick={() => onAbrir?.(t)}
                sx={{
                  all: "unset",
                  cursor: "pointer",
                  display: "block",
                  maxWidth: "100%",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: aberta ? "none" : "line-through",
                  color: aberta ? "text.primary" : "text.secondary",
                  borderRadius: 0.5,
                  "&:hover": { textDecoration: "underline" },
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                }}
              >
                {t.titulo}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mt: 0.25 }}>
                {aberta ? <VencimentoTarefa tarefa={t} mostrarVazio /> : <StatusTarefaCrm status={t.status} />}
                {aberta && t.prioridade !== "MEDIA" && <PrioridadeTarefa chave={t.prioridade} />}
                {mostrarVinculo && vinculo && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                    {vinculo}
                  </Typography>
                )}
              </Box>
            </Box>
            <Box sx={{ pt: 0.25 }}>
              <AvatarResponsavel nome={t.responsavel_nome} foto={t.responsavel_foto} tamanho={22} />
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
