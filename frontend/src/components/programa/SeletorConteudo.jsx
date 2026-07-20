/**
 * Seletor de conteudo da Biblioteca — dialog para referenciar, num Passo, um ou
 * mais conteudos do acervo (aulas, videos, materiais, templates, links).
 *
 * E o que liga o Construtor de Programa (admin) a Biblioteca: o Passo nao
 * recria conteudo, ele aponta para o que ja existe. Os itens ja adicionados
 * saem da lista de disponiveis.
 */
import { useEffect, useState } from "react"
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  Box,
  Typography,
  IconButton,
} from "@mui/material"
import { Search, AddCircleOutline, Close } from "@mui/icons-material"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"
import api from "../../services/api"
import { useAuthStore } from "../../store/authStore"

export default function SeletorConteudo({ aberto, jaSelecionados = [], onAdicionar, onFechar }) {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [termo, setTermo] = useState("")
  const [conteudos, setConteudos] = useState([])
  const [carregando, setCarregando] = useState(false)

  // Busca no servidor, com debounce. So enquanto o dialog esta aberto.
  useEffect(() => {
    if (!aberto || !idTenant) return

    let cancelado = false
    setCarregando(true)

    const t = setTimeout(() => {
      api
        .get("/conteudos", {
          params: {
            id_tenant: idTenant,
            ...(termo.trim() ? { termo: termo.trim() } : {}),
          },
        })
        .then(({ data }) => {
          if (!cancelado) setConteudos(data.conteudos)
        })
        .catch(() => {
          if (!cancelado) setConteudos([])
        })
        .finally(() => {
          if (!cancelado) setCarregando(false)
        })
    }, termo.trim() ? 300 : 0)

    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [aberto, idTenant, termo])

  // O que ja esta no passo sai da lista de disponiveis.
  const disponiveis = conteudos.filter((c) => !jaSelecionados.includes(c.id_conteudo))

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        Adicionar da Biblioteca
        <IconButton onClick={onFechar} sx={{ ml: "auto" }} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          autoFocus
          placeholder="Buscar conteudo…"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
        />

        {carregando && disponiveis.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            Carregando…
          </Typography>
        ) : disponiveis.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            Nenhum conteudo disponivel para adicionar.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {disponiveis.map((c) => {
              const meta = TIPO_CONTEUDO[c.tipo]
              const Icone = meta.icon
              return (
                <Box
                  key={c.id_conteudo}
                  onClick={() => onAdicionar(c.id_conteudo)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    p: 1.25,
                    borderRadius: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    cursor: "pointer",
                    "&:hover": { borderColor: `${meta.cor}66`, bgcolor: "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      width: 34,
                      height: 34,
                      borderRadius: 1.5,
                      bgcolor: `${meta.cor}1f`,
                      color: meta.cor,
                      flexShrink: 0,
                    }}
                  >
                    <Icone sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }} noWrap>
                      {c.titulo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {meta.label} · {c.resumo}
                    </Typography>
                  </Box>
                  <AddCircleOutline sx={{ color: "primary.main" }} />
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} sx={{ textTransform: "none" }}>
          Concluir
        </Button>
      </DialogActions>
    </Dialog>
  )
}
