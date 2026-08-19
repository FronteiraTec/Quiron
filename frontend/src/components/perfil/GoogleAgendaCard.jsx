/**
 * Cartao "Google Agenda" da tela de Perfil.
 *
 * Conectar a conta e ato PESSOAL, nao configuracao da incubadora: por isso
 * mora no Perfil, ao lado dos dados de quem esta logado, e nao em
 * Configuracoes (que e do tenant e so o admin abre). Cada pessoa decide se
 * quer os eventos dela no proprio celular.
 *
 * O cartao SOME quando a instalacao nao tem credenciais do Google
 * (`configurado: false`). Um botao que so sabe dizer "nao esta configurado"
 * nao ajuda quem esta olhando — quem resolve isso e o operador do servidor,
 * pelo .env, e ele nao descobre o problema por esta tela.
 */
import { useCallback, useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from "@mui/material"
import { Google, LinkOff, Sync } from "@mui/icons-material"
import api from "../../services/api"

/** Data/hora no formato brasileiro, ou traco quando nunca aconteceu. */
function formatarData(ts) {
  if (!ts) return "nunca"
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default function GoogleAgendaCard({ onAviso }) {
  const [status, setStatus] = useState(null)
  const [carregando, setCarregando] = useState(true)
  // Uma acao por vez ("conectar" | "sincronizar" | "desconectar" | "pausar"),
  // para o spinner aparecer no botao certo em vez de travar o cartao inteiro.
  const [acao, setAcao] = useState(null)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/google-agenda/status")
      setStatus(data.google)
    } catch {
      setStatus({ configurado: false, conectado: false })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Sai do SPA e vai para a tela de consentimento do Google.
   *
   * `window.location` e nao um fetch: o consentimento e uma pagina do Google
   * que a PESSOA precisa ver e onde ela digita a senha dela. Buscar por XHR
   * so daria erro de CORS — e seria errado mesmo que funcionasse.
   */
  const conectar = async () => {
    setAcao("conectar")
    try {
      const { data } = await api.get("/google-agenda/autorizar")
      window.location.href = data.url
    } catch (err) {
      onAviso?.({ tipo: "error", texto: err.response?.data?.erro || "Nao foi possivel conectar." })
      setAcao(null)
    }
  }

  const sincronizar = async () => {
    setAcao("sincronizar")
    try {
      const { data } = await api.post("/google-agenda/sincronizar")
      onAviso?.({ tipo: "success", texto: data.mensagem })
      await carregar()
    } catch (err) {
      onAviso?.({
        tipo: "error",
        texto: err.response?.data?.erro || "Falha ao sincronizar com o Google.",
      })
      await carregar()
    } finally {
      setAcao(null)
    }
  }

  const alternarPausa = async (ativo) => {
    setAcao("pausar")
    try {
      const { data } = await api.patch("/google-agenda/sincronizacao", { ativo })
      onAviso?.({ tipo: "success", texto: data.mensagem })
      await carregar()
    } catch (err) {
      onAviso?.({ tipo: "error", texto: err.response?.data?.erro || "Falha ao alterar." })
    } finally {
      setAcao(null)
    }
  }

  const desconectar = async () => {
    // A confirmacao existe porque desconectar APAGA a agenda "Quiron" da conta
    // do Google — nao e so parar de sincronizar, que e o que o switch faz.
    if (!window.confirm("Desconectar sua conta do Google? A agenda \"Quiron\" sera removida de la.")) {
      return
    }
    setAcao("desconectar")
    try {
      const { data } = await api.delete("/google-agenda/conexao")
      onAviso?.({ tipo: "success", texto: data.mensagem })
      await carregar()
    } catch (err) {
      onAviso?.({ tipo: "error", texto: err.response?.data?.erro || "Falha ao desconectar." })
    } finally {
      setAcao(null)
    }
  }

  // Enquanto carrega, nada: piscar um esqueleto para depois sumir (instalacao
  // sem credenciais) seria pior que aparecer ja pronto.
  if (carregando || !status?.configurado) return null

  return (
    <Paper sx={{ p: 3, borderRadius: 0, mt: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>
          <Google />
        </Box>
        <Typography variant="h6" fontWeight={700}>
          Google Agenda
        </Typography>
        {status.conectado && (
          <Chip
            size="small"
            label={status.sincronizar ? "Sincronizando" : "Pausado"}
            color={status.sincronizar ? "success" : "default"}
            sx={{ ml: 1 }}
          />
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />

      {status.ultimo_erro && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {status.ultimo_erro}
        </Alert>
      )}

      {!status.conectado ? (
        <>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Conecte sua conta e os eventos da sua incubadora aparecem no seu celular, numa agenda
            separada chamada <strong>Quiron</strong>. O Quiron so escreve nessa agenda — ele nao
            consegue ler seus compromissos pessoais.
          </Typography>
          <Button
            variant="contained"
            startIcon={acao === "conectar" ? <CircularProgress size={18} color="inherit" /> : <Google />}
            onClick={conectar}
            disabled={acao !== null}
          >
            Conectar Google Agenda
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            Conectado como <strong>{status.email || "conta Google"}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ultima sincronizacao: {formatarData(status.ultimo_sync_ts)}
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={Boolean(status.sincronizar)}
                onChange={(e) => alternarPausa(e.target.checked)}
                disabled={acao !== null}
              />
            }
            label="Enviar novos eventos automaticamente"
          />

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={acao === "sincronizar" ? <CircularProgress size={18} /> : <Sync />}
              onClick={sincronizar}
              disabled={acao !== null}
            >
              Sincronizar agora
            </Button>
            <Button
              variant="text"
              color="error"
              startIcon={acao === "desconectar" ? <CircularProgress size={18} color="inherit" /> : <LinkOff />}
              onClick={desconectar}
              disabled={acao !== null}
            >
              Desconectar
            </Button>
          </Box>
        </>
      )}
    </Paper>
  )
}
