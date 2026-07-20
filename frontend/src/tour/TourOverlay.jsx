/**
 * TourOverlay - camada visual do tour: escurece a tela, ilumina o elemento do
 * passo atual (spotlight) e mostra o card com a explicacao ao lado dele.
 *
 * Fica acima de tudo (inclusive dos Drawers do MUI) e e renderizado em portal
 * no body para nao depender do empilhamento da arvore onde foi montado.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { alpha } from "@mui/material/styles"
import { Box, Button, IconButton, Paper, Typography, Fade } from "@mui/material"
import { Close, ArrowBack, ArrowForward, Check } from "@mui/icons-material"

const Z_INDICE = 1600 // acima do Drawer (1200) e do Modal (1300) do MUI
const LARGURA_CARD = 340
const RESPIRO = 8 // folga entre o alvo e o recorte do spotlight
const ESPACO = 16 // distancia entre o spotlight e o card
const MARGEM = 12 // margem minima do card ate a borda da viewport

/**
 * Retangulo (em coordenadas de viewport) do alvo, ou null se nao houver alvo.
 * Quando o seletor casa com varios elementos, devolve o retangulo que envolve
 * todos eles - e assim que um passo destaca um grupo de campos (ex.: data e
 * hora, que sao campos irmaos no formulario).
 */
function medirAlvo(seletor) {
  if (!seletor) return null
  const rects = [...document.querySelectorAll(seletor)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width || r.height)
  if (!rects.length) return null

  const top = Math.min(...rects.map((r) => r.top))
  const left = Math.min(...rects.map((r) => r.left))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  const right = Math.max(...rects.map((r) => r.right))
  return { top, left, bottom, right, width: right - left, height: bottom - top }
}

function mesmoRect(a, b) {
  if (!a || !b) return a === b
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

/** Posicao do card: tenta o lado preferido e vira para outro se nao couber. */
function calcularPosicao(rect, tam, lado = "auto") {
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (!rect) {
    return {
      top: Math.max(MARGEM, (vh - tam.altura) / 2),
      left: Math.max(MARGEM, (vw - tam.largura) / 2),
    }
  }

  const cabe = {
    baixo: vh - rect.bottom >= tam.altura + ESPACO + MARGEM,
    cima: rect.top >= tam.altura + ESPACO + MARGEM,
    direita: vw - rect.right >= tam.largura + ESPACO + MARGEM,
    esquerda: rect.left >= tam.largura + ESPACO + MARGEM,
  }
  const ordem = ["baixo", "cima", "direita", "esquerda"]
  const escolhido = (lado !== "auto" && cabe[lado] && lado) || ordem.find((l) => cabe[l]) || "baixo"

  let top
  let left
  if (escolhido === "baixo" || escolhido === "cima") {
    top = escolhido === "baixo" ? rect.bottom + ESPACO : rect.top - ESPACO - tam.altura
    left = rect.left + rect.width / 2 - tam.largura / 2
  } else {
    left = escolhido === "direita" ? rect.right + ESPACO : rect.left - ESPACO - tam.largura
    top = rect.top + rect.height / 2 - tam.altura / 2
  }

  return {
    top: Math.min(Math.max(MARGEM, top), Math.max(MARGEM, vh - tam.altura - MARGEM)),
    left: Math.min(Math.max(MARGEM, left), Math.max(MARGEM, vw - tam.largura - MARGEM)),
  }
}

export default function TourOverlay({ passo, indice, total, primeiro, ultimo, onProximo, onAnterior, onFechar }) {
  const cardRef = useRef(null)
  const [rect, setRect] = useState(null)
  const [tamCard, setTamCard] = useState({ largura: LARGURA_CARD, altura: 200 })
  const [camada] = useState(() => {
    const el = document.createElement("div")
    el.setAttribute("data-tour-layer", "")
    return el
  })

  const seletor = passo?.seletor

  // Camada propria no body. Ao abrir, os Modais/Drawers do MUI marcam com
  // aria-hidden todos os irmaos do body que nao sejam o modal - o que
  // esconderia o tour dos leitores de tela justamente nos passos do
  // formulario. Desfazemos essa marcacao na nossa camada.
  useEffect(() => {
    document.body.appendChild(camada)
    const desmarcar = () => {
      camada.removeAttribute("aria-hidden")
      camada.removeAttribute("inert")
    }
    desmarcar()
    const observador = new MutationObserver(desmarcar)
    observador.observe(camada, { attributes: true, attributeFilter: ["aria-hidden", "inert"] })
    return () => {
      observador.disconnect()
      camada.remove()
    }
  }, [camada])

  // Acompanha o alvo enquanto o passo esta ativo: ele pode se mover por causa
  // de rolagem, resize, animacao de drawer ou rerender da tela.
  useEffect(() => {
    let raf
    const acompanhar = () => {
      const novo = medirAlvo(seletor)
      setRect((ant) => (mesmoRect(ant, novo) ? ant : novo))
      raf = requestAnimationFrame(acompanhar)
    }
    acompanhar()
    return () => cancelAnimationFrame(raf)
  }, [seletor])

  // Traz o alvo para a area visivel ao entrar no passo.
  useEffect(() => {
    if (!seletor) return
    const el = document.querySelector(seletor)
    if (!el) return
    const r = el.getBoundingClientRect()
    const visivel = r.top >= 0 && r.bottom <= window.innerHeight
    if (!visivel) el.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [seletor])

  // Mede o card para posiciona-lo (a altura varia com o tamanho do texto).
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const medir = () => {
      const { width, height } = el.getBoundingClientRect()
      setTamCard((ant) =>
        ant.largura === width && ant.altura === height ? ant : { largura: width, altura: height }
      )
    }
    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(el)
    return () => observer.disconnect()
  }, [passo])

  // Passos com avancarAoClicar seguem sozinhos quando o usuario clica no alvo.
  // O respiro antes de avancar da tempo de o proximo alvo entrar na tela
  // (ex.: a animacao de abertura do drawer de nova atividade).
  useEffect(() => {
    if (!passo?.avancarAoClicar || !seletor) return
    const aoClicar = (e) => {
      if (e.target.closest?.(seletor)) setTimeout(onProximo, 400)
    }
    document.addEventListener("click", aoClicar, true)
    return () => document.removeEventListener("click", aoClicar, true)
  }, [passo, seletor, onProximo])

  // Teclado: Esc sai do tour, setas navegam. As setas sao ignoradas enquanto o
  // usuario digita num campo destacado (passos com permitirInteracao).
  //
  // O listener e de captura de proposito: o Modal do MUI (usado pelos Drawers)
  // trata o Esc e chama stopPropagation, entao no borbulhamento o evento nunca
  // chegaria aqui. Capturando antes, o Esc encerra o tour e - por interromper a
  // propagacao - deixa o drawer aberto, sem descartar o que o usuario digitou.
  useEffect(() => {
    const digitando = (alvo) =>
      alvo?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName)

    const aoTeclar = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        onFechar()
        return
      }
      if (digitando(e.target)) return
      if (e.key === "ArrowRight") {
        e.preventDefault()
        onProximo()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        onAnterior()
      }
    }
    document.addEventListener("keydown", aoTeclar, true)
    return () => document.removeEventListener("keydown", aoTeclar, true)
  }, [onProximo, onAnterior, onFechar])

  const posicao = calcularPosicao(rect, tamCard, passo?.posicao || "auto")

  // Blocao transparente que impede o clique de chegar na aplicacao. Quando o
  // passo permite interacao, ele vira quatro faixas em volta do alvo, deixando
  // so o recorte clicavel.
  const bloqueios = []
  if (rect && passo?.permitirInteracao) {
    const t = rect.top - RESPIRO
    const b = rect.bottom + RESPIRO
    const l = rect.left - RESPIRO
    const r = rect.right + RESPIRO
    bloqueios.push(
      { top: 0, left: 0, right: 0, height: Math.max(0, t) },
      { top: Math.max(0, b), left: 0, right: 0, bottom: 0 },
      { top: Math.max(0, t), left: 0, width: Math.max(0, l), height: Math.max(0, b - t) },
      { top: Math.max(0, t), left: Math.max(0, r), right: 0, height: Math.max(0, b - t) }
    )
  } else {
    bloqueios.push({ top: 0, left: 0, right: 0, bottom: 0 })
  }

  const parar = useCallback((e) => e.stopPropagation(), [])

  return createPortal(
    <Box sx={{ position: "fixed", inset: 0, zIndex: Z_INDICE, pointerEvents: "none" }}>
      {/* Captura de cliques (transparente: o escurecimento vem do spotlight) */}
      {bloqueios.map((estilo, i) => (
        <Box key={i} sx={{ position: "fixed", pointerEvents: "auto", ...estilo }} />
      ))}

      {/* Spotlight: o box-shadow gigante escurece toda a tela em volta do alvo */}
      {rect ? (
        <Box
          sx={(t) => ({
            position: "fixed",
            top: rect.top - RESPIRO,
            left: rect.left - RESPIRO,
            width: rect.width + RESPIRO * 2,
            height: rect.height + RESPIRO * 2,
            borderRadius: "12px",
            border: "2px solid",
            borderColor: t.palette.primary.main,
            boxShadow: `0 0 0 9999px ${alpha(t.palette.common.black, 0.55)}, 0 0 0 6px ${alpha(
              t.palette.primary.main,
              0.25
            )}`,
            pointerEvents: "none",
            transition: "top .25s ease, left .25s ease, width .25s ease, height .25s ease",
          })}
        />
      ) : (
        <Box sx={(t) => ({ position: "fixed", inset: 0, bgcolor: alpha(t.palette.common.black, 0.55) })} />
      )}

      {/* Card do passo */}
      <Fade in appear key={indice}>
        <Paper
          ref={cardRef}
          elevation={0}
          onClick={parar}
          role="dialog"
          aria-modal="false"
          aria-label={passo?.titulo}
          sx={(t) => ({
            position: "fixed",
            top: posicao.top,
            left: posicao.left,
            width: LARGURA_CARD,
            maxWidth: `calc(100vw - ${MARGEM * 2}px)`,
            p: 2.5,
            pointerEvents: "auto",
            borderRadius: `${Math.max(t.shape.borderRadius, 16)}px`,
            border: "1px solid",
            borderColor: "divider",
            boxShadow:
              t.palette.mode === "dark"
                ? "0 18px 44px rgba(0,0,0,0.6)"
                : "0 18px 44px rgba(15,23,42,0.22)",
            transition: "top .25s ease, left .25s ease",
          })}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
            <Typography
              variant="overline"
              sx={{ flex: 1, color: "primary.main", fontWeight: 700, letterSpacing: 0.6, lineHeight: 1.6 }}
            >
              Passo {indice + 1} de {total}
            </Typography>
            <IconButton size="small" onClick={onFechar} aria-label="Encerrar tour" sx={{ mt: -0.5, mr: -0.5 }}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.75 }}>
            {passo?.titulo}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {passo?.texto}
          </Typography>

          {/* Bolinhas de progresso */}
          <Box sx={{ display: "flex", gap: 0.6, flexWrap: "wrap", mt: 2, mb: 1.75 }}>
            {Array.from({ length: total }, (_, i) => (
              <Box
                key={i}
                sx={{
                  height: 5,
                  width: i === indice ? 18 : 5,
                  borderRadius: 999,
                  bgcolor: i === indice ? "primary.main" : "action.disabled",
                  transition: "width .2s ease, background-color .2s ease",
                }}
              />
            ))}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button size="small" onClick={onFechar} sx={{ textTransform: "none", color: "text.secondary" }}>
              Pular
            </Button>
            <Box sx={{ flex: 1 }} />
            {!primeiro && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowBack fontSize="small" />}
                onClick={onAnterior}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Voltar
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              disableElevation
              endIcon={ultimo ? <Check fontSize="small" /> : <ArrowForward fontSize="small" />}
              onClick={ultimo ? onFechar : onProximo}
              sx={{ textTransform: "none", borderRadius: 2, fontWeight: 600 }}
            >
              {ultimo ? "Concluir" : "Proximo"}
            </Button>
          </Box>
        </Paper>
      </Fade>
    </Box>,
    camada
  )
}
