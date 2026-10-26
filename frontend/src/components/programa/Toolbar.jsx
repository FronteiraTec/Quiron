/**
 * Barra superior do Construtor: seletor de trilha, acoes globais da arvore
 * (expandir / recolher todos) e o botao "Visualizar como incubada".
 * Tambem exibe o botao de alternar a arvore em telas menores (tablet).
 *
 * O SELETOR e o que muda com varias trilhas. Ele carrega o nome da trilha
 * aberta (antes um titulo fixo, "Construtor de Programa") porque com N
 * trilhas a pergunta "qual estou editando?" passa a existir — e a resposta
 * precisa estar onde antes ficava o titulo, nao escondida num menu.
 */
import { useState } from "react"
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material"
import {
  UnfoldMore,
  UnfoldLess,
  Visibility,
  AccountTree,
  MenuOpen,
  ExpandMore,
  Add,
  Star,
  StarBorder,
  Groups,
  Check,
  ContentCopy,
  DeleteOutline,
} from "@mui/icons-material"

export default function Toolbar({
  programas = [],
  programaAtivoId,
  onSelecionarPrograma,
  onNovaTrilha,
  onDuplicarTrilha,
  onDefinirPadrao,
  onExcluirTrilha,
  onGerenciarStartups,
  onExpandirTodos,
  onRecolherTodos,
  onPreview,
  onToggleArvore,
  mostrarToggleArvore,
}) {
  const [menuTrilhas, setMenuTrilhas] = useState(null)

  const ativa = programas.find((p) => Number(p.id_no) === Number(programaAtivoId))

  const escolher = (id) => {
    setMenuTrilhas(null)
    onSelecionarPrograma?.(id)
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 2, md: 3 },
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      {mostrarToggleArvore && (
        <IconButton onClick={onToggleArvore} size="small">
          <MenuOpen />
        </IconButton>
      )}

      <AccountTree sx={{ color: "primary.main", flexShrink: 0 }} />

      {/* Seletor de trilha — o titulo da barra virou o nome da trilha aberta */}
      <Box data-tour="programa-seletor-trilha" sx={{ flex: 1, minWidth: 0 }}>
        <Box
          onClick={(e) => setMenuTrilhas(e.currentTarget)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setMenuTrilhas(e.currentTarget)
            }
          }}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            maxWidth: "100%",
            cursor: "pointer",
            borderRadius: 1,
            px: 0.75,
            ml: -0.75,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }} noWrap>
            {ativa?.nome || "Construtor de Programa"}
          </Typography>
          {ativa?.padrao && (
            <Tooltip title="Trilha padrão no cadastro de startups" arrow>
              <Star sx={{ fontSize: 15, color: "warning.main", flexShrink: 0 }} />
            </Tooltip>
          )}
          <ExpandMore sx={{ fontSize: 20, color: "text.secondary", flexShrink: 0 }} />
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: { xs: "none", sm: "block" } }}
        >
          {ativa
            ? `${ativa.fases} fase${ativa.fases === 1 ? "" : "s"} · ${ativa.passos} passo${
                ativa.passos === 1 ? "" : "s"
              } · ${ativa.startups} startup${ativa.startups === 1 ? "" : "s"}`
            : "Monte a trilha de incubação arrastando, criando e editando em um só lugar"}
        </Typography>
      </Box>

      {ativa && (
        <Tooltip title="Startups desta trilha" arrow>
          <IconButton data-tour="programa-startups" onClick={onGerenciarStartups} size="small">
            <Groups />
          </IconButton>
        </Tooltip>
      )}

      <Tooltip title="Expandir todos" arrow>
        <IconButton data-tour="programa-expandir" onClick={onExpandirTodos} size="small">
          <UnfoldMore />
        </IconButton>
      </Tooltip>
      <Tooltip title="Recolher todos" arrow>
        <IconButton data-tour="programa-expandir" onClick={onRecolherTodos} size="small">
          <UnfoldLess />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 1 }} />

      <Button
        data-tour="programa-preview"
        onClick={onPreview}
        variant="contained"
        disableElevation
        startIcon={<Visibility />}
        sx={{ textTransform: "none", fontWeight: 600, borderRadius: "6px" }}
      >
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          Visualizar como&nbsp;
        </Box>
        incubada
      </Button>

      {/* Lista de trilhas do tenant */}
      <Menu
        anchorEl={menuTrilhas}
        open={Boolean(menuTrilhas)}
        onClose={() => setMenuTrilhas(null)}
        slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 420 } } }}
      >
        <Typography
          variant="caption"
          sx={{ px: 2, py: 1, display: "block", fontWeight: 700, color: "text.secondary" }}
        >
          TRILHAS DA INCUBADORA
        </Typography>

        {programas.map((p) => {
          const ativoItem = Number(p.id_no) === Number(programaAtivoId)
          return (
            <MenuItem key={p.id_no} selected={ativoItem} onClick={() => escolher(p.id_no)}>
              <ListItemIcon>
                {ativoItem ? (
                  <Check fontSize="small" color="primary" />
                ) : (
                  <AccountTree fontSize="small" sx={{ opacity: 0.5 }} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography sx={{ fontWeight: ativoItem ? 700 : 500, fontSize: 14 }} noWrap>
                      {p.nome}
                    </Typography>
                    {p.padrao && (
                      <Chip
                        label="padrão"
                        size="small"
                        sx={{ height: 17, fontSize: 10, fontWeight: 700 }}
                        color="warning"
                      />
                    )}
                    {!p.ativo && (
                      <Chip label="inativa" size="small" sx={{ height: 17, fontSize: 10 }} />
                    )}
                  </Box>
                }
                secondary={`${p.fases} fases · ${p.passos} passos · ${p.startups} startups`}
                secondaryTypographyProps={{ fontSize: 12 }}
              />
            </MenuItem>
          )
        })}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            setMenuTrilhas(null)
            onNovaTrilha?.()
          }}
        >
          <ListItemIcon>
            <Add fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary="Nova trilha" secondary="Nasce vazia" secondaryTypographyProps={{ fontSize: 12 }} />
        </MenuItem>

        {ativa && (
          <MenuItem
            onClick={() => {
              setMenuTrilhas(null)
              onDuplicarTrilha?.(ativa.id_no)
            }}
          >
            <ListItemIcon>
              <ContentCopy fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Duplicar esta trilha"
              secondary="Copia fases, módulos e passos, sem as startups"
              secondaryTypographyProps={{ fontSize: 12 }}
            />
          </MenuItem>
        )}

        {ativa && !ativa.padrao && (
          <MenuItem
            onClick={() => {
              setMenuTrilhas(null)
              onDefinirPadrao?.(ativa.id_no)
            }}
          >
            <ListItemIcon>
              <StarBorder fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Tornar esta a padrão"
              secondary="Vem pré-selecionada no cadastro de startups"
              secondaryTypographyProps={{ fontSize: 12 }}
            />
          </MenuItem>
        )}

        {/* Por ultimo e separado: e a unica acao do menu que nao tem volta */}
        {ativa && <Divider sx={{ my: 0.5 }} />}
        {ativa && (
          <MenuItem
            onClick={() => {
              setMenuTrilhas(null)
              onExcluirTrilha?.(ativa)
            }}
            sx={{ color: "error.main" }}
          >
            <ListItemIcon>
              <DeleteOutline fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText
              primary="Excluir esta trilha"
              secondary="Apaga fases, matrículas e entregas dela"
              secondaryTypographyProps={{ fontSize: 12 }}
            />
          </MenuItem>
        )}
      </Menu>
    </Box>
  )
}
