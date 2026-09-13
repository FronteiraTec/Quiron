/**
 * Render read-only dos blocos de uma AULA no formato ANTIGO.
 *
 * O corpo das aulas passou a ser um documento do editor de blocos, e quem o
 * exibe e o VisualizadorDocumento (components/editor/). A API converte o
 * formato antigo na leitura, entao na pratica toda aula chega ja convertida
 * — este arquivo e a rede de seguranca de PassoConteudo para o caso de o
 * documento vir vazio e os blocos nao.
 *
 * Cobre os oito tipos do enum blocoTipo: titulo, subtitulo, texto, lista,
 * destaque, video, anexo e divisor.
 */
import { Box, Typography, Divider, Link } from "@mui/material"
import { Lightbulb, PlayCircleOutline, InsertDriveFile, OpenInNew } from "@mui/icons-material"
import PlayerYoutube from "../biblioteca/PlayerYoutube"
import { ehYoutube } from "../../utils/youtube"

const CALLOUT = {
  dica: { cor: "#0ea5e9", bg: "#0ea5e914", rotulo: "Dica" },
  atencao: { cor: "#f59e0b", bg: "#f59e0b14", rotulo: "Atenção" },
  sucesso: { cor: "#22c55e", bg: "#22c55e14", rotulo: "Boa prática" },
}

export default function BlocoView({ blocos = [] }) {
  return (
    <Box sx={{ "& > * + *": { mt: 1.25 } }}>
      {blocos.map((b) => (
        <Bloco key={b.id} bloco={b} />
      ))}
    </Box>
  )
}

function Bloco({ bloco }) {
  switch (bloco.tipo) {
    case "h1":
      return (
        <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.25, mt: 2 }}>
          {bloco.texto}
        </Typography>
      )
    case "h2":
      return (
        <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, mt: 1.5 }}>
          {bloco.texto}
        </Typography>
      )
    case "lista":
      return (
        <Box sx={{ display: "flex", gap: 1, pl: 0.5 }}>
          <Box sx={{ color: "text.secondary", lineHeight: 1.7 }}>•</Box>
          <Typography sx={{ fontSize: 15, lineHeight: 1.7 }}>{bloco.texto}</Typography>
        </Box>
      )
    case "callout": {
      const v = CALLOUT[bloco.variante] || CALLOUT.dica
      return (
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            p: 1.75,
            borderRadius: 1.5,
            bgcolor: v.bg,
            border: "1px solid",
            borderColor: `${v.cor}55`,
          }}
        >
          <Lightbulb sx={{ color: v.cor, fontSize: 20, mt: 0.25 }} />
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: v.cor }}>
              {v.rotulo}
            </Typography>
            <Typography sx={{ fontSize: 14, lineHeight: 1.55 }}>{bloco.texto}</Typography>
          </Box>
        </Box>
      )
    }
    // Video da aula: sendo do YouTube (o caso normal, ja que e de la que a
    // incubadora anexa), toca aqui dentro. Qualquer outro endereco continua
    // como cartao de link.
    case "video":
      return ehYoutube(bloco.url) ? (
        <Box sx={{ my: 1.5 }}>
          <PlayerYoutube url={bloco.url} titulo={bloco.nome} />
        </Box>
      ) : (
        <MidiaLink bloco={bloco} icone={<PlayCircleOutline />} rotulo="Vídeo" />
      )
    case "arquivo":
      return <MidiaLink bloco={bloco} icone={<InsertDriveFile />} rotulo="Anexo" />
    case "divisor":
      return <Divider sx={{ my: 1 }} />
    default:
      return <Typography sx={{ fontSize: 15, lineHeight: 1.7 }}>{bloco.texto}</Typography>
  }
}

function MidiaLink({ bloco, icone, rotulo }) {
  const nome = bloco.nome || bloco.url || rotulo
  const conteudo = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "action.hover",
        color: "text.primary",
        transition: "border-color .15s",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <Box sx={{ color: "primary.main", display: "grid", placeItems: "center" }}>{icone}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          {rotulo.toUpperCase()}
        </Typography>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
          {nome}
        </Typography>
      </Box>
      {bloco.url && <OpenInNew sx={{ fontSize: 16, color: "text.disabled" }} />}
    </Box>
  )
  return bloco.url ? (
    <Link href={bloco.url} target="_blank" rel="noopener" underline="none">
      {conteudo}
    </Link>
  ) : (
    conteudo
  )
}
