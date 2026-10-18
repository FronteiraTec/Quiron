/**
 * O quadradinho com o icone do formato de um material (PDF, planilha, link,
 * aula...). O mesmo desenho da linha de material da Jornada (PassoConteudo):
 * fundo tingido da cor do formato, icone na cor cheia.
 */
import { Box } from "@mui/material"
import { FORMATOS, formatoDoMaterial } from "../../data/espacoMentorMeta"

export default function IconeFormato({ item, formato, tamanho = 32 }) {
  const chave = formato || formatoDoMaterial(item)
  const meta = FORMATOS[chave] || FORMATOS.ARQUIVO
  const Icone = meta.icone
  return (
    <Box
      aria-hidden
      sx={{
        display: "grid",
        placeItems: "center",
        width: tamanho,
        height: tamanho,
        borderRadius: "4px",
        bgcolor: `${meta.cor}1f`,
        color: meta.cor,
        flexShrink: 0,
      }}
    >
      <Icone sx={{ fontSize: Math.round(tamanho * 0.56) }} />
    </Box>
  )
}
