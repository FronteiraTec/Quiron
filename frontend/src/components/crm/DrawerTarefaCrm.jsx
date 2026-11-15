/**
 * Cadastro e edicao de tarefa comercial.
 *
 * O VINCULO (cliente ou oportunidade) so se escolhe ao criar: depois ele fica
 * fixo, porque mover uma tarefa de uma venda para outra reescreveria o
 * historico das duas. Criada de dentro de uma oportunidade ou de um cliente, o
 * vinculo ja vem preenchido.
 *
 * O STATUS nao e um campo do formulario na edicao: iniciar, concluir, cancelar
 * e reabrir sao botoes no rodape, porque cada um e um fato proprio no
 * historico — e o backend tem uma rota para isso.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Autocomplete,
  Button,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import { CancelOutlined, PlayCircleOutline, ReplayOutlined, TaskAltOutlined } from "@mui/icons-material"
import { PainelCadastro, Secao } from "./FormCrm"
import { useCrm } from "./useCrm"
import { StatusTarefaCrm } from "./MarcadoresCrm"
import { AvatarResponsavel } from "../tarefas/MarcadoresTarefa"
import { PRIORIDADES_CRM, TAREFA_ABERTA, deCampoDataHora, paraCampoDataHora } from "../../data/crmMeta"

/** Amanha as 9h no fuso de quem cria: o prazo que a maioria das tarefas de venda tem. */
function amanhaNoveHoras() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return paraCampoDataHora(d.toISOString())
}

export default function DrawerTarefaCrm({
  aberto,
  onFechar,
  tarefa = null,
  // { id_oportunidade?, id_cliente?, rotulo } — criada a partir de uma oportunidade ou cliente.
  vinculoInicial = null,
  onSalvo,
}) {
  const { api, membros, idUsuario, falha, avisar } = useCrm()
  const editando = Boolean(tarefa)

  const [form, setForm] = useState({})
  const [tipoVinculo, setTipoVinculo] = useState("nenhum")
  const [opcoes, setOpcoes] = useState({ clientes: [], oportunidades: [] })
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setErros({})
    setErro(null)
    if (editando) {
      setForm({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        id_responsavel: tarefa.id_responsavel,
        vencimento: paraCampoDataHora(tarefa.vencimento_ts),
        prioridade: tarefa.prioridade,
      })
      return
    }
    setForm({
      titulo: "",
      descricao: "",
      id_responsavel: idUsuario,
      vencimento: amanhaNoveHoras(),
      prioridade: "MEDIA",
      status: "PENDENTE",
      id_cliente: vinculoInicial?.id_cliente ?? null,
      id_oportunidade: vinculoInicial?.id_oportunidade ?? null,
    })
    setTipoVinculo(vinculoInicial?.id_oportunidade ? "oportunidade" : vinculoInicial?.id_cliente ? "cliente" : "nenhum")
    // Os seletores de vinculo so existem na criacao solta (sem vinculo inicial).
    if (!vinculoInicial) {
      Promise.all([api.clientes(), api.oportunidades()])
        .then(([clientes, oportunidades]) =>
          setOpcoes({ clientes, oportunidades: oportunidades.filter((o) => o.situacao === "ABERTA") })
        )
        .catch((err) => setErro(falha(err, "Não foi possível carregar clientes e oportunidades.")))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tarefa])

  const alterar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const opcoesResponsavel = useMemo(() => {
    const lista = [...membros]
    if (tarefa?.id_responsavel && !lista.some((m) => m.id_usuario === tarefa.id_responsavel)) {
      lista.push({ id_usuario: tarefa.id_responsavel, nome: tarefa.responsavel_nome || "Ex-membro" })
    }
    return lista
  }, [membros, tarefa])
  const responsavel = opcoesResponsavel.find((m) => m.id_usuario === form.id_responsavel) || null

  const salvar = async () => {
    if (!form.titulo?.trim()) {
      setErros({ titulo: "Dê um título à tarefa." })
      return
    }
    const corpo = {
      titulo: form.titulo,
      descricao: form.descricao,
      id_responsavel: form.id_responsavel,
      vencimento_ts: deCampoDataHora(form.vencimento),
      prioridade: form.prioridade,
    }
    if (!editando) {
      corpo.status = form.status
      if (tipoVinculo === "oportunidade") corpo.id_oportunidade = form.id_oportunidade
      if (tipoVinculo === "cliente") corpo.id_cliente = form.id_cliente
    }
    setSalvando(true)
    setErro(null)
    try {
      const salva = editando ? await api.atualizarTarefa(tarefa.id_tarefa, corpo) : await api.criarTarefa(corpo)
      avisar("success", editando ? "Tarefa atualizada." : "Tarefa criada.")
      onSalvo?.(salva)
      onFechar()
    } catch (err) {
      setErro(falha(err, "Não foi possível salvar a tarefa."))
    } finally {
      setSalvando(false)
    }
  }

  const mudarStatus = async (status, mensagem) => {
    setSalvando(true)
    setErro(null)
    try {
      const salva = await api.statusTarefa(tarefa.id_tarefa, status)
      avisar("success", mensagem)
      onSalvo?.(salva)
      onFechar()
    } catch (err) {
      setErro(falha(err, "Não foi possível mudar o status da tarefa."))
    } finally {
      setSalvando(false)
    }
  }

  const aberta = editando && TAREFA_ABERTA(tarefa.status)
  const acoesStatus = editando ? (
    aberta ? (
      <>
        {tarefa.status === "PENDENTE" && (
          <Button size="small" startIcon={<PlayCircleOutline />} onClick={() => mudarStatus("EM_ANDAMENTO", "Tarefa iniciada.")} disabled={salvando}>
            Iniciar
          </Button>
        )}
        <Button size="small" color="success" startIcon={<TaskAltOutlined />} onClick={() => mudarStatus("CONCLUIDA", "Tarefa concluída.")} disabled={salvando}>
          Concluir
        </Button>
        <Button size="small" color="inherit" startIcon={<CancelOutlined />} onClick={() => mudarStatus("CANCELADA", "Tarefa cancelada.")} disabled={salvando}>
          Cancelar tarefa
        </Button>
      </>
    ) : (
      <Button size="small" startIcon={<ReplayOutlined />} onClick={() => mudarStatus("PENDENTE", "Tarefa reaberta.")} disabled={salvando}>
        Reabrir
      </Button>
    )
  ) : null

  const rotuloVinculo = editando
    ? tarefa.oportunidade_titulo
      ? `Oportunidade: ${tarefa.oportunidade_titulo}`
      : tarefa.cliente_nome
        ? `Cliente: ${tarefa.cliente_nome}`
        : null
    : vinculoInicial?.rotulo

  return (
    <PainelCadastro
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? "Editar tarefa" : "Nova tarefa"}
      subtitulo={rotuloVinculo || (editando ? null : "Uma atividade comercial com responsável e prazo.")}
      idForm="form-crm-tarefa"
      onEnviar={salvar}
      salvando={salvando}
      rotuloSalvar={editando ? "Salvar alterações" : "Criar tarefa"}
      acoesExtras={acoesStatus}
    >
      {erro && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {editando && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
          Status: <StatusTarefaCrm status={tarefa.status} />
        </Typography>
      )}

      <Secao id="secao-tarefa-crm" titulo="A tarefa" primeira>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Título"
              required
              fullWidth
              size="small"
              autoFocus={!editando}
              placeholder="Ex.: Enviar orçamento"
              value={form.titulo || ""}
              onChange={(e) => alterar("titulo", e.target.value)}
              error={Boolean(erros.titulo)}
              helperText={erros.titulo}
              inputProps={{ maxLength: 150 }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Descrição"
              fullWidth
              multiline
              minRows={2}
              size="small"
              value={form.descricao || ""}
              onChange={(e) => alterar("descricao", e.target.value)}
              inputProps={{ maxLength: 5000 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Vencimento"
              type="datetime-local"
              fullWidth
              size="small"
              value={form.vencimento || ""}
              onChange={(e) => alterar("vencimento", e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Data e horário"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select label="Prioridade" fullWidth size="small" value={form.prioridade || "MEDIA"} onChange={(e) => alterar("prioridade", e.target.value)}>
              {PRIORIDADES_CRM.map((p) => (
                <MenuItem key={p.chave} value={p.chave}>
                  {p.rotulo}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={editando ? 12 : 6}>
            <Autocomplete
              size="small"
              options={opcoesResponsavel}
              value={responsavel}
              onChange={(_, m) => alterar("id_responsavel", m ? m.id_usuario : null)}
              getOptionLabel={(m) => m.nome || ""}
              isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
              renderOption={(props, m) => {
                const { key, ...resto } = props
                return (
                  <li key={key} {...resto}>
                    <AvatarResponsavel nome={m.nome} foto={m.foto_url} comNome />
                  </li>
                )
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Responsável"
                  placeholder="Ninguém"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: responsavel ? (
                      <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                        <AvatarResponsavel nome={responsavel.nome} foto={responsavel.foto_url} tamanho={22} dica={false} />
                      </InputAdornment>
                    ) : null,
                  }}
                />
              )}
            />
          </Grid>
          {!editando && (
            <Grid item xs={12} sm={6}>
              <TextField select label="Status inicial" fullWidth size="small" value={form.status || "PENDENTE"} onChange={(e) => alterar("status", e.target.value)}>
                <MenuItem value="PENDENTE">Pendente</MenuItem>
                <MenuItem value="EM_ANDAMENTO">Em andamento</MenuItem>
              </TextField>
            </Grid>
          )}
        </Grid>
      </Secao>

      {!editando && !vinculoInicial && (
        <Secao id="secao-tarefa-crm-vinculo" titulo="Relacionada a">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={tipoVinculo}
            onChange={(_, v) => v && setTipoVinculo(v)}
            aria-label="A tarefa é relacionada a"
            sx={{ mb: 2, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 1.5, letterSpacing: 0 } }}
          >
            <ToggleButton value="nenhum">Nada</ToggleButton>
            <ToggleButton value="cliente">Um cliente</ToggleButton>
            <ToggleButton value="oportunidade">Uma oportunidade</ToggleButton>
          </ToggleButtonGroup>

          {tipoVinculo === "cliente" && (
            <Autocomplete
              size="small"
              options={opcoes.clientes}
              value={opcoes.clientes.find((c) => c.id_cliente === form.id_cliente) || null}
              onChange={(_, c) => alterar("id_cliente", c ? c.id_cliente : null)}
              getOptionLabel={(c) => c.nome || ""}
              isOptionEqualToValue={(a, b) => a.id_cliente === b.id_cliente}
              noOptionsText="Nenhum cliente encontrado"
              renderInput={(params) => <TextField {...params} label="Cliente" />}
            />
          )}
          {tipoVinculo === "oportunidade" && (
            <Autocomplete
              size="small"
              options={opcoes.oportunidades}
              value={opcoes.oportunidades.find((o) => o.id_oportunidade === form.id_oportunidade) || null}
              onChange={(_, o) => alterar("id_oportunidade", o ? o.id_oportunidade : null)}
              getOptionLabel={(o) => (o.titulo ? `${o.titulo} — ${o.cliente_nome}` : "")}
              isOptionEqualToValue={(a, b) => a.id_oportunidade === b.id_oportunidade}
              noOptionsText="Nenhuma oportunidade aberta"
              renderInput={(params) => <TextField {...params} label="Oportunidade" helperText="Só as abertas. O cliente da tarefa é o da oportunidade." />}
            />
          )}
          {tipoVinculo !== "nenhum" && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              O que acontecer com a tarefa entra no histórico do cliente ou da oportunidade.
            </Typography>
          )}
        </Secao>
      )}
    </PainelCadastro>
  )
}
