/**
 * Tela inicial (Home / Dashboard).
 *
 * Usa o AppLayout (Navbar + Sidebar) e exibe uma saudacao, a agenda da semana
 * e os numeros de destaque do programa.
 *
 * Os numeros vem dos mesmos endpoints das telas de relatorio, e nao de um
 * /dashboard proprio: sao exatamente os campos `resumo` que aqueles relatorios
 * ja calculam. Um endpoint so para esta tela criaria uma segunda fonte para o
 * mesmo numero — e duas fontes divergem no dia em que uma das duas mudar.
 *
 * Cada relatorio exige a SUA chave RBAC. Quem nao tem a chave nao pede o
 * relatorio e simplesmente nao ve aqueles cards: esta e a tela que TODO usuario
 * abre primeiro, e disparar aqui uma chamada que responde 403 seria transformar
 * a home de metade dos papeis numa tela de erro.
 */
import { Box, Paper, Typography, CircularProgress } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { ErrorOutline, WarningAmber } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import AgendaSemana from "../components/dashboard/AgendaSemana"
import KpiRow from "../components/relatorios/KpiRow"
import { STATUS } from "../components/relatorios/vizPalette"
import { useRelatorio } from "../hooks/useRelatorio"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"

// Enquanto o relatorio nao chegou — ou falhou — o card mostra um travessao em
// vez de zero. Zero e um dado: "nenhuma startup em risco" e uma boa noticia, e
// nao pode ser confundido com "ainda nao sei".
const VAZIO = "—"

/** Valor do card, ou o travessao enquanto nao ha resposta. */
const kpi = (n) => (n == null ? VAZIO : n)

export default function Dashboard() {
  const usuario = useAuthStore((s) => s.usuario)
  const chaves = usePermissaoStore((s) => s.chaves)
  const pode = usePermissaoStore((s) => s.pode)

  const idTenant = usuario?.id_tenant ?? null

  // Ao contrario do menu — que aparece inteiro e encolhe —, aqui esperamos as
  // chaves chegarem (`chaves !== null`) antes de decidir. O menu erra para o
  // lado de mostrar demais porque o custo e visual; aqui o custo seria uma
  // requisicao que ja nasce 403.
  //
  // A MESMA condicao escolhe o card e dispara (ou nao) a chamada: sem isso
  // existiriam duas regras para a mesma pergunta, e um card apareceria sem
  // ninguem ter pedido o dado dele.
  const veProgresso = chaves !== null && pode("relatorios.progresso.visualizar")
  const veEntregas = chaves !== null && pode("relatorios.entregas.visualizar")
  const veEngajamento = chaves !== null && pode("relatorios.engajamento.visualizar")

  // Os tres relatorios sao pedidos em paralelo e cada card se vira sozinho: um
  // que falhe ou demore nao segura os outros.
  const progresso = useRelatorio("progresso", { idTenant: veProgresso ? idTenant : null })
  const entregas = useRelatorio("entregas", { idTenant: veEntregas ? idTenant : null })
  const engajamento = useRelatorio("engajamento", { idTenant: veEngajamento ? idTenant : null })

  // A lista sai da PERMISSAO, nao da resposta: assim que sabemos quais cards o
  // usuario tem, eles ja ocupam o lugar deles com um travessao e depois so
  // trocam de numero. Montar a partir de `dados` faria a linha inteira nascer
  // vazia e empurrar a pagina quando cada relatorio chegasse.
  const rProgresso = progresso.dados?.resumo
  const rEntregas = entregas.dados?.resumo
  const rEngajamento = engajamento.dados?.resumo

  const itens = []

  if (veProgresso) {
    itens.push(
      { rotulo: "Startups incubadas", valor: kpi(rProgresso?.startups) },
      {
        rotulo: "Progresso médio da trilha",
        valor: kpi(rProgresso?.progresso_medio_pct),
        sufixo: rProgresso ? "%" : undefined,
        ajuda: "Passos aprovados sobre o total de passos ativos, somando todas as startups.",
      },
      {
        rotulo: "Startups em risco alto",
        valor: kpi(rProgresso?.em_risco),
        cor: rProgresso?.em_risco > 0 ? STATUS.CRITICO : undefined,
        icone: rProgresso?.em_risco > 0 ? <ErrorOutline fontSize="small" /> : undefined,
        ajuda: "Tem prazo vencido E está sem atividade.",
      }
    )
  }

  if (veEntregas) {
    itens.push({
      rotulo: "Entregas aguardando avaliação",
      valor: kpi(rEntregas?.na_fila),
      cor: rEntregas?.fila_atrasada > 0 ? STATUS.ATENCAO : undefined,
      icone: rEntregas?.fila_atrasada > 0 ? <WarningAmber fontSize="small" /> : undefined,
      ajuda:
        rEntregas?.fila_atrasada > 0
          ? `${rEntregas.fila_atrasada} parada(s) há 7 dias ou mais.`
          : undefined,
    })
  }

  if (veEngajamento) {
    itens.push({
      rotulo: "Presença média nos eventos",
      valor: kpi(rEngajamento?.presenca_media_pct),
      sufixo: rEngajamento ? "%" : undefined,
      ajuda: rEngajamento
        ? `Eventos já realizados nos últimos ${engajamento.dados.dias} dias.`
        : undefined,
    })
  }

  return (
    <AppLayout>
      {!usuario ? (
        <Box sx={{ textAlign: "center", mt: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box>
          {/* Saudacao: a "capa" da tela inicial, preta nas duas aparencias,
              com o brilho e a faixa do modelo de apresentacao na cor
              escolhida (o preenchimento vivo: lima no padrao). */}
          <Paper
            sx={{
              position: "relative",
              overflow: "hidden",
              p: 4,
              borderRadius: 0,
              mb: 3,
              bgcolor: "marca.preto",
              color: "marca.branco",
              backgroundImage: (t) =>
                `radial-gradient(420px 260px at 100% 0%, ${alpha(t.palette.primary.vivo, 0.3)}, transparent 70%)`,
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                right: -60,
                bottom: 26,
                width: { xs: 180, md: 320 },
                height: 12,
                bgcolor: "primary.vivo",
                transform: "rotate(-12deg)",
              }}
            />
            <Typography variant="h4" gutterBottom sx={{ position: "relative" }}>
              Bem-vindo(a){usuario?.nome ? `, ${usuario.nome}` : ""}!
            </Typography>
            <Typography sx={{ position: "relative", color: (t) => alpha(t.palette.marca.branco, 0.72) }}>
              Este é o painel inicial do Quiron.
              {usuario?.email && ` Você está logado como ${usuario.email}.`}
            </Typography>
          </Paper>

          {/* Agenda: eventos de hoje ate o fim da semana (visibilidade por papel) */}
          <Box data-tour="dashboard-agenda" sx={{ mb: 3 }}>
            <AgendaSemana idTenant={usuario?.id_tenant} />
          </Box>

          {/* Numeros de destaque. Sem nenhum relatorio liberado a linha inteira
              some — um usuario ve a agenda dele e nada de cards vazios. */}
          {itens.length > 0 && (
            <Box data-tour="dashboard-kpis">
              <KpiRow itens={itens} />
            </Box>
          )}
        </Box>
      )}
    </AppLayout>
  )
}
