/**
 * A area de itens do explorador: o miolo do "gerenciador de arquivos".
 *
 * Duas visoes, como no Windows — ICONES (a grade, com miniatura das imagens) e
 * DETALHES (a lista com colunas que ordenam) — e os gestos de la:
 *
 *   clique              seleciona (Ctrl soma, Shift estende)
 *   duplo clique        abre: a pasta entra, o arquivo abre no visualizador
 *   botao direito       o menu do item (ou o da pasta, no espaco vazio)
 *   arrastar            move a selecao para uma pasta
 *   soltar arquivos     envia do computador para a pasta (a aberta, ou a de baixo)
 *   teclado             setas, Enter, F2, Delete, Backspace, Ctrl+A, Esc
 *
 * Em tela de toque nao ha duplo clique nem botao direito: um toque abre, e o
 * "⋮" de cada item traz o menu.
 *
 * O estado (selecao, o item sendo renomeado) mora no explorador; aqui ficam o
 * desenho e a traducao dos gestos.
 */
import { useEffect, useRef } from "react"
import { Box, ButtonBase, Chip, IconButton, LinearProgress, TextField, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { ArrowDownward, ArrowUpward, CloudUpload, MoreVert, Share } from "@mui/icons-material"
import IconeItem from "./IconeItem"
import { iniciarArrasto, terminarArrasto, useAlvoSoltar } from "./arrastar"
import { formatarTamanho } from "../../../services/arquivos"
import { FORMATOS, dataBR, formatoDoMaterial } from "../../../data/espacoMentorMeta"
import { chaveDe, ehPasta, nomeDoItem, podeSoltar, rotuloDoLocal } from "../../../data/exploradorMeta"

/** O veu da selecao: o mesmo da Sidebar e dos menus (theme.js). */
const veu = (forte) => (t) => alpha(t.palette.primary.vivo || t.palette.primary.main, t.palette.mode === "dark" ? (forte ? 0.24 : 0.16) : forte ? 0.32 : 0.22)

const COLUNAS = [
  { campo: "nome", rotulo: "Nome" },
  { campo: "atualizado", rotulo: "Data de modificação" },
  { campo: "tipo", rotulo: "Tipo" },
  { campo: "tamanho", rotulo: "Tamanho", direita: true },
]

export default function AreaItens({
  itens,
  visao,
  plana,
  pastas,
  idPastaAtual,
  nomePastaAtual,
  aceitaSoltar,
  selecao,
  ancora,
  renomeando,
  ordenacao,
  carregando,
  toque,
  compacto,
  vazio,
  onSelecao,
  onAbrir,
  onMenu,
  onTecla,
  onRenomear,
  onCancelarRenomear,
  onOrdenar,
  onSoltarItens,
  onSoltarArquivos,
}) {
  const elementos = useRef(new Map())
  const area = useRef(null)

  // O item que ganhou a selecao pelo teclado vem para a tela.
  useEffect(() => {
    if (ancora) elementos.current.get(ancora)?.scrollIntoView?.({ block: "nearest" })
  }, [ancora])

  const alvoArea = useAlvoSoltar({
    aceitaItens: aceitaSoltar ? (arrastados) => podeSoltar(pastas, arrastados, idPastaAtual) : undefined,
    onItens: aceitaSoltar ? (arrastados) => onSoltarItens(arrastados, idPastaAtual) : undefined,
    onArquivos: aceitaSoltar ? (arquivos) => onSoltarArquivos(arquivos, idPastaAtual) : undefined,
  })

  const indice = (chave) => itens.findIndex((i) => chaveDe(i) === chave)

  const clicar = (item, e) => {
    const chave = chaveDe(item)
    if (toque) {
      onAbrir(item)
      return
    }
    if (e.shiftKey && ancora && indice(ancora) >= 0) {
      const [a, b] = [indice(ancora), indice(chave)].sort((x, y) => x - y)
      const faixa = itens.slice(a, b + 1).map(chaveDe)
      onSelecao(new Set([...(e.ctrlKey || e.metaKey ? selecao : []), ...faixa]), ancora)
    } else if (e.ctrlKey || e.metaKey) {
      const nova = new Set(selecao)
      if (nova.has(chave)) nova.delete(chave)
      else nova.add(chave)
      onSelecao(nova, chave)
    } else {
      onSelecao(new Set([chave]), chave)
    }
  }

  const menuDoItem = (item, e) => {
    e.preventDefault()
    e.stopPropagation()
    const chave = chaveDe(item)
    if (!selecao.has(chave)) onSelecao(new Set([chave]), chave)
    onMenu(e, item)
  }

  const comecarArrasto = (item, e) => {
    const chave = chaveDe(item)
    let arrastados
    if (selecao.has(chave)) {
      arrastados = itens.filter((i) => selecao.has(chaveDe(i)))
    } else {
      arrastados = [item]
      onSelecao(new Set([chave]), chave)
    }
    iniciarArrasto(e, arrastados)
  }

  const mover = (passo, estender) => {
    if (!itens.length) return
    const atual = ancora ? indice(ancora) : -1
    const destino = Math.min(itens.length - 1, Math.max(0, atual < 0 ? 0 : atual + passo))
    const chave = chaveDe(itens[destino])
    if (estender && ancora) {
      const nova = new Set(selecao)
      nova.add(chave)
      onSelecao(nova, chave)
    } else {
      onSelecao(new Set([chave]), chave)
    }
  }

  const teclas = (e) => {
    if (e.target.closest?.("input, textarea")) return
    // Alt+← / Alt+→ (voltar, avancar) e Alt+Enter (propriedades) sao do
    // explorador inteiro: passam adiante.
    if (e.altKey && ["ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) return
    const ctrl = e.ctrlKey || e.metaKey
    const acoes = {
      ArrowDown: () => mover(1, e.shiftKey),
      ArrowRight: () => mover(1, e.shiftKey),
      ArrowUp: () => (e.altKey ? onTecla("subir") : mover(-1, e.shiftKey)),
      ArrowLeft: () => mover(-1, e.shiftKey),
      Home: () => mover(-itens.length, false),
      End: () => mover(itens.length, false),
      Enter: () => onTecla("abrir"),
      F2: () => onTecla("renomear"),
      Delete: () => onTecla("excluir"),
      Backspace: () => onTecla("subir"),
      Escape: () => onSelecao(new Set(), null),
      ContextMenu: () => onTecla("menu", elementos.current.get(ancora)),
    }
    if (ctrl && (e.key === "a" || e.key === "A")) {
      e.preventDefault()
      onSelecao(new Set(itens.map(chaveDe)), ancora)
      return
    }
    if (e.key === "F10" && e.shiftKey) {
      e.preventDefault()
      onTecla("menu", elementos.current.get(ancora))
      return
    }
    const acao = acoes[e.key]
    if (acao) {
      e.preventDefault()
      acao()
    }
  }

  const props = (item) => ({
    item,
    pastas,
    plana,
    toque,
    selecionado: selecao.has(chaveDe(item)),
    renomeando: renomeando === chaveDe(item),
    registrar: (el) => {
      if (el) elementos.current.set(chaveDe(item), el)
      else elementos.current.delete(chaveDe(item))
    },
    onClick: (e) => {
      e.stopPropagation()
      clicar(item, e)
    },
    onDoubleClick: (e) => {
      e.stopPropagation()
      if (!toque) onAbrir(item)
    },
    onContextMenu: (e) => menuDoItem(item, e),
    onMenuBotao: (e) => menuDoItem(item, e),
    onDragStart: (e) => comecarArrasto(item, e),
    onDragEnd: terminarArrasto,
    onRenomear: (nome) => onRenomear(item, nome),
    onCancelarRenomear,
    onSoltarItens,
    onSoltarArquivos,
  })

  const soltandoArquivos = alvoArea.aceso

  return (
    <Box
      ref={area}
      role="listbox"
      aria-multiselectable="true"
      aria-label="Itens da pasta"
      tabIndex={0}
      onKeyDown={teclas}
      onClick={() => onSelecao(new Set(), null)}
      onContextMenu={(e) => {
        e.preventDefault()
        onSelecao(new Set(), null)
        onMenu(e, null)
      }}
      {...alvoArea.props}
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 320,
        overflow: "auto",
        outline: "none",
        "&:focus-visible": { boxShadow: (t) => `inset 0 0 0 2px ${t.palette.primary.main}` },
      }}
    >
      {carregando && <LinearProgress sx={{ position: "sticky", top: 0, zIndex: 2, height: 2 }} />}

      {itens.length === 0 ? (
        !carregando && vazio
      ) : visao === "grade" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "repeat(auto-fill, minmax(104px, 1fr))", sm: "repeat(auto-fill, minmax(124px, 1fr))" },
            gap: 1,
            p: 1.5,
          }}
        >
          {itens.map((item) => (
            <ItemGrade key={chaveDe(item)} {...props(item)} />
          ))}
        </Box>
      ) : (
        <Box sx={{ minWidth: compacto ? 0 : 720 }}>
          <Cabecalho ordenacao={ordenacao} onOrdenar={onOrdenar} plana={plana} compacto={compacto} />
          {itens.map((item) => (
            <LinhaDetalhe key={chaveDe(item)} {...props(item)} compacto={compacto} />
          ))}
        </Box>
      )}

      {soltandoArquivos && (
        <Box
          sx={{
            position: "absolute",
            inset: 8,
            border: "2px dashed",
            borderColor: "primary.main",
            borderRadius: "8px",
            bgcolor: (t) => alpha(t.palette.background.paper, 0.85),
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <CloudUpload sx={{ fontSize: 40, color: "primary.main" }} />
            <Typography sx={{ fontWeight: 700 }}>Solte para colocar em {nomePastaAtual}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------------------

function gridDetalhes(plana, compacto) {
  if (compacto) return "minmax(0, 1fr) 96px 36px"
  return `minmax(240px, 3fr) 150px 120px 90px minmax(150px, 1.4fr)${plana ? " minmax(160px, 1.4fr)" : ""} 36px`
}

function Cabecalho({ ordenacao, onOrdenar, plana, compacto }) {
  const colunas = compacto ? COLUNAS.slice(0, 2) : COLUNAS
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: gridDetalhes(plana, compacto),
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 1,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        px: 1,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {colunas.map((c) => {
        const ativa = ordenacao.campo === c.campo
        const Seta = ordenacao.direcao === "desc" ? ArrowDownward : ArrowUpward
        return (
          <ButtonBase
            key={c.campo}
            onClick={() => onOrdenar(c.campo)}
            sx={{
              justifyContent: c.direita ? "flex-end" : "flex-start",
              gap: 0.5,
              px: 1,
              py: 1,
              fontSize: 12,
              fontWeight: 700,
              color: ativa ? "text.primary" : "text.secondary",
              borderRadius: "4px",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            {c.rotulo}
            {ativa && <Seta sx={{ fontSize: 14 }} />}
          </ButtonBase>
        )
      })}
      {!compacto && (
        <Typography sx={{ px: 1, fontSize: 12, fontWeight: 700, color: "text.secondary" }}>Compartilhado com</Typography>
      )}
      {!compacto && plana && (
        <Typography sx={{ px: 1, fontSize: 12, fontWeight: 700, color: "text.secondary" }}>Local</Typography>
      )}
      <span />
    </Box>
  )
}

/** O que os dois desenhos de item tem em comum: selecao, arrasto e alvo. */
function useItem({ item, pastas, renomeando, onSoltarItens, onSoltarArquivos }) {
  const pasta = ehPasta(item)
  const alvo = useAlvoSoltar({
    aceitaItens: pasta ? (arrastados) => podeSoltar(pastas, arrastados, item.id_pasta) : undefined,
    onItens: pasta ? (arrastados) => onSoltarItens(arrastados, item.id_pasta) : undefined,
    onArquivos: pasta ? (arquivos) => onSoltarArquivos(arquivos, item.id_pasta) : undefined,
  })
  return { pasta, alvo, arrastavel: !renomeando }
}

function ItemGrade(p) {
  const { item, selecionado, renomeando, plana, pastas, toque, registrar } = p
  const { pasta, alvo, arrastavel } = useItem(p)
  const compartilhado = !pasta && item.total_compartilhamentos > 0

  return (
    <Box
      ref={registrar}
      role="option"
      aria-selected={selecionado}
      draggable={arrastavel}
      onDragStart={p.onDragStart}
      onDragEnd={p.onDragEnd}
      onClick={p.onClick}
      onDoubleClick={p.onDoubleClick}
      onContextMenu={p.onContextMenu}
      {...alvo.props}
      title={nomeDoItem(item)}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        p: 1.25,
        pt: 1.5,
        borderRadius: "8px",
        cursor: "default",
        userSelect: "none",
        border: 1,
        borderColor: alvo.aceso ? "primary.main" : "transparent",
        bgcolor: alvo.aceso || selecionado ? veu(alvo.aceso) : "transparent",
        "&:hover": { bgcolor: selecionado ? veu(true) : "action.hover" },
        "&:hover .menu-item, &:focus-within .menu-item": { opacity: 1 },
      }}
    >
      <Box sx={{ position: "relative", height: 64, display: "grid", placeItems: "center" }}>
        <IconeItem item={item} tamanho={pasta ? 64 : 52} miniatura />
        {compartilhado && (
          <Tooltip title={`Compartilhado com ${(item.startups_compartilhadas || []).map((s) => s.nome).join(", ")}`}>
            <Box
              sx={{
                position: "absolute",
                right: -6,
                bottom: -2,
                display: "grid",
                placeItems: "center",
                width: 20,
                height: 20,
                borderRadius: "50%",
                bgcolor: "background.paper",
                boxShadow: 1,
              }}
            >
              <Share sx={{ fontSize: 12, color: "primary.main" }} />
            </Box>
          </Tooltip>
        )}
      </Box>
      {renomeando ? (
        <CampoNome nome={nomeDoItem(item)} onConfirmar={p.onRenomear} onCancelar={p.onCancelarRenomear} />
      ) : (
        <Typography
          variant="body2"
          sx={{
            textAlign: "center",
            fontWeight: 500,
            lineHeight: 1.3,
            wordBreak: "break-word",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {nomeDoItem(item)}
        </Typography>
      )}
      {plana && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: "100%" }}>
          {rotuloDoLocal(pastas, pasta ? item.id_pasta_pai : item.id_pasta)}
        </Typography>
      )}
      <IconButton
        className="menu-item"
        size="small"
        aria-label={`Ações de ${nomeDoItem(item)}`}
        onClick={p.onMenuBotao}
        onDoubleClick={(e) => e.stopPropagation()}
        sx={{ position: "absolute", top: 2, right: 2, opacity: toque ? 1 : 0, p: 0.25 }}
      >
        <MoreVert sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  )
}

function LinhaDetalhe(p) {
  const { item, selecionado, renomeando, plana, pastas, compacto, registrar } = p
  const { pasta, alvo, arrastavel } = useItem(p)
  const startups = item.startups_compartilhadas || []
  const formato = pasta ? "Pasta de arquivos" : FORMATOS[formatoDoMaterial(item)]?.rotulo

  return (
    <Box
      ref={registrar}
      role="option"
      aria-selected={selecionado}
      draggable={arrastavel}
      onDragStart={p.onDragStart}
      onDragEnd={p.onDragEnd}
      onClick={p.onClick}
      onDoubleClick={p.onDoubleClick}
      onContextMenu={p.onContextMenu}
      {...alvo.props}
      sx={{
        display: "grid",
        gridTemplateColumns: gridDetalhes(plana, compacto),
        alignItems: "center",
        minHeight: 40,
        px: 1,
        cursor: "default",
        userSelect: "none",
        borderBottom: 1,
        borderColor: "divider",
        outline: alvo.aceso ? "2px dashed" : "none",
        outlineColor: "primary.main",
        outlineOffset: -2,
        bgcolor: alvo.aceso || selecionado ? veu(alvo.aceso) : "transparent",
        "&:hover": { bgcolor: selecionado ? veu(true) : "action.hover" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 1, minWidth: 0 }}>
        <IconeItem item={item} tamanho={22} />
        {renomeando ? (
          <CampoNome nome={nomeDoItem(item)} onConfirmar={p.onRenomear} onCancelar={p.onCancelarRenomear} linha />
        ) : (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {nomeDoItem(item)}
            </Typography>
            {compacto && plana && (
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {rotuloDoLocal(pastas, pasta ? item.id_pasta_pai : item.id_pasta)}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <Celula>{dataBR(item.atualizado_ts)}</Celula>
      {!compacto && <Celula>{formato}</Celula>}
      {!compacto && <Celula direita>{pasta ? "" : formatarTamanho(item.arquivo_tamanho)}</Celula>}
      {!compacto && (
        <Box sx={{ px: 1, minWidth: 0 }}>
          {!pasta && startups.length > 0 && (
            <Tooltip title={startups.map((s) => s.nome).join(", ")}>
              <Chip
                size="small"
                icon={<Share sx={{ fontSize: 14 }} />}
                label={startups.length === 1 ? startups[0].nome : `${startups.length} startups`}
                sx={{ maxWidth: "100%" }}
              />
            </Tooltip>
          )}
        </Box>
      )}
      {!compacto && plana && <Celula>{rotuloDoLocal(pastas, pasta ? item.id_pasta_pai : item.id_pasta)}</Celula>}
      <IconButton
        size="small"
        aria-label={`Ações de ${nomeDoItem(item)}`}
        onClick={p.onMenuBotao}
        onDoubleClick={(e) => e.stopPropagation()}
        sx={{ p: 0.5 }}
      >
        <MoreVert sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  )
}

function Celula({ children, direita }) {
  return (
    <Typography variant="body2" color="text.secondary" noWrap sx={{ px: 1, textAlign: direita ? "right" : "left" }}>
      {children}
    </Typography>
  )
}

/**
 * Renomear no lugar (F2). Enter grava, Esc desiste, sair do campo grava — o
 * comportamento do Windows. O texto vem todo selecionado, para digitar por cima.
 */
function CampoNome({ nome, onConfirmar, onCancelar, linha }) {
  const feito = useRef(false)
  const terminar = (valor) => {
    if (feito.current) return
    feito.current = true
    const limpo = valor.trim()
    if (!limpo || limpo === nome) onCancelar()
    else onConfirmar(limpo)
  }
  const parar = (e) => e.stopPropagation()

  return (
    <TextField
      autoFocus
      size="small"
      defaultValue={nome}
      fullWidth
      multiline={!linha}
      maxRows={3}
      inputProps={{ maxLength: 200, "aria-label": "Novo nome" }}
      onFocus={(e) => e.target.select()}
      onClick={parar}
      onDoubleClick={parar}
      onContextMenu={parar}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Enter") {
          e.preventDefault()
          terminar(e.target.value)
        } else if (e.key === "Escape") {
          e.preventDefault()
          feito.current = true
          onCancelar()
        }
      }}
      onBlur={(e) => terminar(e.target.value)}
      sx={{ "& .MuiInputBase-root": { fontSize: 14, py: linha ? 0 : 0.5 }, "& textarea": { textAlign: "center" } }}
    />
  )
}
