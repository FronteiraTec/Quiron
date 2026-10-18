/**
 * Marca do Quiron: o centauro (logo) e o nome em Anton.
 *
 * O logo original (assets/logo.svg) e um centauro #121212 com os detalhes —
 * musculos, crina, a corda do arco — desenhados em branco por cima. Ele so
 * existe "positivo": sobre preto, some. Em vez de manter uma copia do arquivo
 * por combinacao, LogoQuiron troca as duas cores no proprio SVG. Os detalhes
 * devem ter a cor do fundo, para lerem como recorte.
 */
import { Box, Typography } from "@mui/material"
import logoBruto from "../../assets/logo.svg?raw"
import { FONTES, MARCA } from "../../theme"

const COR_ORIGINAL = "#121212"
const DETALHE_ORIGINAL = "#ffffff"

// Uma URL por combinacao de cores: o SVG tem ~38 KB, e codifica-lo a cada
// render seria desperdicio.
const urls = new Map()

function urlDoLogo(cor, detalhe) {
  const chave = `${cor}|${detalhe}`
  if (!urls.has(chave)) {
    // Numa passada so: trocar uma cor e depois a outra misturaria as duas
    // quando o centauro novo e branco, a cor original dos detalhes.
    const svg = logoBruto.replace(/#121212|#ffffff/gi, (achada) =>
      achada.toLowerCase() === COR_ORIGINAL ? cor : detalhe
    )
    urls.set(chave, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  }
  return urls.get(chave)
}

/**
 * O centauro.
 * @param {object} props
 * @param {string} [props.cor] - Cor do centauro.
 * @param {string} [props.detalhe] - Cor dos detalhes: use a cor do fundo.
 * @param {string} [props.alt] - Texto alternativo; vazio quando o nome vem ao lado.
 */
export function LogoQuiron({ cor = COR_ORIGINAL, detalhe = DETALHE_ORIGINAL, alt = "", sx }) {
  return (
    <Box
      component="img"
      src={urlDoLogo(cor, detalhe)}
      alt={alt}
      draggable={false}
      sx={[{ display: "block", flexShrink: 0, userSelect: "none" }, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  )
}

/**
 * Centauro + "QUIRON" em Anton. O padrao e para superficie preta (centauro
 * lima, nome branco); sobre a barra do topo, que pinta na cor escolhida, quem
 * chama passa as cores da barra.
 * @param {object} props
 * @param {number} [props.tamanho] - Altura do centauro, em px; o nome acompanha.
 * @param {string} [props.cor] - Cor do centauro.
 * @param {string} [props.corNome] - Cor do nome.
 * @param {string} [props.fundo] - Cor da superficie (vira a dos detalhes do centauro).
 */
export default function MarcaQuiron({
  tamanho = 30,
  cor = MARCA.lima,
  corNome = MARCA.branco,
  fundo = MARCA.preto,
  sx,
}) {
  return (
    <Box sx={[{ display: "flex", alignItems: "center", gap: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <LogoQuiron cor={cor} detalhe={fundo} sx={{ width: tamanho, height: tamanho }} />
      <Typography
        component="span"
        sx={{
          fontFamily: FONTES.titulo,
          fontSize: Math.round(tamanho * 0.8),
          lineHeight: 1,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: corNome,
        }}
      >
        Quiron
      </Typography>
    </Box>
  )
}
