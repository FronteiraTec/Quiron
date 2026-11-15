/**
 * O Mini CRM: a casca comum das telas (cabecalho, abas, avisos) e o contexto
 * que todas usam — a startup, a API dela, os membros (responsaveis possiveis),
 * as etapas do funil e as origens a sugerir.
 *
 * QUAL STARTUP: a que tem o beneficio CRM ativo entre as de que a pessoa e
 * membro (beneficioStore). Quase sempre e uma so; se forem varias, um seletor
 * no cabecalho escolhe, e a escolha fica guardada no navegador.
 *
 * O BLOQUEIO E DO BACKEND. Se a incubadora revogar o beneficio com a tela
 * aberta, o proximo pedido volta 403 BENEFICIO_INATIVO; `falha` reconhece o
 * codigo, troca a tela pelo aviso de "nao liberado" e recarrega o menu. Os
 * dados nao somem — voltam quando o beneficio voltar.
 *
 * Rotas filhas (via Outlet): "" painel, clientes, clientes/:id,
 * oportunidades, oportunidades/:id, tarefas.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Snackbar, Tab, Tabs, TextField, Typography } from "@mui/material"
import { Handshake, LockOutlined } from "@mui/icons-material"
import AppLayout from "../../components/AppLayout"
import { useAuthStore } from "../../store/authStore"
import { useBeneficioStore } from "../../store/beneficioStore"
import { crmApi } from "../../services/crmApi"
import { erroDaApi } from "../../data/crmMeta"

const ABAS = [
  { valor: "", rotulo: "Visão geral" },
  { valor: "clientes", rotulo: "Clientes" },
  { valor: "oportunidades", rotulo: "Oportunidades" },
  { valor: "tarefas", rotulo: "Tarefas" },
]

const CHAVE_STARTUP = "quiron.crm.startup"
const BLOQUEIOS = ["BENEFICIO_INATIVO", "SEM_VINCULO"]

function lerEscolha() {
  try {
    return Number(window.localStorage.getItem(CHAVE_STARTUP)) || null
  } catch {
    return null
  }
}

export default function CrmLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null
  const beneficios = useBeneficioStore((s) => s.beneficios)
  const carregarBeneficios = useBeneficioStore((s) => s.carregar)

  const startups = useMemo(() => (beneficios || []).filter((b) => b.beneficio === "CRM"), [beneficios])
  const [idEscolhido, setIdEscolhido] = useState(lerEscolha)
  const startup = startups.find((s) => s.id_startup === idEscolhido) || startups[0] || null
  const idStartup = startup?.id_startup ?? null

  const [contexto, setContexto] = useState(null)
  const [bloqueio, setBloqueio] = useState(null)
  const [erroContexto, setErroContexto] = useState(null)

  const [aviso, setAviso] = useState(null)
  const avisar = useCallback((tipo, texto) => setAviso({ tipo, texto, chave: Date.now() }), [])

  const api = useMemo(() => (idStartup ? crmApi(idStartup) : null), [idStartup])

  /** Erro de qualquer tela do CRM: bloqueio vira a tela de aviso; o resto vira a frase. */
  const falha = useCallback(
    (err, padrao) => {
      const codigo = err?.response?.data?.codigo
      if (BLOQUEIOS.includes(codigo)) {
        setBloqueio(erroDaApi(err, padrao))
        if (idTenant) carregarBeneficios(idTenant)
      }
      return erroDaApi(err, padrao)
    },
    [carregarBeneficios, idTenant]
  )

  const recarregarContexto = useCallback(async () => {
    if (!api) return
    try {
      setContexto(await api.contexto())
      setErroContexto(null)
      setBloqueio(null)
    } catch (err) {
      setErroContexto(falha(err, "Não foi possível abrir o CRM."))
    }
  }, [api, falha])

  useEffect(() => {
    setContexto(null)
    recarregarContexto()
  }, [recarregarContexto])

  useEffect(() => {
    if (!idStartup) return
    try {
      window.localStorage.setItem(CHAVE_STARTUP, String(idStartup))
    } catch {
      // Sem storage, a tela funciona; so nao lembra a escolha.
    }
  }, [idStartup])

  const abaAtual = location.pathname.replace(/^\/crm\/?/, "").split("/")[0]

  const valorDoContexto = useMemo(
    () =>
      contexto && {
        api,
        idStartup,
        startup: contexto.startup,
        membros: contexto.membros,
        etapas: contexto.etapas,
        etapasAtivas: contexto.etapas.filter((e) => e.ativo),
        origens: contexto.origens,
        idUsuario: usuario?.id ?? null,
        recarregarContexto,
        falha,
        avisar,
      },
    [api, idStartup, contexto, usuario?.id, recarregarContexto, falha, avisar]
  )

  let conteudo
  if (beneficios === null || (api && !contexto && !erroContexto && !bloqueio)) {
    conteudo = (
      <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
        <CircularProgress aria-label="Carregando o CRM" />
      </Box>
    )
  } else if (!startup || bloqueio) {
    conteudo = <NaoLiberado mensagem={bloqueio} onVoltar={() => navigate("/")} />
  } else if (erroContexto) {
    conteudo = (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={recarregarContexto}>Tentar novamente</Button>}>
        {erroContexto}
      </Alert>
    )
  } else {
    conteudo = <Outlet context={valorDoContexto} />
  }

  const liberado = Boolean(startup && !bloqueio)

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Handshake sx={{ color: "primary.main" }} aria-hidden />
              <Typography variant="h4" component="h1" fontWeight={700}>
                CRM
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {liberado
                ? `A gestão comercial da ${startup.nome}: clientes, negociações e o que fazer em cada uma.`
                : "Gestão comercial da startup: clientes, negociações e tarefas de venda."}
            </Typography>
          </Box>

          {startups.length > 1 && liberado && (
            <TextField
              select
              size="small"
              label="Startup"
              value={idStartup}
              onChange={(e) => {
                setIdEscolhido(Number(e.target.value))
                navigate("/crm")
              }}
              sx={{ minWidth: 220 }}
            >
              {startups.map((s) => (
                <MenuItem key={s.id_startup} value={s.id_startup}>
                  {s.nome}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>

        {liberado && (
          <Paper sx={{ borderRadius: 0, mb: 2.5 }}>
            <Tabs
              value={ABAS.some((a) => a.valor === abaAtual) ? abaAtual : ""}
              onChange={(_, valor) => navigate(valor ? `/crm/${valor}` : "/crm")}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Seções do CRM"
            >
              {ABAS.map((aba) => (
                <Tab key={aba.valor} value={aba.valor} label={aba.rotulo} sx={{ textTransform: "none" }} />
              ))}
            </Tabs>
          </Paper>
        )}

        {conteudo}
      </Box>

      <Snackbar
        key={aviso?.chave}
        open={Boolean(aviso)}
        autoHideDuration={aviso?.tipo === "success" ? 4000 : 8000}
        onClose={(_, motivo) => motivo !== "clickaway" && setAviso(null)}
        // A esquerda: os paineis de cadastro abrem a direita.
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert severity={aviso?.tipo || "success"} variant="filled" onClose={() => setAviso(null)} sx={{ width: "100%", alignItems: "center" }}>
          {aviso?.texto}
        </Alert>
      </Snackbar>
    </AppLayout>
  )
}

/** O CRM nao esta liberado para a startup (nunca foi, ou foi revogado). */
function NaoLiberado({ mensagem, onVoltar }) {
  return (
    <Paper sx={{ borderRadius: 0, px: 3, py: 6, textAlign: "center" }}>
      <LockOutlined sx={{ fontSize: 40, color: "text.disabled" }} aria-hidden />
      <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
        O CRM não está liberado para a sua startup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 520, mx: "auto" }}>
        {mensagem ||
          "O Mini CRM é um benefício que a incubadora concede às startups. Quando ele for liberado para a sua, o item “CRM” aparece no menu."}{" "}
        Se a sua startup já usou o CRM, nada foi apagado: tudo volta a aparecer quando o benefício for concedido de novo.
      </Typography>
      <Button variant="outlined" sx={{ mt: 3 }} onClick={onVoltar}>
        Voltar ao início
      </Button>
    </Paper>
  )
}
