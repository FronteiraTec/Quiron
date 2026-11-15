/**
 * O cartao de uma oportunidade no kanban.
 *
 * Responde, sem abrir nada, as perguntas de quem passa o olho no funil: de quem
 * e a venda, quanto vale, quem cuida, o que vem a seguir — e se algo esta
 * atrasado. "Sem proxima tarefa" aparece de proposito: negociacao sem proximo
 * passo e negociacao esfriando.
 *
 * Para quem nao arrasta (teclado, toque), o menu "..." faz o mesmo que o
 * arrasto: mover de etapa, ganhar, perder.
 */
import { useState } from "react"
import { Box, Divider, IconButton, ListSubheader, Menu, MenuItem, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Business, EmojiEventsOutlined, EventBusy, MoreHoriz, Person, ThumbDownAltOutlined, WarningAmberOutlined } from "@mui/icons-material"
import { AvatarResponsavel } from "../tarefas/MarcadoresTarefa"
import { VencimentoTarefa } from "./MarcadoresCrm"
import { dataBR, diasDesde, hojeISO, moeda } from "../../data/crmMeta"

function descrever(op) {
  const partes = [op.titulo, `cliente ${op.cliente_nome}`]
  if (op.valor_estimado !== null) partes.push(`valor estimado ${moeda(op.valor_estimado)}`)
  partes.push(op.responsavel_nome ? `responsável ${op.responsavel_nome}` : "sem responsável")
  if (op.tarefas_atrasadas) partes.push(`${op.tarefas_atrasadas} tarefa(s) atrasada(s)`)
  return partes.join(", ")
}

export default function CartaoOportunidade({
  op,
  arrastavel = false,
  arrastando = false,
  onDragStart,
  onDragEnd,
  onAbrir,
  etapas = [],
  onMoverPara,
  onGanhar,
  onPerder,
}) {
  const [ancora, setAncora] = useState(null)
  const aberta = op.situacao === "ABERTA"
  const previsaoVencida = aberta && op.previsao_fechamento && op.previsao_fechamento < hojeISO()
  const dias = aberta ? diasDesde(op.etapa_ts) : null
  const valor = op.situacao === "GANHA" ? op.valor_vendido : op.valor_estimado
  const IconeCliente = op.cliente_tipo_pessoa === "PJ" ? Business : Person

  const escolher = (fn) => () => {
    setAncora(null)
    fn()
  }

  return (
    <Box
      draggable={arrastavel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sx={{
        position: "relative",
        mb: 1,
        borderRadius: 1,
        border: 1,
        borderColor: op.tarefas_atrasadas ? (t) => alpha(t.palette.error.main, 0.45) : "divider",
        bgcolor: "background.paper",
        opacity: arrastando ? 0.4 : 1,
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": { borderColor: "text.disabled", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)" },
        "& .acoes-cartao": { opacity: ancora ? 1 : 0 },
        "&:hover .acoes-cartao, &:focus-within .acoes-cartao": { opacity: 1 },
        "@media (hover: none)": { "& .acoes-cartao": { opacity: 1 } },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-label={descrever(op)}
        onClick={onAbrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onAbrir?.()
          }
        }}
        sx={{
          p: 1.5,
          borderRadius: "inherit",
          cursor: arrastavel ? "grab" : "pointer",
          "&:active": { cursor: arrastavel ? "grabbing" : "pointer" },
          outline: "none",
          "&:focus-visible": { boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}` },
        }}
      >
        <Typography
          variant="body2"
          fontWeight={700}
          sx={{
            pr: 3.5,
            fontSize: "0.9rem",
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {op.titulo}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, minWidth: 0 }}>
          <IconeCliente sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} aria-hidden />
          <Typography variant="caption" color="text.secondary" noWrap>
            {op.cliente_nome}
          </Typography>
        </Box>

        <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75, fontVariantNumeric: "tabular-nums" }}>
          {valor !== null && valor !== undefined ? moeda(valor) : (
            <Box component="span" sx={{ color: "text.secondary", fontWeight: 500 }}>
              Sem valor estimado
            </Box>
          )}
        </Typography>

        {aberta && (
          <Box sx={{ mt: 0.75, minHeight: 20 }}>
            {op.proxima_tarefa_titulo ? (
              <Tooltip title={`Próxima tarefa: ${op.proxima_tarefa_titulo}`}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                  <VencimentoTarefa tarefa={{ vencimento_ts: op.proxima_tarefa_vencimento, status: "PENDENTE" }} />
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                    {op.proxima_tarefa_titulo}
                  </Typography>
                </Box>
              </Tooltip>
            ) : (
              <Typography variant="caption" sx={{ color: (t) => (t.palette.mode === "dark" ? "#fbbf24" : "#b45309"), display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <WarningAmberOutlined sx={{ fontSize: 14 }} aria-hidden />
                Sem próxima tarefa
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mt: 1 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            {op.tarefas_atrasadas > 0 && (
              <Typography
                variant="caption"
                fontWeight={700}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.25,
                  color: "error.main",
                  px: 0.75,
                  borderRadius: 0.5,
                  bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.2 : 0.1),
                }}
              >
                <EventBusy sx={{ fontSize: 13 }} aria-hidden />
                {op.tarefas_atrasadas} atrasada{op.tarefas_atrasadas > 1 ? "s" : ""}
              </Typography>
            )}
            {previsaoVencida && (
              <Tooltip title={`Previsão de fechamento: ${dataBR(op.previsao_fechamento)}`}>
                <Typography variant="caption" fontWeight={600} sx={{ color: "error.main" }}>
                  Previsão vencida
                </Typography>
              </Tooltip>
            )}
            {!aberta && op.fechamento_dt && (
              <Typography variant="caption" color="text.secondary">
                {op.situacao === "GANHA" ? "Fechada" : "Perdida"} em {dataBR(op.fechamento_dt)}
              </Typography>
            )}
            {aberta && dias !== null && !op.tarefas_atrasadas && !previsaoVencida && (
              <Typography variant="caption" color="text.secondary">
                {dias === 0 ? "Entrou hoje na etapa" : `Há ${dias} dia${dias > 1 ? "s" : ""} na etapa`}
              </Typography>
            )}
          </Box>
          <AvatarResponsavel nome={op.responsavel_nome} foto={op.responsavel_foto} tamanho={22} />
        </Box>
      </Box>

      {aberta && (onMoverPara || onGanhar || onPerder) && (
        <>
          <IconButton
            className="acoes-cartao"
            size="small"
            aria-label={`Ações de "${op.titulo}"`}
            aria-haspopup="menu"
            onClick={(e) => setAncora(e.currentTarget)}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            sx={{ position: "absolute", top: 6, right: 6, transition: "opacity .15s" }}
          >
            <MoreHoriz fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={ancora}
            open={Boolean(ancora)}
            onClose={() => setAncora(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            MenuListProps={{ dense: true }}
          >
            <ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>Mover para</ListSubheader>
            {etapas
              .filter((e) => e.id_etapa !== op.id_etapa)
              .map((e) => (
                <MenuItem key={e.id_etapa} onClick={escolher(() => onMoverPara(e))}>
                  <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: e.cor, mr: 1.25, flexShrink: 0 }} />
                  {e.nome}
                </MenuItem>
              ))}
            <Divider />
            <MenuItem onClick={escolher(onGanhar)}>
              <EmojiEventsOutlined fontSize="small" sx={{ mr: 1, color: "success.main" }} />
              Marcar como ganha
            </MenuItem>
            <MenuItem onClick={escolher(onPerder)}>
              <ThumbDownAltOutlined fontSize="small" sx={{ mr: 1, color: "error.main" }} />
              Marcar como perdida
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  )
}
