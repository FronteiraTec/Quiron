/**
 * Subpagina de Configuracoes: as CATEGORIAS e os LOCAIS que a incubadora usa
 * na agenda.
 *
 * Ate a migracao 008 as categorias eram um enum do Postgres — oito valores
 * iguais para todas as incubadoras. Esta tela e o que as tornou configuraveis.
 *
 * Endpoints (autorizacao no backend: `configuracoes.agenda.gerenciar`):
 *   GET/POST/PUT/PATCH /agenda-config/categorias
 *   GET/POST/PUT/PATCH /agenda-config/locais
 *
 * DESATIVAR, NAO EXCLUIR: os eventos historicos continuam apontando para a
 * categoria e o local em que aconteceram. Uma categoria apagada de verdade
 * deixaria o relatorio de engajamento sem rotulo, e a FK barraria a operacao de
 * qualquer forma. Por isso o botao e um interruptor, e o dialogo avisa quantos
 * eventos usam aquilo antes de desligar.
 */
import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
} from "@mui/material"
import { Add, Edit, ToggleOn, ToggleOff, Close } from "@mui/icons-material"
import api from "../services/api"
import { ICONES, LISTA_ICONES } from "../components/calendar/categorias"
import { useAgendaConfigStore } from "../store/agendaConfigStore"

const CATEGORIA_VAZIA = { rotulo: "", cor: "#6366f1", icone: "Event" }
const LOCAL_VAZIO = { nome: "", endereco: "", capacidade: "" }

/** Uma linha da lista, com o mesmo visual para categoria e local. */
function LinhaConfig({ titulo, subtitulo, adorno, ativo, onEditar, onAlternar }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.25,
        opacity: ativo ? 1 : 0.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {adorno}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {titulo}
        </Typography>
        {subtitulo && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitulo}
          </Typography>
        )}
      </Box>
      {!ativo && <Chip size="small" label="Desativado" />}
      <Tooltip title="Editar">
        <IconButton size="small" onClick={onEditar}>
          <Edit fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={ativo ? "Desativar" : "Reativar"}>
        <IconButton size="small" onClick={onAlternar}>
          {ativo ? <ToggleOn fontSize="small" color="primary" /> : <ToggleOff fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

export default function ConfiguracaoAgenda() {
  const { idTenant } = useOutletContext()
  const definirCategorias = useAgendaConfigStore((s) => s.definirCategorias)
  const definirLocais = useAgendaConfigStore((s) => s.definirLocais)

  const [categorias, setCategorias] = useState([])
  const [locais, setLocais] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }
  const [salvando, setSalvando] = useState(false)

  // Formularios inline: null = fechado; objeto = editando/criando.
  const [formCategoria, setFormCategoria] = useState(null)
  const [formLocal, setFormLocal] = useState(null)
  // Confirmacao de desativar, com a contagem de uso.
  const [confirmacao, setConfirmacao] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) return
    setCarregando(true)
    setAviso(null)
    try {
      // incluir_inativas: esta tela precisa mostrar o que foi desativado, senao
      // nao ha por onde reativar.
      const [respC, respL] = await Promise.all([
        api.get("/agenda-config/categorias", {
          params: { id_tenant: idTenant, incluir_inativas: true },
        }),
        api.get("/agenda-config/locais", {
          params: { id_tenant: idTenant, incluir_inativos: true },
        }),
      ])
      setCategorias(respC.data.categorias)
      setLocais(respL.data.locais)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar a configuração." })
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Reflete no store o que acabou de mudar, para o calendario nao ficar com o
   * rotulo antigo ate o proximo F5. O store so guarda as ATIVAS — e o que o
   * seletor de evento novo pode oferecer.
   */
  const propagar = (novasCategorias, novosLocais) => {
    if (novasCategorias) definirCategorias(novasCategorias.filter((c) => c.ativo))
    if (novosLocais) definirLocais(novosLocais.filter((l) => l.ativo))
  }

  // ----------------------------------------------------------- categorias
  const salvarCategoria = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const corpo = {
        id_tenant: idTenant,
        rotulo: formCategoria.rotulo,
        cor: formCategoria.cor,
        icone: formCategoria.icone,
      }
      if (formCategoria.chave) {
        await api.put(`/agenda-config/categorias/${formCategoria.chave}`, corpo)
      } else {
        await api.post("/agenda-config/categorias", corpo)
      }
      setFormCategoria(null)
      const { data } = await api.get("/agenda-config/categorias", {
        params: { id_tenant: idTenant, incluir_inativas: true },
      })
      setCategorias(data.categorias)
      propagar(data.categorias, null)
      setAviso({ tipo: "success", texto: "Categoria salva." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a categoria." })
    } finally {
      setSalvando(false)
    }
  }

  /** Pergunta antes de desativar, com quantos eventos serao afetados. */
  const pedirDesativarCategoria = async (categoria) => {
    if (categoria.ativo) {
      try {
        const { data } = await api.get(`/agenda-config/categorias/${categoria.chave}/uso`, {
          params: { id_tenant: idTenant },
        })
        setConfirmacao({ tipo: "categoria", alvo: categoria, eventos: data.eventos })
      } catch {
        setConfirmacao({ tipo: "categoria", alvo: categoria, eventos: null })
      }
    } else {
      alternarCategoria(categoria, true)
    }
  }

  const alternarCategoria = async (categoria, ativo) => {
    setConfirmacao(null)
    try {
      await api.patch(`/agenda-config/categorias/${categoria.chave}/status`, {
        id_tenant: idTenant,
        ativo,
      })
      const { data } = await api.get("/agenda-config/categorias", {
        params: { id_tenant: idTenant, incluir_inativas: true },
      })
      setCategorias(data.categorias)
      propagar(data.categorias, null)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar a categoria." })
    }
  }

  // --------------------------------------------------------------- locais
  const salvarLocal = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const corpo = {
        id_tenant: idTenant,
        nome: formLocal.nome,
        endereco: formLocal.endereco,
        capacidade: formLocal.capacidade,
      }
      if (formLocal.id_local) {
        await api.put(`/agenda-config/locais/${formLocal.id_local}`, corpo)
      } else {
        await api.post("/agenda-config/locais", corpo)
      }
      setFormLocal(null)
      const { data } = await api.get("/agenda-config/locais", {
        params: { id_tenant: idTenant, incluir_inativos: true },
      })
      setLocais(data.locais)
      propagar(null, data.locais)
      setAviso({ tipo: "success", texto: "Local salvo." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar o local." })
    } finally {
      setSalvando(false)
    }
  }

  const pedirDesativarLocal = async (local) => {
    if (local.ativo) {
      try {
        const { data } = await api.get(`/agenda-config/locais/${local.id_local}/uso`, {
          params: { id_tenant: idTenant },
        })
        setConfirmacao({ tipo: "local", alvo: local, eventos: data.eventos })
      } catch {
        setConfirmacao({ tipo: "local", alvo: local, eventos: null })
      }
    } else {
      alternarLocal(local, true)
    }
  }

  const alternarLocal = async (local, ativo) => {
    setConfirmacao(null)
    try {
      await api.patch(`/agenda-config/locais/${local.id_local}/status`, {
        id_tenant: idTenant,
        ativo,
      })
      const { data } = await api.get("/agenda-config/locais", {
        params: { id_tenant: idTenant, incluir_inativos: true },
      })
      setLocais(data.locais)
      propagar(null, data.locais)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o local." })
    }
  }

  if (carregando) {
    return (
      <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    )
  }

  const IconePreview = ICONES[formCategoria?.icone] || ICONES.Event

  return (
    <Box>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {/* ------------------------------------------------------ CATEGORIAS */}
      <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Categorias de evento
            </Typography>
            <Typography variant="body2" color="text.secondary">
              O vocabulário da sua agenda: como cada atividade aparece no calendário.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setFormCategoria({ ...CATEGORIA_VAZIA })}
          >
            Nova
          </Button>
        </Box>

        {formCategoria && (
          <Box component="form" onSubmit={salvarCategoria} sx={{ py: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={formCategoria.rotulo}
                  onChange={(e) => setFormCategoria((f) => ({ ...f, rotulo: e.target.value }))}
                  helperText={
                    formCategoria.chave
                      ? "Renomear reetiqueta os eventos existentes."
                      : "Ex.: Demoday, Capacitação, Banca."
                  }
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  select
                  label="Ícone"
                  fullWidth
                  size="small"
                  value={formCategoria.icone}
                  onChange={(e) => setFormCategoria((f) => ({ ...f, icone: e.target.value }))}
                >
                  {LISTA_ICONES.map((nome) => {
                    const Icone = ICONES[nome]
                    return (
                      <MenuItem key={nome} value={nome}>
                        <Icone fontSize="small" sx={{ mr: 1 }} />
                        {nome}
                      </MenuItem>
                    )
                  })}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField
                  label="Cor"
                  type="color"
                  fullWidth
                  size="small"
                  value={formCategoria.cor}
                  onChange={(e) => setFormCategoria((f) => ({ ...f, cor: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Chip
                    size="small"
                    icon={<IconePreview style={{ color: "#fff" }} />}
                    label={formCategoria.rotulo || "Prévia"}
                    sx={{ bgcolor: formCategoria.cor, color: "#fff", fontWeight: 600 }}
                  />
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" size="small" variant="contained" disabled={salvando}>
                {salvando ? <CircularProgress size={18} color="inherit" /> : "Salvar"}
              </Button>
              <Button size="small" onClick={() => setFormCategoria(null)} startIcon={<Close />}>
                Cancelar
              </Button>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          {categorias.map((c) => {
            const Icone = ICONES[c.icone] || ICONES.Event
            return (
              <LinhaConfig
                key={c.chave}
                titulo={c.rotulo}
                adorno={
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "8px",
                      bgcolor: c.cor,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icone sx={{ fontSize: 18, color: "#fff" }} />
                  </Box>
                }
                ativo={c.ativo}
                onEditar={() => setFormCategoria({ ...c })}
                onAlternar={() => pedirDesativarCategoria(c)}
              />
            )
          })}
        </Box>
      </Paper>

      {/* ---------------------------------------------------------- LOCAIS */}
      <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Locais
            </Typography>
            <Typography variant="body2" color="text.secondary">
              As salas e espaços que você usa sempre. No evento também dá para digitar um local avulso.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setFormLocal({ ...LOCAL_VAZIO })}
          >
            Novo
          </Button>
        </Box>

        {formLocal && (
          <Box component="form" onSubmit={salvarLocal} sx={{ py: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={formLocal.nome}
                  onChange={(e) => setFormLocal((f) => ({ ...f, nome: e.target.value }))}
                  helperText="Ex.: Auditório, Sala de reunião 2."
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Endereço"
                  fullWidth
                  size="small"
                  value={formLocal.endereco || ""}
                  onChange={(e) => setFormLocal((f) => ({ ...f, endereco: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="Capacidade"
                  type="number"
                  fullWidth
                  size="small"
                  value={formLocal.capacidade || ""}
                  onChange={(e) => setFormLocal((f) => ({ ...f, capacidade: e.target.value }))}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" size="small" variant="contained" disabled={salvando}>
                {salvando ? <CircularProgress size={18} color="inherit" /> : "Salvar"}
              </Button>
              <Button size="small" onClick={() => setFormLocal(null)} startIcon={<Close />}>
                Cancelar
              </Button>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          {locais.length === 0 && !formLocal ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Nenhum local cadastrado. Até cadastrar, o campo de local no evento aceita texto livre.
            </Typography>
          ) : (
            locais.map((l) => (
              <LinhaConfig
                key={l.id_local}
                titulo={l.nome}
                subtitulo={[l.endereco, l.capacidade ? `${l.capacidade} lugares` : null]
                  .filter(Boolean)
                  .join(" · ")}
                ativo={l.ativo}
                onEditar={() => setFormLocal({ ...l })}
                onAlternar={() => pedirDesativarLocal(l)}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Desativar avisa quantos eventos usam o item — a decisao muda bastante
          entre "nunca usei isso" e "292 eventos usam". */}
      <Dialog open={Boolean(confirmacao)} onClose={() => setConfirmacao(null)}>
        <DialogTitle>
          Desativar {confirmacao?.tipo === "categoria" ? "a categoria" : "o local"} "
          {confirmacao?.alvo?.rotulo || confirmacao?.alvo?.nome}"?
        </DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {confirmacao?.eventos > 0 ? (
              <>
                <strong>
                  {confirmacao.eventos} evento{confirmacao.eventos === 1 ? "" : "s"}
                </strong>{" "}
                {confirmacao.eventos === 1 ? "usa" : "usam"}{" "}
                {confirmacao?.tipo === "categoria" ? "esta categoria" : "este local"}. Nada será
                apagado: {confirmacao.eventos === 1 ? "ele continua" : "eles continuam"} aparecendo
                normalmente no calendário e nos relatórios.
              </>
            ) : (
              <>Nada será apagado.</>
            )}{" "}
            A partir de agora {confirmacao?.tipo === "categoria" ? "ela" : "ele"} apenas deixa de ser
            oferecid{confirmacao?.tipo === "categoria" ? "a" : "o"} ao criar um evento novo. Dá para
            reativar quando quiser.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmacao(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() =>
              confirmacao.tipo === "categoria"
                ? alternarCategoria(confirmacao.alvo, false)
                : alternarLocal(confirmacao.alvo, false)
            }
          >
            Desativar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
