/**
 * O funil em kanban: uma coluna por etapa aberta, e no fim as duas colunas de
 * desfecho, Ganho e Perdido.
 *
 * GANHO E PERDIDO NAO SAO ETAPAS. Soltar um cartao nelas nao "move" nada: abre
 * o dialogo de encerramento, que pede o valor vendido ou o motivo da perda — o
 * mesmo que o botao da tela da oportunidade. As colunas mostram as encerradas
 * dos ultimos 30 dias, para o quadro nao virar arquivo; a lista mostra todas.
 * Cartao encerrado nao arrasta: reabrir e um ato deliberado, na tela dela.
 *
 * O cabecalho de cada coluna aberta traz quantas oportunidades ha nela e a
 * soma dos valores estimados.
 *
 * ARRASTO EM HTML5 PURO, como o quadro de tarefas: draggable + dataTransfer, sem
 * biblioteca. Para teclado e toque, o menu do cartao faz o mesmo.
 */
import { useState } from "react"
import { Box, IconButton, Skeleton, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Add } from "@mui/icons-material"
import CartaoOportunidade from "./CartaoOportunidade"
import { moedaCurta } from "../../data/crmMeta"

const DIAS_ENCERRADAS = 30

function encerradaRecente(op) {
  if (!op.encerrado_ts) return false
  return Date.now() - new Date(op.encerrado_ts).getTime() <= DIAS_ENCERRADAS * 86400000
}

export default function KanbanOportunidades({
  etapas = [],
  oportunidades = [],
  carregando = false,
  filtrando = false,
  onAbrir,
  onMover,
  onGanhar,
  onPerder,
  onCriarEm,
}) {
  const [arrastando, setArrastando] = useState(null)
  const [alvo, setAlvo] = useState(null)

  const colunas = [
    ...etapas.map((e) => ({
      chave: `etapa-${e.id_etapa}`,
      tipo: "etapa",
      etapa: e,
      rotulo: e.nome,
      cor: e.cor,
      itens: oportunidades.filter((o) => o.situacao === "ABERTA" && o.id_etapa === e.id_etapa),
      valor: (o) => o.valor_estimado,
    })),
    {
      chave: "GANHA",
      tipo: "final",
      rotulo: "Ganho",
      cor: "#16a34a",
      itens: oportunidades.filter((o) => o.situacao === "GANHA" && encerradaRecente(o)),
      valor: (o) => o.valor_vendido,
    },
    {
      chave: "PERDIDA",
      tipo: "final",
      rotulo: "Perdido",
      cor: "#dc2626",
      itens: oportunidades.filter((o) => o.situacao === "PERDIDA" && encerradaRecente(o)),
      valor: (o) => o.valor_estimado,
    },
  ]

  const opArrastada = oportunidades.find((o) => o.id_oportunidade === arrastando)

  function soltar(e, coluna) {
    e.preventDefault()
    const op = opArrastada
    setArrastando(null)
    setAlvo(null)
    if (!op) return
    if (coluna.tipo === "etapa") {
      if (coluna.etapa.id_etapa !== op.id_etapa) onMover?.(op, coluna.etapa)
    } else if (coluna.chave === "GANHA") onGanhar?.(op)
    else onPerder?.(op)
  }

  const mostrarEsqueleto = carregando && oportunidades.length === 0

  return (
    <Box
      role="region"
      aria-label="Funil de oportunidades"
      sx={{
        display: "flex",
        gap: 1.5,
        alignItems: "stretch",
        overflowX: "auto",
        p: { xs: 1.5, sm: 2 },
        minHeight: 420,
        scrollSnapType: { xs: "x mandatory", sm: "none" },
        scrollPaddingInline: 12,
      }}
    >
      {colunas.map((coluna, posicao) => {
        const recebendo = alvo === coluna.chave && arrastando
        const total = coluna.itens.reduce((soma, o) => soma + (Number(coluna.valor(o)) || 0), 0)
        const idTitulo = `coluna-crm-${coluna.chave}`
        const final = coluna.tipo === "final"

        return (
          <Box
            key={coluna.chave}
            component="section"
            aria-labelledby={idTitulo}
            sx={{
              flex: { xs: "0 0 86%", sm: "1 0 260px" },
              maxWidth: { sm: 340 },
              minWidth: 0,
              scrollSnapAlign: "start",
              display: "flex",
              flexDirection: "column",
              maxHeight: "max(420px, calc(100vh - 300px))",
              borderRadius: 1,
              bgcolor: (t) =>
                final
                  ? alpha(coluna.cor, t.palette.mode === "dark" ? 0.06 : 0.04)
                  : t.palette.mode === "dark"
                    ? alpha("#fff", 0.03)
                    : alpha("#000", 0.025),
              border: 1,
              borderStyle: final ? "dashed" : "solid",
              borderColor: recebendo ? "primary.main" : "divider",
              borderTop: "3px solid",
              borderTopColor: coluna.cor || "divider",
              boxShadow: (t) => (recebendo ? `0 0 0 1px ${t.palette.primary.main}` : "none"),
              transition: "border-color .15s, box-shadow .15s",
            }}
          >
            <Box sx={{ flexShrink: 0, px: 1.5, pt: 1, pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 30 }}>
                <Typography id={idTitulo} component="h3" variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {coluna.rotulo}
                </Typography>
                <Box
                  component="span"
                  aria-label={`${coluna.itens.length} oportunidade${coluna.itens.length === 1 ? "" : "s"}`}
                  sx={{
                    minWidth: 24,
                    height: 22,
                    px: 0.75,
                    borderRadius: 11,
                    bgcolor: "action.selected",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {mostrarEsqueleto ? "–" : coluna.itens.length}
                </Box>
                {!final && onCriarEm && (
                  <Tooltip title={`Nova oportunidade em "${coluna.rotulo}"`}>
                    <IconButton size="small" onClick={() => onCriarEm(coluna.etapa)} aria-label={`Nova oportunidade em ${coluna.rotulo}`}>
                      <Add sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {mostrarEsqueleto ? <Skeleton width={70} /> : moedaCurta(total)}
                {final && ` · últimos ${DIAS_ENCERRADAS} dias`}
              </Typography>
            </Box>

            <Box
              onDragOver={(e) => {
                if (!arrastando) return
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                if (alvo !== coluna.chave) setAlvo(coluna.chave)
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget)) return
                setAlvo((atual) => (atual === coluna.chave ? null : atual))
              }}
              onDrop={(e) => soltar(e, coluna)}
              sx={{ flex: 1, overflowY: "auto", px: 1, pb: 1, minHeight: 120 }}
            >
              {mostrarEsqueleto &&
                Array.from({ length: [3, 2, 2, 1][posicao % 4] }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={110} sx={{ mb: 1, borderRadius: 1 }} />
                ))}

              {coluna.itens.map((op) => (
                <CartaoOportunidade
                  key={op.id_oportunidade}
                  op={op}
                  arrastavel={op.situacao === "ABERTA"}
                  arrastando={arrastando === op.id_oportunidade}
                  onAbrir={() => onAbrir?.(op)}
                  etapas={etapas}
                  onMoverPara={(etapa) => onMover?.(op, etapa)}
                  onGanhar={() => onGanhar?.(op)}
                  onPerder={() => onPerder?.(op)}
                  onDragStart={(e) => {
                    if (op.situacao !== "ABERTA") {
                      e.preventDefault()
                      return
                    }
                    setArrastando(op.id_oportunidade)
                    e.dataTransfer.effectAllowed = "move"
                    // O Firefox so inicia o arrasto se algo for escrito aqui.
                    e.dataTransfer.setData("text/plain", String(op.id_oportunidade))
                  }}
                  onDragEnd={() => {
                    setArrastando(null)
                    setAlvo(null)
                  }}
                />
              ))}

              {recebendo && final && (
                <Typography variant="caption" sx={{ display: "block", textAlign: "center", py: 1, color: coluna.cor, fontWeight: 700 }}>
                  Solte para marcar como {coluna.chave === "GANHA" ? "ganha" : "perdida"}
                </Typography>
              )}

              {coluna.itens.length === 0 && !recebendo && !mostrarEsqueleto && (
                <Box sx={{ textAlign: "center", px: 1.5, py: 3, border: "1px dashed", borderColor: "divider", borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {filtrando
                      ? "Nada nesta coluna com os filtros atuais."
                      : final
                        ? `Arraste um cartão para cá para marcá-lo como ${coluna.chave === "GANHA" ? "ganho" : "perdido"}.`
                        : "Nenhuma oportunidade nesta etapa."}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
