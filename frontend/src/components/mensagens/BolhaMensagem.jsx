/**
 * Uma bolha da conversa.
 *
 * Duas naturezas na mesma thread, e a diferenca precisa saltar aos olhos:
 *
 *   AVISO    (tem assunto) - nasceu de um envio com destino: "Pitch na sexta",
 *                            mandado para a startup inteira. Mostra o assunto
 *                            em destaque e para quem foi.
 *   RESPOSTA (sem assunto) - fala de conversa, so o texto.
 *
 * As cores saem do tema do usuario (`primary`), nao do verde do WhatsApp: a
 * incubadora escolhe a cor do painel nas preferencias, e uma bolha verde fixa
 * brigaria com ela em metade das telas.
 */
import { alpha } from "@mui/material/styles"
import { Box, Chip, Typography } from "@mui/material"
import { Done, DoneAll, PriorityHigh, Schedule } from "@mui/icons-material"
import { format } from "date-fns"
import { resumirDestinos } from "./destinos"

/** Tique de entrega: um risco = enviada, dois = lida (como no WhatsApp). */
function Tique({ mensagem }) {
  if (mensagem.pendente) return <Schedule sx={{ fontSize: 14, opacity: 0.6 }} />
  if (mensagem.lida_ts) return <DoneAll sx={{ fontSize: 15, color: "info.main" }} />
  return <Done sx={{ fontSize: 15, opacity: 0.6 }} />
}

export default function BolhaMensagem({ mensagem }) {
  const minha = mensagem.minha
  const aviso = Boolean(mensagem.assunto)
  const para = aviso ? resumirDestinos(mensagem.destinos, 2) : ""

  return (
    <Box sx={{ display: "flex", justifyContent: minha ? "flex-end" : "flex-start", px: 1 }}>
      <Box
        sx={{
          maxWidth: { xs: "85%", sm: "70%" },
          minWidth: 120,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          // O "rabinho" da bolha: canto reto do lado de quem falou.
          borderTopRightRadius: minha ? 4 : 16,
          borderTopLeftRadius: minha ? 16 : 4,
          bgcolor: (t) =>
            minha
              ? alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.28 : 0.14)
              : t.palette.mode === "dark"
                ? alpha(t.palette.common.white, 0.06)
                : t.palette.background.paper,
          border: "1px solid",
          borderColor: (t) =>
            minha ? alpha(t.palette.primary.main, 0.25) : t.palette.divider,
          opacity: mensagem.pendente ? 0.7 : 1,
        }}
      >
        {aviso && (
          <Box sx={{ mb: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {mensagem.importante && <PriorityHigh sx={{ fontSize: 15, color: "error.main" }} />}
              <Typography variant="subtitle2" fontWeight={800} sx={{ lineHeight: 1.3 }}>
                {mensagem.assunto}
              </Typography>
            </Box>
            {para && (
              <Chip
                size="small"
                variant="outlined"
                label={minha ? `para ${para}` : `enviado para ${para}`}
                sx={{ height: 20, mt: 0.5, fontSize: 11 }}
              />
            )}
          </Box>
        )}

        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {mensagem.corpo}
        </Typography>

        {/* Hora e tique, alinhados a direita como num app de mensagem. */}
        <Box
          sx={{
            mt: 0.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.5,
            color: "text.disabled",
          }}
        >
          <Typography variant="caption" sx={{ fontSize: 11 }}>
            {format(new Date(mensagem.criado_ts), "HH:mm")}
          </Typography>
          {minha && <Tique mensagem={mensagem} />}
        </Box>
      </Box>
    </Box>
  )
}
