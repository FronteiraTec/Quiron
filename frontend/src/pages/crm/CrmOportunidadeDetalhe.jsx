/**
 * Uma oportunidade: tudo o que se sabe da negociacao e tudo o que aconteceu
 * nela.
 *
 * DUAS AREAS. A lateral responde "o que e esta venda" — valores, cliente,
 * responsavel. A principal responde "em que pe esta e o que fazer": o funil
 * (clicavel), a proxima acao recomendada e as abas Historico e Tarefas.
 *
 * O HISTORICO e escrito pelo servidor. Esta tela so le — e oferece o
 * compositor de anotacao/contato/reuniao, cujo texto o servidor transforma em
 * evento. Depois de qualquer acao, a oportunidade e a linha do tempo recarregam.
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
  Business,
  DeleteOutline,
  EditOutlined,
  EmojiEventsOutlined,
  LightbulbOutlined,
  MoreVert,
  Person,
  ReplayOutlined,
  StickyNote2Outlined,
  ThumbDownAltOutlined,
  WhatsApp,
} from "@mui/icons-material"
import { useCrm } from "../../components/crm/useCrm"
import FunilEtapas from "../../components/crm/FunilEtapas"
import LinhaDoTempo from "../../components/crm/LinhaDoTempo"
import RegistrarAtividade from "../../components/crm/RegistrarAtividade"
import ListaTarefasCrm from "../../components/crm/ListaTarefasCrm"
import DrawerOportunidade from "../../components/crm/DrawerOportunidade"
import DrawerTarefaCrm from "../../components/crm/DrawerTarefaCrm"
import DialogEncerrar from "../../components/crm/DialogEncerrar"
import { StatusCliente, VencimentoTarefa } from "../../components/crm/MarcadoresCrm"
import { AvatarResponsavel } from "../../components/tarefas/MarcadoresTarefa"
import { Dado, Painel } from "../../components/crm/PainelDados"
import {
  TAREFA_ABERTA,
  TIPO_PESSOA,
  dataBR,
  diasDesde,
  formatarDocumento,
  formatarTelefone,
  hojeISO,
  linkWhatsapp,
  moeda,
} from "../../data/crmMeta"

export default function CrmOportunidadeDetalhe() {
  const { idOportunidade } = useParams()
  const navigate = useNavigate()
  const { api, etapas, falha, avisar } = useCrm()

  const [op, setOp] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [erro, setErro] = useState(null)
  const [versao, setVersao] = useState(0)
  const [aba, setAba] = useState("historico")

  const [editando, setEditando] = useState(false)
  const [tarefaAberta, setTarefaAberta] = useState(undefined) // undefined fechado, null nova
  const [encerrar, setEncerrar] = useState(null)
  const [ancoraMenu, setAncoraMenu] = useState(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const compositor = useRef(null)

  const carregar = useCallback(async () => {
    try {
      const dados = await api.oportunidade(idOportunidade)
      setOp(dados.oportunidade)
      setTarefas(dados.tarefas)
      setErro(null)
    } catch (err) {
      if (err?.response?.status === 404) setNaoEncontrada(true)
      else setErro(falha(err, "Não foi possível carregar a oportunidade."))
    } finally {
      setCarregando(false)
    }
  }, [api, idOportunidade, falha])

  useEffect(() => {
    setCarregando(true)
    setNaoEncontrada(false)
    carregar()
  }, [carregar])

  /** Depois de qualquer escrita: a oportunidade e a linha do tempo recarregam. */
  const atualizado = useCallback(() => {
    carregar()
    setVersao((v) => v + 1)
  }, [carregar])

  const carregarHistorico = useCallback((antes) => api.historicoOportunidade(idOportunidade, antes), [api, idOportunidade])

  const mover = async (etapa) => {
    setOcupado(true)
    try {
      await api.moverOportunidade(op.id_oportunidade, etapa.id_etapa)
      avisar("success", `Etapa alterada para ${etapa.nome}.`)
      atualizado()
    } catch (err) {
      avisar("error", falha(err, "Não foi possível mudar a etapa."))
    } finally {
      setOcupado(false)
    }
  }

  const reabrir = async () => {
    setOcupado(true)
    try {
      await api.reabrir(op.id_oportunidade)
      avisar("success", "Oportunidade reaberta.")
      atualizado()
    } catch (err) {
      avisar("error", falha(err, "Não foi possível reabrir a oportunidade."))
    } finally {
      setOcupado(false)
    }
  }

  const excluir = async () => {
    setOcupado(true)
    try {
      await api.excluirOportunidade(op.id_oportunidade)
      avisar("success", `“${op.titulo}” excluída.`)
      navigate("/crm/oportunidades")
    } catch (err) {
      avisar("error", falha(err, "Não foi possível excluir a oportunidade."))
      setOcupado(false)
      setConfirmarExclusao(false)
    }
  }

  const alternarTarefa = async (tarefa, status) => {
    try {
      await api.statusTarefa(tarefa.id_tarefa, status)
      avisar("success", status === "CONCLUIDA" ? "Tarefa concluída." : "Tarefa reaberta.")
      atualizado()
    } catch (err) {
      avisar("error", falha(err, "Não foi possível atualizar a tarefa."))
    }
  }

  const registrarAtividade = async (dados) => {
    await api.atividadeOportunidade(op.id_oportunidade, dados)
    avisar("success", "Registrado no histórico.")
    setVersao((v) => v + 1)
  }

  const anotar = () => {
    setAba("historico")
    // O compositor so existe com a aba montada.
    setTimeout(() => compositor.current?.focar("ANOTACAO"), 0)
  }

  if (carregando && !op) {
    return (
      <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
        <CircularProgress aria-label="Carregando a oportunidade" />
      </Box>
    )
  }
  if (naoEncontrada) {
    return (
      <Paper sx={{ borderRadius: 0, p: 5, textAlign: "center" }}>
        <Typography fontWeight={700}>Oportunidade não encontrada</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Ela pode ter sido excluída, ou o endereço está incorreto.
        </Typography>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => navigate("/crm/oportunidades")}>
          Voltar às oportunidades
        </Button>
      </Paper>
    )
  }
  if (!op) {
    return <Alert severity="error">{erro}</Alert>
  }

  const aberta = op.situacao === "ABERTA"
  const abertas = tarefas.filter((t) => TAREFA_ABERTA(t.status))
  const proxima = abertas.find((t) => t.vencimento_ts) || abertas[0] || null
  const previsaoVencida = aberta && op.previsao_fechamento && op.previsao_fechamento < hojeISO()
  const diasNaEtapa = diasDesde(op.etapa_ts)

  return (
    <Box>
      <Link component={RouterLink} to="/crm/oportunidades" underline="hover" variant="body2" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 1.5 }}>
        <ArrowBack sx={{ fontSize: 16 }} aria-hidden />
        Oportunidades
      </Link>

      {/* CABECALHO */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}>
        <Box sx={{ minWidth: 0, flex: "1 1 320px" }}>
          <Typography variant="h5" component="h2" fontWeight={700} sx={{ wordBreak: "break-word" }}>
            {op.titulo}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1.5, rowGap: 0.5, mt: 0.5 }}>
            <Link component={RouterLink} to={`/crm/clientes/${op.id_cliente}`} underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
              {op.cliente_tipo_pessoa === "PJ" ? <Business sx={{ fontSize: 16 }} aria-hidden /> : <Person sx={{ fontSize: 16 }} aria-hidden />}
              {op.cliente_nome}
            </Link>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
              {op.situacao === "GANHA" ? moeda(op.valor_vendido) : moeda(op.valor_estimado)}
            </Typography>
            <AvatarResponsavel nome={op.responsavel_nome} foto={op.responsavel_foto} comNome tamanho={22} />
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Button variant="outlined" size="small" startIcon={<StickyNote2Outlined />} onClick={anotar}>
            Adicionar anotação
          </Button>
          <Button variant="outlined" size="small" startIcon={<AddTaskOutlined />} onClick={() => setTarefaAberta(null)}>
            Criar tarefa
          </Button>
          {aberta ? (
            <>
              <Button variant="outlined" size="small" color="success" startIcon={<EmojiEventsOutlined />} onClick={() => setEncerrar("ganhar")}>
                Marcar como ganha
              </Button>
              <Button variant="outlined" size="small" color="error" startIcon={<ThumbDownAltOutlined />} onClick={() => setEncerrar("perder")}>
                Marcar como perdida
              </Button>
            </>
          ) : (
            <Button variant="outlined" size="small" startIcon={<ReplayOutlined />} onClick={reabrir} disabled={ocupado}>
              Reabrir
            </Button>
          )}
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
              onClick={() => {
                setAncoraMenu(null)
                setConfirmarExclusao(true)
              }}
              sx={{ color: "error.main" }}
            >
              <DeleteOutline fontSize="small" sx={{ mr: 1 }} />
              Excluir oportunidade
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {op.situacao === "GANHA" && (
        <Alert severity="success" icon={<EmojiEventsOutlined />} sx={{ mb: 2 }}>
          Ganha em {dataBR(op.fechamento_dt)} por {moeda(op.valor_vendido)}
          {op.valor_estimado !== null && Number(op.valor_estimado) !== Number(op.valor_vendido) ? ` (estimado ${moeda(op.valor_estimado)})` : ""}
          {op.encerrado_por_nome ? ` · registrada por ${op.encerrado_por_nome}` : ""}.
        </Alert>
      )}
      {op.situacao === "PERDIDA" && (
        <Alert severity="error" icon={<ThumbDownAltOutlined />} sx={{ mb: 2 }}>
          Perdida em {dataBR(op.fechamento_dt)} na etapa “{op.etapa_nome}”. Motivo: {op.motivo_perda}
        </Alert>
      )}

      <Paper sx={{ borderRadius: 0, p: 1.5, mb: 2 }}>
        <FunilEtapas etapas={etapas} idEtapaAtual={op.id_etapa} situacao={op.situacao} onMover={mover} desabilitado={ocupado} />
        {aberta && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            {diasNaEtapa === 0 ? "Entrou hoje" : `Há ${diasNaEtapa} dia${diasNaEtapa > 1 ? "s" : ""}`} em “{op.etapa_nome}”. Clique numa etapa para mover a oportunidade.
          </Typography>
        )}
      </Paper>

      <Grid container spacing={2}>
        {/* PAINEL LATERAL */}
        <Grid item xs={12} md={4}>
          <Painel titulo="Dados comerciais">
            <Dado rotulo="Valor estimado">{moeda(op.valor_estimado)}</Dado>
            {op.situacao === "GANHA" && <Dado rotulo="Valor vendido">{moeda(op.valor_vendido)}</Dado>}
            <Dado rotulo="Probabilidade de conversão">{op.probabilidade === null ? "—" : `${op.probabilidade}%`}</Dado>
            <Dado rotulo="Previsão de fechamento">
              {dataBR(op.previsao_fechamento) || "—"}
              {previsaoVencida && (
                <Typography component="span" variant="caption" color="error.main" fontWeight={700} sx={{ ml: 1 }}>
                  vencida
                </Typography>
              )}
            </Dado>
            <Dado rotulo="Origem">{op.origem || "—"}</Dado>
            <Dado rotulo="Criada">
              {new Date(op.criado_ts).toLocaleDateString("pt-BR")}
              {op.criado_por_nome ? ` por ${op.criado_por_nome}` : ""}
            </Dado>
          </Painel>

          <Painel titulo="Responsável">
            <AvatarResponsavel nome={op.responsavel_nome} foto={op.responsavel_foto} comNome tamanho={32} />
          </Painel>

          <Painel
            titulo="Cliente"
            acao={
              <Link component={RouterLink} to={`/crm/clientes/${op.id_cliente}`} variant="caption" underline="hover" sx={{ fontWeight: 600 }}>
                Ver cliente
              </Link>
            }
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Typography fontWeight={700}>{op.cliente_nome}</Typography>
              <StatusCliente status={op.cliente_status} />
            </Box>
            <Dado rotulo="Tipo">{TIPO_PESSOA[op.cliente_tipo_pessoa]?.rotulo}</Dado>
            {op.cliente_documento && <Dado rotulo={op.cliente_tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}>{formatarDocumento(op.cliente_documento)}</Dado>}
            {op.cliente_tipo_pessoa === "PF" && (op.cliente_empresa || op.cliente_cargo) && (
              <Dado rotulo="Empresa">{[op.cliente_empresa, op.cliente_cargo].filter(Boolean).join(" · ")}</Dado>
            )}
            {op.cliente_email && (
              <Dado rotulo="E-mail">
                <Link href={`mailto:${op.cliente_email}`} underline="hover">
                  {op.cliente_email}
                </Link>
              </Dado>
            )}
            {op.cliente_telefone && (
              <Dado rotulo="Telefone">
                <Link href={`tel:${op.cliente_telefone}`} underline="hover">
                  {formatarTelefone(op.cliente_telefone)}
                </Link>
              </Dado>
            )}
            {op.cliente_whatsapp && (
              <Dado rotulo="WhatsApp">
                <Link href={linkWhatsapp(op.cliente_whatsapp)} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <WhatsApp sx={{ fontSize: 16 }} aria-hidden />
                  {formatarTelefone(op.cliente_whatsapp)}
                </Link>
              </Dado>
            )}
          </Painel>

          {(op.descricao || op.observacoes) && (
            <Painel titulo="Sobre a negociação">
              {op.descricao && (
                <Dado rotulo="Descrição">
                  <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
                    {op.descricao}
                  </Box>
                </Dado>
              )}
              {op.observacoes && (
                <Dado rotulo="Observações">
                  <Box component="span" sx={{ whiteSpace: "pre-wrap" }}>
                    {op.observacoes}
                  </Box>
                </Dado>
              )}
            </Painel>
          )}
        </Grid>

        {/* AREA PRINCIPAL */}
        <Grid item xs={12} md={8}>
          {aberta && (
            <ProximaAcao
              proxima={proxima}
              previsaoVencida={previsaoVencida}
              onCriarTarefa={() => setTarefaAberta(null)}
              onAbrirTarefa={(t) => setTarefaAberta(t)}
              onConcluir={(t) => alternarTarefa(t, "CONCLUIDA")}
            />
          )}

          <Paper sx={{ borderRadius: 0 }}>
            <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={{ borderBottom: 1, borderColor: "divider", px: 1 }} aria-label="Informações da oportunidade">
              <Tab value="historico" label="Histórico" sx={{ textTransform: "none" }} />
              <Tab value="tarefas" label={`Tarefas (${abertas.length} em aberto)`} sx={{ textTransform: "none" }} />
            </Tabs>
            <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
              {aba === "historico" ? (
                <>
                  <RegistrarAtividade ref={compositor} onRegistrar={registrarAtividade} />
                  <LinhaDoTempo
                    carregar={carregarHistorico}
                    versao={versao}
                    vazio="O histórico começa quando a oportunidade é criada."
                    mensagemErro={(err) => falha(err, "Não foi possível carregar o histórico.")}
                  />
                </>
              ) : (
                <>
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                    <Button size="small" startIcon={<AddTaskOutlined />} onClick={() => setTarefaAberta(null)}>
                      Nova tarefa
                    </Button>
                  </Box>
                  <ListaTarefasCrm
                    tarefas={tarefas}
                    onAbrir={(t) => setTarefaAberta(t)}
                    onAlternarConclusao={alternarTarefa}
                    vazio="Nenhuma tarefa nesta oportunidade. Agende o próximo passo da negociação."
                  />
                </>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <DrawerOportunidade aberto={editando} onFechar={() => setEditando(false)} oportunidade={op} onSalvo={atualizado} />
      <DrawerTarefaCrm
        aberto={tarefaAberta !== undefined}
        onFechar={() => setTarefaAberta(undefined)}
        tarefa={tarefaAberta || null}
        vinculoInicial={{ id_oportunidade: op.id_oportunidade, rotulo: `Oportunidade: ${op.titulo}` }}
        onSalvo={atualizado}
      />
      <DialogEncerrar modo={encerrar} oportunidade={encerrar ? { ...op, tarefas_abertas: abertas.length } : null} onFechar={() => setEncerrar(null)} onEncerrada={atualizado} />

      <Dialog open={confirmarExclusao} onClose={() => !ocupado && setConfirmarExclusao(false)}>
        <DialogTitle>Excluir “{op.titulo}”?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A oportunidade sai do funil e das listas, e as tarefas abertas dela são canceladas. O histórico continua guardado.
            Se a negociação apenas não deu certo, prefira marcá-la como perdida — assim ela conta nos indicadores.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarExclusao(false)} disabled={ocupado} color="inherit">
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={excluir} disabled={ocupado}>
            {ocupado ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

/** O que fazer agora: a proxima tarefa, ou a recomendacao de agendar uma. */
function ProximaAcao({ proxima, previsaoVencida, onCriarTarefa, onAbrirTarefa, onConcluir }) {
  return (
    <Paper
      sx={{
        borderRadius: 0,
        p: 2,
        mb: 2,
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        gap: 1.5,
        borderLeft: 3,
        borderColor: proxima ? "primary.main" : "warning.main",
      }}
    >
      <LightbulbOutlined sx={{ color: proxima ? "primary.main" : "warning.main" }} aria-hidden />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>
          Próxima ação
        </Typography>
        {proxima ? (
          <>
            <Typography fontWeight={700} noWrap>
              {proxima.titulo}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <VencimentoTarefa tarefa={proxima} mostrarVazio />
              {proxima.responsavel_nome && (
                <Typography variant="caption" color="text.secondary">
                  {proxima.responsavel_nome}
                </Typography>
              )}
            </Box>
          </>
        ) : (
          <Typography variant="body2">
            Esta negociação está sem próximo passo. Agende uma tarefa para ela não esfriar.
          </Typography>
        )}
        {previsaoVencida && (
          <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 0.5 }}>
            A previsão de fechamento já passou: atualize a data ou encerre a negociação.
          </Typography>
        )}
      </Box>
      {proxima ? (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={() => onAbrirTarefa(proxima)}>
            Abrir
          </Button>
          <Button size="small" variant="contained" onClick={() => onConcluir(proxima)}>
            Concluir
          </Button>
        </Box>
      ) : (
        <Button size="small" variant="contained" startIcon={<AddTaskOutlined />} onClick={onCriarTarefa}>
          Criar tarefa
        </Button>
      )}
    </Paper>
  )
}
