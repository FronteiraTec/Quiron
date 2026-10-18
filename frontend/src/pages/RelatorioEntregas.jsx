/**
 * Relatorio "Entregas e avaliacoes".
 *
 * Mostra onde as entregas estao paradas e se a incubadora esta respondendo no
 * ritmo em que as startups produzem. Tres leituras: o funil (onde tudo esta),
 * o ritmo semanal (envios contra avaliacoes) e as duas listas que viram
 * trabalho — a fila parada e o desempenho de cada mentor.
 *
 * Endpoint: GET /relatorios/entregas?id_tenant=&dias=
 */
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Box, Chip, Grid, Paper, Typography, useTheme } from "@mui/material"
import { Inbox, WarningAmber, ErrorOutline } from "@mui/icons-material"
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts"

import RelatorioShell, { EstadoRelatorio } from "../components/relatorios/RelatorioShell"
import KpiRow from "../components/relatorios/KpiRow"
import TabelaRelatorio from "../components/relatorios/TabelaRelatorio"
import BotaoExportar from "../components/relatorios/BotaoExportar"
import { useRelatorio } from "../hooks/useRelatorio"
import { paletaViz, STATUS } from "../components/relatorios/vizPalette"
import { baixarCsv } from "../utils/csv"

// Uma entrega parada mais de uma semana deixou de ser fila e virou problema.
const DIAS_FILA_CRITICA = 7

const COLUNAS_FILA_CSV = [
  { chave: "startup", rotulo: "Startup" },
  { chave: "passo", rotulo: "Passo" },
  { chave: "dias_parada", rotulo: "Dias parada" },
  { chave: "enviada_ts", rotulo: "Enviada em" },
  { chave: "mentores", rotulo: "Mentores" },
]

const COLUNAS_MENTORES_CSV = [
  { chave: "mentor", rotulo: "Mentor" },
  { chave: "avaliacoes", rotulo: "Avaliações" },
  { chave: "aprovadas", rotulo: "Aprovadas" },
  { chave: "ajustes", rotulo: "Pedidos de ajuste" },
  { chave: "reprovadas", rotulo: "Reprovadas" },
  { chave: "taxa_aprovacao_pct", rotulo: "Taxa de aprovação (%)" },
  { chave: "nota_media", rotulo: "Nota média" },
  { chave: "dias_resposta_media", rotulo: "Dias até responder (média)" },
  { chave: "startups_atendidas", rotulo: "Startups atendidas" },
]

/** Data curta para os eixos e celulas. */
const dataCurta = (ts) =>
  ts ? new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"

export default function RelatorioEntregas() {
  return (
    <RelatorioShell
      titulo="Entregas e avaliações"
      descricao="Onde as entregas estão paradas, quanto tempo esperam por avaliação e como cada mentor responde."
      icone={<Inbox />}
      periodo
    >
      {({ idTenant, dias }) => <Conteudo idTenant={idTenant} dias={dias} />}
    </RelatorioShell>
  )
}

function Conteudo({ idTenant, dias }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const viz = useMemo(() => paletaViz(theme.palette.mode), [theme.palette.mode])

  const { dados, carregando, erro } = useRelatorio("entregas", { idTenant, dias })

  // Recharts precisa dos dados na ordem em que serao desenhados.
  const funil = useMemo(
    () => (dados ? dados.funil.etapas.map((e) => ({ ...e, nome: e.rotulo })) : []),
    [dados]
  )

  const semanal = useMemo(
    () =>
      dados
        ? dados.semanal.map((s) => ({
            semana: dataCurta(s.semana),
            Enviadas: s.enviadas,
            Avaliadas: s.avaliadas,
          }))
        : [],
    [dados]
  )

  return (
    <EstadoRelatorio
      carregando={carregando}
      erro={erro}
      vazio={dados && dados.funil.total === 0}
      mensagemVazio="Ainda não há trilha montada ou startups incubadas para medir entregas."
    >
      {dados && (
        <>
          <KpiRow
            itens={[
              {
                rotulo: "Entregas esperando avaliação",
                valor: dados.resumo.na_fila,
                cor: dados.resumo.na_fila > 0 ? STATUS.ATENCAO : undefined,
              },
              {
                rotulo: `Paradas há ${DIAS_FILA_CRITICA}+ dias`,
                valor: dados.resumo.fila_atrasada,
                cor: dados.resumo.fila_atrasada > 0 ? STATUS.CRITICO : undefined,
                icone:
                  dados.resumo.fila_atrasada > 0 ? <ErrorOutline fontSize="small" /> : undefined,
              },
              {
                rotulo: "Tempo médio até avaliar",
                valor: dados.resumo.tempo_resposta_medio_dias ?? "—",
                sufixo: dados.resumo.tempo_resposta_medio_dias != null ? " dias" : "",
                ajuda: "Do envio até a avaliação, ponderado pelo volume de cada mentor.",
              },
              { rotulo: `Enviadas nos últimos ${dias} dias`, valor: dados.resumo.enviadas_periodo },
              {
                rotulo: `Avaliadas nos últimos ${dias} dias`,
                valor: dados.resumo.avaliadas_periodo,
              },
              {
                rotulo: "Taxa de aprovação",
                valor: dados.resumo.taxa_aprovacao_pct,
                sufixo: "%",
                ajuda: "Passos aprovados sobre os passos que já tiveram alguma entrega.",
              },
            ]}
          />

          <Grid container data-tour="relatorio-graficos" spacing={3} sx={{ mb: 3 }}>
            {/* Funil: etapas ordenadas, uma cor so em tons crescentes. A cor
                acompanha o avanco no funil; o rotulo e o numero estao sempre
                visiveis, entao nada depende de distinguir os tons. */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, height: "100%" }}>
                <Typography variant="h6" fontWeight={700}>
                  Onde estão as entregas
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Cada passo da trilha, para cada startup incubada — {dados.funil.total} no total.
                </Typography>

                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={funil}
                    layout="vertical"
                    margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid
                      horizontal={false}
                      stroke={viz.chrome.grade}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      type="number"
                      tick={{ fill: viz.chrome.rotulo, fontSize: 12 }}
                      axisLine={{ stroke: viz.chrome.eixo }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      width={140}
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
                      formatter={(valor, _nome, item) => [
                        `${valor} (${item.payload.pct}%)`,
                        "Passos",
                      ]}
                    />
                    <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} barSize={22} isAnimationActive={false}>
                      {funil.map((etapa, i) => (
                        <Cell key={etapa.chave} fill={viz.funil[i]} />
                      ))}
                      <LabelList
                        dataKey="quantidade"
                        position="right"
                        fill={theme.palette.text.secondary}
                        fontSize={12}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            {/* Ritmo: duas series na mesma unidade (entregas), um eixo so.
                Se a linha de avaliadas fica abaixo da de enviadas por varias
                semanas seguidas, a fila esta crescendo. */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, height: "100%" }}>
                <Typography variant="h6" fontWeight={700}>
                  Ritmo semanal
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Envios das startups contra avaliações dos mentores.
                </Typography>

                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={semanal} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} stroke={viz.chrome.grade} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="semana"
                      tick={{ fill: viz.chrome.rotulo, fontSize: 12 }}
                      axisLine={{ stroke: viz.chrome.eixo }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: viz.chrome.rotulo, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: theme.palette.background.paper,
                        border: `1px solid ${viz.chrome.eixo}`,
                        borderRadius: 4,
                        color: theme.palette.text.primary,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: theme.palette.text.secondary }} />
                    <Line
                      type="monotone"
                      dataKey="Enviadas"
                      stroke={viz.series[0]}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, stroke: viz.superficie }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Avaliadas"
                      stroke={viz.series[1]}
                      strokeWidth={2}
                      dot={{ r: 4, strokeWidth: 2, stroke: viz.superficie }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Fila de avaliação
            </Typography>
            <BotaoExportar
              onClick={() => baixarCsv("fila-avaliacao", COLUNAS_FILA_CSV, dados.fila)}
              rotulo="Exportar fila"
              desabilitado={dados.fila.length === 0}
            />
          </Box>

          <Box sx={{ mb: 4 }}>
            <TabelaRelatorio
              chaveId="id_entrega"
              chaveStorage="relatorio-entregas-fila"
              linhas={dados.fila}
              ordemInicial="dias_parada"
              onClickLinha={(l) => navigate(`/startups/${l.startup_uuid}`)}
              mensagemVazio="Nenhuma entrega esperando avaliação. A fila está zerada."
              colunas={[
                { chave: "startup", rotulo: "Startup" },
                { chave: "passo", rotulo: "Passo" },
                {
                  chave: "dias_parada",
                  rotulo: "Parada há",
                  alinhamento: "right",
                  render: (l) => (
                    <Typography
                      variant="body2"
                      fontWeight={l.dias_parada >= DIAS_FILA_CRITICA ? 700 : 400}
                      sx={{
                        fontVariantNumeric: "tabular-nums",
                        color: l.dias_parada >= DIAS_FILA_CRITICA ? STATUS.CRITICO : "inherit",
                      }}
                    >
                      {l.dias_parada}d
                    </Typography>
                  ),
                },
                {
                  chave: "enviada_ts",
                  rotulo: "Enviada em",
                  render: (l) => new Date(l.enviada_ts).toLocaleDateString("pt-BR"),
                },
                {
                  chave: "mentores",
                  rotulo: "Mentor responsável",
                  render: (l) =>
                    l.mentores.length ? (
                      l.mentores.join(", ")
                    ) : (
                      <Chip
                        size="small"
                        icon={<WarningAmber sx={{ fontSize: 16 }} />}
                        label="Sem mentor"
                        variant="outlined"
                        sx={{
                          borderColor: STATUS.ATENCAO,
                          color: STATUS.ATENCAO,
                          "& .MuiChip-icon": { color: STATUS.ATENCAO },
                        }}
                      />
                    ),
                },
              ]}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Desempenho dos mentores
            </Typography>
            <BotaoExportar
              onClick={() => baixarCsv("desempenho-mentores", COLUNAS_MENTORES_CSV, dados.mentores)}
              rotulo="Exportar mentores"
              desabilitado={dados.mentores.length === 0}
            />
          </Box>

          <TabelaRelatorio
            chaveId="id_usuario"
            chaveStorage="relatorio-entregas-mentores"
            linhas={dados.mentores}
            ordemInicial="avaliacoes"
            mensagemVazio="Nenhuma avaliação registrada no período."
            colunas={[
              { chave: "mentor", rotulo: "Mentor" },
              { chave: "avaliacoes", rotulo: "Avaliações", alinhamento: "right" },
              {
                chave: "dias_resposta_media",
                rotulo: "Responde em",
                alinhamento: "right",
                render: (l) =>
                  l.dias_resposta_media == null ? "—" : `${l.dias_resposta_media}d`,
              },
              {
                chave: "taxa_aprovacao_pct",
                rotulo: "Aprovação",
                alinhamento: "right",
                render: (l) => `${l.taxa_aprovacao_pct}%`,
              },
              { chave: "ajustes", rotulo: "Pediu ajuste", alinhamento: "right" },
              {
                chave: "nota_media",
                rotulo: "Nota média",
                alinhamento: "right",
                render: (l) => (l.nota_media == null ? "—" : l.nota_media.toFixed(1)),
              },
              { chave: "startups_atendidas", rotulo: "Startups", alinhamento: "right" },
            ]}
          />
        </>
      )}
    </EstadoRelatorio>
  )
}
