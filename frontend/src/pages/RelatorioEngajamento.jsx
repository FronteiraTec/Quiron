/**
 * Relatorio "Engajamento e eventos".
 *
 * Presenca e o sinal mais barato de que uma startup ainda esta no programa de
 * fato. Duas leituras: por evento (o que atrai gente e o que esvazia) e por
 * startup (quem sumiu). So entram eventos JA REALIZADOS — um evento futuro
 * teria presenca zero e afundaria toda media.
 *
 * Nao ha grafico: as duas perguntas sao "quais eventos" e "quais startups", e
 * as duas se respondem ordenando a coluna de taxa. Um grafico de barras com
 * dezenas de eventos so repetiria a tabela em formato pior.
 *
 * Endpoint: GET /relatorios/engajamento?id_tenant=&dias=
 */
import { useNavigate } from "react-router-dom"
import { Box, Chip, Typography } from "@mui/material"
import { Groups, WarningAmber, ErrorOutline } from "@mui/icons-material"

import RelatorioShell, { EstadoRelatorio } from "../components/relatorios/RelatorioShell"
import KpiRow from "../components/relatorios/KpiRow"
import TabelaRelatorio from "../components/relatorios/TabelaRelatorio"
import BotaoExportar from "../components/relatorios/BotaoExportar"
import { useRelatorio } from "../hooks/useRelatorio"
import { STATUS } from "../components/relatorios/vizPalette"
import { baixarCsv } from "../utils/csv"

// Abaixo disso a sala esteve mais vazia que cheia — o corte em que vale
// revisar formato, horario ou publico do evento.
const PRESENCA_BAIXA_PCT = 50

const COLUNAS_EVENTOS_CSV = [
  { chave: "titulo", rotulo: "Evento" },
  { chave: "categoria", rotulo: "Categoria" },
  { chave: "inicio_ts", rotulo: "Data" },
  { chave: "local", rotulo: "Local" },
  { chave: "obrigatorio", rotulo: "Obrigatorio" },
  { chave: "publico", rotulo: "Publico convidado" },
  { chave: "confirmados", rotulo: "Confirmaram" },
  { chave: "presentes", rotulo: "Compareceram" },
  { chave: "taxa_presenca_pct", rotulo: "Presenca (%)" },
  { chave: "taxa_confirmacao_pct", rotulo: "Confirmacao (%)" },
  { chave: "faltaram_confirmados", rotulo: "Confirmaram e faltaram" },
]

const COLUNAS_STARTUPS_CSV = [
  { chave: "startup", rotulo: "Startup" },
  { chave: "eventos_convidada", rotulo: "Eventos convidada" },
  { chave: "eventos_presente", rotulo: "Eventos presente" },
  { chave: "faltas", rotulo: "Faltas" },
  { chave: "faltas_obrigatorias", rotulo: "Faltas em obrigatorios" },
  { chave: "taxa_presenca_pct", rotulo: "Presenca (%)" },
  { chave: "dias_sem_presenca", rotulo: "Dias sem aparecer" },
]

/** Taxa com a cor do estado; o numero e o rotulo carregam o significado. */
function Taxa({ valor, alerta = PRESENCA_BAIXA_PCT }) {
  const ruim = valor < alerta
  return (
    <Typography
      variant="body2"
      fontWeight={ruim ? 700 : 400}
      sx={{ fontVariantNumeric: "tabular-nums", color: ruim ? STATUS.CRITICO : "inherit" }}
    >
      {valor}%
    </Typography>
  )
}

export default function RelatorioEngajamento() {
  return (
    <RelatorioShell
      titulo="Engajamento e eventos"
      descricao="Quem aparece nos eventos da incubadora, quais encontros esvaziam e quais startups pararam de participar."
      icone={<Groups />}
      periodo
    >
      {({ idTenant, dias }) => <Conteudo idTenant={idTenant} dias={dias} />}
    </RelatorioShell>
  )
}

function Conteudo({ idTenant, dias }) {
  const navigate = useNavigate()
  const { dados, carregando, erro } = useRelatorio("engajamento", { idTenant, dias })

  return (
    <EstadoRelatorio
      carregando={carregando}
      erro={erro}
      vazio={dados && dados.eventos.length === 0}
      mensagemVazio={`Nenhum evento realizado nos ultimos ${dias} dias.`}
    >
      {dados && (
        <>
          <KpiRow
            itens={[
              { rotulo: `Eventos realizados em ${dias} dias`, valor: dados.resumo.eventos_realizados },
              {
                rotulo: "Presenca media",
                valor: dados.resumo.presenca_media_pct,
                sufixo: "%",
                cor:
                  dados.resumo.presenca_media_pct < PRESENCA_BAIXA_PCT ? STATUS.ATENCAO : undefined,
                ajuda: "Pessoas presentes sobre o publico convidado, somando todos os eventos.",
              },
              {
                rotulo: "Dos que confirmaram, compareceram",
                valor: dados.resumo.comparecimento_pct,
                sufixo: "%",
                ajuda: "Mede o quanto a lista de confirmados serve para planejar o evento.",
              },
              {
                rotulo: "Startups que nao apareceram em nada",
                valor: dados.resumo.startups_desengajadas,
                cor: dados.resumo.startups_desengajadas > 0 ? STATUS.CRITICO : undefined,
                icone:
                  dados.resumo.startups_desengajadas > 0 ? (
                    <ErrorOutline fontSize="small" />
                  ) : undefined,
              },
              {
                rotulo: "Faltas em eventos obrigatorios",
                valor: dados.resumo.faltas_obrigatorias,
                cor: dados.resumo.faltas_obrigatorias > 0 ? STATUS.ATENCAO : undefined,
              },
            ]}
          />

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Por evento
            </Typography>
            <BotaoExportar
              onClick={() => baixarCsv("engajamento-eventos", COLUNAS_EVENTOS_CSV, dados.eventos)}
              rotulo="Exportar eventos"
            />
          </Box>

          <Box sx={{ mb: 4 }}>
            <TabelaRelatorio
              chaveId="id_evento"
              linhas={dados.eventos}
              ordemInicial="inicio_ts"
              colunas={[
                {
                  chave: "titulo",
                  rotulo: "Evento",
                  render: (l) => (
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {l.titulo}
                        {l.obrigatorio && (
                          <Chip
                            size="small"
                            label="obrigatorio"
                            sx={{ ml: 1, height: 18, fontSize: 11 }}
                          />
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {l.categoria}
                        {l.local ? ` · ${l.local}` : ""}
                      </Typography>
                    </Box>
                  ),
                },
                {
                  chave: "inicio_ts",
                  rotulo: "Data",
                  render: (l) => new Date(l.inicio_ts).toLocaleDateString("pt-BR"),
                },
                { chave: "publico", rotulo: "Convidados", alinhamento: "right" },
                { chave: "confirmados", rotulo: "Confirmaram", alinhamento: "right" },
                { chave: "presentes", rotulo: "Compareceram", alinhamento: "right" },
                {
                  chave: "taxa_presenca_pct",
                  rotulo: "Presenca",
                  alinhamento: "right",
                  render: (l) => <Taxa valor={l.taxa_presenca_pct} />,
                },
                {
                  chave: "faltaram_confirmados",
                  rotulo: "Confirmou e faltou",
                  alinhamento: "right",
                  render: (l) => (l.faltaram_confirmados > 0 ? l.faltaram_confirmados : "—"),
                },
              ]}
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              Por startup
            </Typography>
            <BotaoExportar
              onClick={() => baixarCsv("engajamento-startups", COLUNAS_STARTUPS_CSV, dados.startups)}
              rotulo="Exportar startups"
            />
          </Box>

          <TabelaRelatorio
            chaveId="id_startup"
            linhas={dados.startups}
            ordemInicial="taxa_presenca_pct"
            direcaoInicial="asc"
            onClickLinha={(l) => navigate(`/startups/${l.id_startup}`)}
            mensagemVazio="Nenhuma startup foi convidada a eventos no periodo."
            colunas={[
              { chave: "startup", rotulo: "Startup" },
              {
                chave: "eventos_presente",
                rotulo: "Compareceu",
                alinhamento: "right",
                render: (l) => `${l.eventos_presente}/${l.eventos_convidada}`,
              },
              {
                chave: "taxa_presenca_pct",
                rotulo: "Presenca",
                alinhamento: "right",
                render: (l) => <Taxa valor={l.taxa_presenca_pct} />,
              },
              {
                chave: "faltas_obrigatorias",
                rotulo: "Faltou em obrigatorio",
                alinhamento: "right",
                render: (l) =>
                  l.faltas_obrigatorias > 0 ? (
                    <Chip
                      size="small"
                      icon={<WarningAmber sx={{ fontSize: 16 }} />}
                      label={l.faltas_obrigatorias}
                      variant="outlined"
                      sx={{
                        borderColor: STATUS.ATENCAO,
                        color: STATUS.ATENCAO,
                        "& .MuiChip-icon": { color: STATUS.ATENCAO },
                      }}
                    />
                  ) : (
                    "—"
                  ),
              },
              {
                chave: "dias_sem_presenca",
                rotulo: "Sem aparecer ha",
                alinhamento: "right",
                render: (l) => (l.dias_sem_presenca == null ? "nunca veio" : `${l.dias_sem_presenca}d`),
              },
              {
                chave: "desengajada",
                rotulo: "Situacao",
                render: (l) =>
                  l.desengajada ? (
                    <Chip
                      size="small"
                      icon={<ErrorOutline sx={{ fontSize: 16 }} />}
                      label="Desengajada"
                      variant="outlined"
                      sx={{
                        borderColor: STATUS.CRITICO,
                        color: STATUS.CRITICO,
                        "& .MuiChip-icon": { color: STATUS.CRITICO },
                      }}
                    />
                  ) : (
                    <Chip size="small" label="Participando" variant="outlined" />
                  ),
              },
            ]}
          />
        </>
      )}
    </EstadoRelatorio>
  )
}
