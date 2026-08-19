/**
 * Relatorio "Progresso das startups".
 *
 * Responde a pergunta que o gestor da incubadora faz toda semana: quem esta
 * avancando, quem travou e por que. Uma linha por startup incubada, ordenavel
 * por qualquer coluna — a mesma tabela serve para achar o atraso e para
 * montar o ranking de quem esta indo bem.
 *
 * Nao ha grafico aqui de proposito: a comparacao e linha a linha entre dezenas
 * de startups, e a barra dentro da propria linha ja e a leitura visual. Um
 * grafico separado exigiria procurar a startup duas vezes.
 *
 * Endpoint: GET /relatorios/progresso?id_tenant=
 */
import { useNavigate } from "react-router-dom"
import { Box, Chip, LinearProgress, Tooltip, Typography } from "@mui/material"
import { Assessment, ErrorOutline, WarningAmber, CheckCircleOutline } from "@mui/icons-material"

import RelatorioShell, { EstadoRelatorio } from "../components/relatorios/RelatorioShell"
import KpiRow from "../components/relatorios/KpiRow"
import TabelaRelatorio from "../components/relatorios/TabelaRelatorio"
import BotaoExportar from "../components/relatorios/BotaoExportar"
import { useRelatorio } from "../hooks/useRelatorio"
import { STATUS, corRisco } from "../components/relatorios/vizPalette"
import { baixarCsv } from "../utils/csv"

// Icone + rotulo acompanham a cor: o risco nunca e comunicado so pelo tom.
const RISCO = {
  ALTO: { rotulo: "Alto", icone: <ErrorOutline sx={{ fontSize: 16 }} /> },
  MEDIO: { rotulo: "Atenção", icone: <WarningAmber sx={{ fontSize: 16 }} /> },
  OK: { rotulo: "Em dia", icone: <CheckCircleOutline sx={{ fontSize: 16 }} /> },
}

const COLUNAS_CSV = [
  { chave: "startup", rotulo: "Startup" },
  { chave: "fase_atual", rotulo: "Fase atual" },
  { chave: "progresso_pct", rotulo: "Progresso (%)" },
  { chave: "aprovados", rotulo: "Passos aprovados" },
  { chave: "total_passos", rotulo: "Passos no programa" },
  { chave: "em_andamento", rotulo: "Em andamento" },
  { chave: "nao_iniciados", rotulo: "Não iniciados" },
  { chave: "atrasados", rotulo: "Com prazo vencido" },
  { chave: "dias_sem_atividade", rotulo: "Dias sem atividade" },
  { chave: "risco", rotulo: "Risco" },
  { chave: "motivos_risco", rotulo: "Motivos" },
  { chave: "mentores", rotulo: "Mentores" },
  { chave: "membros", rotulo: "Membros" },
]

export default function RelatorioProgresso() {
  return (
    <RelatorioShell
      titulo="Progresso das startups"
      descricao="Quanto cada startup já concluiu da trilha, o que está em curso e quem parou de avançar."
      icone={<Assessment />}
    >
      {({ idTenant }) => <Conteudo idTenant={idTenant} />}
    </RelatorioShell>
  )
}

function Conteudo({ idTenant }) {
  const navigate = useNavigate()
  const { dados, carregando, erro } = useRelatorio("progresso", { idTenant })

  const exportar = () =>
    baixarCsv("progresso-startups", COLUNAS_CSV, dados?.startups ?? [])

  return (
    <EstadoRelatorio
      carregando={carregando}
      erro={erro}
      vazio={dados && dados.startups.length === 0}
      mensagemVazio="Nenhuma startup incubada nesta incubadora ainda."
    >
      {dados && (
        <>
          <KpiRow
            itens={[
              { rotulo: "Startups incubadas", valor: dados.resumo.startups },
              {
                rotulo: "Progresso médio da trilha",
                valor: dados.resumo.progresso_medio_pct,
                sufixo: "%",
                ajuda: "Passos aprovados sobre o total de passos ativos, somando todas as startups.",
              },
              {
                rotulo: "Startups em risco alto",
                valor: dados.resumo.em_risco,
                cor: dados.resumo.em_risco > 0 ? STATUS.CRITICO : undefined,
                icone: dados.resumo.em_risco > 0 ? <ErrorOutline fontSize="small" /> : undefined,
                ajuda: "Tem prazo vencido E está sem atividade.",
              },
              {
                rotulo: `Paradas há ${dados.resumo.dias_inativa}+ dias`,
                valor: dados.resumo.paradas,
                cor: dados.resumo.paradas > 0 ? STATUS.ATENCAO : undefined,
                icone: dados.resumo.paradas > 0 ? <WarningAmber fontSize="small" /> : undefined,
              },
              {
                rotulo: "Com passo em atraso",
                valor: dados.resumo.com_atraso,
                cor: dados.resumo.com_atraso > 0 ? STATUS.ATENCAO : undefined,
              },
            ]}
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <BotaoExportar onClick={exportar} rotulo="Exportar startups" />
          </Box>

          <TabelaRelatorio
            chaveId="id_startup"
            chaveStorage="relatorio-progresso-startups"
            linhas={dados.startups}
            ordemInicial="progresso_pct"
            direcaoInicial="asc"
            onClickLinha={(l) => navigate(`/startups/${l.id_startup}`)}
            colunas={[
              {
                chave: "startup",
                rotulo: "Startup",
                render: (l) => (
                  <Box>
                    <Typography variant="body2" fontWeight={600}>
                      {l.startup}
                    </Typography>
                    {l.mentores.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {l.mentores.join(", ")}
                      </Typography>
                    )}
                  </Box>
                ),
              },
              {
                chave: "fase_atual",
                rotulo: "Fase atual",
                render: (l) => l.fase_atual || "Trilha concluída",
              },
              {
                chave: "progresso_pct",
                rotulo: "Progresso",
                alinhamento: "right",
                render: (l) => (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 150 }}>
                    <LinearProgress
                      variant="determinate"
                      value={l.progresso_pct}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ width: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                    >
                      {l.progresso_pct}%
                    </Typography>
                  </Box>
                ),
              },
              {
                chave: "aprovados",
                rotulo: "Aprovados",
                alinhamento: "right",
                render: (l) => `${l.aprovados}/${l.total_passos}`,
              },
              {
                chave: "em_andamento",
                rotulo: "Em andamento",
                alinhamento: "right",
                ajuda: "Rascunho, aguardando avaliação ou em ajuste.",
              },
              {
                chave: "atrasados",
                rotulo: "Atrasados",
                alinhamento: "right",
                render: (l) =>
                  l.atrasados > 0 ? (
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      sx={{ color: STATUS.CRITICO, fontVariantNumeric: "tabular-nums" }}
                    >
                      {l.atrasados}
                    </Typography>
                  ) : (
                    "—"
                  ),
              },
              {
                chave: "dias_sem_atividade",
                rotulo: "Sem atividade",
                alinhamento: "right",
                render: (l) =>
                  l.dias_sem_atividade == null ? "nunca enviou" : `${l.dias_sem_atividade}d`,
              },
              {
                chave: "risco",
                rotulo: "Risco",
                render: (l) => (
                  <Tooltip title={l.motivos_risco.join(" · ") || "Sem sinais de alerta."}>
                    <Chip
                      size="small"
                      icon={RISCO[l.risco].icone}
                      label={RISCO[l.risco].rotulo}
                      variant="outlined"
                      sx={{
                        borderColor: corRisco(l.risco),
                        color: corRisco(l.risco),
                        "& .MuiChip-icon": { color: corRisco(l.risco) },
                      }}
                    />
                  </Tooltip>
                ),
              },
            ]}
          />
        </>
      )}
    </EstadoRelatorio>
  )
}
