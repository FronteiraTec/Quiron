/**
 * Subpagina de Configuracoes: auditoria da incubadora selecionada no
 * ConfiguracoesLayout.
 *
 * Registra quem fez o que e quando. Fica em Configuracoes, e nao em
 * Relatorios, porque nao e material de gestao do programa: e o registro de
 * conformidade que se consulta quando ha uma pergunta especifica ("quem
 * apagou este passo?"), ao lado das demais chaves administrativas.
 *
 * Endpoint: GET /auditlogs?id_tenant=&limite=
 */
import { useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material"
import { Search, Policy } from "@mui/icons-material"
import api from "../services/api"

// Quantos registros trazer. A auditoria cresce sem parar; sem um teto a tela
// tentaria desenhar o historico inteiro da incubadora.
const LIMITE = 300

// Cor por tipo de acao: destrutivo se destaca, leitura/criacao ficam neutras.
const COR_ACAO = { EXCLUIR: "error", DELETE: "error", REMOVER: "error", CRIAR: "success", ATUALIZAR: "info" }

export default function Auditoria() {
  const { idTenant } = useOutletContext()

  const [logs, setLogs] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const [busca, setBusca] = useState("")
  const [filtroEntidade, setFiltroEntidade] = useState("todas")

  useEffect(() => {
    if (!idTenant) return
    setCarregando(true)
    setErro(null)
    api
      .get("/auditlogs", { params: { id_tenant: idTenant, limite: LIMITE } })
      .then(({ data }) => setLogs(data.logs))
      .catch((err) => {
        setLogs([])
        setErro(err.response?.data?.erro || "Erro ao carregar a auditoria.")
      })
      .finally(() => setCarregando(false))
  }, [idTenant])

  // As entidades do filtro saem dos proprios registros: o catalogo cresce
  // junto com o sistema sem precisar ser mantido a mao aqui.
  const entidades = useMemo(
    () => [...new Set(logs.map((l) => l.entidade))].sort(),
    [logs]
  )

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return logs.filter((l) => {
      if (filtroEntidade !== "todas" && l.entidade !== filtroEntidade) return false
      if (!termo) return true
      return [l.acao, l.entidade, l.entidade_id, l.descricao]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo))
    })
  }, [logs, busca, filtroEntidade])

  if (carregando) {
    return (
      <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    )
  }

  return (
    <>
      {erro && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {erro}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <TextField
          data-tour="auditoria-busca"
          placeholder="Buscar por ação, entidade ou descrição..."
          size="small"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ flex: 1, minWidth: 240 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          data-tour="auditoria-entidade"
          select
          size="small"
          label="Entidade"
          value={filtroEntidade}
          onChange={(e) => setFiltroEntidade(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="todas">Todas as entidades</MenuItem>
          {entidades.map((e) => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Paper data-tour="auditoria-tabela" sx={{ borderRadius: 0 }}>
        {filtrados.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
            <Policy sx={{ fontSize: 48, opacity: 0.4 }} />
            <Typography sx={{ mt: 1 }}>
              {logs.length === 0
                ? "Nenhuma ação registrada nesta incubadora ainda."
                : "Nenhum registro corresponde ao filtro."}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Quando</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Ação</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Entidade</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Descrição</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtrados.map((l) => (
                  <TableRow key={l.id_log}>
                    <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                      {new Date(l.criado_ts).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={l.acao}
                        color={COR_ACAO[String(l.acao).toUpperCase()] || "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {l.entidade}
                      {l.entidade_id && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {" "}
                          #{l.entidade_id}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{l.descricao || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {filtrados.length} de {logs.length} registros
            {logs.length === LIMITE && ` (limitado aos ${LIMITE} mais recentes)`}
          </Typography>
        </Box>
      </Paper>
    </>
  )
}
