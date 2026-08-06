/**
 * A marca de um conteudo da Biblioteca.
 *
 * Todo conteudo do mesmo tipo nasce com o mesmo icone (o icone do tipo), o que
 * deixa a grade do acervo indistinguivel quando ela cresce. O logo e a saida:
 * uma imagem por conteudo — o simbolo da ferramenta, do tema, da metodologia —
 * como nos catalogos de curso.
 *
 * Duas pecas, mesmo assunto:
 *   LogoConteudo -> mostra o logo; sem logo, cai no icone do tipo (o padrao).
 *   SeletorLogo  -> o mesmo quadro, clicavel, para escolher/remover a imagem.
 *
 * A imagem SOBE para o servidor (arquivo PUBLICO) e o que fica em
 * conteudo.logo_url e a url servida pela API. O seletor REDUZ antes de enviar:
 * um PNG de 3000px nao tem por que ocupar disco para aparecer num quadro de
 * 34px. Ate 20/07/2026 a data URL base64 ia inteira para a coluna, e como a
 * listagem devolve o logo de cada card, cada abertura do acervo arrastava
 * todas as imagens embutidas na resposta.
 */
import { useRef, useState } from "react"
import { Box, IconButton, Tooltip, CircularProgress } from "@mui/material"
import { PhotoCamera, Close } from "@mui/icons-material"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"
import { enviarArquivo } from "../../services/arquivos"

// Lado maximo da imagem gravada, em px. Cobre o maior quadro em que ela
// aparece (o cabecalho do editor, 40px) com folga para telas retina.
const LADO_MAX = 256

// Teto do arquivo escolhido, antes da reducao (o backend valida o depois).
const ARQUIVO_MAX_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Quadro do conteudo: o logo, quando houver; senao o icone do tipo, tingido
 * com a cor de acento — exatamente o que a tela mostrava antes do logo existir.
 */
export default function LogoConteudo({ conteudo, tamanho = 34, fonteIcone }) {
  const meta = TIPO_CONTEUDO[conteudo.tipo]
  const Icone = meta.icon

  const base = {
    display: "grid",
    placeItems: "center",
    width: tamanho,
    height: tamanho,
    borderRadius: 1.5,
    flexShrink: 0,
    overflow: "hidden",
  }

  if (conteudo.logo_url) {
    return (
      <Box
        component="img"
        src={conteudo.logo_url}
        alt=""
        sx={{
          ...base,
          objectFit: "contain",
          // Fundo neutro e uma borda discreta: logos vem em qualquer cor e
          // muitos tem fundo transparente, que sumiria no tema escuro.
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          p: 0.25,
        }}
      />
    )
  }

  return (
    <Box sx={{ ...base, bgcolor: `${meta.cor}1f`, color: meta.cor }}>
      <Icone sx={{ fontSize: fonteIcone ?? Math.round(tamanho * 0.58) }} />
    </Box>
  )
}

/**
 * Seletor do logo, para o editor. Mostra o quadro atual; clicar abre o
 * seletor de arquivos, e o X (so com logo definido) volta ao icone do tipo.
 *
 * A imagem e reduzida no cliente e SOBE para o servidor como arquivo PUBLICO;
 * o que fica em `logo_url` e a url servida pela API. Antes de 20/07/2026 a data
 * URL base64 era gravada inteira na coluna — e como a listagem da Biblioteca
 * devolve o logo de cada card, cada abertura da tela arrastava todas as imagens
 * embutidas na resposta.
 *
 * PUBLICO e nao PRIVADO porque isto termina num <img src>, e a tag nao envia
 * cabecalho Authorization. Logo de conteudo didatico nao e segredo; anexo de
 * entrega e — por isso os dois regimes.
 *
 * @param {object}   props.conteudo - conteudo em edicao (le tipo e logo_url)
 * @param {number}   props.idTenant - dono do arquivo enviado
 * @param {Function} props.onChange - recebe a url do arquivo, ou null ao remover
 */
export function SeletorLogo({ conteudo, idTenant, onChange, onErro, tamanho = 56 }) {
  const inputRef = useRef(null)
  const [processando, setProcessando] = useState(false)

  const escolher = async (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = "" // permite reescolher o mesmo arquivo depois
    if (!arquivo) return

    if (!arquivo.type.startsWith("image/")) {
      onErro?.("Selecione um arquivo de imagem.")
      return
    }
    if (arquivo.size > ARQUIVO_MAX_BYTES) {
      onErro?.("A imagem deve ter no máximo 5MB.")
      return
    }

    setProcessando(true)
    try {
      // Reduz ANTES de subir: o teto do regime publico e 2MB, e uma foto de
      // celular passa disso com folga. Reduzir aqui evita subir 8MB para
      // guardar um quadrado de 56px.
      const dataUrl = await reduzirParaDataUrl(arquivo)
      const blob = await (await fetch(dataUrl)).blob()
      const reduzido = new File([blob], arquivo.name, { type: blob.type })

      const enviado = await enviarArquivo(reduzido, { idTenant, visibilidade: "PUBLICO" })
      onChange(enviado.url)
    } catch (err) {
      onErro?.(
        err.response?.data?.erro || "Não foi possível enviar a imagem. Tente novamente."
      )
    } finally {
      setProcessando(false)
    }
  }

  return (
    <Box sx={{ position: "relative", width: tamanho, height: tamanho }}>
      <Tooltip title={conteudo.logo_url ? "Trocar logo" : "Escolher um logo"} arrow>
        <Box
          onClick={() => !processando && inputRef.current?.click()}
          sx={{
            cursor: processando ? "default" : "pointer",
            opacity: processando ? 0.5 : 1,
            transition: "opacity .15s",
            "&:hover": { opacity: processando ? 0.5 : 0.85 },
          }}
        >
          <LogoConteudo conteudo={conteudo} tamanho={tamanho} />
        </Box>
      </Tooltip>

      {/* Camera para escolher; X para voltar ao icone do tipo. */}
      <Tooltip title={conteudo.logo_url ? "Remover logo" : "Escolher um logo"} arrow>
        <IconButton
          size="small"
          disabled={processando}
          aria-label={conteudo.logo_url ? "Remover logo do conteúdo" : "Escolher logo do conteúdo"}
          onClick={() =>
            conteudo.logo_url ? onChange(null) : inputRef.current?.click()
          }
          sx={{
            position: "absolute",
            bottom: -6,
            right: -6,
            width: 22,
            height: 22,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {processando ? (
            <CircularProgress size={12} />
          ) : conteudo.logo_url ? (
            <Close sx={{ fontSize: 13 }} />
          ) : (
            <PhotoCamera sx={{ fontSize: 13 }} />
          )}
        </IconButton>
      </Tooltip>

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={escolher} />
    </Box>
  )
}

/**
 * Le o arquivo e devolve uma data URL com no maximo LADO_MAX de lado.
 *
 * A imagem e encaixada num quadrado transparente (nao esticada) para que
 * logos altos e largos convivam na mesma grade sem deformar. Sai em PNG por
 * causa da transparencia — e o formato tipico de logo.
 *
 * SVG passa direto: e vetor, ja e pequeno, e rasterizar so pioraria.
 */
function reduzirParaDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error("falha ao ler o arquivo"))
    leitor.onload = () => {
      const dataUrl = leitor.result

      if (arquivo.type === "image/svg+xml") {
        resolve(dataUrl)
        return
      }

      const img = new Image()
      img.onerror = () => reject(new Error("imagem inválida"))
      img.onload = () => {
        const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
        const largura = Math.round(img.width * escala)
        const altura = Math.round(img.height * escala)

        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = Math.max(largura, altura)
        const ctx = canvas.getContext("2d")
        ctx.drawImage(
          img,
          (canvas.width - largura) / 2,
          (canvas.height - altura) / 2,
          largura,
          altura
        )
        resolve(canvas.toDataURL("image/png"))
      }
      img.src = dataUrl
    }
    leitor.readAsDataURL(arquivo)
  })
}
