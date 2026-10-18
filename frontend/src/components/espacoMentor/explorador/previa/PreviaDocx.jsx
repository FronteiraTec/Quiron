/**
 * O documento do Word (.docx) desenhado na tela (docx-preview).
 *
 * O HTML sai do PROPRIO ARQUIVO, e o arquivo pode ter sido montado por
 * qualquer um: depois de desenhar, o resultado e limpo do que poderia rodar ou
 * vazar algo — script, iframe, atributo `on*`, link `javascript:` e imagem
 * apontando para fora. O CSP da borda ja barraria a maior parte; isto vale
 * tambem onde ele nao existe (o Vite em desenvolvimento).
 *
 * O .doc antigo (binario) nao passa por aqui: o navegador nao tem como le-lo.
 */
import { useEffect, useRef, useState } from "react"
import { Alert, Box, CircularProgress } from "@mui/material"
import { renderAsync } from "docx-preview"

const LINK_SEGURO = /^(https?:|mailto:|#)/i
const IMAGEM_LOCAL = /^(data:|blob:)/i

function limpar(raiz) {
  raiz.querySelectorAll("script, iframe, object, embed, link, meta, base, form").forEach((el) => el.remove())
  raiz.querySelectorAll("*").forEach((el) => {
    for (const { name } of [...el.attributes]) {
      if (name.toLowerCase().startsWith("on")) el.removeAttribute(name)
    }
  })
  raiz.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || ""
    if (!LINK_SEGURO.test(href)) {
      a.removeAttribute("href")
    } else if (/^https?:/i.test(href)) {
      a.setAttribute("target", "_blank")
      a.setAttribute("rel", "noopener noreferrer")
    }
  })
  raiz.querySelectorAll("img").forEach((img) => {
    if (!IMAGEM_LOCAL.test(img.getAttribute("src") || "")) img.removeAttribute("src")
    img.removeAttribute("srcset")
  })
}

export default function PreviaDocx({ blob }) {
  const corpo = useRef(null)
  const estilos = useRef(null)
  const [estado, setEstado] = useState("carregando")

  useEffect(() => {
    let cancelado = false
    setEstado("carregando")
    const alvo = corpo.current
    const folha = estilos.current
    alvo.innerHTML = ""
    folha.innerHTML = ""
    renderAsync(blob, alvo, folha, {
      inWrapper: true,
      ignoreLastRenderedPageBreak: true,
      // Pedaco de HTML embutido no .docx: seria desenhado num iframe.
      renderAltChunks: false,
      // Imagens e fontes como data: — o CSP aceita data: e nao aceita fonte blob:.
      useBase64URL: true,
      renderComments: false,
    })
      .then(() => {
        if (cancelado) return
        limpar(alvo)
        setEstado("pronto")
      })
      .catch(() => !cancelado && setEstado("erro"))
    return () => {
      cancelado = true
      alvo.innerHTML = ""
      folha.innerHTML = ""
    }
  }, [blob])

  return (
    <Box sx={{ height: "100%", overflow: "auto", bgcolor: "action.hover" }}>
      {estado === "carregando" && (
        <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {estado === "erro" && (
        <Alert severity="warning" sx={{ m: 2 }}>
          Não foi possível ler este documento. Baixe o arquivo para abri-lo no Word.
        </Alert>
      )}
      <div ref={estilos} />
      <Box
        ref={corpo}
        sx={{
          // O desenho da biblioteca: paginas brancas sobre o fundo da tela, e
          // nao sobre o cinza fixo que ela traz.
          "& .docx-wrapper": { background: "transparent", padding: { xs: 1, sm: 3 } },
          "& .docx-wrapper > section.docx": { boxShadow: 2, marginBottom: 2 },
        }}
      />
    </Box>
  )
}
