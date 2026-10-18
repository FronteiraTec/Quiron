/**
 * O painel de indicadores do topo da tela de Tarefas.
 *
 * CADA INDICADOR E UM FILTRO. "3 atrasadas" so serve se levar as tres: clicar
 * recorta a lista (e o quadro) para elas, clicar de novo devolve tudo. O
 * selecionado fica marcado com fundo, a linha embaixo e `aria-pressed` — e a
 * barra de filtros mostra o recorte como um chip, para ninguem esquecer que ha
 * algo escondido.
 *
 * UM PAINEL SO, e nao quatro cartoes soltos: os numeros sao partes da mesma
 * leitura ("como esta o trabalho"), e as linhas finas entre eles saem de um
 * `gap` de 1px sobre o fundo de divisoria — funciona em quatro colunas no
 * desktop e em duas no celular sem reescrever borda nenhuma.
 *
 * O NUMERO FICA EM COR DE TEXTO, como no KpiRow. Quando o estado e ruim (ha
 * tarefas atrasadas), quem avisa e o icone e a faixa vermelha a esquerda,
 * alem do rotulo — nunca a cor sozinha.
 */
import { Box, ButtonBase, Skeleton, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { FilterAlt } from "@mui/icons-material"

/**
 * @param {object} props
 * @param {Array<{id: string, rotulo: string, valor: number, icone: React.ReactNode,
 *   ajuda?: string, alerta?: boolean}>} props.itens
 * @param {string|null} props.ativo - o id do indicador que esta filtrando.
 * @param {(id: string) => void} props.onAlternar
 * @param {boolean} [props.carregando]
 */
export default function IndicadoresTarefas({ itens, ativo, onAlternar, carregando = false }) {
  return (
    <Box
      role="group"
      aria-label="Indicadores de tarefas — clique para filtrar"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: `repeat(${itens.length}, minmax(0, 1fr))` },
        gap: "1px",
        bgcolor: "divider",
        border: 1,
        borderColor: "divider",
        mb: 2,
      }}
    >
      {itens.map((item) => {
        const selecionado = ativo === item.id
        return (
          <Tooltip key={item.id} title={item.ajuda || ""} placement="top" enterDelay={400}>
            <ButtonBase
              onClick={() => onAlternar(item.id)}
              aria-pressed={selecionado}
              aria-label={`${item.rotulo}: ${carregando ? "carregando" : item.valor}. ${
                selecionado ? "Filtro ativo; clique para remover." : "Clique para filtrar."
              }`}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                // Rotulo em cima, numero embaixo: se um rotulo quebrar em duas
                // linhas no celular, os numeros da mesma fileira continuam
                // alinhados.
                justifyContent: "space-between",
                textAlign: "left",
                gap: 0.5,
                px: 2,
                py: 1.5,
                bgcolor: (t) =>
                  selecionado ? alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.14 : 0.16) : t.palette.background.paper,
                // A faixa esquerda e o alerta; a de baixo, a selecao. Sombra
                // interna e nao borda: borda mudaria a altura do bloco ao
                // selecionar e o painel inteiro pularia um pixel.
                boxShadow: (t) =>
                  [
                    item.alerta ? `inset 3px 0 0 ${t.palette.error.main}` : null,
                    selecionado ? `inset 0 -3px 0 ${t.palette.primary.main}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "none",
                transition: "background-color .15s",
                "&:hover": {
                  bgcolor: (t) =>
                    selecionado
                      ? alpha(t.palette.primary.vivo, t.palette.mode === "dark" ? 0.2 : 0.22)
                      : t.palette.action.hover,
                },
                "&.Mui-focusVisible": {
                  outline: "2px solid",
                  outlineColor: "primary.main",
                  outlineOffset: -2,
                  zIndex: 1,
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, minWidth: 0 }}>
                <Box
                  aria-hidden
                  sx={{ display: "flex", color: item.alerta ? "error.main" : "text.secondary", flexShrink: 0 }}
                >
                  {item.icone}
                </Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ flex: 1, lineHeight: 1.35 }}>
                  {item.rotulo}
                </Typography>
                {selecionado && <FilterAlt aria-hidden sx={{ fontSize: 14, color: "primary.main" }} />}
              </Box>

              <Typography variant="h4" component="span" sx={{ lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>
                {carregando ? <Skeleton width={36} /> : item.valor}
              </Typography>
            </ButtonBase>
          </Tooltip>
        )
      })}
    </Box>
  )
}
