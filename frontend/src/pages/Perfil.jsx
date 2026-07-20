/**
 * Tela de Perfil.
 *
 * Reune os dados basicos do usuario (nome e celular, via PUT /auth/me).
 * As preferencias de aparencia (tema, cor principal) ficam no UserPanel,
 * acessivel pelo avatar da Navbar.
 */
import { useEffect, useRef, useState } from "react"
import {
  Box,
  Paper,
  Grid,
  Typography,
  TextField,
  Button,
  Alert,
  Divider,
  Avatar,
  CircularProgress,
  IconButton,
} from "@mui/material"
import { Person, PhotoCamera } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import { useAuthStore } from "../store/authStore"

// Tamanho maximo aceito para a foto (precisa bater com o limite do backend).
const FOTO_MAX_BYTES = 2 * 1024 * 1024 // 2MB

export default function Perfil() {
  const usuario = useAuthStore((s) => s.usuario)
  const atualizarPerfil = useAuthStore((s) => s.atualizarPerfil)
  const atualizarFoto = useAuthStore((s) => s.atualizarFoto)

  // --- Formulario de perfil ---
  const [nome, setNome] = useState("")
  const [celular, setCelular] = useState("")
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)

  // --- Foto de perfil ---
  const inputFotoRef = useRef(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)

  // Feedback (sucesso/erro) exibido no topo.
  const [aviso, setAviso] = useState(null) // { tipo, texto }

  // Sincroniza os campos quando os dados carregam.
  useEffect(() => {
    if (usuario) {
      setNome(usuario.nome || "")
      setCelular(usuario.celular || "")
    }
  }, [usuario])

  const salvarDadosPerfil = async (e) => {
    e.preventDefault()
    setAviso(null)
    setSalvandoPerfil(true)
    try {
      await atualizarPerfil({ nome, celular })
      setAviso({ tipo: "success", texto: "Perfil atualizado com sucesso." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar o perfil." })
    } finally {
      setSalvandoPerfil(false)
    }
  }

  const selecionarFoto = (e) => {
    const arquivo = e.target.files?.[0]
    e.target.value = "" // permite selecionar o mesmo arquivo de novo depois
    if (!arquivo) return

    if (!arquivo.type.startsWith("image/")) {
      setAviso({ tipo: "error", texto: "Selecione um arquivo de imagem." })
      return
    }
    if (arquivo.size > FOTO_MAX_BYTES) {
      setAviso({ tipo: "error", texto: "A imagem deve ter no maximo 2MB." })
      return
    }

    setAviso(null)
    const leitor = new FileReader()
    leitor.onload = async () => {
      setEnviandoFoto(true)
      try {
        await atualizarFoto(leitor.result)
        setAviso({ tipo: "success", texto: "Foto atualizada com sucesso." })
      } catch (err) {
        setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao enviar a foto." })
      } finally {
        setEnviandoFoto(false)
      }
    }
    leitor.readAsDataURL(arquivo)
  }

  return (
    <AppLayout>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Perfil
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Gerencie seus dados pessoais.
        </Typography>

        {aviso && (
          <Alert severity={aviso.tipo} sx={{ mb: 3 }} onClose={() => setAviso(null)}>
            {aviso.texto}
          </Alert>
        )}

        {!usuario ? (
          <Box sx={{ textAlign: "center", mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper sx={{ p: 3, borderRadius: 0 }} component="form" onSubmit={salvarDadosPerfil}>
            <SecaoTitulo icone={<Person />} titulo="Perfil" />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Box sx={{ position: "relative", width: 56, height: 56 }}>
                <Avatar src={usuario.foto_url || undefined} sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
                  {(usuario.nome || "?").charAt(0).toUpperCase()}
                </Avatar>
                <IconButton
                  size="small"
                  onClick={() => inputFotoRef.current?.click()}
                  disabled={enviandoFoto}
                  aria-label="Alterar foto de perfil"
                  sx={{
                    position: "absolute",
                    bottom: -4,
                    right: -4,
                    width: 24,
                    height: 24,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  {enviandoFoto ? <CircularProgress size={14} /> : <PhotoCamera sx={{ fontSize: 14 }} />}
                </IconButton>
                <input
                  ref={inputFotoRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={selecionarFoto}
                />
              </Box>
              <Box>
                <Typography fontWeight={600}>{usuario.nome}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {usuario.email}
                </Typography>
              </Box>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Celular"
                  fullWidth
                  required
                  value={celular}
                  onChange={(e) => setCelular(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Email" fullWidth value={usuario.email} disabled />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, textAlign: "right" }}>
              <Button type="submit" variant="contained" disabled={salvandoPerfil}>
                {salvandoPerfil ? <CircularProgress size={22} color="inherit" /> : "Salvar perfil"}
              </Button>
            </Box>
          </Paper>
        )}
      </Box>
    </AppLayout>
  )
}

/** Cabecalho de uma secao (icone + titulo + divisor). */
function SecaoTitulo({ icone, titulo }) {
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>{icone}</Box>
        <Typography variant="h6" fontWeight={700}>
          {titulo}
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
    </>
  )
}
