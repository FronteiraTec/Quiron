/**
 * O cadastro de uma tarefa: um painel lateral direito, do mesmo desenho do
 * DrawerCadastroStartup.
 *
 * PAINEL E NAO DIALOGO pelo mesmo motivo de la: com descricao longa, prazo,
 * responsavel, startup e os campos que cada incubadora inventa, um dialogo
 * centralizado cobriria o quadro e rolaria dentro de uma caixa flutuante. Aqui
 * a lista continua visivel a esquerda — da para conferir se a tarefa ja existe
 * enquanto se digita — e o rodape com "Salvar" fica fixo.
 *
 * SERVE PARA CRIAR E PARA EDITAR. A diferenca esta so no rodape: editando, ha
 * tambem o "Excluir".
 *
 * OS CAMPOS PERSONALIZAVEIS vivem num estado separado do resto do formulario
 * (`extras`), porque a chave deles e definida pela incubadora e poderia colidir
 * com "titulo" ou "prazo". Os ANEXOS tambem vivem a parte, e por outro motivo:
 * eles ja subiram para o servidor quando chegam aqui, e o que o formulario
 * carrega e so a lista de ids. Ver AnexosTarefa.
 *
 * Endpoints (via useTarefas):
 *   POST   /tarefas
 *   PUT    /tarefas/:id
 *   DELETE /tarefas/:id
 */
import { useEffect, useState } from "react"
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
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material"
import { Close, DeleteOutline, TaskAlt } from "@mui/icons-material"
import CampoPersonalizado, {
  valorParaEnvio,
  valorParaFormulario,
} from "../campos/CampoPersonalizado"
import AnexosTarefa from "./AnexosTarefa"
import { useTarefaConfigStore } from "../../store/tarefaConfigStore"
import { PRIORIDADES } from "../../data/tarefaMeta"

const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  status: "",
  prioridade: "MEDIA",
  id_responsavel: "",
  id_startup: "",
  prazo: "",
}

/** Cabecalho de secao — separa os blocos sem transformar o painel em abas. */
function Secao({ titulo, descricao, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" fontWeight={700} color="text.primary">
        {titulo}
      </Typography>
      {descricao && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
          {descricao}
        </Typography>
      )}
      <Box sx={{ mt: descricao ? 0 : 1.5 }}>{children}</Box>
    </Box>
  )
}

export default function DrawerTarefa({
  aberto,
  onFechar,
  idTenant,
  tarefa = null,
  // Coluna sugerida ao criar. Vem do "+" do cabecalho de uma coluna do kanban:
  // quem clica ali ja disse onde quer a tarefa.
  statusInicial = null,
  pessoas = [],
  startups = [],
  podeExcluir = false,
  onSalvar,
  onExcluir,
}) {
  const editando = Boolean(tarefa)

  const statusDisponiveis = useTarefaConfigStore((s) => s.status) || []
  const campos = useTarefaConfigStore((s) => s.campos) || []

  const [form, setForm] = useState(FORM_VAZIO)
  const [extras, setExtras] = useState({})
  const [anexos, setAnexos] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [aviso, setAviso] = useState(null)

  /**
   * Preenche o formulario ao abrir.
   *
   * Reprocessa a cada abertura (e nao so na montagem) porque o painel fica
   * montado entre uma edicao e outra: sem isto, abrir a segunda tarefa
   * mostraria os dados da primeira.
   */
  useEffect(() => {
    if (!aberto) return
    setAviso(null)
    setConfirmarExclusao(false)

    if (editando) {
      setForm({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        status: tarefa.status || "",
        prioridade: tarefa.prioridade || "MEDIA",
        id_responsavel: tarefa.id_responsavel ?? "",
        id_startup: tarefa.id_startup ?? "",
        // A API devolve DATE como "2026-08-19" ou ISO completo; o
        // <input type="date"> so aceita os dez primeiros caracteres.
        prazo: tarefa.prazo ? String(tarefa.prazo).slice(0, 10) : "",
      })
      const guardados = tarefa.campos_extras || {}
      setExtras(
        Object.fromEntries(
          campos.map((campo) => [campo.chave, valorParaFormulario(campo, guardados[campo.chave])])
        )
      )
      setAnexos(tarefa.anexos || [])
      return
    }

    setForm({
      ...FORM_VAZIO,
      status: statusInicial || statusDisponiveis[0]?.chave || "",
    })
    setExtras(Object.fromEntries(campos.map((campo) => [campo.chave, ""])))
    setAnexos([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tarefa, statusInicial])

  const alterar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.titulo.trim()) {
      setAviso({ tipo: "error", texto: "A tarefa precisa de um título." })
      return
    }

    setSalvando(true)
    setAviso(null)
    try {
      await onSalvar({
        ...form,
        // "" nao e um id: o backend recusaria, e null e o que diz "ninguem".
        id_responsavel: form.id_responsavel || null,
        id_startup: form.id_startup || null,
        prazo: form.prazo || null,
        campos_extras: Object.fromEntries(
          campos.map((campo) => [campo.chave, valorParaEnvio(campo, extras[campo.chave])])
        ),
        // So os ids: os arquivos ja subiram (ver AnexosTarefa).
        anexos: anexos.map((a) => a.id_arquivo),
      })
      onFechar()
    } catch (err) {
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao salvar a tarefa." })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    setExcluindo(true)
    try {
      await onExcluir(tarefa.id_tarefa)
      setConfirmarExclusao(false)
      onFechar()
    } catch (err) {
      setConfirmarExclusao(false)
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao excluir a tarefa." })
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <>
      <Drawer
        anchor="right"
        open={aberto}
        onClose={onFechar}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 520 }, display: "flex", flexDirection: "column" },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <TaskAlt sx={{ color: "primary.main" }} />
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            {editando ? "Editar tarefa" : "Nova tarefa"}
          </Typography>
          <IconButton size="small" onClick={onFechar} aria-label="Fechar">
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Box component="form" id="form-tarefa" onSubmit={salvar} sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}

          <Secao titulo="O que precisa ser feito">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Título"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={form.titulo}
                  onChange={(e) => alterar("titulo", e.target.value)}
                  placeholder="Ex.: Revisar o contrato de incubação da Acme"
                  inputProps={{ maxLength: 160 }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Descrição"
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  value={form.descricao}
                  onChange={(e) => alterar("descricao", e.target.value)}
                  placeholder="Contexto, links, o que conta como pronto..."
                />
              </Grid>
            </Grid>
          </Secao>

          <Divider sx={{ mb: 3 }} />

          <Secao titulo="Andamento" descricao="Onde ela está no quadro e o quanto corre.">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Coluna"
                  fullWidth
                  size="small"
                  value={form.status}
                  onChange={(e) => alterar("status", e.target.value)}
                >
                  {statusDisponiveis.map((s) => (
                    <MenuItem key={s.chave} value={s.chave}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box
                          sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.cor }}
                        />
                        {s.rotulo}
                      </Box>
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Prioridade"
                  fullWidth
                  size="small"
                  value={form.prioridade}
                  onChange={(e) => alterar("prioridade", e.target.value)}
                >
                  {PRIORIDADES.map((p) => (
                    <MenuItem key={p.chave} value={p.chave}>
                      <Chip
                        size="small"
                        label={p.rotulo}
                        variant="outlined"
                        sx={{ borderColor: p.cor, color: p.cor }}
                      />
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Prazo"
                  type="date"
                  fullWidth
                  size="small"
                  value={form.prazo}
                  onChange={(e) => alterar("prazo", e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="Opcional. Sem prazo, a tarefa nunca aparece como atrasada."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Responsável"
                  fullWidth
                  size="small"
                  value={form.id_responsavel}
                  onChange={(e) => alterar("id_responsavel", e.target.value)}
                  helperText="Sem responsável, ela fica no quadro esperando quem a puxe."
                >
                  <MenuItem value="">
                    <em>Ninguém ainda</em>
                  </MenuItem>
                  {pessoas.map((p) => (
                    <MenuItem key={p.id_usuario} value={p.id_usuario}>
                      {p.nome}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Secao>

          {/* A startup so aparece se houver alguma: sem startups cadastradas o
              seletor seria um campo vazio pedindo uma escolha impossivel. */}
          {startups.length > 0 && (
            <>
              <Divider sx={{ mb: 3 }} />
              <Secao
                titulo="Sobre qual startup"
                descricao="Opcional. Nem toda tarefa da incubadora fala de uma startup."
              >
                <TextField
                  select
                  label="Startup"
                  fullWidth
                  size="small"
                  value={form.id_startup}
                  onChange={(e) => alterar("id_startup", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Nenhuma</em>
                  </MenuItem>
                  {startups.map((s) => (
                    <MenuItem key={s.id_startup} value={s.id_startup}>
                      {s.nome}
                    </MenuItem>
                  ))}
                </TextField>
              </Secao>
            </>
          )}

          <Divider sx={{ mb: 3 }} />

          <Secao
            titulo="Anexos"
            descricao="O documento de que a tarefa fala — contrato, planilha, edital."
          >
            <AnexosTarefa
              idTenant={idTenant}
              idTarefa={tarefa?.id_tarefa}
              anexos={anexos}
              onChange={setAnexos}
            />
          </Secao>

          {/* Os campos que a propria incubadora criou. A secao inteira some
              quando nao ha nenhum — um titulo sobre o vazio so ocuparia
              espaco. */}
          {campos.length > 0 && (
            <>
              <Divider sx={{ mb: 3 }} />
              <Secao
                titulo="Informações complementares"
                descricao="Campos definidos pela sua incubadora."
              >
                <Grid container spacing={2}>
                  {campos.map((campo) => (
                    <Grid
                      item
                      xs={12}
                      sm={campo.tipo === "TEXTO" && campo.config?.multilinha ? 12 : 6}
                      key={campo.chave}
                    >
                      <CampoPersonalizado
                        campo={campo}
                        valor={extras[campo.chave]}
                        onChange={(valor) => setExtras((e) => ({ ...e, [campo.chave]: valor }))}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Secao>
            </>
          )}
        </Box>

        {/* ACOES — fixas no rodape, para "Salvar" nao exigir rolar ate o fim. */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
            borderTop: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          {editando && podeExcluir && (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={() => setConfirmarExclusao(true)}
              disabled={salvando || excluindo}
            >
              Excluir
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-tarefa" variant="contained" disabled={salvando}>
            {salvando ? <CircularProgress size={20} color="inherit" /> : "Salvar"}
          </Button>
        </Box>
      </Drawer>

      {/* Excluir tarefa e DEFINITIVO, ao contrario de desativar uma coluna:
          a confirmacao diz isso em vez de perguntar "tem certeza?". */}
      <Dialog open={confirmarExclusao} onClose={() => setConfirmarExclusao(false)}>
        <DialogTitle>Excluir "{tarefa?.titulo}"?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A tarefa sai do quadro e não há como recuperá-la. O registro de quem a criou e de quem a
            excluiu fica na auditoria.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarExclusao(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={excluir} disabled={excluindo}>
            {excluindo ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
