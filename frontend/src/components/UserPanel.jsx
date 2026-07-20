/**
 * UserPanel - painel flutuante de conta, aberto a partir do avatar da Navbar.
 *
 * Nao e uma pagina nem um modal: e um popover elegante (estilo ClickUp /
 * Linear / Notion / Stripe Dashboard) com dados da conta, preferencias de
 * aparencia, atalhos de preferencias/ajuda/aplicativos e logout.
 */
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { alpha } from "@mui/material/styles"
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import {
  LightMode,
  DarkMode,
  SettingsBrightness,
  Check,
  NotificationsNone,
  Language,
  Keyboard,
  Accessibility,
  ChatBubbleOutline,
  HelpOutline,
  MenuBook,
  OndemandVideo,
  ExploreOutlined,
  Feedback,
  Person,
  Logout,
  ChevronRight,
} from "@mui/icons-material"
import { useAuthStore } from "../store/authStore"
import { usePreferenciaStore } from "../store/preferenciaStore"
import { useTour } from "../tour/TourProvider"

const ROTULO_PAPEL = { admin: "Administrador", mentor: "Mentor", usuario: "Usuario" }

const CORES_ACCENT = [
  { nome: "Azul", cor: "#4f46e5" },
  { nome: "Verde", cor: "#16a34a" },
  { nome: "Laranja", cor: "#f97316" },
  { nome: "Vermelho", cor: "#dc2626" },
  { nome: "Roxo", cor: "#9333ea" },
  { nome: "Rosa", cor: "#db2777" },
  { nome: "Ciano", cor: "#0891b2" },
  { nome: "Amarelo", cor: "#ca8a04" },
]

const PREFERENCIAS_ITENS = [
  { chave: "notificacoes", label: "Notificacoes", Icone: NotificationsNone },
  { chave: "idioma", label: "Idioma", Icone: Language },
  { chave: "atalhos", label: "Atalhos", Icone: Keyboard },
  { chave: "acessibilidade", label: "Acessibilidade", Icone: Accessibility },
]

const AJUDA_ITENS = [
  { chave: "conversar", label: "Conversar conosco", Icone: ChatBubbleOutline },
  { chave: "central", label: "Central de Ajuda", Icone: HelpOutline },
  { chave: "documentacao", label: "Documentacao", Icone: MenuBook },
  { chave: "videos", label: "Videos", Icone: OndemandVideo },
  { chave: "tour", label: "Fazer Tour", Icone: ExploreOutlined },
  { chave: "feedback", label: "Enviar Feedback", Icone: Feedback },
]

const APLICATIVOS_PADRAO = [
  { chave: "crm", label: "CRM", ativo: true },
  { chave: "analytics", label: "Analytics", ativo: false },
  { chave: "financeiro", label: "Financeiro", ativo: false },
  { chave: "portal", label: "Portal", ativo: false },
]

function iniciais(nome = "") {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase() || "?"
}

// Linha de acao reutilizada nas secoes "Preferencias" e "Ajuda".
function LinhaAcao({ icone: Icone, label, onClick }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        width: "100%",
        px: 2.5,
        py: 1,
        gap: 1.5,
        borderRadius: 1.5,
        justifyContent: "flex-start",
        color: "text.primary",
        userSelect: "none",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
      }}
    >
      <Icone fontSize="small" sx={{ color: "text.secondary" }} />
      <Typography variant="body2" sx={{ flex: 1, textAlign: "left" }}>
        {label}
      </Typography>
    </ButtonBase>
  )
}

export default function UserPanel({
  plano = { nome: "Free", diasRestantes: null },
  onUpgrade,
  onPreferenciaItem,
  onAjudaItem,
  onAbrirApp,
  aplicativos = APLICATIVOS_PADRAO,
}) {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  const preferencias = usePreferenciaStore((s) => s.preferencias)
  const atualizarLocal = usePreferenciaStore((s) => s.atualizarLocal)
  const salvarPreferencias = usePreferenciaStore((s) => s.salvar)
  const tour = useTour()

  const [anchorEl, setAnchorEl] = useState(null)
  const aberto = Boolean(anchorEl)

  const fechar = () => setAnchorEl(null)
  const irPara = (rota) => {
    fechar()
    navigate(rota)
  }
  const sair = async () => {
    fechar()
    await logout()
    navigate("/login")
  }

  // "Fazer Tour" e resolvido aqui: fecha o painel e inicia o tutorial da tela
  // atual (os passos de cada tela ficam em tour/tours.js). Os demais itens de
  // ajuda continuam delegados a quem usa o componente.
  const clicarAjuda = (chave) => {
    if (chave === "tour") {
      fechar()
      // Espera o Popover fechar para o overlay medir a tela ja sem ele.
      setTimeout(tour.iniciar, 220)
      return
    }
    onAjudaItem?.(chave)
  }

  const persistir = async (patch) => {
    atualizarLocal(patch)
    try {
      await salvarPreferencias(patch)
    } catch (erro) {
      console.error("Falha ao salvar preferencias", erro)
    }
  }

  const mudarTema = (_e, novoTema) => {
    if (!novoTema || novoTema === preferencias.tema) return
    persistir({ tema: novoTema })
  }

  const mudarCorPrimaria = (cor) => {
    if (cor === preferencias.cor_primaria) return
    persistir({ cor_primaria: cor })
  }

  const tenantAtual =
    usuario?.tenants?.find((t) => t.id_tenant === usuario?.id_tenant) || usuario?.tenants?.[0]
  const empresa = tenantAtual?.nome
  const rotuloPapel = usuario?.root ? "Super Admin" : ROTULO_PAPEL[usuario?.papel] || usuario?.papel

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label="Menu da conta"
        sx={{
          borderRadius: "50%",
          "&:focus-visible": { outline: (t) => `2px solid ${alpha(t.palette.common.white, 0.8)}`, outlineOffset: 2 },
        }}
      >
        <Avatar src={usuario?.avatar || undefined} sx={{ width: 36, height: 36, bgcolor: "secondary.main" }}>
          {iniciais(usuario?.nome)}
        </Avatar>
      </ButtonBase>

      <Popover
        open={aberto}
        anchorEl={anchorEl}
        onClose={fechar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        transitionDuration={200}
        slotProps={{
          paper: {
            sx: (t) => ({
              mt: 1.5,
              width: 344,
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 32px)",
              borderRadius: `${Math.max(t.shape.borderRadius, 16)}px`,
              overflowY: "auto",
              overflowX: "hidden",
              border: "1px solid",
              borderColor: "divider",
              boxShadow:
                t.palette.mode === "dark"
                  ? "0 16px 40px rgba(0,0,0,0.55)"
                  : "0 16px 40px rgba(15,23,42,0.14)",
            }),
          },
        }}
      >
        {/* Cabecalho solido na cor primaria */}
        <Box
          sx={{
            px: 3,
            pt: 3,
            pb: 2.5,
            bgcolor: "primary.main",
            color: (t) => t.palette.primary.contrastText,
          }}
        >
          <Avatar
            src={usuario?.avatar || undefined}
            sx={{
              width: 60,
              height: 60,
              mb: 1.5,
              bgcolor: "rgba(255,255,255,0.16)",
              border: "3px solid rgba(255,255,255,0.35)",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {iniciais(usuario?.nome)}
          </Avatar>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {usuario?.nome || "Usuario"}
          </Typography>
          {(rotuloPapel || empresa) && (
            <Typography variant="body2" sx={{ opacity: 0.85 }} noWrap>
              {[rotuloPapel, empresa].filter(Boolean).join(" - ")}
            </Typography>
          )}
          {usuario?.id != null && (
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 0.75, opacity: 0.7, fontFamily: "monospace", letterSpacing: 0.4 }}
            >
              ID {usuario.id}
            </Typography>
          )}
        </Box>

        {/* Card de plano */}
        {plano && (
          <Box
            sx={{
              mx: 2.5,
              mt: 2,
              p: 1.75,
              borderRadius: 2.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.07),
              border: "1px solid",
              borderColor: (t) => alpha(t.palette.primary.main, 0.18),
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Chip label={`Plano ${plano.nome}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              {plano.diasRestantes != null && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Expira em {plano.diasRestantes} dias
                </Typography>
              )}
            </Box>
            <Button
              size="small"
              variant="contained"
              onClick={onUpgrade}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600, px: 2, flexShrink: 0 }}
            >
              Upgrade
            </Button>
          </Box>
        )}

        {/* Aparencia */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
            Aparencia
          </Typography>

          <ToggleButtonGroup
            value={preferencias.tema}
            exclusive
            onChange={mudarTema}
            fullWidth
            size="small"
            sx={{
              mt: 1,
              bgcolor: "action.hover",
              borderRadius: 2.5,
              p: 0.5,
              gap: 0.5,
              "& .MuiToggleButtonGroup-grouped": {
                border: 0,
                borderRadius: "18px !important",
                textTransform: "none",
                fontWeight: 600,
                fontSize: 13,
                color: "text.secondary",
                transition: "all .18s ease",
              },
              "& .Mui-selected": {
                bgcolor: (t) => `${t.palette.background.paper} !important`,
                color: "text.primary !important",
                boxShadow: (t) =>
                  t.palette.mode === "dark" ? "0 1px 4px rgba(0,0,0,0.5)" : "0 1px 4px rgba(15,23,42,0.16)",
              },
            }}
          >
            <ToggleButton value="claro" aria-label="Tema claro">
              <LightMode fontSize="small" sx={{ mr: 0.75 }} />
              Claro
            </ToggleButton>
            <ToggleButton value="escuro" aria-label="Tema escuro">
              <DarkMode fontSize="small" sx={{ mr: 0.75 }} />
              Escuro
            </ToggleButton>
            <ToggleButton value="automatico" aria-label="Tema automatico">
              <SettingsBrightness fontSize="small" sx={{ mr: 0.75 }} />
              Auto
            </ToggleButton>
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
            Cor principal
          </Typography>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            {CORES_ACCENT.map(({ nome, cor }) => {
              const ativo = preferencias.cor_primaria?.toLowerCase() === cor.toLowerCase()
              return (
                <ButtonBase
                  key={cor}
                  onClick={() => mudarCorPrimaria(cor)}
                  aria-label={`Cor ${nome}`}
                  aria-pressed={ativo}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    bgcolor: cor,
                    transition: "transform .15s ease, box-shadow .15s ease",
                    boxShadow: ativo
                      ? (t) => `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${cor}`
                      : "none",
                    "&:hover": { transform: "scale(1.1)" },
                    "&:focus-visible": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
                  }}
                >
                  {ativo && <Check sx={{ fontSize: 14, color: "#fff" }} />}
                </ButtonBase>
              )
            })}
          </Stack>
        </Box>

        <Divider />

        {/* Preferencias */}
        <Box sx={{ py: 1.25 }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 2.5, letterSpacing: 0.6 }}>
            Preferencias
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {PREFERENCIAS_ITENS.map(({ chave, label, Icone }) => (
              <LinhaAcao
                key={chave}
                icone={Icone}
                label={label}
                onClick={() => onPreferenciaItem?.(chave)}
              />
            ))}
          </Stack>
        </Box>

        <Divider />

        {/* Ajuda */}
        <Box sx={{ py: 1.25 }}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 2.5, letterSpacing: 0.6 }}>
            Ajuda
          </Typography>
          <Stack sx={{ mt: 0.5 }}>
            {AJUDA_ITENS.map(({ chave, label, Icone }) => (
              <LinhaAcao key={chave} icone={Icone} label={label} onClick={() => clicarAjuda(chave)} />
            ))}
          </Stack>
        </Box>

        <Divider />

        {/* Aplicativos */}
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
            Aplicativos
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
            {aplicativos.map((app) => (
              <Chip
                key={app.chave}
                label={app.label}
                size="small"
                onClick={() => onAbrirApp?.(app)}
                color={app.ativo ? "primary" : "default"}
                variant={app.ativo ? "filled" : "outlined"}
                sx={{ fontWeight: 600, borderRadius: 1.5 }}
              />
            ))}
          </Stack>
        </Box>

        <Divider />

        {/* Rodape */}
        <Box sx={{ px: 1.5, py: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <ButtonBase
            onClick={() => irPara("/perfil")}
            sx={{
              px: 1.5,
              py: 1,
              gap: 0.75,
              borderRadius: 1.5,
              color: "text.secondary",
              userSelect: "none",
              "&:hover": { bgcolor: "action.hover", color: "text.primary" },
            }}
          >
            <Person fontSize="small" />
            <Typography variant="body2" fontWeight={600}>
              Minha Conta
            </Typography>
            <ChevronRight fontSize="small" />
          </ButtonBase>

          <ButtonBase
            onClick={sair}
            sx={{
              px: 1.5,
              py: 1,
              gap: 0.75,
              borderRadius: 1.5,
              color: "error.main",
              userSelect: "none",
              "&:hover": { bgcolor: (t) => alpha(t.palette.error.main, 0.08) },
            }}
          >
            <Logout fontSize="small" />
            <Typography variant="body2" fontWeight={600}>
              Sair
            </Typography>
          </ButtonBase>
        </Box>
      </Popover>
    </>
  )
}
