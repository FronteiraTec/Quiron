/**
 * Uma linha do sino: mensagem interna que alguem enderecou a esta pessoa.
 *
 * O estado de lida vem do servidor (mensagem_destinatario), entao o negrito e
 * o ponto azul refletem o que a pessoa realmente ainda nao abriu — em qualquer
 * aparelho.
 */
import { alpha } from "@mui/material/styles"
import { Avatar, Box, ButtonBase, Typography } from "@mui/material"
import { PriorityHigh } from "@mui/icons-material"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { resumirDestinos } from "../mensagens/destinos"

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

export default function ItemMensagem({ mensagem, onClick }) {
  const quando = formatDistanceToNow(new Date(mensagem.criado_ts), { addSuffix: true, locale: ptBR })
  const para = resumirDestinos(mensagem.destinos)

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        px: 2,
        py: 1.5,
        gap: 1.5,
        textAlign: "left",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        bgcolor: mensagem.lida ? "transparent" : (t) => alpha(t.palette.primary.main, 0.06),
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Avatar
        src={mensagem.remetente_foto || undefined}
        sx={{
          width: 36,
          height: 36,
          flexShrink: 0,
          fontSize: 15,
          fontWeight: 700,
          bgcolor: (t) =>
            mensagem.importante ? alpha(t.palette.error.main, 0.16) : alpha(t.palette.primary.main, 0.14),
          color: mensagem.importante ? "error.main" : "primary.main",
        }}
      >
        {inicial(mensagem.remetente_nome)}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          {mensagem.importante && <PriorityHigh sx={{ fontSize: 15, color: "error.main", flexShrink: 0 }} />}
          <Typography variant="body2" fontWeight={mensagem.lida ? 500 : 700} noWrap>
            {mensagem.assunto}
          </Typography>
        </Box>

        {/* Duas linhas do corpo: o suficiente para decidir se abre agora. */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            whiteSpace: "pre-line",
          }}
        >
          {mensagem.corpo}
        </Typography>

        <Typography variant="caption" color="text.disabled" sx={{ display: "block" }} noWrap>
          {mensagem.remetente_nome || "Alguém"}
          {para ? ` · para ${para}` : ""} · {quando}
        </Typography>
      </Box>

      {!mensagem.lida && (
        <Box sx={{ width: 8, height: 8, mt: 1, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }} />
      )}
    </ButtonBase>
  )
}
