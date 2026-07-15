/**
 * Aba "Membros": lista, adiciona e remove membros de uma startup.
 * Usada tanto em MinhaStartup (startup do usuario logado) quanto em
 * StartupDetail (visao da incubadora sobre qualquer startup).
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Typography,
} from "@mui/material"
import { Add, Delete, Groups } from "@mui/icons-material"
import api from "../../services/api"

export default function AbaMembros({ idStartup, idTenant }) {
  const [membros, setMembros] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [dialogAberto, setDialogAberto] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      const [membrosRes, usuariosRes] = await Promise.all([
        api.get(`/startups/${idStartup}/membros`),
        api.get(`/tenants/${idTenant}/usuarios`),
      ])
      setMembros(membrosRes.data.membros)
      setUsuarios(usuariosRes.data.usuarios.filter((u) => u.ativo))
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar os membros." })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStartup])

  const idsMembros = useMemo(() => new Set(membros.map((m) => m.id_usuario)), [membros])

  const remover = async (idUsuario) => {
    if (!window.confirm("Remover este membro da startup?")) return
    setAviso(null)
    try {
      await api.delete(`/startups/${idStartup}/membros/${idUsuario}`)
      await carregar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao remover o membro." })
    }
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setDialogAberto(true)}>
          Adicionar membro
        </Button>
      </Box>

      {carregando ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      ) : membros.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <Groups sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography sx={{ mt: 1 }}>Nenhum membro cadastrado ainda.</Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="center">Lider</TableCell>
                <TableCell align="center">Entrada</TableCell>
                <TableCell align="center" width={70}>
                  Acoes
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {membros.map((m) => (
                <TableRow key={m.id_usuario} hover>
                  <TableCell>{m.nome}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell align="center">
                    {m.lider && <Chip size="small" label="Lider" color="primary" />}
                  </TableCell>
                  <TableCell align="center">
                    {m.entrada_dt ? new Date(m.entrada_dt).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Remover">
                      <IconButton size="small" color="error" onClick={() => remover(m.id_usuario)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <DialogAdicionarMembro
        aberto={dialogAberto}
        onFechar={() => setDialogAberto(false)}
        idStartup={idStartup}
        usuarios={usuarios}
        idsMembros={idsMembros}
        onAdicionado={async () => {
          setDialogAberto(false)
          await carregar()
        }}
      />
    </>
  )
}

function DialogAdicionarMembro({ aberto, onFechar, idStartup, usuarios, idsMembros, onAdicionado }) {
  const [idUsuario, setIdUsuario] = useState("")
  const [lider, setLider] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const disponiveis = useMemo(() => usuarios.filter((u) => !idsMembros.has(u.id_usuario)), [usuarios, idsMembros])

  const salvar = async (e) => {
    e.preventDefault()
    if (!idUsuario) return
    setSalvando(true)
    setAviso(null)
    try {
      await api.post(`/startups/${idStartup}/membros`, { id_usuario: idUsuario, lider })
      setIdUsuario("")
      setLider(false)
      await onAdicionado()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao adicionar o membro." })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={salvar}>
        <DialogTitle>Adicionar membro</DialogTitle>
        <DialogContent dividers>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}
          <TextField
            select
            label="Usuario"
            fullWidth
            required
            value={idUsuario}
            onChange={(e) => setIdUsuario(e.target.value)}
            sx={{ mb: 2 }}
          >
            {disponiveis.map((u) => (
              <MenuItem key={u.id_usuario} value={u.id_usuario}>
                {u.nome} ({u.email})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Papel"
            fullWidth
            value={lider ? "1" : "0"}
            onChange={(e) => setLider(e.target.value === "1")}
          >
            <MenuItem value="0">Membro</MenuItem>
            <MenuItem value="1">Lider</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={salvando || !idUsuario}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Adicionar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
