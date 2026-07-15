/**
 * Organiza o catalogo de permissoes por modulo (um Accordion por modulo,
 * cabecalho com contagem "x/y selecionadas" + atalho "Marcar todas do
 * modulo"). Dentro de cada modulo, um grid de PermissionCard (um por
 * recurso). O catalogo recebido ja vem filtrado pela busca.
 */
import { Accordion, AccordionSummary, AccordionDetails, Box, Typography, Button, Grid } from "@mui/material"
import { ExpandMore } from "@mui/icons-material"
import PermissionCard from "./PermissionCard"

export default function PermissionsAccordion({ catalogo, selecionadas, onToggle, onSelecionarModulo, buscaAtiva }) {
  if (catalogo.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
        Nenhuma permissao encontrada para a busca informada.
      </Typography>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {catalogo.map((mod) => {
        const acoesDoModulo = mod.recursos.flatMap((r) => r.acoes)
        const total = acoesDoModulo.length
        const marcadas = acoesDoModulo.filter((a) => selecionadas.has(a.chave)).length
        const todasMarcadas = total > 0 && marcadas === total

        return (
          <Accordion key={mod.modulo} defaultExpanded={buscaAtiva} disableGutters sx={{ borderRadius: 1, "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", pr: 1 }}>
                <Typography fontWeight={700}>{mod.rotulo}</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {marcadas}/{total} selecionadas
                  </Typography>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelecionarModulo(mod.modulo, !todasMarcadas)
                    }}
                    sx={{ textTransform: "none" }}
                  >
                    {todasMarcadas ? "Limpar modulo" : "Selecionar todas"}
                  </Button>
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {mod.recursos.map((rec) => (
                  <Grid item xs={12} sm={6} md={4} key={rec.recurso}>
                    <PermissionCard
                      recurso={rec.recurso}
                      rotulo={rec.rotulo}
                      acoes={rec.acoes}
                      selecionadas={selecionadas}
                      onToggle={onToggle}
                      onSelecionarTudo={(recurso, marcar) => onSelecionarModulo(mod.modulo, marcar, recurso)}
                    />
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )
      })}
    </Box>
  )
}
