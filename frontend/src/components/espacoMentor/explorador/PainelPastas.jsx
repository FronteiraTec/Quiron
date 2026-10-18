/**
 * O painel de navegacao do explorador: a arvore de pastas, com "Minha
 * biblioteca" na raiz e "Arquivados" no fim — o lugar do "Este computador" e
 * da "Lixeira" no Windows.
 *
 * Cada no e tambem um alvo: soltar itens move, soltar arquivos do computador
 * envia para la. Abrir uma pasta pela area expande o caminho ate ela, para que
 * a pessoa sempre veja onde esta.
 */
import { useEffect, useState } from "react"
import { Box, ButtonBase, IconButton, Typography } from "@mui/material"
import { ChevronRight, ExpandMore, Inventory2Outlined, LocalLibrary } from "@mui/icons-material"
import IconeItem from "./IconeItem"
import { useAlvoSoltar } from "./arrastar"
import { ARQUIVADOS, caminhoDaPasta, podeSoltar, subpastas } from "../../../data/exploradorMeta"

export default function PainelPastas({ pastas, atual, totalArquivados, onAbrir, onSoltarItens, onSoltarArquivos, onMenu }) {
  const [abertas, setAbertas] = useState(() => new Set())

  // O caminho ate a pasta aberta fica sempre expandido.
  useEffect(() => {
    if (atual === null || atual === ARQUIVADOS) return
    const caminho = caminhoDaPasta(pastas, atual).slice(0, -1)
    if (!caminho.length) return
    setAbertas((a) => {
      const nova = new Set(a)
      caminho.forEach((p) => nova.add(p.id_pasta))
      return nova
    })
  }, [atual, pastas])

  const alternar = (id) =>
    setAbertas((a) => {
      const nova = new Set(a)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })

  const comum = { pastas, atual, abertas, alternar, onAbrir, onSoltarItens, onSoltarArquivos, onMenu }

  return (
    <Box component="nav" aria-label="Pastas" sx={{ py: 1, overflowY: "auto", height: "100%" }}>
      <Box role="tree">
        <No {...comum} pasta={null} nivel={0} />
      </Box>
      <Box sx={{ mx: 1.5, my: 1, borderTop: 1, borderColor: "divider" }} />
      <Linha
        selecionada={atual === ARQUIVADOS}
        nivel={0}
        icone={<Inventory2Outlined sx={{ fontSize: 20, color: "text.secondary" }} />}
        rotulo="Arquivados"
        contador={totalArquivados}
        onClick={() => onAbrir(ARQUIVADOS)}
      />
    </Box>
  )
}

function No({ pasta, nivel, pastas, atual, abertas, alternar, onAbrir, onSoltarItens, onSoltarArquivos, onMenu }) {
  const id = pasta ? pasta.id_pasta : null
  const filhas = subpastas(pastas, id)
  const raiz = id === null
  const expandida = raiz || abertas.has(id)

  const alvo = useAlvoSoltar({
    aceitaItens: (itens) => podeSoltar(pastas, itens, id),
    onItens: (itens) => onSoltarItens(itens, id),
    onArquivos: (arquivos) => onSoltarArquivos(arquivos, id),
  })

  return (
    <Box role="treeitem" aria-expanded={filhas.length ? expandida : undefined} aria-selected={atual === id}>
      <Linha
        selecionada={atual === id}
        aceso={alvo.aceso}
        nivel={nivel}
        alvoProps={alvo.props}
        expansor={
          filhas.length && !raiz ? (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                alternar(id)
              }}
              aria-label={expandida ? `Recolher ${pasta.nome}` : `Expandir ${pasta.nome}`}
              sx={{ p: 0.25 }}
            >
              {expandida ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
            </IconButton>
          ) : null
        }
        icone={
          raiz ? (
            <LocalLibrary sx={{ fontSize: 20, color: "primary.main" }} />
          ) : (
            <IconeItem item={pasta} tamanho={20} aberta={atual === id} />
          )
        }
        rotulo={raiz ? "Minha biblioteca" : pasta.nome}
        onClick={() => onAbrir(id)}
        onContextMenu={pasta ? (e) => onMenu(e, pasta) : undefined}
      />
      {expandida && filhas.length > 0 && (
        <Box role="group">
          {filhas.map((f) => (
            <No
              key={f.id_pasta}
              pasta={f}
              nivel={nivel + 1}
              pastas={pastas}
              atual={atual}
              abertas={abertas}
              alternar={alternar}
              onAbrir={onAbrir}
              onSoltarItens={onSoltarItens}
              onSoltarArquivos={onSoltarArquivos}
              onMenu={onMenu}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

function Linha({ selecionada, aceso, nivel, alvoProps, expansor, icone, rotulo, contador, onClick, onContextMenu }) {
  return (
    <Box
      {...alvoProps}
      sx={{
        display: "flex",
        alignItems: "center",
        mx: 1,
        pl: 0.5 + nivel * 1.5,
        borderRadius: "6px",
        outline: aceso ? "2px dashed" : "none",
        outlineColor: "primary.main",
        bgcolor: aceso ? "action.hover" : selecionada ? "action.selected" : "transparent",
        "&:hover": { bgcolor: selecionada ? "action.selected" : "action.hover" },
      }}
    >
      <Box sx={{ width: 24, display: "grid", placeItems: "center", flexShrink: 0 }}>{expansor}</Box>
      <ButtonBase
        onClick={onClick}
        onContextMenu={onContextMenu}
        sx={{ flex: 1, minWidth: 0, justifyContent: "flex-start", gap: 1, py: 0.6, pr: 1, borderRadius: "6px" }}
      >
        {icone}
        <Typography variant="body2" noWrap sx={{ fontWeight: selecionada ? 700 : 500, flex: 1, textAlign: "left" }}>
          {rotulo}
        </Typography>
        {contador > 0 && (
          <Typography variant="caption" color="text.secondary">
            {contador}
          </Typography>
        )}
      </ButtonBase>
    </Box>
  )
}
