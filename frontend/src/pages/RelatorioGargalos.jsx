/**
 * Relatorio "Gargalos do programa".
 *
 * Vira a lente do relatorio de progresso: em vez de perguntar quais startups
 * travaram, pergunta quais PASSOS travam startups. E o relatorio que muda o
 * desenho da trilha — se metade das incubadas empaca no mesmo passo, o
 * problema quase nunca e das startups.
 *
 * Endpoint: GET /relatorios/gargalos?id_tenant=
 */
import { useMemo } from "react"
import { Box, Chip, Paper, Typography, useTheme } from "@mui/material"
import { Timeline, ErrorOutline } from "@mui/icons-material"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
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

const COLUNAS_CSV = [
  { chave: "fase", rotulo: "Fase" },
  { chave: "modulo", rotulo: "Módulo" },
  { chave: "passo", rotulo: "Passo" },
  { chave: "startups", rotulo: "Startups no programa" },
  { chave: "iniciaram", rotulo: "Iniciaram" },
  { chave: "aprovados", rotulo: "Aprovados" },
  { chave: "aguardando", rotulo: "Aguardando avaliação" },
  { chave: "em_ajuste", rotulo: "Em ajuste" },
  { chave: "rascunho", rotulo: "Em rascunho" },
  { chave: "nao_iniciados", rotulo: "Não iniciados" },
  { chave: "atrasados", rotulo: "Com prazo vencido" },
  { chave: "taxa_aprovacao_pct", rotulo: "Taxa de aprovação (%)" },
  { chave: "dias_ate_aprovar", rotulo: "Dias até aprovar (média)" },
  { chave: "dias_na_fila", rotulo: "Dias na fila (média)" },
]

/** Encurta o nome do passo para caber no eixo do grafico. */
const encurtar = (texto, max = 34) =>
  texto.length > max ? `${texto.slice(0, max - 1)}…` : texto

export default function RelatorioGargalos() {
  return (
    <RelatorioShell
      titulo="Gargalos do programa"
      descricao="Quais passos da trilha seguram mais startups, quanto tempo levam para ser aprovados e onde os prazos estouram."
      icone={<Timeline />}
    >
      {({ idTenant }) => <Conteudo idTenant={idTenant} />}
    </RelatorioShell>
  )
}

function Conteudo({ idTenant }) {
  const theme = useTheme()
  const viz = useMemo(() => paletaViz(theme.palette.mode), [theme.palette.mode])

  const { dados, carregando, erro } = useRelatorio("gargalos", { idTenant })

  // Serie unica: so a quantidade de startups presas. Sem legenda, porque nao
  // ha o que distinguir — o nome do passo esta no eixo e o numero, na barra.
  const ranking = useMemo(
    () =>
      dados
        ? dados.ranking.map((p) => ({
            nome: encurtar(p.passo),
            passoCompleto: p.passo,
            fase: p.fase,
            presos: p.presos,
          }))
        : [],
    [dados]
  )

  return (
    <EstadoRelatorio
      carregando={carregando}
      erro={erro}
      vazio={dados && dados.passos.length === 0}
      mensagemVazio="A trilha ainda não tem passos ativos para analisar."
    >
      {dados && (
        <>
          <KpiRow
            itens={[
              { rotulo: "Passos ativos na trilha", valor: dados.resumo.passos_ativos },
              {
                rotulo: "Passos segurando alguma startup",
                valor: dados.resumo.passos_com_travamento,
                cor: dados.resumo.passos_com_travamento > 0 ? STATUS.ATENCAO : undefined,
              },
              {
                rotulo: "Startups presas em algum passo",
                valor: dados.resumo.startups_presas,
                ajuda: "Soma de startups em rascunho, aguardando avaliação ou em ajuste.",
              },
              {
                rotulo: "Passos com prazo vencido",
                valor: dados.resumo.passos_atrasados,
                cor: dados.resumo.passos_atrasados > 0 ? STATUS.CRITICO : undefined,
                icone:
                  dados.resumo.passos_atrasados > 0 ? <ErrorOutline fontSize="small" /> : undefined,
              },
              {
                rotulo: "Passo mais lento até aprovar",
                valor: dados.resumo.passo_mais_lento
                  ? `${dados.resumo.passo_mais_lento.dias}`
                  : "—",
                sufixo: dados.resumo.passo_mais_lento ? " dias" : "",
                ajuda: dados.resumo.passo_mais_lento?.passo,
              },
            ]}
          />

          {ranking.length > 0 && (
            <Paper data-tour="relatorio-graficos" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
              <Typography variant="h6" fontWeight={700}>
                Os passos que mais travam
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Quantas startups estão paradas em cada um — em rascunho, esperando avaliação ou
                refazendo após um pedido de ajuste.
              </Typography>

              <ResponsiveContainer width="100%" height={Math.max(200, ranking.length * 34)}>
                <BarChart
                  data={ranking}
                  layout="vertical"
                  margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
                >
                  <CartesianGrid horizontal={false} stroke={viz.chrome.grade} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: viz.chrome.rotulo, fontSize: 12 }}
                    axisLine={{ stroke: viz.chrome.eixo }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={230}
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
                    formatter={(valor) => [`${valor} startup(s) paradas`, ""]}
                    labelFormatter={(_rotulo, carga) =>
                      carga?.[0]?.payload
                        ? `${carga[0].payload.passoCompleto}${
                            carga[0].payload.fase ? ` · ${carga[0].payload.fase}` : ""
                          }`
                        : ""
                    }
                  />
                  <Bar
                    dataKey="presos"
                    fill={viz.funil[3]}
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="presos"
                      position="right"
                      fill={theme.palette.text.secondary}
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Todos os passos
            </Typography>
            <BotaoExportar
              onClick={() => baixarCsv("gargalos-programa", COLUNAS_CSV, dados.passos)}
              rotulo="Exportar passos"
            />
          </Box>

          <TabelaRelatorio
            chaveId="id_no"
            linhas={dados.passos}
            ordemInicial="presos"
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
                      {[l.fase, l.modulo].filter(Boolean).join(" · ") || "Sem fase"}
                    </Typography>
                  </Box>
                ),
              },
              {
                chave: "presos",
                rotulo: "Presas",
                alinhamento: "right",
                render: (l) =>
                  l.presos > 0 ? (
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {l.presos}
                    </Typography>
                  ) : (
                    "—"
                  ),
              },
              { chave: "aguardando", rotulo: "Aguardando", alinhamento: "right" },
              { chave: "em_ajuste", rotulo: "Em ajuste", alinhamento: "right" },
              {
                chave: "aprovados",
                rotulo: "Aprovados",
                alinhamento: "right",
                render: (l) => `${l.aprovados}/${l.startups}`,
              },
              {
                chave: "taxa_aprovacao_pct",
                rotulo: "Aprovação",
                alinhamento: "right",
                ajuda: "Sobre quem já começou o passo.",
                render: (l) => (l.iniciaram === 0 ? "—" : `${l.taxa_aprovacao_pct}%`),
              },
              {
                chave: "dias_ate_aprovar",
                rotulo: "Leva",
                alinhamento: "right",
                render: (l) => (l.dias_ate_aprovar == null ? "—" : `${l.dias_ate_aprovar}d`),
              },
              {
                chave: "atrasados",
                rotulo: "Atraso",
                alinhamento: "right",
                render: (l) =>
                  l.atrasados > 0 ? (
                    <Chip
                      size="small"
                      icon={<ErrorOutline sx={{ fontSize: 16 }} />}
                      label={l.atrasados}
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
            ]}
          />
        </>
      )}
    </EstadoRelatorio>
  )
}
