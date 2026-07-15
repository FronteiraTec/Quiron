/**
 * Aba "Fases concluidas": lista somente leitura das fases ja aprovadas.
 * Usada tanto em MinhaStartup quanto em StartupDetail.
 */
import { useEffect, useState } from "react"
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Typography,
} from "@mui/material"
import { CheckCircle } from "@mui/icons-material"
import api from "../../services/api"

export default function AbaFasesConcluidas({ idStartup }) {
  const [fases, setFases] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    setCarregando(true)
    api
      .get(`/startups/${idStartup}/fases-concluidas`)
      .then(({ data }) => setFases(data.fases))
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as fases." }))
      .finally(() => setCarregando(false))
  }, [idStartup])

  if (carregando) {
    return (
      <Box sx={{ textAlign: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}
      {fases.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <CheckCircle sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography sx={{ mt: 1 }}>Nenhuma fase concluida ainda.</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell align="center" width={90}>
                  Ordem
                </TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Descricao</TableCell>
                <TableCell align="center">Concluida em</TableCell>
                <TableCell align="center">Aprovada por</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fases.map((f) => (
                <TableRow key={f.id_startup_fase} hover>
                  <TableCell align="center">
                    <Chip size="small" label={f.ordem} />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{f.nome}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {f.descricao}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {f.fim_ts ? new Date(f.fim_ts).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell align="center">{f.aprovado_por_nome || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  )
}
