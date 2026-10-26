/**
 * Subpagina de Configuracoes: a estrutura do QUADRO DE TAREFAS — as COLUNAS e os
 * CAMPOS PERSONALIZAVEIS da incubadora.
 *
 * E a tela que torna o quadro extensivel. As quatro colunas com que ele nasce
 * (A fazer / Em andamento / Em revisao / Concluida) sao um padrao, nao uma
 * regra: uma incubadora que trabalhe com "Aguardando terceiros" ou "Bloqueada"
 * cria a coluna aqui e o quadro se remonta sozinho.
 *
 * Endpoints (autorizacao no backend: `configuracoes.tarefas.gerenciar`):
 *   GET/POST/PUT/PATCH /tarefas-config/status
 *   GET/POST/PUT/PATCH /tarefas-config/campos
 *
 * A CATEGORIA DE UMA COLUNA e o campo que mais confunde e o que mais importa:
 * ela diz o que aquela coluna SIGNIFICA para o sistema, por tras do nome que a
 * incubadora escolheu. Sem isso, uma coluna "Arquivada" contaria como pendencia
 * atrasada para sempre, e o "concluidas neste mes" nunca fecharia. Mudar a
 * categoria de uma coluna reprocessa as tarefas que ja estao nela — o aviso na
 * tela diz isso antes de salvar.
 *
 * DESATIVAR, NAO EXCLUIR: as tarefas continuam apontando para a coluna em que
 * estao, e os valores dos campos continuam gravados no `campos_extras` de cada
 * uma. Por isso o botao e um interruptor, e o dialogo avisa quantas tarefas
 * serao afetadas antes de desligar.
 */
import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material"
import { Add, Close } from "@mui/icons-material"
import api from "../services/api"
import { useTarefaConfigStore } from "../store/tarefaConfigStore"
import ConfigDoTipo, { TIPOS_CAMPO, rotuloDoTipoCampo } from "../components/campos/ConfigDoTipo"
import LinhaConfig, { Bolinha } from "../components/campos/LinhaConfig"

const STATUS_VAZIO = { rotulo: "", cor: "#6366f1", categoria: "PENDENTE" }
const CAMPO_VAZIO = {
  rotulo: "",
  tipo: "TEXTO",
  descricao: "",
  obrigatorio: false,
  config: {},
}

/** O que cada categoria significa, na lingua de quem administra a incubadora. */
const CATEGORIAS = [
  {
    valor: "PENDENTE",
    rotulo: "Não começou",
    ajuda: "A tarefa está aberta e ninguém pôs a mão nela ainda.",
  },
  {
    valor: "EM_ANDAMENTO",
    rotulo: "Em andamento",
    ajuda: "Alguém está trabalhando nisso. Continua contando como pendência.",
  },
  {
    valor: "CONCLUIDA",
    rotulo: "Concluída",
    ajuda: "Encerra a tarefa: marca a data de conclusão e sai das pendências.",
  },
]

const ajudaDaCategoria = (valor) => CATEGORIAS.find((c) => c.valor === valor)?.ajuda

export default function ConfiguracaoTarefas() {
  const { idTenant } = useOutletContext()
  const definirStatus = useTarefaConfigStore((s) => s.definirStatus)
  const definirCampos = useTarefaConfigStore((s) => s.definirCampos)

  const [status, setStatus] = useState([])
  const [campos, setCampos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }
  const [salvando, setSalvando] = useState(false)

  // Formularios inline: null = fechado; objeto = editando/criando.
  const [formStatus, setFormStatus] = useState(null)
  const [formCampo, setFormCampo] = useState(null)
  // Confirmacao de desativar, com a contagem de uso.
  const [confirmacao, setConfirmacao] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) return
    setCarregando(true)
    setAviso(null)
    try {
      // incluir_inativos: esta tela precisa mostrar o que foi desativado, senao
      // nao ha por onde reativar.
      const [respS, respC] = await Promise.all([
        api.get("/tarefas-config/status", {
          params: { id_tenant: idTenant, incluir_inativos: true },
        }),
        api.get("/tarefas-config/campos", {
          params: { id_tenant: idTenant, incluir_inativos: true },
        }),
      ])
      setStatus(respS.data.status)
      setCampos(respC.data.campos)
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err.response?.data?.erro || "Erro ao carregar a configuração.",
      })
    } finally {
      setCarregando(false)
    }
  }, [idTenant])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Recarrega uma das listas e reflete no store, para o quadro nao ficar com o
   * vocabulario antigo ate o proximo F5.
   */
  const recarregar = async (recurso) => {
    const { data } = await api.get(`/tarefas-config/${recurso}`, {
      params: { id_tenant: idTenant, incluir_inativos: true },
    })
    if (recurso === "status") {
      setStatus(data.status)
      definirStatus(data.status)
    } else {
      setCampos(data.campos)
      definirCampos(data.campos)
    }
  }

  // --------------------------------------------------------------- colunas
  const salvarStatus = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const corpo = {
        id_tenant: idTenant,
        rotulo: formStatus.rotulo,
        cor: formStatus.cor,
        categoria: formStatus.categoria,
      }
      if (formStatus.chave) {
        await api.put(`/tarefas-config/status/${formStatus.chave}`, corpo)
      } else {
        await api.post("/tarefas-config/status", corpo)
      }
      setFormStatus(null)
      await recarregar("status")
      setAviso({ tipo: "success", texto: "Coluna salva." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a coluna." })
    } finally {
      setSalvando(false)
    }
  }

  // ---------------------------------------------------------------- campos
  const salvarCampo = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const corpo = {
        id_tenant: idTenant,
        rotulo: formCampo.rotulo,
        tipo: formCampo.tipo,
        descricao: formCampo.descricao,
        obrigatorio: formCampo.obrigatorio,
        config: formCampo.config,
      }
      if (formCampo.id_campo) {
        await api.put(`/tarefas-config/campos/${formCampo.id_campo}`, corpo)
      } else {
        await api.post("/tarefas-config/campos", corpo)
      }
      setFormCampo(null)
      await recarregar("campos")
      setAviso({ tipo: "success", texto: "Campo salvo." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar o campo." })
    } finally {
      setSalvando(false)
    }
  }

  /**
   * Abre a edicao de um campo ja salvo.
   *
   * As opcoes de CATEGORIA voltam marcadas com `fixado`: o valor delas ja esta
   * gravado nas tarefas, entao editar o rotulo nao pode mais mexer no valor.
   */
  const editarCampo = (campo) => {
    const config = { ...(campo.config || {}) }
    if (campo.tipo === "CATEGORIA") {
      config.opcoes = (config.opcoes || []).map((o) => ({ ...o, fixado: true }))
    }
    setFormCampo({ ...campo, descricao: campo.descricao || "", config })
  }

  // ------------------------------------------------------- ativar/desativar
  /**
   * Pergunta antes de desativar, com quantas tarefas serao afetadas — a decisao
   * muda bastante entre "nunca usei isso" e "30 tarefas estao aqui".
   *
   * O caminho do endpoint difere entre os dois recursos: a coluna usa /ativo
   * (porque "/status/:chave/status" seria ilegivel) e o campo usa /status.
   */
  const pedirDesativar = async (recurso, alvo, id, rotulo) => {
    if (!alvo.ativo) {
      alternar(recurso, id, true)
      return
    }
    try {
      const { data } = await api.get(`/tarefas-config/${recurso}/${id}/uso`, {
        params: { id_tenant: idTenant },
      })
      setConfirmacao({ recurso, id, rotulo, tarefas: data.tarefas })
    } catch {
      setConfirmacao({ recurso, id, rotulo, tarefas: null })
    }
  }

  const alternar = async (recurso, id, ativo) => {
    setConfirmacao(null)
    setAviso(null)
    try {
      const caminho = recurso === "status" ? "ativo" : "status"
      await api.patch(`/tarefas-config/${recurso}/${id}/${caminho}`, {
        id_tenant: idTenant,
        ativo,
      })
      await recarregar(recurso)
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao alterar o item." })
    }
  }

  if (carregando) {
    return (
      <Paper sx={{ borderRadius: 0, p: { xs: 3, sm: 6 }, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    )
  }

  const tipoCampoAtual = TIPOS_CAMPO.find((t) => t.valor === formCampo?.tipo)

  return (
    <Box>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {/* --------------------------------------------------------- COLUNAS */}
      <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Colunas do quadro
            </Typography>
            <Typography variant="body2" color="text.secondary">
              As etapas pelas quais uma tarefa passa. Cada coluna diz também o que ela significa,
              é o que mantém as contagens de pendência e conclusão certas.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setFormStatus({ ...STATUS_VAZIO })}
          >
            Nova
          </Button>
        </Box>

        {formStatus && (
          <Box component="form" onSubmit={salvarStatus} sx={{ py: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={formStatus.rotulo}
                  onChange={(e) => setFormStatus((f) => ({ ...f, rotulo: e.target.value }))}
                  helperText={
                    formStatus.chave
                      ? "Renomear reetiqueta as tarefas existentes."
                      : "Ex.: Aguardando terceiros, Bloqueada, Entregue."
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  label="O que significa"
                  fullWidth
                  size="small"
                  value={formStatus.categoria}
                  onChange={(e) => setFormStatus((f) => ({ ...f, categoria: e.target.value }))}
                  helperText={ajudaDaCategoria(formStatus.categoria)}
                >
                  {CATEGORIAS.map((c) => (
                    <MenuItem key={c.valor} value={c.valor}>
                      {c.rotulo}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={2}>
                <TextField
                  label="Cor"
                  type="color"
                  fullWidth
                  size="small"
                  value={formStatus.cor}
                  onChange={(e) => setFormStatus((f) => ({ ...f, cor: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <Chip
                  size="small"
                  label={formStatus.rotulo || "Prévia"}
                  sx={{ bgcolor: formStatus.cor, color: "#fff", fontWeight: 600 }}
                />
              </Grid>
            </Grid>

            {/* Mudar a categoria de uma coluna EM USO reprocessa as tarefas que
                estao nela. Avisar depois do fato seria avisar tarde. */}
            {formStatus.chave && formStatus.categoria !== formStatus.categoriaOriginal && (
              <Alert severity="info" sx={{ mt: 2 }}>
                As tarefas que já estão nesta coluna terão a marca de conclusão reprocessada.
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" size="small" variant="contained" disabled={salvando}>
                {salvando ? <CircularProgress size={18} color="inherit" /> : "Salvar"}
              </Button>
              <Button size="small" onClick={() => setFormStatus(null)} startIcon={<Close />}>
                Cancelar
              </Button>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          {status.map((s) => (
            <LinhaConfig
              key={s.chave}
              titulo={s.rotulo}
              subtitulo={ajudaDaCategoria(s.categoria)}
              adorno={<Bolinha cor={s.cor} />}
              ativo={s.ativo}
              onEditar={() => setFormStatus({ ...s, categoriaOriginal: s.categoria })}
              onAlternar={() => pedirDesativar("status", s, s.chave, s.rotulo)}
            />
          ))}
        </Box>
      </Paper>

      {/* --------------------------------------------- CAMPOS PERSONALIZAVEIS */}
      <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Campos personalizáveis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              O que mais a sua incubadora precisa registrar em cada tarefa. Os campos criados aqui
              aparecem no formulário e viram coluna e filtro na tabela, na ordem desta lista.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setFormCampo({ ...CAMPO_VAZIO, config: {} })}
          >
            Novo
          </Button>
        </Box>

        {formCampo && (
          <Box component="form" onSubmit={salvarCampo} sx={{ py: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Nome do campo"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={formCampo.rotulo}
                  onChange={(e) => setFormCampo((f) => ({ ...f, rotulo: e.target.value }))}
                  helperText="Ex.: Centro de custo, Nº do contrato, Horas estimadas."
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  label="Tipo"
                  fullWidth
                  size="small"
                  value={formCampo.tipo}
                  // O tipo e IMUTAVEL depois de criado: os valores ja gravados
                  // nas tarefas foram normalizados por ele, e trocar
                  // transformaria "12.345,67" em lixo.
                  disabled={Boolean(formCampo.id_campo)}
                  onChange={(e) => setFormCampo((f) => ({ ...f, tipo: e.target.value, config: {} }))}
                  helperText={
                    formCampo.id_campo ? "O tipo não muda depois de criado." : tipoCampoAtual?.ajuda
                  }
                >
                  {TIPOS_CAMPO.map((t) => (
                    <MenuItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  sx={{ mt: 0.5 }}
                  control={
                    <Switch
                      size="small"
                      checked={Boolean(formCampo.obrigatorio)}
                      onChange={(e) =>
                        setFormCampo((f) => ({ ...f, obrigatorio: e.target.checked }))
                      }
                    />
                  }
                  label={<Typography variant="body2">Obrigatório</Typography>}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Texto de ajuda"
                  fullWidth
                  size="small"
                  value={formCampo.descricao}
                  onChange={(e) => setFormCampo((f) => ({ ...f, descricao: e.target.value }))}
                  helperText="Aparece embaixo do campo no formulário. Opcional."
                />
              </Grid>
              <Grid item xs={12}>
                <ConfigDoTipo
                  tipo={formCampo.tipo}
                  config={formCampo.config || {}}
                  onChange={(config) => setFormCampo((f) => ({ ...f, config }))}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" size="small" variant="contained" disabled={salvando}>
                {salvando ? <CircularProgress size={18} color="inherit" /> : "Salvar"}
              </Button>
              <Button size="small" onClick={() => setFormCampo(null)} startIcon={<Close />}>
                Cancelar
              </Button>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          {campos.length === 0 && !formCampo ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Nenhum campo personalizado. O formulário de tarefa mostra só os campos padrão.
            </Typography>
          ) : (
            campos.map((c) => (
              <LinhaConfig
                key={c.id_campo}
                titulo={c.rotulo}
                subtitulo={[
                  rotuloDoTipoCampo(c.tipo),
                  c.obrigatorio ? "obrigatório" : null,
                  c.tipo === "DOCUMENTO" ? c.config?.mascara : null,
                  c.tipo === "CATEGORIA" ? `${(c.config?.opcoes || []).length} opções` : null,
                  c.descricao,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                adorno={
                  <Chip
                    size="small"
                    label={rotuloDoTipoCampo(c.tipo)}
                    variant="outlined"
                    sx={{ flexShrink: 0, minWidth: 92 }}
                  />
                }
                ativo={c.ativo}
                onEditar={() => editarCampo(c)}
                onAlternar={() => pedirDesativar("campos", c, c.id_campo, c.rotulo)}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* Desativar avisa quantas tarefas usam o item. */}
      <Dialog open={Boolean(confirmacao)} onClose={() => setConfirmacao(null)}>
        <DialogTitle>Desativar "{confirmacao?.rotulo}"?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {confirmacao?.tarefas > 0 ? (
              <>
                <strong>
                  {confirmacao.tarefas} tarefa{confirmacao.tarefas === 1 ? "" : "s"}
                </strong>{" "}
                {confirmacao.tarefas === 1 ? "usa" : "usam"} isto. Nada será apagado:{" "}
                {confirmacao.tarefas === 1 ? "ela continua" : "elas continuam"} com o valor que já
                têm, e o item só some do quadro e do formulário. Dá para reativar quando quiser.
              </>
            ) : (
              <>
                Ninguém está usando isto no momento. O item some do quadro e do formulário, e pode
                ser reativado quando quiser.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmacao(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => alternar(confirmacao.recurso, confirmacao.id, false)}
          >
            Desativar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
