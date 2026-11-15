/**
 * O faturamento da startup no cadastro dela, para a incubadora.
 *
 * Vem do Mini CRM, e SO em soma: o valor efetivamente vendido nas oportunidades
 * que a startup marcou como ganhas, pela data de fechamento. Nenhum cliente nem
 * negociacao chega aqui (GET /startups/:id/faturamento).
 *
 * Quatro numeros (12 meses, ano, desde o inicio, ticket medio) e os 12 meses
 * em barras. Uma serie so, de uma cor so: o titulo diz o que e, e cada barra
 * diz o mes e o valor ao passar o mouse ou focar com o teclado. A barra usa a
 * cor de TEXTO do tema (primary.main), e nao o preenchimento vivo: lima sobre
 * branco tem 1,6:1, e uma barra que nao se ve nao compara nada.
 *
 * Startup sem CRM ve uma frase, nao zeros: zero pareceria "nao vendeu nada".
 */
import { useEffect, useState } from "react"
import { Alert, Box, Skeleton, Tooltip, Typography } from "@mui/material"
import api from "../../services/api"

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const moedaCurta = (v) =>
  Math.abs(Number(v || 0)) < 10000
    ? moeda(v)
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 })
const dataBR = (d) => (d ? d.split("-").reverse().join("/") : "")

export default function FaturamentoStartup({ idStartup }) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [semAcesso, setSemAcesso] = useState(false)

  useEffect(() => {
    let vivo = true
    setDados(null)
    setErro(null)
    api
      .get(`/startups/${idStartup}/faturamento`)
      .then(({ data }) => vivo && setDados(data))
      .catch((err) => {
        if (!vivo) return
        if (err.response?.status === 403) setSemAcesso(true)
        else setErro(err.response?.data?.erro || "Não foi possível carregar o faturamento.")
      })
    return () => {
      vivo = false
    }
  }, [idStartup])

  // Sem a chave, a secao nem aparece: o menu de permissoes ja disse que nao.
  if (semAcesso) return null
  if (erro) return <Alert severity="error">{erro}</Alert>
  if (!dados) {
    return (
      <Box aria-busy="true" aria-label="Carregando o faturamento">
        <Skeleton variant="rounded" height={84} sx={{ mb: 1.5 }} />
        <Skeleton variant="rounded" height={140} />
      </Box>
    )
  }

  if (!dados.usa_crm) {
    return (
      <Typography variant="body2" color="text.secondary">
        Esta startup não usa o Mini CRM. Quando a incubadora conceder o benefício e a startup registrar vendas, o
        faturamento aparece aqui.
      </Typography>
    )
  }

  const { resumo, meses } = dados
  const blocos = [
    { rotulo: "Últimos 12 meses", valor: resumo.ultimos_12_meses, detalhe: `${resumo.vendas_12_meses} venda${resumo.vendas_12_meses === 1 ? "" : "s"}` },
    { rotulo: `Em ${dados.hoje.slice(0, 4)}`, valor: resumo.ano_atual },
    { rotulo: "Desde o início", valor: resumo.total, detalhe: resumo.primeira_venda ? `desde ${dataBR(resumo.primeira_venda)}` : null },
    { rotulo: "Ticket médio", valor: resumo.ticket_medio, detalhe: `${resumo.vendas} venda${resumo.vendas === 1 ? "" : "s"} no total` },
  ]

  return (
    <Box>
      {!dados.crm_ativo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          O Mini CRM desta startup está revogado: os números mostram o que ela registrou até a revogação.
        </Alert>
      )}

      <Box
        role="list"
        aria-label="Faturamento por período"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
          gap: "1px",
          bgcolor: "divider",
          border: 1,
          borderColor: "divider",
          mb: 2,
        }}
      >
        {blocos.map((b) => (
          <Box role="listitem" key={b.rotulo} sx={{ bgcolor: "background.paper", px: 2, py: 1.5 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block" }}>
              {b.rotulo}
            </Typography>
            <Tooltip title={b.valor === null ? "" : moeda(b.valor)}>
              <Typography variant="h5" component="span" sx={{ display: "block", lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>
                {b.valor === null ? "—" : moedaCurta(b.valor)}
              </Typography>
            </Tooltip>
            {b.detalhe && (
              <Typography variant="caption" color="text.secondary">
                {b.detalhe}
              </Typography>
            )}
          </Box>
        ))}
      </Box>

      {resumo.vendas === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhuma venda registrada no CRM ainda.
        </Typography>
      ) : (
        <GraficoMeses meses={meses} />
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        Soma das vendas que a própria startup marcou como ganhas no Mini CRM (valor vendido, pela data de fechamento)
        {resumo.ultima_venda ? ` · última venda em ${dataBR(resumo.ultima_venda)}` : ""}. Não substitui o faturamento
        fiscal. Clientes e negociações não são compartilhados com a incubadora.
      </Typography>
    </Box>
  )
}

/** As 12 barras mensais. A maior leva o valor escrito; as outras, no tooltip. */
function GraficoMeses({ meses }) {
  const maior = Math.max(...meses.map((m) => m.valor))
  const indiceMaior = meses.findIndex((m) => m.valor === maior)

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        Vendas por mês
      </Typography>
      <Box
        role="list"
        aria-label="Vendas por mês nos últimos 12 meses"
        sx={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: { xs: "3px", sm: "6px" }, alignItems: "end" }}
      >
        {meses.map((m, i) => {
          const [ano, mes] = m.mes.split("-").map(Number)
          const rotulo = `${MESES_LONGOS[mes - 1]} de ${ano}: ${moeda(m.valor)} · ${m.vendas} venda${m.vendas === 1 ? "" : "s"}`
          const altura = maior > 0 ? (m.valor / maior) * 100 : 0
          const mostrarAno = i === 0 || mes === 1
          return (
            <Tooltip key={m.mes} title={rotulo} placement="top">
              {/* A coluna inteira e o alvo do mouse e do teclado, nao so a barra. */}
              <Box
                role="listitem"
                tabIndex={0}
                aria-label={rotulo}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  minWidth: 0,
                  outline: "none",
                  borderRadius: 0.5,
                  "&:hover .barra, &:focus-visible .barra": { opacity: 0.8 },
                  "&:focus-visible": { boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}` },
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: "center", minHeight: 18, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "visible" }}
                >
                  {i === indiceMaior && m.valor > 0 ? moedaCurta(m.valor) : ""}
                </Typography>
                <Box sx={{ height: 120, display: "flex", alignItems: "flex-end", borderBottom: 1, borderColor: "divider" }}>
                  <Box
                    className="barra"
                    sx={{
                      width: "100%",
                      height: `${altura}%`,
                      minHeight: m.valor > 0 ? 3 : 0,
                      bgcolor: "primary.main",
                      borderRadius: "4px 4px 0 0",
                      transition: "opacity .15s",
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", lineHeight: 1.3, mt: 0.5 }}>
                  {MESES[mes - 1]}
                  {mostrarAno && (
                    <Box component="span" sx={{ display: "block", fontSize: 10 }}>
                      {ano}
                    </Box>
                  )}
                </Typography>
              </Box>
            </Tooltip>
          )
        })}
      </Box>
    </Box>
  )
}
