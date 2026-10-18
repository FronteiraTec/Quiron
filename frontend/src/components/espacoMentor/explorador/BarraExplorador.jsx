/**
 * As duas barras do topo do explorador, na ordem do Windows:
 *
 *   endereco   voltar, avancar, subir; o caminho da pasta (cada pedaco abre a
 *              pasta e recebe o que for solto nele); a pesquisa na pasta.
 *   comandos   "Novo" (pasta, arquivos, link), as acoes da selecao, a ordem,
 *              o modo de exibicao e os filtros.
 */
import { useState } from "react"
import {
  Badge,
  Box,
  Button,
  ButtonBase,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  AccountTree,
  Add,
  ArrowBack,
  ArrowForward,
  ArrowUpward,
  Check,
  ChevronRight,
  Clear,
  CreateNewFolderOutlined,
  FilterList,
  GridView,
  Inventory2Outlined,
  LinkOutlined,
  NoteAddOutlined,
  Search,
  Sort,
  UploadFileOutlined,
  ViewList,
} from "@mui/icons-material"
import { useAlvoSoltar } from "./arrastar"
import { ORDENACOES, podeSoltar } from "../../../data/exploradorMeta"

export default function BarraExplorador({
  podeVoltar,
  podeAvancar,
  podeSubir,
  onVoltar,
  onAvancar,
  onSubir,
  caminho,
  arquivados,
  pastas,
  onAbrirPasta,
  onSoltarItens,
  onSoltarArquivos,
  busca,
  onBusca,
  nomePastaAtual,
  podeCriar,
  onNovaPasta,
  onEnviarArquivos,
  onNovoLink,
  onNovoMaterial,
  acoesSelecao,
  ordenacao,
  onOrdenacao,
  visao,
  onVisao,
  totalFiltros,
  onFiltros,
  compacto,
  // Em tela pequena o painel de pastas vira gaveta, aberta por este botao.
  onAbrirPainel,
}) {
  const [menuNovo, setMenuNovo] = useState(null)
  const [menuOrdem, setMenuOrdem] = useState(null)

  const novo = (fn) => () => {
    setMenuNovo(null)
    fn()
  }

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      {/* Endereco */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, py: 0.75, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        {onAbrirPainel && (
          <Navegar titulo="Pastas" onClick={onAbrirPainel}>
            <AccountTree fontSize="small" />
          </Navegar>
        )}
        <Navegar titulo="Voltar" atalho="Alt+←" onClick={onVoltar} desabilitado={!podeVoltar}>
          <ArrowBack fontSize="small" />
        </Navegar>
        <Navegar titulo="Avançar" atalho="Alt+→" onClick={onAvancar} desabilitado={!podeAvancar}>
          <ArrowForward fontSize="small" />
        </Navegar>
        <Navegar titulo="Subir um nível" atalho="Alt+↑" onClick={onSubir} desabilitado={!podeSubir}>
          <ArrowUpward fontSize="small" />
        </Navegar>

        <Box
          component="nav"
          aria-label="Caminho da pasta"
          sx={{
            flex: 1,
            minWidth: { xs: "calc(100% - 120px)", md: 0 },
            display: "flex",
            alignItems: "center",
            border: 1,
            borderColor: "divider",
            borderRadius: "6px",
            px: 0.5,
            height: 34,
            overflow: "hidden",
          }}
        >
          {arquivados ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1 }}>
              <Inventory2Outlined sx={{ fontSize: 18, color: "text.secondary" }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Arquivados
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, overflowX: "auto", scrollbarWidth: "none" }}>
              <Pedaco
                id={null}
                nome="Minha biblioteca"
                atual={caminho.length === 0}
                pastas={pastas}
                onAbrir={onAbrirPasta}
                onSoltarItens={onSoltarItens}
                onSoltarArquivos={onSoltarArquivos}
              />
              {caminho.map((p, i) => (
                <Box key={p.id_pasta} sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                  <ChevronRight sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                  <Pedaco
                    id={p.id_pasta}
                    nome={p.nome}
                    atual={i === caminho.length - 1}
                    pastas={pastas}
                    onAbrir={onAbrirPasta}
                    onSoltarItens={onSoltarItens}
                    onSoltarArquivos={onSoltarArquivos}
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <TextField
          size="small"
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder={`Pesquisar em ${nomePastaAtual}`}
          inputProps={{ "aria-label": `Pesquisar em ${nomePastaAtual}` }}
          sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0, "& .MuiInputBase-root": { height: 34 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: busca ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onBusca("")} aria-label="Limpar pesquisa" edge="end">
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {/* Comandos */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1, pb: 0.75, flexWrap: "wrap" }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={(e) => setMenuNovo(e.currentTarget)}
          disabled={!podeCriar}
          sx={{ textTransform: "none", mr: 0.5 }}
        >
          Novo
        </Button>
        <Menu anchorEl={menuNovo} open={Boolean(menuNovo)} onClose={() => setMenuNovo(null)}>
          <MenuItem onClick={novo(onNovaPasta)}>
            <ListItemIcon>
              <CreateNewFolderOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Pasta</ListItemText>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              Ctrl+Shift+N
            </Typography>
          </MenuItem>
          <Divider />
          <MenuItem onClick={novo(onEnviarArquivos)}>
            <ListItemIcon>
              <UploadFileOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Enviar arquivos" secondary="Um ou vários, direto para esta pasta" />
          </MenuItem>
          <MenuItem onClick={novo(onNovoLink)}>
            <ListItemIcon>
              <LinkOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Link</ListItemText>
          </MenuItem>
          <MenuItem onClick={novo(onNovoMaterial)}>
            <ListItemIcon>
              <NoteAddOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Material com descrição" secondary="Arquivo ou link, com categoria" />
          </MenuItem>
        </Menu>

        {!compacto && (
          <Tooltip title="Enviar arquivos para esta pasta">
            <span>
              <Button
                size="small"
                startIcon={<UploadFileOutlined />}
                onClick={onEnviarArquivos}
                disabled={!podeCriar}
                sx={{ textTransform: "none" }}
              >
                Enviar
              </Button>
            </span>
          </Tooltip>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />

        {acoesSelecao.filter(Boolean).map((acao) => (
          <Tooltip key={acao.rotulo} title={acao.atalho ? `${acao.rotulo} (${acao.atalho})` : acao.rotulo}>
            <span>
              <IconButton
                size="small"
                onClick={acao.onClick}
                disabled={acao.desabilitada}
                aria-label={acao.rotulo}
                sx={acao.perigo && !acao.desabilitada ? { color: "error.main" } : undefined}
              >
                {acao.icone}
              </IconButton>
            </span>
          </Tooltip>
        ))}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Ordenar">
          <Button
            size="small"
            startIcon={<Sort />}
            onClick={(e) => setMenuOrdem(e.currentTarget)}
            sx={{ textTransform: "none", minWidth: 0 }}
          >
            {compacto ? "" : "Ordenar"}
          </Button>
        </Tooltip>
        <Menu anchorEl={menuOrdem} open={Boolean(menuOrdem)} onClose={() => setMenuOrdem(null)}>
          {Object.entries(ORDENACOES).map(([campo, o]) => (
            <MenuItem key={campo} onClick={() => onOrdenacao({ ...ordenacao, campo })}>
              <ListItemIcon>{ordenacao.campo === campo && <Check fontSize="small" />}</ListItemIcon>
              <ListItemText>{o.rotulo}</ListItemText>
            </MenuItem>
          ))}
          <Divider />
          {[
            ["asc", "Crescente"],
            ["desc", "Decrescente"],
          ].map(([direcao, rotulo]) => (
            <MenuItem key={direcao} onClick={() => onOrdenacao({ ...ordenacao, direcao })}>
              <ListItemIcon>{ordenacao.direcao === direcao && <Check fontSize="small" />}</ListItemIcon>
              <ListItemText>{rotulo}</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={visao}
          onChange={(_, v) => v && onVisao(v)}
          aria-label="Modo de exibição"
          sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 0.75 } }}
        >
          <ToggleButton value="grade" aria-label="Ícones">
            <Tooltip title="Ícones">
              <GridView fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="detalhes" aria-label="Detalhes">
            <Tooltip title="Detalhes">
              <ViewList fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Filtrar">
          <IconButton size="small" onClick={onFiltros} aria-label="Filtrar">
            <Badge badgeContent={totalFiltros} color="primary">
              <FilterList fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}

function Navegar({ titulo, atalho, onClick, desabilitado, children }) {
  return (
    <Tooltip title={atalho ? `${titulo} (${atalho})` : titulo}>
      <span>
        <IconButton size="small" onClick={onClick} disabled={desabilitado} aria-label={titulo}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

/** Um pedaco do caminho: abre a pasta e recebe o que for solto nele. */
function Pedaco({ id, nome, atual, pastas, onAbrir, onSoltarItens, onSoltarArquivos }) {
  const alvo = useAlvoSoltar({
    aceitaItens: (itens) => podeSoltar(pastas, itens, id),
    onItens: (itens) => onSoltarItens(itens, id),
    onArquivos: (arquivos) => onSoltarArquivos(arquivos, id),
  })
  return (
    <ButtonBase
      {...alvo.props}
      onClick={() => onAbrir(id)}
      aria-current={atual ? "location" : undefined}
      sx={{
        px: 0.75,
        py: 0.25,
        borderRadius: "4px",
        flexShrink: atual ? 1 : 0,
        minWidth: 0,
        outline: alvo.aceso ? "2px dashed" : "none",
        outlineColor: "primary.main",
        bgcolor: alvo.aceso ? "action.hover" : "transparent",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography variant="body2" noWrap sx={{ fontWeight: atual ? 700 : 500 }}>
        {nome}
      </Typography>
    </ButtonBase>
  )
}
