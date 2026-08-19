/**
 * Relatorio "Tempo por etapa".
 *
 * Os outros relatorios contam ESTADO — quantos passos aprovados, quantas
 * startups paradas. Este conta TEMPO, e faz a unica pergunta que estado nao
 * responde: ha quanto tempo a startup esta nesta etapa e de quem e esse tempo.
 *
 * A separacao e o ponto da tela. Uma startup pode estar ha quarenta dias na
 * Validacao sem ter feito nada de errado: se a entrega foi enviada no terceiro
 * dia e ninguem corrigiu, os outros trinta e sete sao da incubadora. Cobrar a
 * startup por esse prazo e ler o numero ao contrario — por isso toda linha aqui
 * vem quebrada em "com a startup" e "esperando correcao", e nunca so no total.
 *
 * Endpoint: GET /relatorios/tempo?id_tenant=
 */
import { useMemo } from "react"
import { Box, Chip, Paper, Tooltip, Typography, useTheme } from "@mui/material"
import { HourglassBottom, ErrorOutline, HelpOutline } from "@mui/icons-material"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"

import RelatorioShell, { EstadoRelatorio } from "../components/relatorios/RelatorioShell"
import KpiRow from "../components/relatorios/KpiRow"
import TabelaRelatorio from "../components/relatorios/TabelaRelatorio"
import BotaoExportar from "../components/relatorios/BotaoExportar"
import { useRelatorio } from "../hooks/useRelatorio"
import { paletaViz, STATUS } from "../components/relatorios/vizPalette"
import { baixarCsv } from "../utils/csv"

const COLUNAS_CSV_ETAPAS = [
  { chave: "startup", rotulo: "Startup" },
  { chave: "programa", rotulo: "Trilha" },
  { chave: "fase", rotulo: "Etapa" },
  { chave: "situacao", rotulo: "Situação" },
  { chave: "entrada_ts", rotulo: "Entrou em" },
  { chave: "saida_ts", rotulo: "Concluiu em" },
  { chave: "dias_total", rotulo: "Dias na etapa" },
  { chave: "dias_startup", rotulo: "Dias com a startup" },
  { chave: "dias_bloqueada", rotulo: "Dias bloqueada (fila do mentor)" },
  { chave: "pct_bloqueada", rotulo: "% do tempo bloqueada" },
  { chave: "dias_em_fila", rotulo: "Dias com alguma entrega na fila" },
  { chave: "aguardando_agora", rotulo: "Entregas na fila agora" },
  { chave: "espera_dias", rotulo: "Espera mais antiga (dias)" },
  { chave: "devolucoes", rotulo: "Devoluções para ajuste" },
  { chave: "aprovados", rotulo: "Passos aprovados" },
  { chave: "passos", rotulo: "Passos da etapa" },
  { chave: "atribuicao", rotulo: "Atraso atribuível a" },
]

const COLUNAS_CSV_PASSOS = [
  { chave: "fase", rotulo: "Etapa" },
  { chave: "modulo", rotulo: "Módulo" },
  { chave: "passo", rotulo: "Passo" },
  { chave: "startups", rotulo: "Startups que passaram" },
  { chave: "dias_startup_medio", rotulo: "Dias com a startup (média)" },
  { chave: "dias_mentor_medio", rotulo: "Dias na fila do mentor (média)" },
  { chave: "dias_mentor_maximo", rotulo: "Pior espera (dias)" },
  { chave: "pct_mentor", rotulo: "% do tempo na fila" },
  { chave: "aguardando_agora", rotulo: "Esperando correção agora" },
  { chave: "devolucoes", rotulo: "Devoluções para ajuste" },
]

// Rotulo e cor de cada atribuicao. A cor nunca anda sozinha: o chip sempre
// carrega o texto, porque "amarelo" nao significa nada para quem nao o
// distingue — mesma regra da paleta dos demais relatorios.
const ATRIBUICAO = {
  MENTORIA: { rotulo: "Mentoria", cor: STATUS.CRITICO },
  MISTA: { rotulo: "Dividido", cor: STATUS.ATENCAO },
  STARTUP: { rotulo: "Startup", cor: STATUS.BOM },
}

/** Encurta um nome para caber no eixo do grafico. */
const encurtar = (texto, max = 28) =>
  texto.length > max ? `${texto.slice(0, max - 1)}…` : texto

/** Data curta, ou travessao quando a etapa ainda nao fechou. */
const data = (ts) => (ts ? new Date(ts).toLocaleDateString("pt-BR") : "—")

export default function RelatorioTempo() {
  return (
    <RelatorioShell
      titulo="Tempo por etapa"
      descricao="Há quanto tempo cada startup está em cada etapa da trilha — e quanto desse tempo foi ela produzindo, quanto foi entrega parada esperando correção."
      icone={<HourglassBottom />}
    >
      {({ idTenant }) => <Conteudo idTenant={idTenant} />}
    </RelatorioShell>
  )
}

function Conteudo({ idTenant }) {
  const theme = useTheme()
  const viz = useMemo(() => paletaViz(theme.palette.mode), [theme.palette.mode])

  const { dados, carregando, erro } = useRelatorio("tempo", { idTenant })

  // O grafico mostra so a etapa ABERTA de cada startup: e sobre ela que ainda
  // da para agir. As concluidas ficam na tabela, como historico.
  const barras = useMemo(() => {
    if (!dados) return []
    return dados.startups
      .filter((s) => s.etapa_atual)
      .map((s) => ({
        nome: encurtar(`${s.startup} · ${s.etapa_atual.fase}`),
        startup: s.startup,
        etapa: s.etapa_atual.fase,
        comStartup: Math.max(0, s.etapa_atual.dias_total - s.etapa_atual.dias_bloqueada),
        bloqueada: s.etapa_atual.dias_bloqueada,
        total: s.etapa_atual.dias_total,
      }))
      .sort((a, b) => b.total - a.total)
  }, [dados])

  return (
    <EstadoRelatorio
      carregando={carregando}
      erro={erro}
      vazio={dados && dados.etapas.length === 0}
      mensagemVazio="Nenhuma startup matriculada em uma trilha com etapas ativas ainda."
    >
      {dados && (
        <>
          <KpiRow
            itens={[
              {
                rotulo: "Startups acompanhadas",
                valor: dados.resumo.startups,
              },
              {
                rotulo: "Dias por etapa concluída (média)",
                valor: dados.resumo.dias_medio_etapa_concluida ?? "—",
                sufixo: dados.resumo.dias_medio_etapa_concluida != null ? " d" : "",
                ajuda:
                  "Só as etapas que já fecharam. As abertas ainda vão crescer e puxariam a média para baixo.",
              },
              {
                rotulo: "Do tempo de trilha foi fila de correção",
                valor: `${dados.resumo.pct_tempo_bloqueado}%`,
                cor: dados.resumo.pct_tempo_bloqueado >= 25 ? STATUS.ALERTA : undefined,
                ajuda: `Períodos em que a startup não tinha nenhum passo nas mãos: tudo o que faltava estava aguardando avaliação. Somam ${dados.resumo.dias_bloqueados_total} dias.`,
              },
              {
                rotulo: "Startups travadas na mentoria",
                valor: dados.resumo.startups_travadas_na_mentoria,
                cor:
                  dados.resumo.startups_travadas_na_mentoria > 0 ? STATUS.CRITICO : undefined,
                icone:
                  dados.resumo.startups_travadas_na_mentoria > 0 ? (
                    <ErrorOutline fontSize="small" />
                  ) : undefined,
                ajuda: `Etapa abertas cujo atraso é atribuível à incubadora: entrega parada há ${dados.parametros.sla_mentor_dias} dias ou mais, ou ${dados.parametros.pct_bloqueio_alto}%+ do tempo da etapa sem nada com a startup.`,
              },
              {
                rotulo: "Espera mais antiga na fila",
                valor: dados.resumo.espera_mais_antiga_dias ?? "—",
                sufixo: dados.resumo.espera_mais_antiga_dias != null ? " d" : "",
                cor:
                  dados.resumo.espera_mais_antiga_dias >= dados.parametros.sla_mentor_dias
                    ? STATUS.CRITICO
                    : undefined,
                ajuda: `${dados.resumo.entregas_na_fila} entrega(s) aguardando avaliação neste momento.`,
              },
            ]}
          />

          {barras.length > 0 && (
            <Paper
              data-tour="relatorio-graficos"
              sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}
            >
              <Typography variant="h6" fontWeight={700}>
                Onde cada startup está parada — e por quê
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Dias na etapa atual, divididos entre o tempo em que a startup tinha algum passo
                para tocar e o tempo em que tudo o que faltava estava na fila de correção.
              </Typography>

              <ResponsiveContainer width="100%" height={Math.max(220, barras.length * 36)}>
                <BarChart
                  data={barras}
                  layout="vertical"
                  margin={{ top: 4, right: 32, bottom: 4, left: 8 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={viz.chrome.grade}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: viz.chrome.rotulo, fontSize: 12 }}
                    axisLine={{ stroke: viz.chrome.eixo }}
                    tickLine={false}
                    unit=" d"
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={250}
                    tick={{ fill: viz.chrome.rotulo, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: theme.palette.action.hover }}
                    contentStyle={{
                      background: theme.palette.background.paper,
                      border: `1px solid ${viz.chrome.eixo}`,
                      borderRadius: 4,
                      color: theme.palette.text.primary,
                    }}
                    formatter={(valor, nome) => [`${valor} dias`, nome]}
                    labelFormatter={(_rotulo, carga) =>
                      carga?.[0]?.payload
                        ? `${carga[0].payload.startup} · ${carga[0].payload.etapa}`
                        : ""
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="comStartup"
                    name="Com a startup"
                    stackId="tempo"
                    fill={viz.funil[1]}
                    barSize={20}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="bloqueada"
                    name="Esperando correção"
                    stackId="tempo"
                    fill={STATUS.ALERTA}
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}

          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}
          >
            <Typography variant="h6" fontWeight={700}>
              Cada startup em cada etapa
            </Typography>
            <BotaoExportar
              onClick={() => baixarCsv("tempo-por-etapa", COLUNAS_CSV_ETAPAS, dados.etapas)}
              rotulo="Exportar etapas"
            />
          </Box>

          <TabelaRelatorio
            chaveId="id_fase_startup"
            chaveStorage="relatorio-tempo-etapas"
            linhas={dados.etapas.map((e) => ({
              ...e,
              id_fase_startup: `${e.id_startup}-${e.id_fase}`,
            }))}
            ordemInicial="dias_bloqueada"
            colunas={[
              {
                chave: "startup",
                rotulo: "Startup / etapa",
                render: (l) => (
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {l.startup}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {l.fase}
                      {l.concluida ? " · concluída" : " · em andamento"}
                    </Typography>
                  </Box>
                ),
              },
              {
                chave: "dias_total",
                rotulo: "Na etapa",
                alinhamento: "right",
                ajuda: "Da entrada na etapa até a conclusão (ou até hoje).",
                render: (l) => (
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {l.dias_total}d
                  </Typography>
                ),
              },
              {
                chave: "dias_startup",
                rotulo: "Com a startup",
                alinhamento: "right",
                ajuda: "Tempo em que havia ao menos um passo nas mãos da startup.",
                render: (l) => `${l.dias_startup}d`,
              },
              {
                chave: "dias_bloqueada",
                rotulo: "Bloqueada",
                alinhamento: "right",
                ajuda:
                  "Tempo em que tudo o que faltava estava na fila do mentor — a startup não tinha o que entregar.",
                render: (l) =>
                  l.dias_bloqueada > 0 ? (
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ fontVariantNumeric: "tabular-nums", color: STATUS.ALERTA }}
                    >
                      {l.dias_bloqueada}d ({l.pct_bloqueada}%)
                    </Typography>
                  ) : (
                    "—"
                  ),
              },
              {
                chave: "espera_dias",
                rotulo: "Na fila agora",
                alinhamento: "right",
                ajuda: "Entregas aguardando avaliação neste momento e há quantos dias a mais antiga.",
                render: (l) =>
                  l.aguardando_agora > 0 ? (
                    <Chip
                      size="small"
                      label={`${l.aguardando_agora} há ${l.espera_dias}d`}
                      variant="outlined"
                      sx={
                        l.espera_dias >= dados.parametros.sla_mentor_dias
                          ? { borderColor: STATUS.CRITICO, color: STATUS.CRITICO }
                          : undefined
                      }
                    />
                  ) : (
                    "—"
                  ),
              },
              {
                chave: "devolucoes",
                rotulo: "Idas e voltas",
                alinhamento: "right",
                ajuda: "Quantas vezes o mentor devolveu uma entrega desta etapa para ajuste.",
              },
              {
                chave: "aprovados",
                rotulo: "Passos",
                alinhamento: "right",
                render: (l) => `${l.aprovados}/${l.passos}`,
              },
              {
                chave: "atribuicao",
                rotulo: "Atraso de quem",
                ajuda:
                  "Quem segura o relógio desta etapa hoje. Passe o mouse na marca para ver o motivo.",
                render: (l) => {
                  const cfg = ATRIBUICAO[l.atribuicao] ?? ATRIBUICAO.STARTUP
                  const chip = (
                    <Chip
                      size="small"
                      label={cfg.rotulo}
                      variant="outlined"
                      sx={{ borderColor: cfg.cor, color: cfg.cor }}
                    />
                  )
                  if (l.motivos.length === 0) return chip
                  return (
                    <Tooltip title={l.motivos.join(" · ")}>
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        {chip}
                        <HelpOutline sx={{ fontSize: 14, color: "text.disabled" }} />
                      </Box>
                    </Tooltip>
                  )
                },
              },
              {
                chave: "entrada_ts",
                rotulo: "Entrou",
                alinhamento: "right",
                render: (l) => data(l.entrada_ts),
              },
            ]}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mt: 4,
              mb: 1,
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Onde o tempo se perde na trilha
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Média por startup que passou pelo passo. Um passo com muito tempo de fila não é
                difícil de fazer — é difícil de corrigir.
              </Typography>
            </Box>
            <BotaoExportar
              onClick={() => baixarCsv("tempo-por-passo", COLUNAS_CSV_PASSOS, dados.passos)}
              rotulo="Exportar passos"
            />
          </Box>

          <TabelaRelatorio
            chaveId="id_no"
            chaveStorage="relatorio-tempo-passos"
            linhas={dados.passos}
            ordemInicial="dias_mentor_medio"
            mensagemVazio="A trilha ainda não tem passos com entrega."
            colunas={[
              {
                chave: "passo",
                rotulo: "Passo",
                render: (l) => (
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {l.passo}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[l.fase, l.modulo].filter(Boolean).join(" · ") || "Sem etapa"}
                    </Typography>
                  </Box>
                ),
              },
              { chave: "startups", rotulo: "Startups", alinhamento: "right" },
              {
                chave: "dias_startup_medio",
                rotulo: "Com a startup",
                alinhamento: "right",
                render: (l) => (l.startups === 0 ? "—" : `${l.dias_startup_medio}d`),
              },
              {
                chave: "dias_mentor_medio",
                rotulo: "Na fila",
                alinhamento: "right",
                ajuda: "Média de dias entre o envio e a resposta do mentor.",
                render: (l) =>
                  l.dias_mentor_medio > 0 ? (
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ fontVariantNumeric: "tabular-nums", color: STATUS.ALERTA }}
                    >
                      {l.dias_mentor_medio}d
                    </Typography>
                  ) : (
                    "—"
                  ),
              },
              {
                chave: "pct_mentor",
                rotulo: "% na fila",
                alinhamento: "right",
                render: (l) => (l.startups === 0 ? "—" : `${l.pct_mentor}%`),
              },
              {
                chave: "dias_mentor_maximo",
                rotulo: "Pior espera",
                alinhamento: "right",
                render: (l) =>
                  l.dias_mentor_maximo > 0 ? `${l.dias_mentor_maximo}d` : "—",
              },
              {
                chave: "aguardando_agora",
                rotulo: "Parados agora",
                alinhamento: "right",
                render: (l) =>
                  l.aguardando_agora > 0 ? (
                    <Chip
                      size="small"
                      icon={<ErrorOutline sx={{ fontSize: 16 }} />}
                      label={l.aguardando_agora}
                      variant="outlined"
                      sx={{
                        borderColor: STATUS.CRITICO,
                        color: STATUS.CRITICO,
                        "& .MuiChip-icon": { color: STATUS.CRITICO },
                      }}
                    />
                  ) : (
                    "—"
                  ),
              },
              { chave: "devolucoes", rotulo: "Devoluções", alinhamento: "right" },
            ]}
          />

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            O relógio de cada etapa começa quando a etapa anterior é aprovada (a primeira, na
            matrícula na trilha) — a mesma sequência que a Jornada usa para liberar as fases. As
            durações anteriores à implantação do registro de tempo são um piso: os ciclos de ajuste
            já apagados por reenvios antigos não puderam ser reconstruídos.
          </Typography>
        </>
      )}
    </EstadoRelatorio>
  )
}
