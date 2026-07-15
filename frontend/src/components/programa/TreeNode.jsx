/**
 * Um no da arvore do programa (fase, modulo ou tarefa), recursivo.
 *
 * Responsavel por:
 *  - indicador visual do nivel (indentacao + barra de acento colorida)
 *  - expandir/recolher (chevron) quando o no tem filhos
 *  - selecao (destaca e abre o Inspector)
 *  - acoes ao hover: adicionar filho (+) e menu de contexto (...)
 *  - drag and drop entre irmaos (HTML5 nativo, sem dependencias)
 *  - realce do termo buscado
 */
import { useState } from "react"
import { Box, Typography, IconButton, Tooltip, Chip } from "@mui/material"
import {
  ChevronRight,
  ExpandMore,
  Add,
  MoreHoriz,
  DragIndicator,
} from "@mui/icons-material"
import { motion, AnimatePresence } from "framer-motion"
import { TIPO_META } from "../../data/programaMock"
import QuickAdd from "./QuickAdd"

// Realca o trecho que casa com a busca dentro do nome do no.
function Realce({ texto, termo, cor }) {
  if (!termo) return texto
  const i = texto.toLowerCase().indexOf(termo.toLowerCase())
  if (i < 0) return texto
  return (
    <>
      {texto.slice(0, i)}
      <Box component="span" sx={{ bgcolor: `${cor}33`, borderRadius: 0.5, px: 0.25 }}>
        {texto.slice(i, i + termo.length)}
      </Box>
      {texto.slice(i + termo.length)}
    </>
  )
}

export default function TreeNode({
  no,
  nivel = 0,
  ctx, // { selecionadoId, expandidos, termo, ...acoes }
}) {
  const meta = TIPO_META[no.tipo]
  const Icone = meta.icon
  const filhos = meta.childKey ? no[meta.childKey] : null
  const temFilhos = Array.isArray(filhos)
  const aberto = ctx.expandidos[no.id]
  const selecionado = ctx.selecionadoId === no.id

  const [hover, setHover] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const onDragStart = (e) => {
    e.stopPropagation()
    e.dataTransfer.setData("text/plain", no.id)
    e.dataTransfer.effectAllowed = "move"
  }
  const onDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }
  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const dragId = e.dataTransfer.getData("text/plain")
    if (dragId) ctx.reordenar(dragId, no.id)
  }

  return (
    <Box>
      <motion.div layout="position" transition={{ duration: 0.18 }}>
        <Box
          draggable
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={() => ctx.setSelecionadoId(no.id)}
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            ml: `${nivel * 22}px`,
            pl: 1,
            pr: 0.5,
            py: 0.6,
            my: 0.15,
            borderRadius: "6px",
            cursor: "pointer",
            userSelect: "none",
            borderTop: dragOver ? `2px solid ${meta.cor}` : "2px solid transparent",
            bgcolor: selecionado ? `${meta.cor}18` : "transparent",
            boxShadow: selecionado ? `inset 3px 0 0 ${meta.cor}` : "none",
            transition: "background-color .15s, box-shadow .15s",
            opacity: no.ativo ? 1 : 0.55,
            "&:hover": { bgcolor: selecionado ? `${meta.cor}22` : "action.hover" },
          }}
        >
          {/* Alca de arraste (aparece no hover) */}
          <DragIndicator
            sx={{
              fontSize: 16,
              color: "text.disabled",
              opacity: hover ? 1 : 0,
              cursor: "grab",
              transition: "opacity .15s",
            }}
          />

          {/* Chevron de expandir/recolher */}
          {temFilhos ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                ctx.alternarExpandido(no.id)
              }}
              sx={{ p: 0.25 }}
            >
              {aberto ? (
                <ExpandMore sx={{ fontSize: 18 }} />
              ) : (
                <ChevronRight sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          ) : (
            <Box sx={{ width: 26 }} />
          )}

          {/* Icone do tipo */}
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 26,
              height: 26,
              borderRadius: "5px",
              bgcolor: `${meta.cor}1f`,
              color: meta.cor,
              flexShrink: 0,
            }}
          >
            <Icone sx={{ fontSize: 16 }} />
          </Box>

          {/* Nome */}
          <Typography
            noWrap
            sx={{
              flex: 1,
              fontSize: 13.5,
              fontWeight: no.tipo === "fase" ? 600 : 500,
              color: "text.primary",
            }}
          >
            <Realce texto={no.nome} termo={ctx.termo} cor={meta.cor} />
          </Typography>

          {/* Contagem de filhos / status inativo */}
          {!hover && temFilhos && filhos.length > 0 && (
            <Chip
              label={filhos.length}
              size="small"
              sx={{
                height: 18,
                fontSize: 11,
                bgcolor: "action.hover",
                color: "text.secondary",
              }}
            />
          )}
          {!no.ativo && !hover && (
            <Chip
              label="inativo"
              size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: "action.hover" }}
            />
          )}

          {/* Acoes no hover: adicionar filho + menu */}
          {hover && (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {meta.childTipo && (
                <Tooltip title={`Adicionar ${meta.childLabel}`} arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      ctx.adicionar(no.id, meta.childTipo)
                    }}
                    sx={{ p: 0.4 }}
                  >
                    <Add sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Acoes" arrow>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    ctx.abrirMenu(e.currentTarget, no)
                  }}
                  sx={{ p: 0.4 }}
                >
                  <MoreHoriz sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </motion.div>

      {/* Filhos (com animacao de abrir/fechar) */}
      <AnimatePresence initial={false}>
        {temFilhos && aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {filhos.map((filho) => (
              <TreeNode key={filho.id} no={filho} nivel={nivel + 1} ctx={ctx} />
            ))}
            {/* Entrada rapida para o proximo filho */}
            <QuickAdd
              tipoFilho={meta.childTipo}
              cor={TIPO_META[meta.childTipo].cor}
              indent={nivel + 1}
              onAdd={(nome) => ctx.adicionar(no.id, meta.childTipo, nome)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
