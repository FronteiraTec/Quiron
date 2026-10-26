/**
 * Analise SWOT guiada, no desenho classico da matriz 2x2.
 *
 * Quatro quadrantes — Forcas e Fraquezas (internos) em cima, Oportunidades e
 * Ameacas (externos) embaixo —, cada um com uma faixa colorida voltada para o
 * eixo do meio e um losango com a letra (S, W, O, T) apontando para o centro
 * da matriz. Cada quadrante tem pergunta-guia, exemplos no placeholder, ajuda
 * contextual (popover), contador de caracteres e salvamento automatico, como
 * o Canvas.
 *
 * Cores: as quatro do logo EMPREENDE UFFS, ajustadas a aparencia como os
 * cabecalhos do 5W2H — no claro, a faixa e a cor viva com o texto de maior
 * contraste; no escuro, um tom escuro da cor com a letra acesa. O corpo vazio
 * leva um veu da cor do quadrante; respondido, fica no papel limpo.
 *
 * API: GET /startups/:id/swot e PUT /startups/:id/swot/:quadrante.
 */
import { useMemo, useState } from "react"
import { Alert, Box, IconButton, InputBase, LinearProgress, Popover, Skeleton, Typography, useTheme } from "@mui/material"
import { alpha } from "@mui/material/styles"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import TipsAndUpdatesOutlinedIcon from "@mui/icons-material/TipsAndUpdatesOutlined"
import { motion } from "framer-motion"
import { FONTES, paletaDaCor } from "../../../theme"
import { EIXOS_SWOT, QUADRANTES_SWOT } from "./swotConfig"
import { ConteudoAjuda, IndicadorAutoSave, StatusBloco } from "./comum"
import { useBlocosAutoSave } from "./useBlocosAutoSave"

const FORMATO_API = { lista: "quadrantes", campo: "quadrante", erroCarregar: "Erro ao carregar a análise SWOT." }

// Geometria da matriz (telas medias para cima). O losango e um quadrado
// girado com o centro no canto interno da faixa e meia-diagonal igual a altura
// dela: a ponta de fora fica na linha da faixa e a de baixo (ou de cima) cai
// exatamente na outra borda da faixa — a faixa "vira" uma seta para o centro.
// O vao entre as colunas cabe as duas pontas, com folga entre elas.
const FAIXA = 48
const MEIA_DIAGONAL = FAIXA
const LADO_LOSANGO = MEIA_DIAGONAL * Math.SQRT2
const VAO_COLUNAS = 2 * MEIA_DIAGONAL + 16
// Espaco que a metade do losango ocupa dentro do quadrante, mais um respiro.
const RECUO_LOSANGO = `${MEIA_DIAGONAL + 10}px`

const GRADE_SX = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
  columnGap: { md: `${VAO_COLUNAS}px` },
  rowGap: { xs: 2, md: 3 },
}

/**
 * Cores de um quadrante na aparencia atual. `fundo` vale para a faixa e para o
 * losango — os dois precisam ser a MESMA cor solida para formar uma peca so,
 * por isso o veu do escuro vai como gradiente sobre o papel, e nao translucido.
 */
function estiloQuadrante(cor, escuro) {
  const paleta = paletaDaCor(cor, escuro)
  const comum = { contorno: alpha(paleta.main, 0.3), foco: alpha(paleta.main, 0.6) }
  if (escuro) {
    const veu = alpha(paleta.main, 0.3)
    return {
      ...comum,
      fundo: { bgcolor: "background.paper", backgroundImage: `linear-gradient(${veu}, ${veu})` },
      texto: "text.primary",
      ingles: paleta.main,
      letra: paleta.main,
      selo: { bgcolor: paleta.main, color: paleta.contrastText },
      // No escuro, a cor crua some sobre o preto: o veu sai do `main` clareado.
      veu: alpha(paleta.main, 0.1),
      veuForte: alpha(paleta.main, 0.17),
    }
  }
  return {
    ...comum,
    fundo: { bgcolor: paleta.vivo },
    texto: paleta.vivoContraste,
    ingles: alpha(paleta.vivoContraste, 0.75),
    letra: paleta.vivoContraste,
    selo: { bgcolor: paleta.vivoContraste, color: paleta.vivo },
    // No claro, o veu sai da cor crua: pastel, como os post-its do 5W2H.
    veu: alpha(cor, 0.13),
    veuForte: alpha(cor, 0.22),
  }
}

export default function AnaliseSwot({ idStartup }) {
  const { blocos, statusBlocos, carregando, aviso, setAviso, aoDigitar, aoSairDoCampo, salvando, comErro } =
    useBlocosAutoSave(`/startups/${idStartup}/swot`, FORMATO_API)
  const [ajuda, setAjuda] = useState(null) // { ancora, quadrante }
  const escuro = useTheme().palette.mode === "dark"

  const estilos = useMemo(
    () => Object.fromEntries(QUADRANTES_SWOT.map((q) => [q.chave, estiloQuadrante(q.cor, escuro)])),
    [escuro]
  )
  const preenchidos = QUADRANTES_SWOT.filter((q) => (blocos[q.chave] || "").trim().length > 0).length
  const progresso = Math.round((preenchidos / QUADRANTES_SWOT.length) * 100)

  if (carregando) return <SwotSkeleton />

  const quadranteAjuda = ajuda ? QUADRANTES_SWOT.find((q) => q.chave === ajuda.quadrante) : null

  return (
    <Box>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {/* Cabecalho: progresso + status do salvamento automatico */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="body2" fontWeight={600}>
              Análise preenchida · {preenchidos} de {QUADRANTES_SWOT.length} quadrantes
            </Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {progresso}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progresso}
            sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.primary.main, 0.1) }}
          />
        </Box>
        <IndicadorAutoSave salvando={salvando} comErro={comErro} />
      </Box>

      {/* Legenda dos dois eixos da matriz */}
      <Box sx={{ display: "flex", gap: { xs: 0.5, sm: 3 }, flexWrap: "wrap", mb: 2.5 }}>
        {EIXOS_SWOT.map((e) => (
          <Typography key={e.nome} variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
              {e.nome} ({e.letras})
            </Box>
            , {e.detalhe}
          </Typography>
        ))}
      </Box>

      <Box sx={GRADE_SX}>
        {QUADRANTES_SWOT.map((q, i) => (
          <QuadranteSwot
            key={q.chave}
            quadrante={q}
            indice={i}
            estilo={estilos[q.chave]}
            valor={blocos[q.chave] || ""}
            status={statusBlocos[q.chave]}
            onDigitar={aoDigitar}
            onSair={aoSairDoCampo}
            onAjuda={(ancora) => setAjuda({ ancora, quadrante: q.chave })}
          />
        ))}
      </Box>

      {/* Ponte para o proximo modelo */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 2.5, color: "text.secondary" }}>
        <TipsAndUpdatesOutlinedIcon sx={{ fontSize: 18, color: "primary.main", mt: 0.1 }} />
        <Typography variant="caption" sx={{ lineHeight: 1.6 }}>
          Próximo passo: leve as fraquezas e ameaças mais sérias para a Matriz GUT e descubra o que atacar primeiro.
        </Typography>
      </Box>

      {/* Ajuda contextual do quadrante */}
      <Popover
        open={Boolean(ajuda)}
        anchorEl={ajuda?.ancora}
        onClose={() => setAjuda(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { maxWidth: 360, p: 2.5, borderRadius: 3 } } }}
      >
        {quadranteAjuda && <ConteudoAjuda bloco={quadranteAjuda} />}
      </Popover>
    </Box>
  )
}

/**
 * Um quadrante: a faixa (titulo + losango) e o corpo (pergunta, texto, rodape).
 * Nas telas medias para cima, a linha de cima tem a faixa embaixo e a de baixo
 * tem a faixa em cima — as quatro faixas se encontram no eixo do meio, como no
 * desenho classico. Na tela estreita, uma coluna so, sempre com a faixa em cima.
 */
function QuadranteSwot({ quadrante, indice, estilo, valor, status, onDigitar, onSair, onAjuda }) {
  const emCima = indice < 2
  const internoDireita = indice % 2 === 0 // coluna da esquerda: o centro fica a direita
  const preenchido = valor.trim().length > 0
  const recuoInterno = internoDireita ? "pr" : "pl"

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: indice * 0.05 }}
      sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <FaixaSwot
        quadrante={quadrante}
        estilo={estilo}
        emCima={emCima}
        internoDireita={internoDireita}
        onAjuda={onAjuda}
      />

      <Box
        sx={{
          order: { xs: 1, md: emCima ? 0 : 1 },
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          bgcolor: "background.paper",
          // Vazio, o quadrante fica com o veu da cor; respondido, papel limpo.
          backgroundImage: preenchido ? "none" : `linear-gradient(${estilo.veu}, ${estilo.veu})`,
          boxShadow: `inset 0 0 0 1px ${estilo.contorno}`,
          transition: "box-shadow .15s ease",
          "&:hover": preenchido ? {} : { backgroundImage: `linear-gradient(${estilo.veuForte}, ${estilo.veuForte})` },
          "&:focus-within": { boxShadow: `inset 0 0 0 2px ${estilo.foco}` },
        }}
      >
        {/* Na linha de baixo o losango desce sobre o topo do corpo: a pergunta recua. */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            px: 2,
            pt: 1.5,
            lineHeight: 1.5,
            ...(!emCima && { [recuoInterno]: { md: RECUO_LOSANGO }, minHeight: { md: MEIA_DIAGONAL } }),
          }}
        >
          {quadrante.pergunta}
        </Typography>

        <InputBase
          multiline
          minRows={6}
          fullWidth
          value={valor}
          placeholder={quadrante.placeholder}
          inputProps={{ "aria-label": quadrante.titulo }}
          onChange={(e) => onDigitar(quadrante.chave, e.target.value)}
          onBlur={(e) => onSair(quadrante.chave, e.target.value)}
          sx={{
            px: 2,
            py: 1,
            flex: 1,
            alignItems: "flex-start",
            fontSize: 13.5,
            lineHeight: 1.65,
            "& textarea::placeholder": { fontSize: 12.5, opacity: 0.65 },
          }}
        />

        {/* Na linha de cima o losango sobe sobre o pe do corpo: o rodape recua. */}
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            pb: 1,
            ...(emCima && { [recuoInterno]: { md: RECUO_LOSANGO }, minHeight: { md: MEIA_DIAGONAL } }),
          }}
        >
          <Typography variant="caption" color="text.disabled">
            {valor.length > 0 ? `${valor.length} caracteres` : " "}
          </Typography>
          <StatusBloco status={status} />
        </Box>
      </Box>
    </Box>
  )
}

function FaixaSwot({ quadrante, estilo, emCima, internoDireita, onAjuda }) {
  const recuoInterno = internoDireita ? "pr" : "pl"
  // O centro do losango e o canto interno da faixa, na borda que encosta no corpo.
  const centroLosango = {
    display: { xs: "none", md: "block" },
    position: "absolute",
    top: emCima ? 0 : "100%",
    left: internoDireita ? "100%" : 0,
  }

  return (
    <Box
      sx={{
        order: { xs: 0, md: emCima ? 1 : 0 },
        position: "relative",
        minHeight: FAIXA,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        [recuoInterno]: { md: RECUO_LOSANGO },
        justifyContent: { xs: "flex-start", md: internoDireita ? "flex-start" : "flex-end" },
        color: estilo.texto,
        ...estilo.fundo,
      }}
    >
      {/* Tela estreita: sem o vao do meio, a letra vai num selo dentro da faixa. */}
      <Box
        aria-hidden
        sx={{
          display: { xs: "grid", md: "none" },
          placeItems: "center",
          width: 30,
          height: 30,
          flexShrink: 0,
          clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
          fontFamily: FONTES.titulo,
          fontSize: 15,
          lineHeight: 1,
          ...estilo.selo,
        }}
      >
        {quadrante.letra}
      </Box>

      <Typography variant="h5" component="h3" sx={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
        {quadrante.titulo}
      </Typography>
      {/* Numa faixa estreita, o nome em ingles e o que cede (reticencias), para a ajuda nao sair da faixa. */}
      <Typography variant="overline" noWrap sx={{ fontSize: 10, lineHeight: 1.3, mt: "3px", minWidth: 0, color: estilo.ingles }}>
        {quadrante.ingles}
      </Typography>
      <IconButton
        size="small"
        aria-label={`Ajuda sobre ${quadrante.titulo}`}
        onClick={(e) => onAjuda(e.currentTarget)}
        sx={{ color: "inherit", opacity: 0.7, p: 0.5, flexShrink: 0, "&:hover": { opacity: 1 } }}
      >
        <HelpOutlineIcon sx={{ fontSize: 17 }} />
      </IconButton>

      {/* O losango (mesma cor da faixa) e a letra por cima, sem girar. */}
      <Box
        aria-hidden
        sx={{
          ...centroLosango,
          width: LADO_LOSANGO,
          height: LADO_LOSANGO,
          transform: "translate(-50%, -50%) rotate(45deg)",
          zIndex: 1,
          ...estilo.fundo,
        }}
      />
      <Box
        aria-hidden
        sx={{
          ...centroLosango,
          transform: "translate(-50%, -50%)",
          zIndex: 2,
          fontFamily: FONTES.titulo,
          fontSize: 38,
          lineHeight: 1,
          color: estilo.letra,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {quadrante.letra}
      </Box>
    </Box>
  )
}

function SwotSkeleton() {
  return (
    <Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        <Skeleton variant="rounded" height={32} sx={{ flex: 1 }} />
        <Skeleton variant="rounded" height={32} width={160} />
      </Box>
      <Box sx={GRADE_SX}>
        {QUADRANTES_SWOT.map((q) => (
          <Skeleton key={q.chave} variant="rectangular" height={260} />
        ))}
      </Box>
    </Box>
  )
}
