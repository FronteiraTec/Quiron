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
  ButtonBase,
  Divider,
  Popover,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material"
import {
  LightMode,
  DarkMode,
  Check,
  ChatBubbleOutline,
  HelpOutline,
  ExploreOutlined,
  Feedback,
  Person,
  Logout,
  ChevronRight,
} from "@mui/icons-material"
import { useAuthStore } from "../store/authStore"
import { usePreferenciaStore } from "../store/preferenciaStore"
import { useTour } from "../tour/TourProvider"
import { CORES_PRINCIPAIS, paletaDaCor } from "../theme"

const ROTULO_PAPEL = { admin: "Administrador", mentor: "Mentor", usuario: "Usuário" }

const AJUDA_ITENS = [
  { chave: "conversar", label: "Conversar conosco", Icone: ChatBubbleOutline },
  { chave: "central", label: "Central de Ajuda", Icone: HelpOutline },
  { chave: "tour", label: "Fazer Tour", Icone: ExploreOutlined },
  { chave: "feedback", label: "Enviar Feedback", Icone: Feedback },
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
  onAjudaItem,
}) {
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const logout = useAuthStore((s) => s.logout)
  const preferencias = usePreferenciaStore((s) => s.preferencias)
  const atualizarLocal = usePreferenciaStore((s) => s.atualizarLocal)
  const salvarPreferencias = usePreferenciaStore((s) => s.salvar)
  const tour = useTour()
  const escuro = useTheme().palette.mode === "dark"

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
  // atual (os passos de cada tela ficam em tour/tours.js). "Conversar conosco",
  // "Enviar Feedback" e "Central de Ajuda" levam as respectivas paginas.
  // Os demais itens de ajuda continuam delegados a quem usa o componente.
  const clicarAjuda = (chave) => {
    if (chave === "tour") {
      fechar()
      // Espera o Popover fechar para o overlay medir a tela ja sem ele.
      setTimeout(tour.iniciar, 220)
      return
    }
    if (chave === "conversar") {
      irPara("/fala-conosco")
      return
    }
    if (chave === "feedback") {
      irPara("/enviar-feedback")
      return
    }
    if (chave === "central") {
      irPara("/central-ajuda")
      return
    }
    onAjudaItem?.(chave)
  }

  const persistir = async (patch) => {
    atualizarLocal(patch)
    try {
      await salvarPreferencias(patch)
    } catch (erro) {
      console.error("Falha ao salvar preferências", erro)
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
          "&:focus-visible": { outline: (t) => `2px solid ${t.palette.barra.destaque}`, outlineOffset: 2 },
        }}
      >
        {/* O destaque da barra (ver paletaDaBarra): no claro, preto com letra
            lima sobre a barra lima — o circulo da seta do modelo, invertido. */}
        <Avatar
          src={usuario?.foto_url || undefined}
          sx={{ width: 36, height: 36, bgcolor: "barra.destaque", color: "barra.destaqueTexto", fontWeight: 700, fontSize: 15 }}
        >
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
                  : "0 16px 40px rgba(0,0,0,0.14)",
            }),
          },
        }}
      >
        {/* Cabecalho nas cores da barra do topo, de onde o painel abre, com a
            faixa diagonal do modelo de apresentacao. */}
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            px: 3,
            pt: 3,
            pb: 2.5,
            bgcolor: "barra.fundo",
            color: "barra.texto",
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              right: -48,
              top: 34,
              width: 210,
              height: 10,
              bgcolor: "barra.destaque",
              transform: "rotate(-24deg)",
            }}
          />
          <Avatar
            src={usuario?.foto_url || undefined}
            sx={{
              position: "relative",
              width: 60,
              height: 60,
              mb: 1.5,
              bgcolor: "barra.destaque",
              color: "barra.destaqueTexto",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            {iniciais(usuario?.nome)}
          </Avatar>
          <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ position: "relative" }}>
            {usuario?.nome || "Usuário"}
          </Typography>
          {(rotuloPapel || empresa) && (
            <Typography variant="body2" sx={{ position: "relative", opacity: 0.72 }} noWrap>
              {[rotuloPapel, empresa].filter(Boolean).join(" - ")}
            </Typography>
          )}
        </Box>

        {/* Aparencia */}
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
            Aparência
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
              "& .MuiToggleButton-root": {
                flex: 1,
              },
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
                // No escuro o popover fica acima do papel (tema: MuiPopover),
                // entao o papel ali pareceria um buraco, e nao a opcao ativa.
                bgcolor: (t) =>
                  `${t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : t.palette.background.paper} !important`,
                color: "text.primary !important",
                boxShadow: (t) =>
                  t.palette.mode === "dark"
                    ? "0 1px 4px rgba(0,0,0,0.5)"
                    : "0 1px 4px rgba(0,0,0,0.16)",
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
          </ToggleButtonGroup>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, mb: 1 }}>
            Cor principal
          </Typography>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            {CORES_PRINCIPAIS.map(({ nome, cor }) => {
              const ativo = preferencias.cor_primaria?.toLowerCase() === cor.toLowerCase()
              // A amostra mostra a cor como ela fica NESTA aparencia (o
              // preenchimento dos botoes), e nao o hex salvo: no claro o
              // amarelo e o lima ficam vivos, no escuro o magenta clareia.
              const { vivo, vivoContraste } = paletaDaCor(cor, escuro)
              return (
                <Tooltip key={cor} title={nome} arrow>
                  <ButtonBase
                    onClick={() => mudarCorPrimaria(cor)}
                    aria-label={`Cor ${nome}`}
                    aria-pressed={ativo}
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      bgcolor: vivo,
                      transition: "transform .15s ease, box-shadow .15s ease",
                      boxShadow: ativo
                        ? (t) => `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${vivo}`
                        : "none",
                      "&:hover": { transform: "scale(1.1)" },
                      "&:focus-visible": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
                    }}
                  >
                    {ativo && <Check sx={{ fontSize: 14, color: vivoContraste }} />}
                  </ButtonBase>
                </Tooltip>
              )
            })}
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
