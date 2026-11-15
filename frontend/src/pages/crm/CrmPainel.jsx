/**
 * Visao geral do CRM: os numeros da operacao comercial da startup, contados no
 * banco, e as listas curtas que dizem o que fazer hoje.
 *
 * O PERIODO vale para o que se encerrou (ganhas, perdidas, conversao). Funil e
 * tarefas sao sempre o retrato de agora.
 *
 * Os indicadores sao numeros, nao graficos: "quanto ha no funil" e uma
 * pergunta de uma resposta so. A distribuicao por etapa e uma barra por etapa,
 * de uma cor so — a etapa e identificada pelo nome e pelo ponto da cor dela,
 * nao pela cor da barra —, com a quantidade e o valor escritos ao lado.
 *
 * Startup que ainda nao cadastrou nada ve um roteiro de tres passos no lugar
 * dos zeros.
 */
import { useCallback, useEffect, useState } from "react"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { Alert, Box, Button, ButtonBase, Grid, Link, MenuItem, Paper, Skeleton, TextField, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import {
  Add,
  AttachMoney,
  EmojiEventsOutlined,
  EventBusy,
  Handshake,
  PendingActions,
  PeopleOutline,
  Percent,
  ThumbDownAltOutlined,
} from "@mui/icons-material"
import { useCrm } from "../../components/crm/useCrm"
import LinhaDoTempo from "../../components/crm/LinhaDoTempo"
import ListaTarefasCrm from "../../components/crm/ListaTarefasCrm"
import DrawerTarefaCrm from "../../components/crm/DrawerTarefaCrm"
import { PERIODOS_PAINEL, moeda, moedaCurta, tempoRelativo } from "../../data/crmMeta"

const CHAVE_PERIODO = "quiron.crm.painel.periodo"

function lerPeriodo() {
  try {
    return window.localStorage.getItem(CHAVE_PERIODO) || "90d"
  } catch {
    return "90d"
  }
}

export default function CrmPainel() {
  const { api, falha, avisar } = useCrm()
  const navigate = useNavigate()
  const [periodo, setPeriodo] = useState(lerPeriodo)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [tarefaAberta, setTarefaAberta] = useState(undefined)

  const carregar = useCallback(async () => {
    try {
      setDados(await api.painel(periodo))
      setErro(null)
    } catch (err) {
      setErro(falha(err, "Não foi possível carregar o painel."))
    }
  }, [api, periodo, falha])

  useEffect(() => {
    carregar()
    try {
      window.localStorage.setItem(CHAVE_PERIODO, periodo)
    } catch {
      // Sem storage, so nao lembra o periodo.
    }
  }, [carregar, periodo])

  // As atividades ja vieram com o painel: a linha do tempo so as desenha. Muda
  // de referencia quando o painel recarrega, e e isso que a faz redesenhar.
  const carregarAtividades = useCallback(async () => ({ eventos: dados?.atividades || [], temMais: false }), [dados])

  const alternarTarefa = async (t, status) => {
    try {
      await api.statusTarefa(t.id_tarefa, status)
      avisar("success", status === "CONCLUIDA" ? "Tarefa concluída." : "Tarefa reaberta.")
      carregar()
    } catch (err) {
      avisar("error", falha(err, "Não foi possível atualizar a tarefa."))
    }
  }

  const i = dados?.indicadores
  const carregando = !dados && !erro
  const rotuloPeriodo = PERIODOS_PAINEL.find((p) => p.valor === periodo)?.rotulo.toLowerCase()

  if (erro && !dados) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={carregar}>Tentar novamente</Button>}>
        {erro}
      </Alert>
    )
  }

  const comecando = dados && i.total_clientes === 0 && i.oportunidades_abertas === 0 && i.ganhas + i.perdidas === 0

  const blocos = [
    { rotulo: "Clientes", valor: i?.total_clientes, icone: <PeopleOutline />, para: "/crm/clientes" },
    { rotulo: "Oportunidades abertas", valor: i?.oportunidades_abertas, icone: <Handshake />, para: "/crm/oportunidades" },
    { rotulo: "Valor do funil", valor: i && moedaCurta(i.valor_funil), dica: i && moeda(i.valor_funil), icone: <AttachMoney />, para: "/crm/oportunidades" },
    {
      rotulo: "Ganhas",
      valor: i?.ganhas,
      detalhe: i && i.valor_ganho ? moedaCurta(i.valor_ganho) : null,
      icone: <EmojiEventsOutlined />,
      periodo: true,
    },
    { rotulo: "Perdidas", valor: i?.perdidas, icone: <ThumbDownAltOutlined />, periodo: true },
    {
      rotulo: "Taxa de conversão",
      valor: i ? (i.taxa_conversao === null ? "—" : `${i.taxa_conversao.toLocaleString("pt-BR")}%`) : null,
      dica: "Ganhas sobre o total de encerradas (ganhas + perdidas) no período. Sem nada encerrado, não há taxa.",
      icone: <Percent />,
      periodo: true,
    },
    { rotulo: "Tarefas pendentes", valor: i?.tarefas_pendentes, icone: <PendingActions />, para: "/crm/tarefas?recorte=abertas" },
    {
      rotulo: "Tarefas atrasadas",
      valor: i?.tarefas_atrasadas,
      icone: <EventBusy />,
      alerta: i?.tarefas_atrasadas > 0,
      para: "/crm/tarefas?recorte=atrasadas",
    },
  ]

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            Ganhas, perdidas e conversão: {rotuloPeriodo}. Funil e tarefas: hoje.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            A incubadora vê só o total vendido (as oportunidades ganhas) no cadastro da startup. Clientes e
            negociações ficam só com a equipe.
          </Typography>
        </Box>
        <TextField select size="small" label="Período" value={periodo} onChange={(e) => setPeriodo(e.target.value)} sx={{ minWidth: 190 }}>
          {PERIODOS_PAINEL.map((p) => (
            <MenuItem key={p.valor} value={p.valor}>
              {p.rotulo}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Os oito numeros num painel so, com linhas finas entre eles (o mesmo
          desenho dos indicadores das Tarefas). */}
      <Box
        role="list"
        aria-label="Indicadores comerciais"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
          gap: "1px",
          bgcolor: "divider",
          border: 1,
          borderColor: "divider",
          mb: 2.5,
        }}
      >
        {blocos.map((b) => (
          <Bloco key={b.rotulo} {...b} carregando={carregando} onAbrir={b.para ? () => navigate(b.para) : undefined} />
        ))}
      </Box>

      {comecando && <PrimeirosPassos onCliente={() => navigate("/crm/clientes?novo=1")} onOportunidade={() => navigate("/crm/oportunidades?nova=1")} />}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Secao titulo="Distribuição por etapa" acao={<Link component={RouterLink} to="/crm/oportunidades" variant="caption" underline="hover" fontWeight={600}>Ver funil</Link>}>
            {carregando ? <Skeleton variant="rounded" height={160} /> : <Distribuicao etapas={dados.etapas} />}
          </Secao>

          <Secao titulo="Oportunidades com movimento recente">
            {carregando ? (
              <Skeleton variant="rounded" height={140} />
            ) : dados.oportunidades_recentes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma oportunidade ainda.
              </Typography>
            ) : (
              <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                {dados.oportunidades_recentes.map((o) => (
                  <Box component="li" key={o.id_oportunidade} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}>
                    <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: o.situacao === "ABERTA" ? o.etapa_cor : o.situacao === "GANHA" ? "success.main" : "error.main", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Link component={RouterLink} to={`/crm/oportunidades/${o.id_oportunidade}`} underline="hover" fontWeight={600} variant="body2" noWrap sx={{ display: "block" }}>
                        {o.titulo}
                      </Link>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {o.cliente_nome} · {o.situacao === "ABERTA" ? o.etapa_nome : o.situacao === "GANHA" ? "Ganha" : "Perdida"} · {tempoRelativo(o.ultima_atividade_ts)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {moeda(o.valor_estimado)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Secao>
        </Grid>

        <Grid item xs={12} md={6}>
          <Secao titulo="Próximas tarefas" acao={<Link component={RouterLink} to="/crm/tarefas" variant="caption" underline="hover" fontWeight={600}>Ver todas</Link>}>
            {carregando ? (
              <Skeleton variant="rounded" height={140} />
            ) : (
              <ListaTarefasCrm
                tarefas={dados.proximas_tarefas}
                mostrarVinculo
                onAbrir={async (t) => {
                  try {
                    setTarefaAberta(await api.tarefa(t.id_tarefa))
                  } catch (err) {
                    avisar("error", falha(err, "Não foi possível abrir a tarefa."))
                  }
                }}
                onAlternarConclusao={alternarTarefa}
                vazio="Nenhuma tarefa em aberto. Bom momento para planejar os próximos contatos."
              />
            )}
          </Secao>

          <Secao titulo="Últimas atividades comerciais">
            {carregando ? (
              <Skeleton variant="rounded" height={160} />
            ) : (
              <LinhaDoTempo
                carregar={carregarAtividades}
                mostrarOportunidade
                vazio="As atividades aparecem aqui assim que a equipe começar a registrar."
              />
            )}
          </Secao>
        </Grid>
      </Grid>

      <DrawerTarefaCrm aberto={Boolean(tarefaAberta)} onFechar={() => setTarefaAberta(undefined)} tarefa={tarefaAberta || null} onSalvo={carregar} />
    </Box>
  )
}

function Bloco({ rotulo, valor, detalhe, dica, icone, alerta, periodo, carregando, onAbrir }) {
  const conteudo = (
    <>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0 }}>
        <Box aria-hidden sx={{ display: "flex", color: alerta ? "error.main" : "text.secondary", "& svg": { fontSize: 16 } }}>
          {icone}
        </Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ flex: 1, lineHeight: 1.35 }}>
          {rotulo}
          {periodo && (
            <Box component="span" sx={{ fontWeight: 400 }}>
              {" "}
              · no período
            </Box>
          )}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h4" component="span" sx={{ lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
          {carregando ? <Skeleton width={48} /> : valor}
        </Typography>
        {detalhe && (
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {detalhe}
          </Typography>
        )}
      </Box>
    </>
  )

  const estilo = {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    textAlign: "left",
    gap: 0.5,
    px: 2,
    py: 1.5,
    minHeight: 88,
    bgcolor: "background.paper",
    boxShadow: (t) => (alerta ? `inset 3px 0 0 ${t.palette.error.main}` : "none"),
  }

  return (
    <Tooltip title={dica || ""} placement="top" enterDelay={400}>
      <Box role="listitem" sx={{ display: "flex" }}>
        {onAbrir ? (
          <ButtonBase
            onClick={onAbrir}
            aria-label={`${rotulo}: ${valor ?? "carregando"}. Abrir.`}
            sx={{
              ...estilo,
              flex: 1,
              "&:hover": { bgcolor: "action.hover" },
              "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2, zIndex: 1 },
            }}
          >
            {conteudo}
          </ButtonBase>
        ) : (
          <Box sx={{ ...estilo, flex: 1 }}>{conteudo}</Box>
        )}
      </Box>
    </Tooltip>
  )
}

function Secao({ titulo, acao, children }) {
  return (
    <Paper sx={{ borderRadius: 0, p: 2, mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography variant="subtitle2" component="h3" fontWeight={700}>
          {titulo}
        </Typography>
        {acao}
      </Box>
      {children}
    </Paper>
  )
}

/**
 * Uma barra por etapa ativa, proporcional a quantidade de oportunidades
 * abertas nela. Cor unica (a do preenchimento do tema); a etapa e o nome e o
 * ponto. Os numeros estao escritos — a barra so ajuda a comparar.
 */
function Distribuicao({ etapas }) {
  const maior = Math.max(1, ...etapas.map((e) => e.quantidade))
  if (etapas.every((e) => e.quantidade === 0)) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhuma oportunidade aberta no funil.
      </Typography>
    )
  }
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }} aria-label="Oportunidades abertas por etapa">
      {etapas.map((e) => (
        <Tooltip key={e.id_etapa} title={`${e.nome}: ${e.quantidade} oportunidade${e.quantidade === 1 ? "" : "s"}, ${moeda(e.valor)}`} placement="top">
          <Box component="li" sx={{ mb: 1.25, "&:last-of-type": { mb: 0 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: e.cor, flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                {e.nome}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: "tabular-nums" }}>
                {e.quantidade}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 76, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {moedaCurta(e.valor)}
              </Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 4, bgcolor: "action.hover", overflow: "hidden" }}>
              <Box
                sx={{
                  height: "100%",
                  width: `${(e.quantidade / maior) * 100}%`,
                  minWidth: e.quantidade ? 6 : 0,
                  borderRadius: 4,
                  // primary.main, e nao o vivo: lima sobre branco tem 1,6:1.
                  bgcolor: "primary.main",
                }}
              />
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}

function PrimeirosPassos({ onCliente, onOportunidade }) {
  const passos = [
    { n: 1, titulo: "Cadastre seus clientes", texto: "Pessoas e empresas com quem a startup conversa." },
    { n: 2, titulo: "Abra oportunidades", texto: "Cada venda em andamento vira um cartão no funil." },
    { n: 3, titulo: "Agende tarefas e registre contatos", texto: "O histórico de cada negociação se escreve sozinho." },
  ]
  return (
    <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 2.5, bgcolor: (t) => alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.08 : 0.1) }}>
      <Typography variant="subtitle1" fontWeight={700}>
        Comece por aqui
      </Typography>
      <Grid container spacing={2} sx={{ mt: 0.5, mb: 2 }}>
        {passos.map((p) => (
          <Grid item xs={12} sm={4} key={p.n}>
            <Box sx={{ display: "flex", gap: 1.25 }}>
              <Box
                aria-hidden
                sx={(t) => ({
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 14,
                  bgcolor: t.palette.primary.vivo,
                  color: t.palette.primary.vivoContraste,
                })}
              >
                {p.n}
              </Box>
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {p.titulo}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {p.texto}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={onCliente}>
          Cadastrar cliente
        </Button>
        <Button variant="outlined" size="small" startIcon={<Handshake />} onClick={onOportunidade}>
          Nova oportunidade
        </Button>
      </Box>
    </Paper>
  )
}
