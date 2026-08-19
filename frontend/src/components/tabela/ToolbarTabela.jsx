/**
 * ToolbarTabela — a barra que fica acima da TabelaDados.
 *
 * Junta o que vale para qualquer listagem: a busca livre, o botao que abre o
 * PainelFiltros (com o numero de filtros ativos), a exportacao e o botao de
 * criar. O que e da tela entra por `acoes` — assim a barra nao precisa saber o
 * que a tela cria nem para onde exporta.
 *
 * MUDA DE LADO QUANDO HA SELECAO: com linhas marcadas, a esquerda deixa de ser
 * "filtrar" e passa a ser "o que fazer com estas N linhas". Sao dois modos de
 * trabalho diferentes, e mostrar os dois ao mesmo tempo faria a barra crescer
 * justo quando ela precisa ser lida rapido.
 *
 * Props:
 *   busca, onBuscaChange, placeholderBusca   campo de busca (omitido sem o handler)
 *   totalFiltros, onAbrirFiltros             botao de filtro e o badge
 *   totalSelecionados, onLimparSelecao       modo selecao
 *   acoesMassa                               ReactNode: o que fazer com a selecao
 *   onExportar, rotuloExportar               exportacao (omitida sem o handler)
 *   acoes                                    ReactNode a direita (ex.: "Nova startup")
 *   propsBusca, propsBotaoFiltro             atributos extras (data-tour, aria-*)
 */
import { Box, Button, IconButton, InputAdornment, TextField, Tooltip, Typography } from "@mui/material"
import { Close, Download, FilterList, Search } from "@mui/icons-material"

export default function ToolbarTabela({
  busca = "",
  onBuscaChange,
  placeholderBusca = "Pesquisar...",
  totalFiltros = 0,
  onAbrirFiltros,
  totalSelecionados = 0,
  onLimparSelecao,
  acoesMassa,
  onExportar,
  rotuloExportar = "Exportar CSV",
  acoes,
  propsBusca,
  propsBotaoFiltro,
}) {
  const emSelecao = totalSelecionados > 0

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        flexWrap: "wrap",
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {emSelecao ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", flex: 1 }}>
          <Typography variant="body2" fontWeight={600} color="primary.main">
            {totalSelecionados} selecionada{totalSelecionados > 1 ? "s" : ""}
          </Typography>
          {acoesMassa}
          <Tooltip title="Limpar selecao">
            <IconButton size="small" onClick={onLimparSelecao}>
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <>
          {onAbrirFiltros && (
            <Button
              size="small"
              variant={totalFiltros > 0 ? "contained" : "outlined"}
              startIcon={<FilterList />}
              onClick={onAbrirFiltros}
              {...propsBotaoFiltro}
            >
              Filtro
              {totalFiltros > 0 ? ` (${totalFiltros})` : ""}
            </Button>
          )}

          {onBuscaChange && (
            <TextField
              placeholder={placeholderBusca}
              size="small"
              value={busca}
              onChange={(e) => onBuscaChange(e.target.value)}
              sx={{ flex: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: busca ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => onBuscaChange("")} aria-label="Limpar busca">
                      <Close sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
              {...propsBusca}
            />
          )}
        </>
      )}

      {/* Direita: continua disponivel durante a selecao — exportar o que esta
          na tela e criar um registro novo nao dependem do que esta marcado. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
        {onExportar && (
          <Tooltip title={rotuloExportar}>
            <IconButton size="small" onClick={onExportar}>
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {acoes}
      </Box>
    </Box>
  )
}
