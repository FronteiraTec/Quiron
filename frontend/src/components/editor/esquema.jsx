/**
 * O esquema do editor de documentos do Quiron.
 *
 * O BlockNote ja traz parágrafo, títulos, listas, checklist, citação, código,
 * tabela, divisor e imagem — nada disso e reimplementado aqui. Este arquivo
 * define so o que e do Quiron e o que o BlockNote nao teria como saber:
 *
 *   destaque       a caixa de dica/atencao/boa pratica que o editor antigo
 *                  chamava de "callout". Aula nenhuma perde o destaque que
 *                  tinha por causa da troca de editor.
 *   videoEmbutido  video que TOCA dentro do sistema. O bloco de video nativo
 *                  do BlockNote usa <video src>, que nao reproduz link do
 *                  YouTube — e YouTube e de onde a incubadora anexa tudo.
 *                  Reaproveita o PlayerYoutube que a Jornada ja usa.
 *   anexo          arquivo de apoio. Sobe pela API de arquivos como PRIVADO e
 *                  abre com token (services/arquivos), que e o caminho que a
 *                  Jornada ja faz com anexo de entrega — um <a href> simples
 *                  receberia 401.
 *
 * Os blocos nativos `video`, `audio` e `file` ficam de fora: os tres seriam
 * uma segunda porta para as mesmas duas coisas que os blocos acima ja fazem,
 * e duas portas para o mesmo lugar so confundem quem escreve.
 */
import { useRef, useState } from "react"
import { BlockNoteSchema, defaultBlockSpecs, insertOrUpdateBlockForSlashMenu } from "@blocknote/core"
import { createReactBlockSpec } from "@blocknote/react"
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from "@mui/material"
import {
  Lightbulb,
  WarningAmber,
  CheckCircleOutline,
  Videocam,
  AttachFile,
  InsertDriveFile,
  OpenInNew,
  Edit,
  UploadFile,
} from "@mui/icons-material"
import PlayerYoutube from "../biblioteca/PlayerYoutube"
import { ehYoutube } from "../../utils/youtube"
import { enviarArquivo, abrirArquivo, formatarTamanho } from "../../services/arquivos"
import { useAuthStore } from "../../store/authStore"

// As mesmas cores e rotulos do editor antigo: uma aula convertida tem de
// continuar com a cara que tinha.
export const VARIANTES_DESTAQUE = {
  dica: { cor: "#0ea5e9", rotulo: "Dica", Icone: Lightbulb },
  atencao: { cor: "#f59e0b", rotulo: "Atenção", Icone: WarningAmber },
  sucesso: { cor: "#22c55e", rotulo: "Boa prática", Icone: CheckCircleOutline },
}

/**
 * Casca para controles dentro de um bloco.
 *
 * Um campo do MUI dentro do editor esta, para o ProseMirror, dentro da area
 * editavel: sem `contentEditable={false}` ele tentaria administrar o que se
 * digita ali, e teclas como Enter ou "/" seriam interpretadas como comandos do
 * documento em vez de texto do campo.
 */
function ControlesDoBloco({ children, sx, className }) {
  return (
    <Box
      contentEditable={false}
      className={className}
      onKeyDown={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
      sx={sx}
    >
      {children}
    </Box>
  )
}

// ---------------------------------------------------------------------------
// destaque — a caixa de dica/atencao/boa pratica
// ---------------------------------------------------------------------------
function Destaque({ block, editor, contentRef }) {
  const variante = VARIANTES_DESTAQUE[block.props.variante] || VARIANTES_DESTAQUE.dica
  const { cor, Icone } = variante

  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        gap: 1.5,
        p: 1.75,
        my: 0.5,
        width: "100%",
        borderRadius: 1.5,
        bgcolor: `${cor}14`,
        border: "1px solid",
        borderColor: `${cor}55`,
        "&:hover .seletor-variante": { opacity: 1, pointerEvents: "auto" },
      }}
    >
      <Icone sx={{ color: cor, fontSize: 20, mt: 0.25, flexShrink: 0 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editor.isEditable && (
          <ControlesDoBloco
            sx={{
              // Some ate o mouse chegar: o destaque e para ler, e tres botoes
              // permanentes por caixa deixariam a aula parecendo um painel.
              //
              // Fora do fluxo (`position: absolute`) de proposito: com o
              // seletor ocupando altura mesmo invisivel, o texto do destaque
              // ficava empurrado para baixo e desalinhado do icone ao lado.
              position: "absolute",
              top: 6,
              right: 8,
              opacity: 0,
              pointerEvents: "none",
              transition: "opacity .12s",
              bgcolor: "background.paper",
              borderRadius: 1,
            }}
            className="seletor-variante"
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={block.props.variante}
              onChange={(_, valor) =>
                valor && editor.updateBlock(block, { props: { variante: valor } })
              }
              sx={{
                "& .MuiToggleButton-root": {
                  py: 0,
                  px: 1,
                  fontSize: 11,
                  textTransform: "none",
                  lineHeight: 1.8,
                },
              }}
            >
              {Object.entries(VARIANTES_DESTAQUE).map(([chave, meta]) => (
                <ToggleButton key={chave} value={chave}>
                  {meta.rotulo}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </ControlesDoBloco>
        )}

        <Box ref={contentRef} sx={{ fontSize: 14, lineHeight: 1.6 }} />
      </Box>
    </Box>
  )
}

const criarDestaque = createReactBlockSpec(
  {
    type: "destaque",
    propSchema: {
      variante: { default: "dica", values: ["dica", "atencao", "sucesso"] },
    },
    content: "inline",
  },
  { render: Destaque }
)

// ---------------------------------------------------------------------------
// videoEmbutido — o video que toca dentro do sistema
// ---------------------------------------------------------------------------
function Video({ block, editor }) {
  const { url, legenda } = block.props
  const [editandoLink, setEditandoLink] = useState(false)
  const [rascunho, setRascunho] = useState(url || "")

  const aplicar = () => {
    editor.updateBlock(block, { props: { url: rascunho.trim() } })
    setEditandoLink(false)
  }

  // Sem link ainda (ou trocando): o bloco e o formulario.
  if (!url || editandoLink) {
    if (!editor.isEditable) return null

    return (
      <ControlesDoBloco
        sx={{
          width: "100%",
          my: 0.5,
          p: 1.75,
          borderRadius: 1.5,
          border: "1px dashed",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
          <Videocam sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
            VÍDEO
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <TextField
            size="small"
            autoFocus
            fullWidth
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && aplicar()}
            placeholder="Cole o link do YouTube"
            sx={{ flex: "1 1 240px" }}
          />
          <Button
            variant="contained"
            onClick={aplicar}
            disabled={!rascunho.trim()}
            sx={{ textTransform: "none" }}
          >
            Inserir
          </Button>
        </Box>
      </ControlesDoBloco>
    )
  }

  return (
    <Box sx={{ width: "100%", my: 1 }}>
      {ehYoutube(url) ? (
        <PlayerYoutube url={url} titulo={legenda} />
      ) : (
        <CartaoLink url={url} nome={legenda || url} rotulo="Vídeo" icone={<Videocam />} />
      )}

      {editor.isEditable ? (
        <ControlesDoBloco sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
          <TextField
            size="small"
            variant="standard"
            fullWidth
            value={legenda || ""}
            onChange={(e) => editor.updateBlock(block, { props: { legenda: e.target.value } })}
            placeholder="Legenda do vídeo (opcional)"
            InputProps={{ disableUnderline: true, sx: { fontSize: 13 } }}
          />
          <Tooltip title="Trocar o link" arrow>
            <IconButton
              size="small"
              onClick={() => {
                setRascunho(url)
                setEditandoLink(true)
              }}
            >
              <Edit sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </ControlesDoBloco>
      ) : (
        legenda && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            {legenda}
          </Typography>
        )
      )}
    </Box>
  )
}

const criarVideoEmbutido = createReactBlockSpec(
  {
    type: "videoEmbutido",
    propSchema: {
      url: { default: "" },
      legenda: { default: "" },
    },
    content: "none",
  },
  { render: Video }
)

// ---------------------------------------------------------------------------
// anexo — arquivo de apoio da aula
// ---------------------------------------------------------------------------

/** Cartao de material: o mesmo desenho que a Jornada usa nos anexos. */
function CartaoLink({ nome, rotulo, icone, onAbrir, url, tamanho, acao }) {
  const clicavel = Boolean(onAbrir || url)

  return (
    <Box
      onClick={onAbrir}
      component={onAbrir ? "div" : url ? "a" : "div"}
      {...(!onAbrir && url ? { href: url, target: "_blank", rel: "noopener noreferrer" } : {})}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "action.hover",
        color: "text.primary",
        textDecoration: "none",
        cursor: clicavel ? "pointer" : "default",
        transition: "border-color .15s",
        "&:hover": clicavel ? { borderColor: "primary.main" } : undefined,
      }}
    >
      <Box sx={{ color: "primary.main", display: "grid", placeItems: "center" }}>{icone}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          {rotulo.toUpperCase()}
          {tamanho ? ` · ${formatarTamanho(tamanho)}` : ""}
        </Typography>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
          {nome}
        </Typography>
      </Box>
      {acao || (clicavel && <OpenInNew sx={{ fontSize: 16, color: "text.disabled" }} />)}
    </Box>
  )
}

function Anexo({ block, editor }) {
  const { url, nome, tamanho } = block.props
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant)
  const inputRef = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState("")

  const escolher = async (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = "" // permite reescolher o mesmo arquivo
    if (!arquivo) return

    setEnviando(true)
    setErro("")
    try {
      // PRIVADO como todo documento: o regime PUBLICO so aceita imagem, e o
      // material de apoio e PDF, planilha, apresentacao (ver arquivoService).
      const enviado = await enviarArquivo(arquivo, { idTenant, visibilidade: "PRIVADO" })
      editor.updateBlock(block, {
        props: {
          url: enviado.url,
          nome: enviado.nome_original,
          tamanho: enviado.tamanho ?? 0,
        },
      })
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível enviar o arquivo.")
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Abre o anexo. Arquivo da API e PRIVADO e exige o cabecalho Authorization,
   * que uma tag <a> nao envia — por isso o caminho pelo `abrirArquivo`, que
   * busca com o token e abre o blob. Link externo abre direto.
   */
  const abrir = async () => {
    if (!url) return
    if (!url.startsWith("/")) {
      window.open(url, "_blank", "noopener,noreferrer")
      return
    }
    try {
      await abrirArquivo(url, nome)
    } catch (err) {
      setErro(err.message || "Não foi possível abrir o arquivo.")
    }
  }

  if (!url) {
    if (!editor.isEditable) return null

    return (
      <ControlesDoBloco
        sx={{
          width: "100%",
          my: 0.5,
          p: 1.75,
          borderRadius: 1.5,
          border: "1px dashed",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25 }}>
          <AttachFile sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
            ANEXO
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={enviando ? <CircularProgress size={14} /> : <UploadFile />}
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          sx={{ textTransform: "none" }}
        >
          {enviando ? "Enviando…" : "Escolher arquivo"}
        </Button>
        {erro && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
            {erro}
          </Typography>
        )}
        <input ref={inputRef} type="file" hidden onChange={escolher} />
      </ControlesDoBloco>
    )
  }

  return (
    <Box sx={{ width: "100%", my: 0.5 }}>
      <CartaoLink
        nome={nome || url}
        rotulo="Anexo"
        tamanho={tamanho}
        icone={<InsertDriveFile />}
        onAbrir={abrir}
      />
      {erro && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {erro}
        </Typography>
      )}
    </Box>
  )
}

const criarAnexo = createReactBlockSpec(
  {
    type: "anexo",
    propSchema: {
      url: { default: "" },
      nome: { default: "" },
      tamanho: { default: 0 },
    },
    content: "none",
  },
  { render: Anexo }
)

// ---------------------------------------------------------------------------
// O esquema
// ---------------------------------------------------------------------------
const { audio, video, file, ...blocosNativos } = defaultBlockSpecs

export const esquemaQuiron = BlockNoteSchema.create({
  blockSpecs: {
    ...blocosNativos,
    destaque: criarDestaque(),
    videoEmbutido: criarVideoEmbutido(),
    anexo: criarAnexo(),
  },
})

/**
 * Itens do menu "/" para os blocos do Quiron.
 *
 * Os itens dos blocos nativos saem prontos de getDefaultReactSlashMenuItems,
 * ja traduzidos pelo dicionario — estes tres sao os que o BlockNote nao tem
 * como conhecer.
 *
 * @param {import("@blocknote/core").BlockNoteEditor} editor
 */
export function itensDosBlocosQuiron(editor) {
  return [
    {
      title: "Destaque",
      subtext: "Caixa de dica, atenção ou boa prática",
      aliases: ["destaque", "dica", "callout", "aviso", "atencao", "nota"],
      group: "Blocos do Quíron",
      icon: <Lightbulb sx={{ fontSize: 18 }} />,
      onItemClick: () =>
        insertOrUpdateBlockForSlashMenu(editor, { type: "destaque", props: { variante: "dica" } }),
    },
    {
      title: "Vídeo",
      subtext: "Vídeo do YouTube, que toca aqui dentro",
      aliases: ["video", "youtube", "aula"],
      group: "Blocos do Quíron",
      icon: <Videocam sx={{ fontSize: 18 }} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "videoEmbutido" }),
    },
    {
      title: "Anexo",
      subtext: "Material de apoio: PDF, planilha, apresentação",
      aliases: ["anexo", "arquivo", "material", "pdf", "download"],
      group: "Blocos do Quíron",
      icon: <AttachFile sx={{ fontSize: 18 }} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "anexo" }),
    },
  ]
}
