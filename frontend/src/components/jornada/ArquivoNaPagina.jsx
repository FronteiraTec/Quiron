/**
 * O arquivo que a incubadora anexou ao conteudo, desenhado NA PROPRIA PAGINA
 * do passo: o incubado le o PDF ali mesmo, entre o objetivo e a entrega, sem
 * abrir outra aba nem baixar nada.
 *
 * Os leitores sao os do visualizador do Espaco do Mentor (pdf.js,
 * docx-preview, read-excel-file), e cada um so e carregado quando um arquivo
 * daquele tipo aparece. Apresentacao e .doc, que o navegador nao desenha, o
 * servidor converte em PDF (GET /arquivos/:id/pdf) e a pagina mostra esse PDF;
 * o "Baixar" continua entregando o original. O resto (zip, .xls antigo), e a
 * conversao que falhar, continua como a linha clicavel de antes: o `fallback`.
 *
 * QUEM DECIDE e o tipo que o servidor declara nos bytes, e nao o nome. A
 * extensao serve so para escolher o que pedir, e para nao baixar um zip de
 * 15MB a toa, so para descobrir que ele nao tem previa.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material"
import { Download, OpenInNew } from "@mui/icons-material"
import { abrirArquivo, baixarArquivo, buscarArquivo, ehArquivoDaApi } from "../../services/arquivos"
import { tipoDePrevia } from "../../data/exploradorMeta"

const PreviaPdf = lazy(() => import("../espacoMentor/explorador/previa/PreviaPdf"))
const PreviaDocx = lazy(() => import("../espacoMentor/explorador/previa/PreviaDocx"))
const PreviaPlanilha = lazy(() => import("../espacoMentor/explorador/previa/PreviaPlanilha"))

const EXTENSAO_IMAGEM = /\.(png|jpe?g|webp|gif)$/i
const EXTENSAO_CONVERTIDA = /\.(pptx?|doc)$/i
const EXTENSAO_COM_PREVIA = /\.(pdf|docx|xlsx|pptx?|doc|png|jpe?g|webp|gif)$/i
const PREVIAS = ["PDF", "DOCX", "XLSX", "IMAGEM"]

/**
 * Altura da janela do documento. Fixa, com rolagem por dentro, como o PDF
 * embutido do Drive: deixar crescer com o arquivo empurraria a entrega para
 * depois de 80 paginas.
 */
const ALTURA_DOCUMENTO = { xs: "70vh", sm: "min(75vh, 820px)" }

/** Vale tentar desenhar este conteudo na pagina? */
export function temPreviaNaPagina(conteudo) {
  return ehArquivoDaApi(conteudo.url) && EXTENSAO_COM_PREVIA.test(conteudo.nome_arquivo || "")
}

export default function ArquivoNaPagina({ conteudo, Icone, cor, raio, fallback }) {
  const [blob, setBlob] = useState(null)
  const [erro, setErro] = useState("")
  const nome = conteudo.nome_arquivo || conteudo.titulo
  const convertido = EXTENSAO_CONVERTIDA.test(conteudo.nome_arquivo || "")
  // O que a pagina desenha (e o que abre em outra aba): o PDF, quando ha conversao.
  const urlPagina = convertido ? `${conteudo.url}/pdf` : conteudo.url

  useEffect(() => {
    let cancelado = false
    setBlob(null)
    setErro("")
    buscarArquivo(urlPagina)
      .then((b) => !cancelado && setBlob(b))
      .catch((err) => !cancelado && setErro(err.message || "Não foi possível abrir o arquivo."))
    return () => {
      cancelado = true
    }
  }, [urlPagina])

  const previa = blob ? tipoDePrevia({ tipo: "ARQUIVO", arquivo_mime: blob.type }) : null
  const urlImagem = useMemo(() => (blob && previa === "IMAGEM" ? URL.createObjectURL(blob) : null), [blob, previa])
  useEffect(() => () => urlImagem && URL.revokeObjectURL(urlImagem), [urlImagem])

  // Nome de PDF com bytes de outra coisa: sem previa, volta a linha de antes.
  if (blob && !PREVIAS.includes(previa)) return fallback

  // Nao deu para buscar (ou converter): a linha de antes, que ainda baixa o
  // original, e o motivo embaixo.
  if (erro && !blob) {
    return (
      <>
        {fallback}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          Prévia indisponível: {erro}
        </Typography>
      </>
    )
  }

  const acao = (fn, url) => async () => {
    setErro("")
    try {
      await fn(url, nome)
    } catch (err) {
      setErro(err.message)
    }
  }

  const imagem = previa ? previa === "IMAGEM" : EXTENSAO_IMAGEM.test(conteudo.nome_arquivo || "")

  return (
    <Box>
      {/* A mesma credencial da aula: de onde o arquivo veio, sobre um fio. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 0.5,
          mb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Icone sx={{ fontSize: 16, color: cor, flexShrink: 0 }} />
        <Typography sx={{ fontWeight: 600, fontSize: 13.5, flex: 1, minWidth: 0 }} color="text.secondary" noWrap>
          {conteudo.titulo}
        </Typography>
        <Tooltip title="Abrir em outra aba">
          <IconButton size="small" onClick={acao(abrirArquivo, urlPagina)} aria-label="Abrir em outra aba">
            <OpenInNew sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Baixar">
          <IconButton size="small" onClick={acao(baixarArquivo, conteudo.url)} aria-label="Baixar">
            <Download sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {conteudo.resumo && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {conteudo.resumo}
        </Typography>
      )}

      <Box
        sx={{
          height: imagem ? "auto" : ALTURA_DOCUMENTO,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: raio,
          overflow: "hidden",
          bgcolor: "action.hover",
        }}
      >
        {!blob ? (
          // A primeira abertura de uma apresentacao espera a conversao.
          <Carregando texto={convertido ? "Preparando a visualização…" : null} />
        ) : previa === "IMAGEM" ? (
          <Box
            component="img"
            src={urlImagem}
            alt={conteudo.titulo}
            sx={{ display: "block", maxWidth: "100%", mx: "auto" }}
          />
        ) : (
          <Suspense fallback={<Carregando />}>
            {previa === "PDF" && <PreviaPdf blob={blob} />}
            {previa === "DOCX" && <PreviaDocx blob={blob} />}
            {previa === "XLSX" && <PreviaPlanilha blob={blob} />}
          </Suspense>
        )}
      </Box>

      {erro && blob && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {erro}
        </Typography>
      )}
    </Box>
  )
}

function Carregando({ texto }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        height: "100%",
        minHeight: 160,
      }}
    >
      <CircularProgress size={24} />
      {texto && (
        <Typography variant="caption" color="text.secondary">
          {texto}
        </Typography>
      )}
    </Box>
  )
}
