/**
 * O PDF desenhado na propria tela, pagina por pagina (pdf.js).
 *
 * POR QUE NAO UM <iframe> DO BLOB: o CSP da borda (proxy/Caddyfile) tem
 * `default-src 'self'` e `object-src 'none'` — um iframe de `blob:` e barrado,
 * e o visualizador nativo do navegador e um plugin que o `object-src` recusa.
 * O pdf.js desenha em <canvas>, com o worker servido pelo proprio Quiron
 * (o `?url` do Vite), e nao depende de nenhuma das duas excecoes.
 *
 * As paginas so sao desenhadas quando entram na tela: um PDF de 80 paginas
 * abre na primeira, e nao depois de rasterizar as 80.
 */
import { useEffect, useRef, useState } from "react"
import { Alert, Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material"
import { ZoomIn, ZoomOut, FitScreen } from "@mui/icons-material"
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist"
import urlDoWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

GlobalWorkerOptions.workerSrc = urlDoWorker

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3

export default function PreviaPdf({ blob }) {
  const [pdf, setPdf] = useState(null)
  const [erro, setErro] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [largura, setLargura] = useState(0)
  const [larguraPagina, setLarguraPagina] = useState(null) // da 1a pagina, a escala 1
  const rolagem = useRef(null)

  useEffect(() => {
    let cancelado = false
    setPdf(null)
    setErro(null)
    let carregamento = null
    blob
      .arrayBuffer()
      .then((bytes) => {
        if (cancelado) return null
        // WebAssembly fica de fora: o CSP nao tem 'wasm-unsafe-eval'. So
        // decodifica mais devagar um tipo raro de imagem (JPEG 2000).
        carregamento = getDocument({ data: new Uint8Array(bytes), useWasm: false })
        return carregamento.promise
      })
      .then(async (doc) => {
        if (!doc || cancelado) return
        const primeira = await doc.getPage(1)
        if (cancelado) return
        setLarguraPagina(primeira.getViewport({ scale: 1 }).width)
        setPdf(doc)
      })
      .catch(() => !cancelado && setErro("Não foi possível ler este PDF. Baixe o arquivo para abri-lo no seu computador."))
    return () => {
      cancelado = true
      carregamento?.destroy()
    }
  }, [blob])

  // A escala acompanha a largura disponivel: "ajustar a largura" e o zoom 1.
  useEffect(() => {
    const el = rolagem.current
    if (!el) return undefined
    const medir = () => setLargura(el.clientWidth)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  const escala = larguraPagina && largura ? (Math.min(largura - 32, 1000) / larguraPagina) * zoom : null

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1.5,
          py: 0.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {pdf ? `${pdf.numPages} ${pdf.numPages === 1 ? "página" : "páginas"}` : ""}
        </Typography>
        <Tooltip title="Diminuir">
          <span>
            <IconButton size="small" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.25))} disabled={zoom <= ZOOM_MIN}>
              <ZoomOut fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ minWidth: 40, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </Typography>
        <Tooltip title="Aumentar">
          <span>
            <IconButton size="small" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.25))} disabled={zoom >= ZOOM_MAX}>
              <ZoomIn fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Ajustar à largura">
          <IconButton size="small" onClick={() => setZoom(1)}>
            <FitScreen fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box ref={rolagem} sx={{ flex: 1, overflow: "auto", bgcolor: "action.hover", py: 2 }}>
        {erro ? (
          <Alert severity="warning" sx={{ m: 2 }}>
            {erro}
          </Alert>
        ) : !pdf || !escala ? (
          <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          Array.from({ length: pdf.numPages }, (_, i) => (
            <Pagina key={i} pdf={pdf} numero={i + 1} escala={escala} raiz={rolagem.current} />
          ))
        )}
      </Box>
    </Box>
  )
}

/** Uma pagina: reserva o espaco, e so desenha quando aparece. */
function Pagina({ pdf, numero, escala, raiz }) {
  const caixa = useRef(null)
  const canvas = useRef(null)
  const [pagina, setPagina] = useState(null)
  const [visivel, setVisivel] = useState(numero <= 2)

  useEffect(() => {
    let cancelado = false
    pdf.getPage(numero).then((p) => !cancelado && setPagina(p)).catch(() => {})
    return () => {
      cancelado = true
    }
  }, [pdf, numero])

  useEffect(() => {
    const el = caixa.current
    if (!el || visivel) return undefined
    const observador = new IntersectionObserver(
      (entradas) => entradas.some((e) => e.isIntersecting) && setVisivel(true),
      { root: raiz, rootMargin: "600px 0px" }
    )
    observador.observe(el)
    return () => observador.disconnect()
  }, [raiz, visivel])

  const viewport = pagina?.getViewport({ scale: escala })

  useEffect(() => {
    if (!pagina || !visivel || !canvas.current) return undefined
    // O canvas tem a densidade da tela: sem isso, o texto sai borrado no
    // monitor de alta resolucao.
    const densidade = window.devicePixelRatio || 1
    const vp = pagina.getViewport({ scale: escala * densidade })
    const el = canvas.current
    el.width = Math.floor(vp.width)
    el.height = Math.floor(vp.height)
    const tarefa = pagina.render({ canvas: el, viewport: vp })
    tarefa.promise.catch(() => {}) // cancelada pelo zoom seguinte: nada a fazer
    return () => tarefa.cancel()
  }, [pagina, visivel, escala])

  return (
    <Box
      ref={caixa}
      sx={{
        mx: "auto",
        mb: 2,
        width: viewport ? viewport.width : "min(100%, 600px)",
        height: viewport ? viewport.height : 800,
        bgcolor: "#fff",
        boxShadow: 2,
        position: "relative",
      }}
    >
      <canvas
        ref={canvas}
        aria-label={`Página ${numero}`}
        style={{ width: "100%", height: "100%", display: visivel ? "block" : "none" }}
      />
    </Box>
  )
}
