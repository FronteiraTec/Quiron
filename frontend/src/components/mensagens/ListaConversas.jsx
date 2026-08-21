/**
 * A coluna da esquerda: com quem voce fala, ordenado pela conversa mais recente.
 *
 * Cada linha e o que basta para decidir se abre: quem, a ultima fala, quando, e
 * quantas estao por ler. O "Você:" na previa evita a duvida mais comum de quem
 * volta ao chat depois de um tempo — quem falou por ultimo.
 */
import { alpha } from "@mui/material/styles"
import {
  Avatar,
  Badge,
  Box,
  ButtonBase,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material"
import { ForumOutlined, Search } from "@mui/icons-material"
import { format, isThisYear, isToday, isYesterday } from "date-fns"
import { ptBR } from "date-fns/locale"

/** "14:32" hoje, "Ontem", "12/03" no ano, "12/03/25" fora dele. */
function quando(ts) {
  const data = new Date(ts)
  if (isToday(data)) return format(data, "HH:mm")
  if (isYesterday(data)) return "Ontem"
  if (isThisYear(data)) return format(data, "dd/MM", { locale: ptBR })
  return format(data, "dd/MM/yy", { locale: ptBR })
}

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

const PAPEL = { admin: "Administração", mentor: "Mentoria", usuario: "Incubado" }

function Linha({ conversa, ativa, onAbrir }) {
  const naoLidas = conversa.nao_lidas
  // Aviso tem assunto; fala de conversa nao. Na previa, o assunto ganha —
  // "Pitch na sexta" diz mais que a primeira linha do texto.
  const previa = conversa.assunto || conversa.corpo

  return (
    <ButtonBase
      onClick={onAbrir}
      sx={{
        width: "100%",
        px: 2,
        py: 1.5,
        gap: 1.5,
        textAlign: "left",
        alignItems: "center",
        justifyContent: "flex-start",
        borderLeft: "3px solid",
        borderColor: ativa ? "primary.main" : "transparent",
        bgcolor: (t) => (ativa ? alpha(t.palette.primary.main, 0.08) : "transparent"),
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Avatar
        src={conversa.foto_url || undefined}
        sx={{ width: 44, height: 44, fontWeight: 700, flexShrink: 0 }}
      >
        {inicial(conversa.nome)}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography variant="body2" fontWeight={naoLidas ? 800 : 600} noWrap sx={{ flex: 1 }}>
            {conversa.nome}
          </Typography>
          <Typography
            variant="caption"
            sx={{ flexShrink: 0, color: naoLidas ? "primary.main" : "text.disabled", fontWeight: naoLidas ? 700 : 400 }}
          >
            {quando(conversa.criado_ts)}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="caption"
            noWrap
            sx={{ flex: 1, color: naoLidas ? "text.primary" : "text.secondary", fontWeight: naoLidas ? 600 : 400 }}
          >
            {conversa.minha && "Você: "}
            {previa}
          </Typography>
          {naoLidas > 0 && <Badge badgeContent={naoLidas} color="primary" max={99} sx={{ mr: 1.5 }} />}
        </Box>

        {PAPEL[conversa.papel] && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
            {PAPEL[conversa.papel]}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  )
}

export default function ListaConversas({ conversas, carregando, ativa, onAbrir, busca, onBusca, acao }) {
  const filtradas = busca.trim()
    ? conversas.filter((c) =>
        [c.nome, c.assunto, c.corpo]
          .filter(Boolean)
          .some((t) => t.toLowerCase().includes(busca.trim().toLowerCase()))
      )
    : conversas

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ p: 1.5, display: "flex", gap: 1, alignItems: "center" }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar conversa..."
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          InputProps={{
            startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "text.disabled" }} />,
            sx: { borderRadius: 5 },
          }}
        />
        {acao}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {carregando ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <CircularProgress size={22} />
          </Box>
        ) : filtradas.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, px: 3, color: "text.disabled" }}>
            <ForumOutlined sx={{ fontSize: 38, opacity: 0.5 }} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}
            </Typography>
          </Box>
        ) : (
          filtradas.map((c) => (
            <Linha
              key={c.id_usuario}
              conversa={c}
              ativa={ativa === c.id_usuario}
              onAbrir={() => onAbrir(c.id_usuario)}
            />
          ))
        )}
      </Box>
    </Box>
  )
}
