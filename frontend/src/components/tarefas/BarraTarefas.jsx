/**
 * A barra de pesquisa e filtros da tela de Tarefas, acima das duas
 * visualizacoes.
 *
 * POR QUE NAO A ToolbarTabela: ela e a barra de todas as listagens e nao tem
 * lugar para o que esta tela precisa mostrar — os filtros RAPIDOS (prioridade,
 * responsavel, startup a um clique, sem abrir o painel), a linha de filtros
 * ativos com o "x" de cada um, e o total do recorte. Mexer nela mudaria
 * Startups, Membros e os relatorios junto. O modo selecao (linhas marcadas na
 * tabela) e o mesmo de la, para o gesto ser igual nas duas telas.
 *
 * O PAINEL CONTINUA SENDO A FONTE: os filtros rapidos escrevem no mesmo objeto
 * `filtros` que o PainelFiltros, entao abrir o painel mostra marcado o que foi
 * escolhido aqui, e vice-versa. Os rapidos so aparecem do tablet para cima; no
 * celular fica o botao "Filtros", que tem tudo.
 */
import { useId, useState } from "react"
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material"
import { ArrowDropDown, Close, Download, FilterList, Search } from "@mui/icons-material"

/** Acima disto o filtro rapido ganha uma busca propria. */
const ITENS_PARA_BUSCA = 8

/**
 * Um filtro de lista num popover: o rotulo do grupo, a contagem do que esta
 * marcado e a lista de marcar. Aplica a cada clique — ao contrario do painel,
 * aqui nao ha "Aplicar": o popover e pequeno e a lista atras dele e o retorno.
 *
 * Popover + List, e nao Menu: o Menu move o foco a cada letra digitada (busca
 * por inicial), o que torna impossivel escrever no campo de busca dentro dele.
 */
function FiltroRapido({ grupo, valor = [], onChange }) {
  const [ancora, setAncora] = useState(null)
  const [busca, setBusca] = useState("")
  const idPopover = useId()
  const marcados = Array.isArray(valor) ? valor : []
  const itens = grupo.itens || []
  const termo = busca.trim().toLowerCase()
  const visiveis = termo ? itens.filter((it) => it.rotulo.toLowerCase().includes(termo)) : itens

  const alternar = (id) =>
    onChange(marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id])

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color={marcados.length ? "primary" : "inherit"}
        endIcon={<ArrowDropDown />}
        onClick={(e) => setAncora(e.currentTarget)}
        aria-haspopup="true"
        aria-expanded={Boolean(ancora)}
        aria-controls={ancora ? idPopover : undefined}
        sx={{
          whiteSpace: "nowrap",
          fontWeight: 600,
          letterSpacing: 0,
          textTransform: "none",
          borderColor: marcados.length ? undefined : "divider",
          color: marcados.length ? "primary.main" : "text.primary",
          bgcolor: (t) => (marcados.length ? t.palette.action.selected : "transparent"),
        }}
      >
        {grupo.rotulo}
        {marcados.length > 0 && (
          <Box
            component="span"
            sx={{
              ml: 0.75,
              minWidth: 18,
              height: 18,
              px: 0.5,
              borderRadius: 9,
              bgcolor: "primary.vivo",
              color: "primary.vivoContraste",
              fontSize: 11,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {marcados.length}
          </Box>
        )}
      </Button>

      <Popover
        id={idPopover}
        open={Boolean(ancora)}
        anchorEl={ancora}
        onClose={() => {
          setAncora(null)
          setBusca("")
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { width: 280, mt: 0.5 } }}
      >
        {itens.length > ITENS_PARA_BUSCA && (
          <Box sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder={`Buscar ${grupo.rotulo.toLowerCase()}...`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              inputProps={{ "aria-label": `Buscar em ${grupo.rotulo}` }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        )}

        <List dense sx={{ maxHeight: 320, overflowY: "auto", py: 0.5 }} aria-label={grupo.rotulo}>
          {visiveis.map((item) => {
            const marcado = marcados.includes(item.id)
            return (
              <ListItemButton
                key={item.id}
                role="checkbox"
                aria-checked={marcado}
                onClick={() => alternar(item.id)}
                sx={{ py: 0.25 }}
              >
                <ListItemIcon sx={{ minWidth: 34 }}>
                  <Checkbox edge="start" size="small" checked={marcado} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText primary={item.rotulo} primaryTypographyProps={{ variant: "body2", noWrap: true }} />
              </ListItemButton>
            )
          })}
          {visiveis.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
              Nada encontrado.
            </Typography>
          )}
        </List>

        {marcados.length > 0 && (
          <Box sx={{ px: 1, py: 0.5, borderTop: 1, borderColor: "divider", display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => onChange([])}>
              Limpar
            </Button>
          </Box>
        )}
      </Popover>
    </>
  )
}

/**
 * @param {object} props
 * @param {string} props.busca
 * @param {(texto: string) => void} props.onBuscaChange
 * @param {Array<object>} props.gruposRapidos - grupos do PainelFiltros que viram botao.
 * @param {object} props.filtros
 * @param {(filtros: object) => void} props.onFiltrosChange
 * @param {number} props.totalFiltros
 * @param {() => void} props.onAbrirFiltros
 * @param {Array<{chave: string, rotulo: string, onRemover: () => void, destaque?: boolean}>} props.chips
 * @param {() => void} props.onLimparTudo
 * @param {number} props.totalVisiveis
 * @param {number} props.totalGeral
 * @param {number} [props.totalSelecionados]
 * @param {() => void} [props.onLimparSelecao]
 * @param {React.ReactNode} [props.acoesMassa]
 * @param {() => void} [props.onExportar]
 */
export default function BarraTarefas({
  busca,
  onBuscaChange,
  gruposRapidos = [],
  filtros,
  onFiltrosChange,
  totalFiltros = 0,
  // Os filtros ativos que NAO tem botao proprio. No desktop o badge de "Mais
  // filtros" conta so estes — o de responsavel ja aparece no botao dele; no
  // celular, onde os rapidos somem, o badge conta tudo.
  totalFiltrosOcultos = totalFiltros,
  onAbrirFiltros,
  chips = [],
  onLimparTudo,
  totalVisiveis,
  totalGeral,
  carregando = false,
  totalSelecionados = 0,
  onLimparSelecao,
  acoesMassa,
  onExportar,
}) {
  const emSelecao = totalSelecionados > 0
  const desktop = useMediaQuery((t) => t.breakpoints.up("md"))
  const totalBadge = desktop ? totalFiltrosOcultos : totalFiltros

  const definirGrupo = (idGrupo, valor) => {
    const novos = { ...filtros }
    if (valor.length) novos[idGrupo] = valor
    else delete novos[idGrupo]
    onFiltrosChange(novos)
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 2, py: 1.5 }}>
        {emSelecao ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", flex: 1, minHeight: 40 }}>
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {totalSelecionados} selecionada{totalSelecionados > 1 ? "s" : ""}
            </Typography>
            {acoesMassa}
            <Tooltip title="Limpar seleção">
              <IconButton size="small" onClick={onLimparSelecao} aria-label="Limpar seleção">
                <Close fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <>
            <TextField
              placeholder="Pesquisar título, descrição, pessoa ou startup"
              size="small"
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              inputProps={{ "aria-label": "Pesquisar tarefas" }}
              sx={{ flex: { xs: "1 1 100%", sm: "1 1 260px" }, maxWidth: { md: 440 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: busca ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => onBuscaChange("")} aria-label="Limpar pesquisa">
                      <Close sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
            />

            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
              {gruposRapidos.map((grupo) => (
                <FiltroRapido
                  key={grupo.id}
                  grupo={grupo}
                  valor={filtros[grupo.id]}
                  onChange={(valor) => definirGrupo(grupo.id, valor)}
                />
              ))}
            </Box>

            <Badge
              badgeContent={totalBadge}
              color="primary"
              invisible={totalBadge === 0}
              sx={{ "& .MuiBadge-badge": { bgcolor: "primary.vivo", color: "primary.vivoContraste", fontWeight: 700 } }}
            >
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<FilterList />}
                onClick={onAbrirFiltros}
                sx={{ borderColor: "divider", fontWeight: 600, letterSpacing: 0, textTransform: "none", whiteSpace: "nowrap" }}
              >
                {/* No desktop os rapidos ja estao a vista: o botao e o "resto". */}
                <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>
                  Filtros
                </Box>
                <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                  Mais filtros
                </Box>
              </Button>
            </Badge>
          </>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
          {!carregando && (
            <Typography
              variant="caption"
              color="text.secondary"
              aria-live="polite"
              sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
            >
              {totalVisiveis === totalGeral
                ? `${totalGeral} tarefa${totalGeral === 1 ? "" : "s"}`
                : `${totalVisiveis} de ${totalGeral}`}
            </Typography>
          )}
          {onExportar && (
            <Tooltip title="Exportar CSV (o que está filtrado)">
              <IconButton size="small" onClick={onExportar} aria-label="Exportar CSV">
                <Download fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {chips.length > 0 && !emSelecao && (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", px: 2, pb: 1.5, mt: -0.5 }}
          aria-label="Filtros ativos"
          role="group"
        >
          {chips.map((chip) => (
            <Chip
              key={chip.chave}
              size="small"
              label={chip.rotulo}
              onDelete={chip.onRemover}
              variant={chip.destaque ? "filled" : "outlined"}
              sx={{
                fontWeight: 600,
                ...(chip.destaque && {
                  bgcolor: "action.selected",
                }),
              }}
            />
          ))}
          <Button size="small" onClick={onLimparTudo} sx={{ letterSpacing: 0, fontWeight: 600, textTransform: "none" }}>
            Limpar filtros
          </Button>
        </Box>
      )}
    </Box>
  )
}
