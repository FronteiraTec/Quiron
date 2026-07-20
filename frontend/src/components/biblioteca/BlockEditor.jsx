/**
 * Editor de blocos estilo Notion — usado pelas AULAS da Biblioteca.
 *
 * Uma aula e uma lista ordenada de blocos. Cada bloco tem um tipo (titulo,
 * subtitulo, texto, lista, destaque, video, anexo, divisor) e edita-se inline,
 * sem modal. Ao passar o mouse num bloco aparece a "calha" a esquerda com:
 *   +  -> adiciona um bloco abaixo (menu com os tipos)
 *   ⠿  -> menu do bloco (transformar em, mover, excluir)
 *
 * Componente controlado: recebe `blocos` e devolve alteracoes via `onChange`.
 */
import { useState } from "react"
import {
  Box,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from "@mui/material"
import {
  Add,
  DragIndicator,
  ArrowUpward,
  ArrowDownward,
  DeleteOutline,
  Title,
  Segment,
  Notes,
  FormatListBulleted,
  Lightbulb,
  Videocam,
  AttachFile,
  HorizontalRule,
  OpenInNew,
} from "@mui/icons-material"
import { AnimatePresence, motion } from "framer-motion"
import { BLOCOS_TIPOS, criarBloco } from "../../data/bibliotecaMeta"

// Icone por tipo de bloco (usado nos menus).
const ICONE_BLOCO = {
  h1: Title,
  h2: Segment,
  paragrafo: Notes,
  lista: FormatListBulleted,
  callout: Lightbulb,
  video: Videocam,
  arquivo: AttachFile,
  divisor: HorizontalRule,
}

// Tipos que sao "texto" (podem ser transformados entre si).
const TIPOS_TEXTO = ["h1", "h2", "paragrafo", "lista", "callout"]

// Cores das variantes de destaque (callout).
const CALLOUT_VARIANTES = {
  dica: { cor: "#0ea5e9", bg: "#0ea5e914", rotulo: "Dica" },
  atencao: { cor: "#f59e0b", bg: "#f59e0b14", rotulo: "Atencao" },
  sucesso: { cor: "#22c55e", bg: "#22c55e14", rotulo: "Boa pratica" },
}

export default function BlockEditor({ blocos, onChange }) {
  // Menu de adicionar bloco: { ancora, index } (index = inserir apos).
  const [menuAdd, setMenuAdd] = useState(null)
  // Menu do bloco: { ancora, index }.
  const [menuBloco, setMenuBloco] = useState(null)

  const patch = (index, campos) =>
    onChange(blocos.map((b, i) => (i === index ? { ...b, ...campos } : b)))

  const inserirApos = (index, tipo) => {
    const nova = [...blocos]
    nova.splice(index + 1, 0, criarBloco(tipo))
    onChange(nova)
    setMenuAdd(null)
  }

  const transformar = (index, tipo) => {
    const b = blocos[index]
    patch(index, { tipo, ...(tipo === "callout" && !b.variante ? { variante: "dica" } : {}) })
    setMenuBloco(null)
  }

  const mover = (index, dir) => {
    const alvo = index + dir
    if (alvo < 0 || alvo >= blocos.length) return
    const nova = [...blocos]
    ;[nova[index], nova[alvo]] = [nova[alvo], nova[index]]
    onChange(nova)
    setMenuBloco(null)
  }

  const excluir = (index) => {
    onChange(blocos.filter((_, i) => i !== index))
    setMenuBloco(null)
  }

  return (
    <Box>
      <AnimatePresence initial={false}>
        {blocos.map((bloco, index) => (
          <motion.div
            key={bloco.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Box
              sx={{
                position: "relative",
                pl: 5,
                py: 0.25,
                borderRadius: 1,
                "&:hover .calha": { opacity: 1 },
              }}
            >
              {/* Calha de acoes (aparece no hover) */}
              <Box
                className="calha"
                sx={{
                  position: "absolute",
                  left: 0,
                  top: 6,
                  display: "flex",
                  opacity: 0,
                  transition: "opacity .12s",
                }}
              >
                <Tooltip title="Adicionar bloco" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => setMenuAdd({ ancora: e.currentTarget, index })}
                    sx={{ color: "text.disabled", p: 0.25 }}
                  >
                    <Add sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Opcoes do bloco" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => setMenuBloco({ ancora: e.currentTarget, index })}
                    sx={{ color: "text.disabled", p: 0.25, cursor: "grab" }}
                  >
                    <DragIndicator sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>

              <BlocoConteudo bloco={bloco} onPatch={(campos) => patch(index, campos)} />
            </Box>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Adicionar no fim */}
      <Box sx={{ pl: 5, mt: 1 }}>
        <Box
          onClick={(e) => setMenuAdd({ ancora: e.currentTarget, index: blocos.length - 1 })}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            color: "text.disabled",
            cursor: "pointer",
            fontSize: 14,
            "&:hover": { color: "text.secondary" },
          }}
        >
          <Add sx={{ fontSize: 18 }} /> Adicionar bloco
        </Box>
      </Box>

      {/* Menu: adicionar bloco */}
      <Menu
        anchorEl={menuAdd?.ancora}
        open={Boolean(menuAdd)}
        onClose={() => setMenuAdd(null)}
      >
        {Object.entries(BLOCOS_TIPOS).map(([tipo, meta]) => {
          const I = ICONE_BLOCO[tipo]
          return (
            <MenuItem key={tipo} onClick={() => inserirApos(menuAdd.index, tipo)}>
              <ListItemIcon>
                <I fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={meta.label} secondary={meta.atalho} />
            </MenuItem>
          )
        })}
      </Menu>

      {/* Menu: opcoes do bloco */}
      <Menu
        anchorEl={menuBloco?.ancora}
        open={Boolean(menuBloco)}
        onClose={() => setMenuBloco(null)}
      >
        {menuBloco && TIPOS_TEXTO.includes(blocos[menuBloco.index]?.tipo) && (
          <Typography
            variant="caption"
            sx={{ px: 2, py: 0.5, color: "text.disabled", fontWeight: 700 }}
          >
            TRANSFORMAR EM
          </Typography>
        )}
        {menuBloco &&
          TIPOS_TEXTO.includes(blocos[menuBloco.index]?.tipo) &&
          TIPOS_TEXTO.map((tipo) => {
            const I = ICONE_BLOCO[tipo]
            return (
              <MenuItem
                key={tipo}
                dense
                selected={blocos[menuBloco.index]?.tipo === tipo}
                onClick={() => transformar(menuBloco.index, tipo)}
              >
                <ListItemIcon>
                  <I fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={BLOCOS_TIPOS[tipo].label} />
              </MenuItem>
            )
          })}
        {menuBloco && TIPOS_TEXTO.includes(blocos[menuBloco.index]?.tipo) && <Divider />}
        <MenuItem dense onClick={() => mover(menuBloco.index, -1)}>
          <ListItemIcon>
            <ArrowUpward fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mover para cima" />
        </MenuItem>
        <MenuItem dense onClick={() => mover(menuBloco.index, 1)}>
          <ListItemIcon>
            <ArrowDownward fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Mover para baixo" />
        </MenuItem>
        <Divider />
        <MenuItem dense onClick={() => excluir(menuBloco.index)} sx={{ color: "error.main" }}>
          <ListItemIcon>
            <DeleteOutline fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="Excluir bloco" />
        </MenuItem>
      </Menu>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Render de um bloco conforme o tipo.
// ---------------------------------------------------------------------------
function BlocoConteudo({ bloco, onPatch }) {
  const campoTexto = (props) => (
    <TextField
      variant="standard"
      fullWidth
      multiline
      value={bloco.texto}
      onChange={(e) => onPatch({ texto: e.target.value })}
      InputProps={{ disableUnderline: true }}
      {...props}
    />
  )

  switch (bloco.tipo) {
    case "h1":
      return campoTexto({
        placeholder: "Titulo",
        sx: { "& textarea": { fontSize: 28, fontWeight: 800, lineHeight: 1.2 } },
      })
    case "h2":
      return campoTexto({
        placeholder: "Subtitulo",
        sx: { "& textarea": { fontSize: 20, fontWeight: 700, lineHeight: 1.3 } },
      })
    case "lista":
      return (
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ mt: "6px", fontSize: 18, lineHeight: 1, color: "text.secondary" }}>•</Box>
          {campoTexto({
            placeholder: "Item da lista",
            sx: { "& textarea": { fontSize: 15, lineHeight: 1.6 } },
          })}
        </Box>
      )
    case "callout": {
      const v = CALLOUT_VARIANTES[bloco.variante] || CALLOUT_VARIANTES.dica
      return (
        <Box
          sx={{
            display: "flex",
            gap: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: v.bg,
            border: "1px solid",
            borderColor: `${v.cor}55`,
          }}
        >
          <Lightbulb sx={{ color: v.cor, fontSize: 20, mt: 0.25 }} />
          <Box sx={{ flex: 1 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={bloco.variante || "dica"}
              onChange={(_, val) => val && onPatch({ variante: val })}
              sx={{ mb: 0.5, "& .MuiToggleButton-root": { py: 0, px: 1, fontSize: 11, textTransform: "none" } }}
            >
              {Object.entries(CALLOUT_VARIANTES).map(([k, meta]) => (
                <ToggleButton key={k} value={k}>
                  {meta.rotulo}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {campoTexto({
              placeholder: "Escreva o destaque…",
              sx: { "& textarea": { fontSize: 14, lineHeight: 1.5 } },
            })}
          </Box>
        </Box>
      )
    }
    case "video":
      return (
        <MidiaBloco
          bloco={bloco}
          onPatch={onPatch}
          icone={<Videocam sx={{ fontSize: 18 }} />}
          rotulo="Video"
          placeholderUrl="Cole o link do YouTube/Vimeo"
          placeholderNome="Titulo do video (opcional)"
        />
      )
    case "arquivo":
      return (
        <MidiaBloco
          bloco={bloco}
          onPatch={onPatch}
          icone={<AttachFile sx={{ fontSize: 18 }} />}
          rotulo="Anexo"
          placeholderUrl="URL do arquivo (ou faca upload depois)"
          placeholderNome="Nome do arquivo"
        />
      )
    case "divisor":
      return <Divider sx={{ my: 1.5 }} />
    default: // paragrafo
      return campoTexto({
        placeholder: "Escreva algo, ou clique no + para adicionar um bloco…",
        sx: { "& textarea": { fontSize: 15, lineHeight: 1.7 } },
      })
  }
}

// Bloco de midia (video/anexo): url + nome, com preview do link.
function MidiaBloco({ bloco, onPatch, icone, rotulo, placeholderUrl, placeholderNome }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "action.hover",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        {icone}
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          {rotulo.toUpperCase()}
        </Typography>
        {bloco.url && (
          <Tooltip title="Abrir" arrow>
            <IconButton
              size="small"
              component="a"
              href={bloco.url}
              target="_blank"
              rel="noopener"
              sx={{ ml: "auto", p: 0.25 }}
            >
              <OpenInNew sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <TextField
        size="small"
        fullWidth
        value={bloco.nome || ""}
        onChange={(e) => onPatch({ nome: e.target.value })}
        placeholder={placeholderNome}
        sx={{ mb: 1 }}
      />
      <TextField
        size="small"
        fullWidth
        value={bloco.url || ""}
        onChange={(e) => onPatch({ url: e.target.value })}
        placeholder={placeholderUrl}
      />
    </Box>
  )
}
