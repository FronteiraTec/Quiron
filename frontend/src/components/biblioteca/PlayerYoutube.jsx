/**
 * Player de YouTube embutido — o video da incubadora toca DENTRO do Quiron.
 *
 * Antes, todo video anexado a um passo da trilha era um cartao com link: o
 * incubado clicava, saia do sistema e ia parar no YouTube, com os videos
 * sugeridos ao lado. Aqui ele assiste na propria pagina do passo e segue para
 * a entrega logo abaixo.
 *
 * Usa a IFrame Player API oficial (https://www.youtube.com/iframe_api), a lib
 * que o proprio YouTube publica para embed — e nao um <iframe> solto — porque
 * e ela que da controle do player por codigo e os eventos (pronto, tocando,
 * erro) de que a tela precisa para reagir.
 *
 * O iframe SO nasce quando alguem clica em assistir: ate la aparece a capa do
 * video (fachada). Um passo com tres videos carregaria tres players do YouTube
 * so de ser aberto, e esse custo seria do incubado.
 */
import { useEffect, useRef, useState } from "react"
import { Box, ButtonBase, Typography, Link, CircularProgress } from "@mui/material"
import { PlayArrow, OpenInNew, ErrorOutline } from "@mui/icons-material"
import { lerYoutube, capaYoutube, urlYoutube } from "../../utils/youtube"

// Promessa unica de carregamento da lib: varios players na mesma pagina
// esperam o MESMO script (o YouTube so avisa uma vez que a API ficou pronta).
let apiCarregando = null

function carregarApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("sem janela"))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiCarregando) return apiCarregando

  apiCarregando = new Promise((resolve, reject) => {
    // O script chama este global quando termina. Encadeia o que ja existir em
    // vez de sobrescrever — outro trecho pode estar esperando o mesmo aviso.
    const anterior = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof anterior === "function") anterior()
      resolve(window.YT)
    }

    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      apiCarregando = null // deixa tentar de novo na proxima vez
      reject(new Error("Nao foi possivel carregar o player do YouTube"))
    }
    document.head.appendChild(script)
  })

  return apiCarregando
}

/**
 * @param url      link do YouTube em qualquer formato (ver utils/youtube)
 * @param titulo   nome exibido sobre a capa
 * @param duracao  texto livre ("12 min"), so para a fachada
 * @param aspecto  proporcao do quadro (padrao 16/9)
 */
export default function PlayerYoutube({ url, titulo, duracao, aspecto = "16 / 9" }) {
  const video = lerYoutube(url)
  const [ativo, setAtivo] = useState(false)
  const [erro, setErro] = useState(false)
  const hospedeRef = useRef(null)

  useEffect(() => {
    if (!ativo || !video) return

    let cancelado = false
    let player = null

    carregarApi()
      .then((YT) => {
        if (cancelado || !hospedeRef.current) return

        // A API SUBSTITUI o elemento pelo iframe, entao ela recebe um filho
        // descartavel — nunca o no que o React controla.
        const alvo = document.createElement("div")
        hospedeRef.current.replaceChildren(alvo)

        player = new YT.Player(alvo, {
          width: "100%",
          height: "100%",
          videoId: video.id || undefined,
          playerVars: {
            autoplay: 1,
            rel: 0, // ao terminar, sugere so videos do mesmo canal
            modestbranding: 1,
            playsinline: 1, // no celular toca na pagina, nao em tela cheia
            ...(video.inicio ? { start: video.inicio } : {}),
            ...(video.lista ? { list: video.lista } : {}),
            ...(video.lista && !video.id ? { listType: "playlist" } : {}),
          },
          events: {
            onError: () => !cancelado && setErro(true),
          },
        })
      })
      .catch(() => !cancelado && setErro(true))

    return () => {
      cancelado = true
      try {
        player?.destroy()
      } catch {
        /* o iframe pode ja ter saido junto com a tela */
      }
    }
  }, [ativo, video?.id, video?.lista, video?.inicio]) // eslint-disable-line

  // Nao e YouTube: quem chamou decide o que mostrar (cartao de link, anexo...).
  if (!video) return null

  const capa = capaYoutube(video.id)
  const externo = urlYoutube(video)

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: aspecto,
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#000",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {erro ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            px: 3,
            color: "common.white",
          }}
        >
          <Box>
            <ErrorOutline sx={{ fontSize: 36, opacity: 0.7 }} />
            <Typography sx={{ fontSize: 14, mt: 1 }}>
              Este vídeo não pode ser exibido aqui.
            </Typography>
            {externo && (
              <Link
                href={externo}
                target="_blank"
                rel="noopener"
                sx={{ fontSize: 14, color: "#93c5fd" }}
              >
                Abrir no YouTube
              </Link>
            )}
          </Box>
        </Box>
      ) : ativo ? (
        <>
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "common.white",
            }}
          >
            <CircularProgress size={28} color="inherit" />
          </Box>
          <Box
            ref={hospedeRef}
            sx={{
              position: "absolute",
              inset: 0,
              "& iframe": { width: "100%", height: "100%", border: 0, display: "block" },
            }}
          />
        </>
      ) : (
        <ButtonBase
          onClick={() => setAtivo(true)}
          focusRipple
          aria-label={titulo ? `Assistir ao vídeo: ${titulo}` : "Assistir ao vídeo"}
          sx={{ position: "absolute", inset: 0, display: "block", textAlign: "left" }}
        >
          {capa && (
            <Box
              component="img"
              src={capa}
              alt=""
              loading="lazy"
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                // A capa "hq" vem com tarja preta em cima e embaixo; o leve
                // zoom corta a tarja sem distorcer a imagem.
                transform: "scale(1.35)",
              }}
            />
          )}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.12) 45%, rgba(0,0,0,.7) 100%)",
            }}
          />

          {(titulo || duracao) && (
            <Box sx={{ position: "absolute", top: 12, left: 14, right: 14 }}>
              {titulo && (
                <Typography
                  noWrap
                  sx={{
                    color: "common.white",
                    fontWeight: 700,
                    fontSize: 15,
                    lineHeight: 1.3,
                    textShadow: "0 1px 3px rgba(0,0,0,.6)",
                  }}
                >
                  {titulo}
                </Typography>
              )}
              {duracao && (
                <Typography sx={{ color: "rgba(255,255,255,.85)", fontSize: 12.5 }}>
                  {duracao}
                </Typography>
              )}
            </Box>
          )}

          {/* Botao de play com a cara do YouTube */}
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Box
              sx={{
                width: 68,
                height: 48,
                borderRadius: "12px",
                bgcolor: "rgba(0,0,0,.65)",
                display: "grid",
                placeItems: "center",
                transition: "background-color .15s, transform .15s",
                ".MuiButtonBase-root:hover &": { bgcolor: "#ff0000", transform: "scale(1.06)" },
              }}
            >
              <PlayArrow sx={{ color: "common.white", fontSize: 34 }} />
            </Box>
          </Box>

          <Typography
            sx={{
              position: "absolute",
              bottom: 10,
              left: 14,
              color: "rgba(255,255,255,.85)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.3,
            }}
          >
            Assistir aqui
          </Typography>
        </ButtonBase>
      )}

      {/* Saida para o YouTube: quem prefere a aba de fora continua tendo. */}
      {!erro && !ativo && externo && (
        <Link
          href={externo}
          target="_blank"
          rel="noopener"
          onClick={(e) => e.stopPropagation()}
          title="Abrir no YouTube"
          sx={{
            position: "absolute",
            bottom: 8,
            right: 8,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: "rgba(0,0,0,.6)",
            color: "rgba(255,255,255,.9)",
            fontSize: 11.5,
            fontWeight: 600,
            textDecoration: "none",
            "&:hover": { bgcolor: "rgba(0,0,0,.85)" },
          }}
        >
          YouTube <OpenInNew sx={{ fontSize: 13 }} />
        </Link>
      )}
    </Box>
  )
}
