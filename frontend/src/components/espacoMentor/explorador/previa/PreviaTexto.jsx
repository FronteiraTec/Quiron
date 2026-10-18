/**
 * Texto puro (.txt) e CSV: lidos, e EDITADOS aqui mesmo.
 *
 * Sao os dois formatos que o navegador consegue reescrever sem perder nada do
 * arquivo — num .docx ou .xlsx, salvar pelo navegador jogaria fora formatacao,
 * formula e imagem. Para esses, o caminho e "Enviar nova versao".
 *
 * Fora da edicao, o CSV aparece como planilha; na edicao, como o texto que ele
 * e (o separador e as aspas a vista), porque e isso que vai ser gravado.
 */
import { Suspense, lazy } from "react"
import { Box, CircularProgress } from "@mui/material"

const PreviaPlanilha = lazy(() => import("./PreviaPlanilha"))

/**
 * Le os bytes como texto. UTF-8 primeiro; se nao for UTF-8 valido, e o
 * Windows-1252 de quem salvou o CSV pelo Excel em portugues — ler como UTF-8
 * trocaria todo "ç" por "�".
 *
 * @returns {{texto: string, bom: boolean}} `bom` diz se o arquivo comecava com
 *   a marca de UTF-8 (o Excel precisa dela para abrir acento certo).
 */
export function decodificar(bytes) {
  const u8 = new Uint8Array(bytes)
  const bom = u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf
  try {
    return { texto: new TextDecoder("utf-8", { fatal: true }).decode(u8), bom }
  } catch {
    return { texto: new TextDecoder("windows-1252").decode(u8), bom: false }
  }
}

/**
 * O arquivo a enviar como versao nova. CSV sempre leva a marca de UTF-8: sem
 * ela o Excel abre em Windows-1252 e o acento que acabou de ser digitado vira
 * lixo. No .txt, so se ela ja estava la.
 */
export function arquivoDoTexto(texto, { nome, mime, bom }) {
  const marca = mime === "text/csv" || bom ? "﻿" : ""
  return new File([marca + texto], nome, { type: mime })
}

export default function PreviaTexto({ texto, csv, editando, onMudar }) {
  if (editando) {
    return (
      <Box
        component="textarea"
        autoFocus
        spellCheck={!csv}
        value={texto}
        onChange={(e) => onMudar(e.target.value)}
        aria-label="Conteúdo do arquivo"
        sx={{
          width: "100%",
          height: "100%",
          resize: "none",
          border: 0,
          outline: 0,
          p: 2,
          fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
          fontSize: 14,
          lineHeight: 1.6,
          color: "text.primary",
          bgcolor: "background.paper",
        }}
      />
    )
  }

  if (csv) {
    return (
      <Suspense fallback={<Carregando />}>
        <PreviaPlanilha texto={texto} />
      </Suspense>
    )
  }

  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        height: "100%",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      {texto}
    </Box>
  )
}

function Carregando() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
      <CircularProgress size={28} />
    </Box>
  )
}
