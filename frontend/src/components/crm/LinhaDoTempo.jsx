/**
 * A linha do tempo do CRM: o historico de uma oportunidade ou de um cliente,
 * do mais recente para o mais antigo, agrupado por dia.
 *
 * Cada evento diz QUEM fez (em negrito), O QUE fez (a frase gravada pelo
 * servidor no momento do fato) e QUANDO, com um icone pelo tipo. O que a frase
 * nao cabe — o texto inteiro de uma anotacao, o motivo da perda, o antes e o
 * depois de uma descricao longa — aparece logo abaixo.
 *
 * SO LEITURA. Nao ha editar nem apagar aqui, e nao e esquecimento: o backend
 * nao tem essas rotas, e o banco recusa as duas operacoes.
 *
 * A pagina seguinte vem por "Carregar registros anteriores", pelo cursor do
 * ultimo evento exibido (`carregar(antes)`). `versao` muda quando quem usa
 * gravou algo: a linha recomeca do topo.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { Link as RouterLink } from "react-router-dom"
import { Box, Button, CircularProgress, Collapse, Link, Skeleton, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import {
  AddCircleOutline,
  AddTaskOutlined,
  ArrowForward,
  AssignmentInd,
  CallOutlined,
  CancelOutlined,
  DeleteOutline,
  EditNoteOutlined,
  EditOutlined,
  EmojiEventsOutlined,
  ErrorOutline,
  Groups2Outlined,
  History,
  ManageAccountsOutlined,
  PersonAddAlt1Outlined,
  PlayCircleOutline,
  ReplayOutlined,
  StickyNote2Outlined,
  SwapHoriz,
  TaskAltOutlined,
  ThumbDownAltOutlined,
} from "@mui/icons-material"
import { CANAIS_CONTATO, dataHoraBR, diaLocal, horaDe, rotuloDoDia, tempoRelativo } from "../../data/crmMeta"
import { prioridade as metaPrioridade } from "../../data/tarefaMeta"

/** O icone e o tom de cada tipo de evento. O tom so pinta o circulo do icone. */
const VISUAL = {
  CLIENTE_CRIADO: { Icone: PersonAddAlt1Outlined, tom: "destaque" },
  CLIENTE_ALTERADO: { Icone: ManageAccountsOutlined, tom: "neutro" },
  CLIENTE_EXCLUIDO: { Icone: DeleteOutline, tom: "negativo" },
  OPORTUNIDADE_CRIADA: { Icone: AddCircleOutline, tom: "destaque" },
  OPORTUNIDADE_ALTERADA: { Icone: EditOutlined, tom: "neutro" },
  RESPONSAVEL_ALTERADO: { Icone: AssignmentInd, tom: "neutro" },
  CLIENTE_ASSOCIADO: { Icone: SwapHoriz, tom: "neutro" },
  ETAPA_ALTERADA: { Icone: ArrowForward, tom: "destaque" },
  OPORTUNIDADE_GANHA: { Icone: EmojiEventsOutlined, tom: "positivo" },
  OPORTUNIDADE_PERDIDA: { Icone: ThumbDownAltOutlined, tom: "negativo" },
  OPORTUNIDADE_REABERTA: { Icone: ReplayOutlined, tom: "neutro" },
  OPORTUNIDADE_EXCLUIDA: { Icone: DeleteOutline, tom: "negativo" },
  TAREFA_CRIADA: { Icone: AddTaskOutlined, tom: "neutro" },
  TAREFA_EDITADA: { Icone: EditNoteOutlined, tom: "neutro" },
  TAREFA_INICIADA: { Icone: PlayCircleOutline, tom: "neutro" },
  TAREFA_CONCLUIDA: { Icone: TaskAltOutlined, tom: "positivo" },
  TAREFA_REABERTA: { Icone: ReplayOutlined, tom: "neutro" },
  TAREFA_CANCELADA: { Icone: CancelOutlined, tom: "neutro" },
  ANOTACAO: { Icone: StickyNote2Outlined, tom: "manual" },
  CONTATO: { Icone: CallOutlined, tom: "manual" },
  REUNIAO: { Icone: Groups2Outlined, tom: "manual" },
}

function coresDoTom(t, tom) {
  const escuro = t.palette.mode === "dark"
  const base = {
    destaque: t.palette.primary.main,
    positivo: t.palette.success.main,
    negativo: t.palette.error.main,
    manual: t.palette.info.main,
  }[tom]
  if (!base) return { bg: t.palette.action.selected, fg: t.palette.text.secondary }
  return { bg: alpha(base, escuro ? 0.22 : 0.12), fg: base }
}

const CAMPOS_LONGOS = { descricao: "Descrição", observacoes: "Observações" }

/**
 * A frase do evento. Nas atividades manuais o texto vai inteiro no bloco de
 * baixo, entao a frase para no verbo; no resto, e a frase gravada.
 */
function frase(ev) {
  if (ev.tipo === "ANOTACAO") return "adicionou uma anotação"
  if (ev.tipo === "REUNIAO") return "registrou uma reunião"
  if (ev.tipo === "CONTATO") {
    const canal = CANAIS_CONTATO.find((c) => c.valor === ev.metadados?.canal)
    return canal ? `registrou um contato por ${canal.rotulo}` : "registrou um contato"
  }
  if (ev.tipo === "OPORTUNIDADE_PERDIDA") return "marcou a oportunidade como perdida"
  return ev.descricao
}

/** O que a frase nao diz: texto inteiro, motivo, prazo, tempo na etapa anterior. */
function Complemento({ ev }) {
  const [aberto, setAberto] = useState(false)
  const m = ev.metadados || {}
  const novos = ev.dados_novos || {}
  const antigos = ev.dados_anteriores || {}

  if (["ANOTACAO", "CONTATO", "REUNIAO"].includes(ev.tipo) && m.texto) {
    return <Citacao>{m.texto}</Citacao>
  }
  if (ev.tipo === "OPORTUNIDADE_PERDIDA" && novos.motivo_perda) {
    return <Citacao rotulo="Motivo da perda">{novos.motivo_perda}</Citacao>
  }
  if (ev.tipo === "ETAPA_ALTERADA" && Number.isInteger(m.dias_na_etapa_anterior)) {
    const d = m.dias_na_etapa_anterior
    return (
      <Detalhe>
        {d === 0 ? "Ficou menos de um dia" : `Ficou ${d} dia${d > 1 ? "s" : ""}`} em “{antigos.etapa}”.
      </Detalhe>
    )
  }
  if (ev.tipo === "TAREFA_CRIADA" && (novos.vencimento_ts || novos.prioridade)) {
    return (
      <Detalhe>
        {novos.vencimento_ts ? `Prazo: ${dataHoraBR(novos.vencimento_ts)}` : "Sem prazo"}
        {novos.prioridade ? ` · Prioridade ${metaPrioridade(novos.prioridade).rotulo.toLowerCase()}` : ""}
        {novos.responsavel ? ` · ${novos.responsavel}` : ""}
      </Detalhe>
    )
  }
  if (ev.tipo === "TAREFA_EDITADA") {
    const partes = []
    if ("vencimento_ts" in novos) partes.push(novos.vencimento_ts ? `Novo prazo: ${dataHoraBR(novos.vencimento_ts)}` : "Prazo removido")
    if (m.responsavel_novo !== undefined) partes.push(`Responsável: ${m.responsavel_novo || "ninguém"}`)
    if ("prioridade" in novos) partes.push(`Prioridade ${metaPrioridade(novos.prioridade).rotulo.toLowerCase()}`)
    return partes.length ? <Detalhe>{partes.join(" · ")}</Detalhe> : null
  }
  if (ev.tipo === "OPORTUNIDADE_ALTERADA" && CAMPOS_LONGOS[m.campo]) {
    return (
      <Box sx={{ mt: 0.5 }}>
        <Link component="button" type="button" variant="caption" onClick={() => setAberto((v) => !v)} sx={{ fontWeight: 600 }}>
          {aberto ? "Ocultar alteração" : "Ver alteração"}
        </Link>
        <Collapse in={aberto} unmountOnExit>
          <Citacao rotulo="Antes">{antigos[m.campo] || "(vazio)"}</Citacao>
          <Citacao rotulo="Depois">{novos[m.campo] || "(vazio)"}</Citacao>
        </Collapse>
      </Box>
    )
  }
  return null
}

function Detalhe({ children }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
      {children}
    </Typography>
  )
}

function Citacao({ rotulo, children }) {
  return (
    <Box
      sx={{
        mt: 0.75,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: (t) => (t.palette.mode === "dark" ? alpha("#fff", 0.04) : alpha("#000", 0.03)),
        borderLeft: 3,
        borderColor: "divider",
      }}
    >
      {rotulo && (
        <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block" }}>
          {rotulo}
        </Typography>
      )}
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Box>
  )
}

function ItemEvento({ ev, ultimo, mostrarOportunidade }) {
  const visual = VISUAL[ev.tipo] || { Icone: History, tom: "neutro" }
  const { Icone } = visual

  return (
    <Box component="li" sx={{ display: "flex", gap: 1.5, position: "relative", pb: ultimo ? 0 : 2.25 }}>
      {/* A linha vertical que liga os eventos passa por tras dos icones. */}
      {!ultimo && (
        <Box aria-hidden sx={{ position: "absolute", left: 15, top: 34, bottom: 0, width: "2px", bgcolor: "divider" }} />
      )}
      <Box
        aria-hidden
        sx={(t) => {
          const c = coresDoTom(t, visual.tom)
          return {
            width: 32,
            height: 32,
            borderRadius: "50%",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            bgcolor: c.bg,
            color: c.fg,
          }
        }}
      >
        <Icone sx={{ fontSize: 18 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, pt: 0.5 }}>
        <Typography variant="body2" sx={{ lineHeight: 1.5, wordBreak: "break-word" }}>
          <Box component="strong" sx={{ fontWeight: 700 }}>
            {ev.autor_nome || "Alguém"}
          </Box>{" "}
          {frase(ev)}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 1, mt: 0.125 }}>
          <Tooltip title={dataHoraBR(ev.criado_ts)}>
            <Typography component="time" dateTime={ev.criado_ts} variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {horaDe(ev.criado_ts)} · {tempoRelativo(ev.criado_ts)}
            </Typography>
          </Tooltip>
          {mostrarOportunidade && ev.id_oportunidade && ev.oportunidade_titulo && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              em{" "}
              {ev.oportunidade_excluida ? (
                <Box component="span" sx={{ textDecoration: "line-through" }}>
                  {ev.oportunidade_titulo}
                </Box>
              ) : (
                <Link component={RouterLink} to={`/crm/oportunidades/${ev.id_oportunidade}`} underline="hover" sx={{ fontWeight: 600 }}>
                  {ev.oportunidade_titulo}
                </Link>
              )}
            </Typography>
          )}
        </Box>

        <Complemento ev={ev} />
      </Box>
    </Box>
  )
}

/**
 * @param {object} props
 * @param {(antes: number|null) => Promise<{eventos: object[], temMais: boolean}>} props.carregar
 * @param {any} [props.versao] - muda quando algo foi gravado; recarrega do topo.
 * @param {boolean} [props.mostrarOportunidade] - no historico do cliente, diz de qual oportunidade e cada evento.
 * @param {string} [props.vazio] - o que dizer quando nao ha evento nenhum.
 * @param {(err) => string} [props.mensagemErro]
 */
export default function LinhaDoTempo({ carregar, versao, mostrarOportunidade = false, vazio, mensagemErro }) {
  const [eventos, setEventos] = useState([])
  const [temMais, setTemMais] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState(null)
  // A resposta de uma carga antiga nao pode sobrescrever a de uma mais nova.
  const pedido = useRef(0)
  // Numa ref, e nao nas dependencias: a tela costuma passar uma funcao nova a
  // cada render, e isso nao pode recarregar o historico.
  const traduzirErro = useRef(mensagemErro)
  traduzirErro.current = mensagemErro
  const mensagemDe = (err, padrao) => (traduzirErro.current ? traduzirErro.current(err) : padrao)

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current
    setCarregando(true)
    setErro(null)
    try {
      const pagina = await carregar(null)
      if (meu !== pedido.current) return
      setEventos(pagina.eventos)
      setTemMais(pagina.temMais)
    } catch (err) {
      if (meu !== pedido.current) return
      setErro(mensagemDe(err, "Não foi possível carregar o histórico."))
    } finally {
      if (meu === pedido.current) setCarregando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar])

  useEffect(() => {
    recarregar()
  }, [recarregar, versao])

  const carregarAnteriores = async () => {
    const ultimo = eventos[eventos.length - 1]
    if (!ultimo) return
    const meu = pedido.current
    setCarregandoMais(true)
    try {
      const pagina = await carregar(ultimo.id_evento)
      if (meu !== pedido.current) return
      setEventos((atuais) => [...atuais, ...pagina.eventos])
      setTemMais(pagina.temMais)
    } catch (err) {
      setErro(mensagemDe(err, "Não foi possível carregar os registros anteriores."))
    } finally {
      setCarregandoMais(false)
    }
  }

  if (carregando && eventos.length === 0) {
    return (
      <Box aria-busy="true" aria-label="Carregando o histórico">
        {[0, 1, 2].map((i) => (
          <Box key={i} sx={{ display: "flex", gap: 1.5, mb: 2.5 }}>
            <Skeleton variant="circular" width={32} height={32} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width={i === 1 ? "55%" : "75%"} />
              <Skeleton width={90} height={16} />
            </Box>
          </Box>
        ))}
      </Box>
    )
  }

  if (erro && eventos.length === 0) {
    return (
      <Box role="alert" sx={{ py: 4, textAlign: "center" }}>
        <ErrorOutline sx={{ color: "error.main" }} aria-hidden />
        <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5 }}>
          {erro}
        </Typography>
        <Button size="small" variant="outlined" onClick={recarregar}>
          Tentar novamente
        </Button>
      </Box>
    )
  }

  if (eventos.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <History sx={{ fontSize: 32, color: "text.disabled" }} aria-hidden />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {vazio || "Nada registrado ainda."}
        </Typography>
      </Box>
    )
  }

  // Agrupa por dia, mantendo a ordem (mais recente primeiro).
  const grupos = []
  for (const ev of eventos) {
    const dia = diaLocal(ev.criado_ts)
    const atual = grupos[grupos.length - 1]
    if (atual && atual.dia === dia) atual.itens.push(ev)
    else grupos.push({ dia, rotulo: rotuloDoDia(ev.criado_ts), itens: [ev] })
  }

  return (
    <Box>
      {grupos.map((g) => (
        <Fragment key={g.dia}>
          <Typography
            variant="overline"
            component="h4"
            color="text.secondary"
            sx={{ display: "block", lineHeight: 1.6, mb: 1, mt: 0.5 }}
          >
            {g.rotulo}
          </Typography>
          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, mb: 2 }}>
            {g.itens.map((ev, i) => (
              <ItemEvento key={ev.id_evento} ev={ev} ultimo={i === g.itens.length - 1} mostrarOportunidade={mostrarOportunidade} />
            ))}
          </Box>
        </Fragment>
      ))}

      {erro && (
        <Typography role="alert" variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
          {erro}
        </Typography>
      )}

      {temMais && (
        <Box sx={{ textAlign: "center" }}>
          <Button
            size="small"
            variant="outlined"
            onClick={carregarAnteriores}
            disabled={carregandoMais}
            startIcon={carregandoMais ? <CircularProgress size={14} color="inherit" /> : <History />}
          >
            Carregar registros anteriores
          </Button>
        </Box>
      )}
    </Box>
  )
}
