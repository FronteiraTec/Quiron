/**
 * Um cliente: o cadastro na lateral e, na area principal, o relacionamento
 * comercial — o historico de interacoes (os eventos dele e os das
 * oportunidades dele, com anotacoes, contatos e reunioes), as oportunidades e
 * as tarefas.
 *
 * Daqui se cria oportunidade e tarefa ja ligadas ao cliente.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  AddTaskOutlined,
  ArrowBack,
  DeleteOutline,
  EditOutlined,
  Handshake,
  MoreVert,
  StickyNote2Outlined,
  WhatsApp,
} from "@mui/icons-material"
import { useCrm } from "../../components/crm/useCrm"
import LinhaDoTempo from "../../components/crm/LinhaDoTempo"
import RegistrarAtividade from "../../components/crm/RegistrarAtividade"
import ListaTarefasCrm from "../../components/crm/ListaTarefasCrm"
import DrawerCliente from "../../components/crm/DrawerCliente"
import DrawerOportunidade from "../../components/crm/DrawerOportunidade"
import DrawerTarefaCrm from "../../components/crm/DrawerTarefaCrm"
import { SituacaoOportunidade, StatusCliente } from "../../components/crm/MarcadoresCrm"
import { Dado, Painel } from "../../components/crm/PainelDados"
import { TAREFA_ABERTA, TIPO_PESSOA, dataBR, formatarDocumento, formatarTelefone, linkWhatsapp, moeda } from "../../data/crmMeta"

export default function CrmClienteDetalhe() {
  const { idCliente } = useParams()
  const navigate = useNavigate()
  const { api, falha, avisar } = useCrm()

  const [dados, setDados] = useState(null)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [erro, setErro] = useState(null)
  const [versao, setVersao] = useState(0)
  const [aba, setAba] = useState("historico")
  const [editando, setEditando] = useState(false)
  const [novaOportunidade, setNovaOportunidade] = useState(false)
  const [tarefaAberta, setTarefaAberta] = useState(undefined)
  const [ancoraMenu, setAncoraMenu] = useState(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const compositor = useRef(null)

  const carregar = useCallback(async () => {
    try {
      setDados(await api.cliente(idCliente))
      setErro(null)
    } catch (err) {
      if (err?.response?.status === 404) setNaoEncontrado(true)
      else setErro(falha(err, "Não foi possível carregar o cliente."))
    }
  }, [api, idCliente, falha])

  useEffect(() => {
    setDados(null)
    setNaoEncontrado(false)
    carregar()
  }, [carregar])

  const atualizado = useCallback(() => {
    carregar()
    setVersao((v) => v + 1)
  }, [carregar])

  const carregarHistorico = useCallback((antes) => api.historicoCliente(idCliente, antes), [api, idCliente])

  const alternarTarefa = async (tarefa, status) => {
    try {
      await api.statusTarefa(tarefa.id_tarefa, status)
      avisar("success", status === "CONCLUIDA" ? "Tarefa concluída." : "Tarefa reaberta.")
      atualizado()
    } catch (err) {
      avisar("error", falha(err, "Não foi possível atualizar a tarefa."))
    }
  }

  const excluir = async () => {
    setExcluindo(true)
    try {
      await api.excluirCliente(idCliente)
      avisar("success", "Cliente excluído.")
      navigate("/crm/clientes")
    } catch (err) {
      avisar("error", falha(err, "Não foi possível excluir o cliente."))
      setExcluindo(false)
      setConfirmarExclusao(false)
    }
  }

  if (naoEncontrado) {
    return (
      <Paper sx={{ borderRadius: 0, p: 5, textAlign: "center" }}>
        <Typography fontWeight={700}>Cliente não encontrado</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Ele pode ter sido excluído, ou o endereço está incorreto.
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate("/crm/clientes")}>
          Voltar aos clientes
        </Button>
      </Paper>
    )
  }
  if (!dados) {
    return erro ? (
      <Alert severity="error">{erro}</Alert>
    ) : (
      <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
        <CircularProgress aria-label="Carregando o cliente" />
      </Box>
    )
  }

  const { cliente: c, oportunidades, tarefas } = dados
  const abertas = tarefas.filter((t) => TAREFA_ABERTA(t.status))

  return (
    <Box>
      <Link component={RouterLink} to="/crm/clientes" underline="hover" variant="body2" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
        <ArrowBack sx={{ fontSize: 16 }} aria-hidden />
        Clientes
      </Link>

      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Box sx={{ minWidth: 0, flex: "1 1 280px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
            <Typography variant="h5" component="h2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
              {c.nome}
            </Typography>
            <StatusCliente status={c.status} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {TIPO_PESSOA[c.tipo_pessoa]?.rotulo}
            {c.tipo_pessoa === "PF" && (c.cargo || c.empresa) ? ` · ${[c.cargo, c.empresa].filter(Boolean).join(" na ")}` : ""}
            {c.valor_ganho ? ` · ${moeda(c.valor_ganho)} em vendas` : ""}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<StickyNote2Outlined />}
            onClick={() => {
              setAba("historico")
              setTimeout(() => compositor.current?.focar("ANOTACAO"), 0)
            }}
          >
            Adicionar anotação
          </Button>
          <Button variant="outlined" size="small" startIcon={<AddTaskOutlined />} onClick={() => setTarefaAberta(null)}>
            Criar tarefa
          </Button>
          <Button variant="outlined" size="small" startIcon={<Handshake />} onClick={() => setNovaOportunidade(true)}>
            Nova oportunidade
          </Button>
          <Button variant="contained" size="small" startIcon={<EditOutlined />} onClick={() => setEditando(true)}>
            Editar
          </Button>
          <Tooltip title="Mais ações">
            <IconButton size="small" aria-label="Mais ações" aria-haspopup="menu" onClick={(e) => setAncoraMenu(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={ancoraMenu} open={Boolean(ancoraMenu)} onClose={() => setAncoraMenu(null)} MenuListProps={{ dense: true }}>
            <MenuItem
              sx={{ color: "error.main" }}
              onClick={() => {
                setAncoraMenu(null)
                setConfirmarExclusao(true)
              }}
            >
              <DeleteOutline fontSize="small" sx={{ mr: 1 }} />
              Excluir cliente
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Painel titulo="Dados cadastrais">
            {c.documento && <Dado rotulo={c.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}>{formatarDocumento(c.documento)}</Dado>}
            <Dado rotulo="E-mail">
              {c.email ? (
                <Link href={`mailto:${c.email}`} underline="hover">
                  {c.email}
                </Link>
              ) : (
                "—"
              )}
            </Dado>
            <Dado rotulo="Telefone">
              {c.telefone ? (
                <Link href={`tel:${c.telefone}`} underline="hover">
                  {formatarTelefone(c.telefone)}
                </Link>
              ) : (
                "—"
              )}
            </Dado>
            <Dado rotulo="WhatsApp">
              {c.whatsapp ? (
                <Link href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <WhatsApp sx={{ fontSize: 16 }} aria-hidden />
                  {formatarTelefone(c.whatsapp)}
                </Link>
              ) : (
                "—"
              )}
            </Dado>
            {c.tipo_pessoa === "PF" && (
              <>
                <Dado rotulo="Empresa">{c.empresa || "—"}</Dado>
                <Dado rotulo="Cargo">{c.cargo || "—"}</Dado>
              </>
            )}
          </Painel>
          <Painel titulo="Informações comerciais">
            <Dado rotulo="Origem">{c.origem || "—"}</Dado>
            <Dado rotulo="Em negociação">
              {c.oportunidades_abertas ? `${c.oportunidades_abertas} · ${moeda(c.valor_em_aberto)}` : "Nenhuma oportunidade aberta"}
            </Dado>
            <Dado rotulo="Cadastrado">
              {new Date(c.criado_ts).toLocaleDateString("pt-BR")}
              {c.criado_por_nome ? ` por ${c.criado_por_nome}` : ""}
            </Dado>
            {c.observacoes && (
              <Dado rotulo="Observações">
                <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
                  {c.observacoes}
                </Box>
              </Dado>
            )}
          </Painel>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ borderRadius: 0 }}>
            <Tabs value={aba} onChange={(_, v) => setAba(v)} variant="scrollable" sx={{ borderBottom: 1, borderColor: "divider", px: 1 }} aria-label="Relacionamento com o cliente">
              <Tab value="historico" label="Histórico de interações" sx={{ textTransform: "none" }} />
              <Tab value="oportunidades" label={`Oportunidades (${oportunidades.length})`} sx={{ textTransform: "none" }} />
              <Tab value="tarefas" label={`Tarefas (${abertas.length} em aberto)`} sx={{ textTransform: "none" }} />
            </Tabs>
            <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
              {aba === "historico" && (
                <>
                  <RegistrarAtividade
                    ref={compositor}
                    onRegistrar={async (corpo) => {
                      await api.atividadeCliente(idCliente, corpo)
                      avisar("success", "Registrado no histórico.")
                      setVersao((v) => v + 1)
                    }}
                  />
                  <LinhaDoTempo
                    carregar={carregarHistorico}
                    versao={versao}
                    mostrarOportunidade
                    vazio="O histórico começa no cadastro do cliente."
                    mensagemErro={(err) => falha(err, "Não foi possível carregar o histórico.")}
                  />
                </>
              )}

              {aba === "oportunidades" &&
                (oportunidades.length === 0 ? (
                  <Box sx={{ py: 3, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Este cliente ainda não tem oportunidades.
                    </Typography>
                    <Button size="small" variant="contained" startIcon={<Handshake />} onClick={() => setNovaOportunidade(true)}>
                      Nova oportunidade
                    </Button>
                  </Box>
                ) : (
                  <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                    {oportunidades.map((o) => (
                      <Box
                        component="li"
                        key={o.id_oportunidade}
                        sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Link component={RouterLink} to={`/crm/oportunidades/${o.id_oportunidade}`} underline="hover" fontWeight={600} sx={{ display: "block" }} noWrap>
                            {o.titulo}
                          </Link>
                          <Typography variant="caption" color="text.secondary">
                            {o.situacao === "ABERTA"
                              ? o.previsao_fechamento
                                ? `Previsão ${dataBR(o.previsao_fechamento)}`
                                : "Sem previsão de fechamento"
                              : `Encerrada em ${dataBR(o.fechamento_dt)}`}
                          </Typography>
                        </Box>
                        <SituacaoOportunidade situacao={o.situacao} etapa={o.etapa_nome} cor={o.etapa_cor} />
                        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 110, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {moeda(o.situacao === "GANHA" ? o.valor_vendido : o.valor_estimado)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ))}

              {aba === "tarefas" && (
                <>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                    <Button size="small" startIcon={<AddTaskOutlined />} onClick={() => setTarefaAberta(null)}>
                      Nova tarefa
                    </Button>
                  </Box>
                  <ListaTarefasCrm
                    tarefas={tarefas}
                    mostrarVinculo
                    onAbrir={(t) => setTarefaAberta(t)}
                    onAlternarConclusao={alternarTarefa}
                    vazio="Nenhuma tarefa para este cliente."
                  />
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <DrawerCliente aberto={editando} onFechar={() => setEditando(false)} cliente={c} onSalvo={atualizado} />
      <DrawerOportunidade
        aberto={novaOportunidade}
        onFechar={() => setNovaOportunidade(false)}
        idClienteInicial={c.id_cliente}
        onSalvo={(op) => navigate(`/crm/oportunidades/${op.id_oportunidade}`)}
      />
      <DrawerTarefaCrm
        aberto={tarefaAberta !== undefined}
        onFechar={() => setTarefaAberta(undefined)}
        tarefa={tarefaAberta || null}
        vinculoInicial={{ id_cliente: c.id_cliente, rotulo: `Cliente: ${c.nome}` }}
        onSalvo={atualizado}
      />

      <Dialog open={confirmarExclusao} onClose={() => !excluindo && setConfirmarExclusao(false)}>
        <DialogTitle>Excluir “{c.nome}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {oportunidades.length > 0
              ? `Este cliente tem ${oportunidades.length} oportunidade${oportunidades.length > 1 ? "s" : ""}. Exclua-as ou associe-as a outro cliente antes — uma venda não pode ficar sem comprador.`
              : "O cliente sai da carteira e as tarefas abertas dele são canceladas. O histórico continua guardado. Se ele só deixou de comprar, prefira marcá-lo como Inativo."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarExclusao(false)} disabled={excluindo} color="inherit">
            {oportunidades.length > 0 ? "Entendi" : "Cancelar"}
          </Button>
          {oportunidades.length === 0 && (
            <Button color="error" variant="contained" onClick={excluir} disabled={excluindo}>
              {excluindo ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
