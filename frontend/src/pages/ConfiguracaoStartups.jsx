/**
 * Subpagina de Configuracoes: o vocabulario e a estrutura do CADASTRO DE
 * STARTUP — os TIPOS, os STATUS e os CAMPOS PERSONALIZAVEIS da incubadora.
 *
 * E a tela que torna o cadastro extensivel. Ate a migracao 010 o status era um
 * enum de tres valores igual para todas as incubadoras e nao havia tipo nenhum;
 * um campo novo exigia migracao, deploy e um formulario reescrito. Aqui a
 * incubadora cria os proprios, e o formulario de startup se redesenha sozinho.
 *
 * Endpoints (autorizacao no backend: `configuracoes.startups.gerenciar`):
 *   GET/POST/PUT/PATCH /startups-config/tipos
 *   GET/POST/PUT/PATCH /startups-config/situacoes
 *   GET/POST/PUT/PATCH /startups-config/campos
 *
 * DESATIVAR, NAO EXCLUIR: as startups continuam apontando para o tipo e o
 * status em que estao, e os valores dos campos continuam gravados no
 * `campos_extras` de cada uma. Um tipo apagado de verdade seria barrado pela FK;
 * um campo apagado deixaria valor orfao dentro do JSONB. Por isso o botao e um
 * interruptor, e o dialogo avisa quantas startups serao afetadas antes de
 * desligar.
 *
 * O CICLO DE UM STATUS: cada status declara se a startup nele ainda esta no
 * programa (Ativa/Pausada) ou ja saiu (Encerrada). E o que mantem relatorios e
 * agenda corretos com rotulos inventados — "Graduada" com ciclo Encerrada sai
 * das contagens do programa exatamente como a antiga ENCERRADA saia.
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
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
  Switch,
  FormControlLabel,
} from "@mui/material"
import { Add, Close } from "@mui/icons-material"
import api from "../services/api"
import { useStartupConfigStore } from "../store/startupConfigStore"
// O editor de campo e a linha da lista sao compartilhados com a configuracao do
// quadro de tarefas: as duas telas definem campos com a mesma estrutura, e uma
// segunda copia divergiria na primeira correcao.
import ConfigDoTipo, { TIPOS_CAMPO, rotuloDoTipoCampo } from "../components/campos/ConfigDoTipo"
import LinhaConfig, { Bolinha } from "../components/campos/LinhaConfig"

const TIPO_VAZIO = { rotulo: "", cor: "#6366f1" }
const SITUACAO_VAZIA = { rotulo: "", cor: "#10b981", ciclo: "ATIVA" }
const CAMPO_VAZIO = {
  rotulo: "",
  tipo: "TEXTO",
  descricao: "",
  obrigatorio: false,
  config: {},
}

/** O que cada ciclo significa, na lingua de quem administra a incubadora. */
const CICLOS = [
  { valor: "ATIVA", rotulo: "Ativa", ajuda: "Continua no programa e conta nos relatórios." },
  { valor: "PAUSADA", rotulo: "Pausada", ajuda: "Continua no programa, temporariamente parada." },
  { valor: "ENCERRADA", rotulo: "Encerrada", ajuda: "Saiu do programa; sai das contagens." },
]

export default function ConfiguracaoStartups() {
  const { idTenant } = useOutletContext()
  const definirTipos = useStartupConfigStore((s) => s.definirTipos)
  const definirSituacoes = useStartupConfigStore((s) => s.definirSituacoes)
  const definirCampos = useStartupConfigStore((s) => s.definirCampos)

  const [tipos, setTipos] = useState([])
  const [situacoes, setSituacoes] = useState([])
  const [campos, setCampos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo, texto }
  const [salvando, setSalvando] = useState(false)

  // Formularios inline: null = fechado; objeto = editando/criando.
  const [formTipo, setFormTipo] = useState(null)
  const [formSituacao, setFormSituacao] = useState(null)
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
      const [respT, respS, respC] = await Promise.all([
        api.get("/startups-config/tipos", {
          params: { id_tenant: idTenant, incluir_inativos: true },
        }),
        api.get("/startups-config/situacoes", {
          params: { id_tenant: idTenant, incluir_inativas: true },
        }),
        api.get("/startups-config/campos", {
          params: { id_tenant: idTenant, incluir_inativos: true },
        }),
      ])
      setTipos(respT.data.tipos)
      setSituacoes(respS.data.situacoes)
      setCampos(respC.data.campos)
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
   * Recarrega uma das listas e reflete no store, para o cadastro de startup
   * nao ficar com o vocabulario antigo ate o proximo F5.
   */
  const recarregar = async (recurso) => {
    const paramInativos =
      recurso === "situacoes" ? { incluir_inativas: true } : { incluir_inativos: true }
    const { data } = await api.get(`/startups-config/${recurso}`, {
      params: { id_tenant: idTenant, ...paramInativos },
    })
    if (recurso === "tipos") {
      setTipos(data.tipos)
      definirTipos(data.tipos)
    } else if (recurso === "situacoes") {
      setSituacoes(data.situacoes)
      definirSituacoes(data.situacoes)
    } else {
      setCampos(data.campos)
      definirCampos(data.campos)
    }
  }

  // ---------------------------------------------------------------- tipos
  const salvarTipo = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const corpo = { id_tenant: idTenant, rotulo: formTipo.rotulo, cor: formTipo.cor }
      if (formTipo.chave) {
        await api.put(`/startups-config/tipos/${formTipo.chave}`, corpo)
      } else {
        await api.post("/startups-config/tipos", corpo)
      }
      setFormTipo(null)
      await recarregar("tipos")
      setAviso({ tipo: "success", texto: "Tipo salvo." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar o tipo." })
    } finally {
      setSalvando(false)
    }
  }

  // ------------------------------------------------------------ situacoes
  const salvarSituacao = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setAviso(null)
    try {
      const corpo = {
        id_tenant: idTenant,
        rotulo: formSituacao.rotulo,
        cor: formSituacao.cor,
        ciclo: formSituacao.ciclo,
      }
      if (formSituacao.chave) {
        await api.put(`/startups-config/situacoes/${formSituacao.chave}`, corpo)
      } else {
        await api.post("/startups-config/situacoes", corpo)
      }
      setFormSituacao(null)
      await recarregar("situacoes")
      setAviso({ tipo: "success", texto: "Status salvo." })
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar o status." })
    } finally {
      setSalvando(false)
    }
  }

  // --------------------------------------------------------------- campos
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
        await api.put(`/startups-config/campos/${formCampo.id_campo}`, corpo)
      } else {
        await api.post("/startups-config/campos", corpo)
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
   * gravado nas startups, entao editar o rotulo nao pode mais mexer no valor.
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
   * Pergunta antes de desativar, com quantas startups serao afetadas — a
   * decisao muda bastante entre "nunca usei isso" e "30 startups usam".
   */
  const pedirDesativar = async (recurso, alvo, id, rotulo) => {
    if (!alvo.ativo) {
      alternar(recurso, id, true)
      return
    }
    try {
      const { data } = await api.get(`/startups-config/${recurso}/${id}/uso`, {
        params: { id_tenant: idTenant },
      })
      setConfirmacao({ recurso, id, rotulo, startups: data.startups })
    } catch {
      setConfirmacao({ recurso, id, rotulo, startups: null })
    }
  }

  const alternar = async (recurso, id, ativo) => {
    setConfirmacao(null)
    setAviso(null)
    try {
      await api.patch(`/startups-config/${recurso}/${id}/status`, { id_tenant: idTenant, ativo })
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

      {/* ----------------------------------------------------------- TIPOS */}
      <Paper data-tour="startups-config-tipos" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Tipos de startup
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Como você classifica as empresas: incubada, residente, associada, ou o que a sua
              incubadora usar.
            </Typography>
          </Box>
          <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setFormTipo({ ...TIPO_VAZIO })}>
            Novo
          </Button>
        </Box>

        {formTipo && (
          <Box component="form" onSubmit={salvarTipo} sx={{ py: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={7}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={formTipo.rotulo}
                  onChange={(e) => setFormTipo((f) => ({ ...f, rotulo: e.target.value }))}
                  helperText={
                    formTipo.chave
                      ? "Renomear reetiqueta as startups existentes."
                      : "Ex.: Incubada, Graduada, Parceira."
                  }
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  label="Cor"
                  type="color"
                  fullWidth
                  size="small"
                  value={formTipo.cor}
                  onChange={(e) => setFormTipo((f) => ({ ...f, cor: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <Chip
                  size="small"
                  label={formTipo.rotulo || "Prévia"}
                  variant="outlined"
                  sx={{ borderColor: formTipo.cor, color: formTipo.cor }}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" size="small" variant="contained" disabled={salvando}>
                {salvando ? <CircularProgress size={18} color="inherit" /> : "Salvar"}
              </Button>
              <Button size="small" onClick={() => setFormTipo(null)} startIcon={<Close />}>
                Cancelar
              </Button>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          {tipos.length === 0 && !formTipo ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              Nenhum tipo cadastrado. O campo "Tipo" fica indisponível no cadastro até você criar um.
            </Typography>
          ) : (
            tipos.map((t) => (
              <LinhaConfig
                key={t.chave}
                titulo={t.rotulo}
                adorno={<Bolinha cor={t.cor} />}
                ativo={t.ativo}
                onEditar={() => setFormTipo({ ...t })}
                onAlternar={() => pedirDesativar("tipos", t, t.chave, t.rotulo)}
              />
            ))
          )}
        </Box>
      </Paper>

      {/* ------------------------------------------------------------ STATUS */}
      <Paper data-tour="startups-config-situacoes" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Status das startups
            </Typography>
            <Typography variant="body2" color="text.secondary">
              O vocabulário do acompanhamento. Cada status diz também se a startup ainda está no
              programa, é o que mantém os relatórios certos.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setFormSituacao({ ...SITUACAO_VAZIA })}
          >
            Novo
          </Button>
        </Box>

        {formSituacao && (
          <Box component="form" onSubmit={salvarSituacao} sx={{ py: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={formSituacao.rotulo}
                  onChange={(e) => setFormSituacao((f) => ({ ...f, rotulo: e.target.value }))}
                  helperText={
                    formSituacao.chave
                      ? "Renomear reetiqueta as startups existentes."
                      : "Ex.: Em tração, Aceleração, Desligada."
                  }
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  label="No programa"
                  fullWidth
                  size="small"
                  value={formSituacao.ciclo}
                  onChange={(e) => setFormSituacao((f) => ({ ...f, ciclo: e.target.value }))}
                  helperText={CICLOS.find((c) => c.valor === formSituacao.ciclo)?.ajuda}
                >
                  {CICLOS.map((c) => (
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
                  value={formSituacao.cor}
                  onChange={(e) => setFormSituacao((f) => ({ ...f, cor: e.target.value }))}
                />
              </Grid>
              <Grid item xs={6} sm={2}>
                <Chip
                  size="small"
                  label={formSituacao.rotulo || "Prévia"}
                  sx={{ bgcolor: formSituacao.cor, color: "#fff", fontWeight: 600 }}
                />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
              <Button type="submit" size="small" variant="contained" disabled={salvando}>
                {salvando ? <CircularProgress size={18} color="inherit" /> : "Salvar"}
              </Button>
              <Button size="small" onClick={() => setFormSituacao(null)} startIcon={<Close />}>
                Cancelar
              </Button>
            </Box>
            <Divider sx={{ mt: 2 }} />
          </Box>
        )}

        <Box sx={{ mt: 1 }}>
          {situacoes.map((s) => (
            <LinhaConfig
              key={s.chave}
              titulo={s.rotulo}
              subtitulo={CICLOS.find((c) => c.valor === s.ciclo)?.ajuda}
              adorno={<Bolinha cor={s.cor} />}
              ativo={s.ativo}
              onEditar={() => setFormSituacao({ ...s })}
              onAlternar={() => pedirDesativar("situacoes", s, s.chave, s.rotulo)}
            />
          ))}
        </Box>
      </Paper>

      {/* --------------------------------------------- CAMPOS PERSONALIZAVEIS */}
      <Paper data-tour="startups-config-campos" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Campos personalizáveis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              O que mais a sua incubadora precisa saber de cada startup. Os campos criados aqui
              aparecem no cadastro, na ordem desta lista.
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
                  helperText="Ex.: Setor, Faturamento anual, CPF do responsável."
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
                  // nas startups foram normalizados por ele, e trocar
                  // transformaria "12.345,67" em lixo.
                  disabled={Boolean(formCampo.id_campo)}
                  onChange={(e) => setFormCampo((f) => ({ ...f, tipo: e.target.value, config: {} }))}
                  helperText={
                    formCampo.id_campo
                      ? "O tipo não muda depois de criado."
                      : tipoCampoAtual?.ajuda
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
                  helperText="Aparece embaixo do campo no cadastro. Opcional."
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
              Nenhum campo personalizado. O cadastro de startup mostra só os campos padrão.
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

      {/* Desativar avisa quantas startups usam o item. */}
      <Dialog open={Boolean(confirmacao)} onClose={() => setConfirmacao(null)}>
        <DialogTitle>Desativar "{confirmacao?.rotulo}"?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {confirmacao?.startups > 0 ? (
              <>
                <strong>
                  {confirmacao.startups} startup{confirmacao.startups === 1 ? "" : "s"}
                </strong>{" "}
                {confirmacao.startups === 1 ? "usa" : "usam"} isto. Nada será apagado:{" "}
                {confirmacao.startups === 1 ? "ela continua" : "elas continuam"} com o valor que já
                têm, e o item só some do formulário de cadastro. Dá para reativar quando quiser.
              </>
            ) : (
              <>
                Ninguém está usando isto no momento. O item some do formulário de cadastro e pode ser
                reativado quando quiser.
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
