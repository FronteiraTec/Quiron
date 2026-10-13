/**
 * Os materiais de uma fase, no Inspector do Construtor.
 *
 * Substitui a lista de modulos: a fase passou a ser o ultimo nivel que quem
 * monta a trilha enxerga, e o que vai dentro dela e o material. Dois caminhos:
 *   - "Novo material": cria o conteudo na Biblioteca, ja o coloca na fase e
 *     abre o editor — o material nasce onde ele vai ser usado;
 *   - "Da Biblioteca": reaproveita um conteudo que ja existe (de outra trilha,
 *     por exemplo).
 *
 * Vincular e desvincular valem na hora, como no passo antes: vivem no
 * servidor (/trilha/:id/materiais), nao no formulario da fase. Por baixo o
 * material fica num passo "Materiais" da fase, que o servidor cria.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material"
import { Add, Close, LibraryAdd } from "@mui/icons-material"
import api from "../../services/api"
import { useAuthStore } from "../../store/authStore"
import { TIPO_CONTEUDO, TIPOS_ORDEM } from "../../data/bibliotecaMeta"
import LogoConteudo from "../biblioteca/LogoConteudo"
import EditorConteudo from "../biblioteca/EditorConteudo"
import SeletorConteudo from "./SeletorConteudo"

export default function MateriaisDaFase({ fase, onErro }) {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [materiais, setMateriais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [menuNovo, setMenuNovo] = useState(null)
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [editando, setEditando] = useState(null)

  // Em ref: o pai costuma passar uma funcao nova a cada render, e ela dentro
  // das dependencias de `carregar` refaria o fetch em loop.
  const refErro = useRef(onErro)
  refErro.current = onErro
  const avisar = (texto) => refErro.current?.(texto)

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/trilha/${fase.id_no}/materiais`)
      setMateriais(data.fases[0]?.conteudos ?? [])
    } catch (err) {
      setMateriais([])
      avisar(err.response?.data?.erro || "Erro ao carregar os materiais da fase.")
    } finally {
      setCarregando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase.id_no])

  useEffect(() => {
    setCarregando(true)
    carregar()
  }, [carregar])

  const vincular = async (idConteudo) => {
    await api.post(`/trilha/${fase.id_no}/materiais`, { id_conteudo: idConteudo })
    await carregar()
  }

  /** Do seletor da Biblioteca: o seletor segue aberto para escolher outro. */
  const adicionarDaBiblioteca = async (idConteudo) => {
    try {
      await vincular(idConteudo)
    } catch (err) {
      avisar(err.response?.data?.erro || "Erro ao adicionar o material.")
    }
  }

  /** Cria o conteudo, ja o poe na fase e abre o editor. */
  const criar = async (tipo) => {
    setMenuNovo(null)
    try {
      // O servidor exige url em LINK e VIDEO, entao eles nascem com um
      // placeholder que o editor troca. AULA nasce sem corpo: o editor de
      // blocos abre com um paragrafo vazio por conta propria.
      const { data } = await api.post("/conteudos", {
        id_tenant: idTenant,
        tipo,
        titulo: "Sem título",
        ...(tipo === "LINK" || tipo === "VIDEO" ? { url: "https://" } : {}),
      })
      await vincular(data.conteudo.id_conteudo)
      setEditando(data.conteudo)
    } catch (err) {
      avisar(err.response?.data?.erro || "Erro ao criar o material.")
    }
  }

  /** Abre no editor. A lista nao traz os blocos da aula, entao busca o completo. */
  const abrir = async (conteudo) => {
    setEditando(conteudo)
    try {
      const { data } = await api.get(`/conteudos/${conteudo.id_conteudo}`)
      setEditando(data.conteudo)
    } catch {
      avisar("Erro ao carregar o material.")
    }
  }

  const remover = async (idConteudo) => {
    try {
      await api.delete(`/trilha/${fase.id_no}/materiais/${idConteudo}`)
      setMateriais((lista) => lista.filter((c) => c.id_conteudo !== idConteudo))
    } catch (err) {
      avisar(err.response?.data?.erro || "Erro ao remover o material.")
    }
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        O que a incubadora ensina nesta fase. O incubado vê isto na Jornada, e
        a Biblioteca mostra os materiais de cada fase.
      </Typography>

      {carregando ? (
        <Box sx={{ py: 2, display: "grid", placeItems: "center" }}>
          <CircularProgress size={22} />
        </Box>
      ) : materiais.length > 0 ? (
        <Stack spacing={1} sx={{ mb: 1.5 }}>
          {materiais.map((c) => {
            const cmeta = TIPO_CONTEUDO[c.tipo]
            return (
              <Box
                key={c.id_conteudo}
                onClick={() => abrir(c)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  cursor: "pointer",
                  transition: "border-color .15s, background-color .15s",
                  "&:hover": { borderColor: `${cmeta.cor}66`, bgcolor: "action.hover" },
                }}
              >
                <LogoConteudo conteudo={c} tamanho={30} fonteIcone={17} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 13.5 }} noWrap>
                    {c.titulo}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {cmeta.label}
                  </Typography>
                </Box>
                <Tooltip title="Tirar da fase (continua na Biblioteca)" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      remover(c.id_conteudo)
                    }}
                  >
                    <Close sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )
          })}
        </Stack>
      ) : (
        <Box
          sx={{
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1.5,
            p: 2.5,
            textAlign: "center",
            color: "text.secondary",
            mb: 1.5,
          }}
        >
          <LibraryAdd sx={{ fontSize: 22, opacity: 0.4, mb: 0.5 }} />
          <Typography variant="body2">Nenhum material nesta fase ainda.</Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          onClick={(e) => setMenuNovo(e.currentTarget)}
          startIcon={<Add />}
          variant="contained"
          size="small"
          sx={{ textTransform: "none" }}
        >
          Novo material
        </Button>
        <Button
          onClick={() => setSeletorAberto(true)}
          startIcon={<LibraryAdd />}
          variant="outlined"
          size="small"
          sx={{ textTransform: "none" }}
        >
          Da Biblioteca
        </Button>
      </Box>

      <Menu anchorEl={menuNovo} open={Boolean(menuNovo)} onClose={() => setMenuNovo(null)}>
        {TIPOS_ORDEM.map((tipo) => {
          const meta = TIPO_CONTEUDO[tipo]
          const I = meta.icon
          return (
            <MenuItem key={tipo} onClick={() => criar(tipo)}>
              <ListItemIcon>
                <I fontSize="small" sx={{ color: meta.cor }} />
              </ListItemIcon>
              <ListItemText primary={meta.label} secondary={meta.descricao} />
            </MenuItem>
          )
        })}
      </Menu>

      <SeletorConteudo
        aberto={seletorAberto}
        jaSelecionados={materiais.map((c) => c.id_conteudo)}
        onAdicionar={adicionarDaBiblioteca}
        onFechar={() => setSeletorAberto(false)}
      />

      {/* O editor grava sozinho; ao fechar, a lista e refeita para trazer o
          titulo e o logo novos. */}
      <EditorConteudo
        conteudo={editando}
        onSalvar={(id, patch) => api.patch(`/conteudos/${id}`, patch)}
        onFechar={() => {
          setEditando(null)
          carregar()
        }}
      />
    </Box>
  )
}
