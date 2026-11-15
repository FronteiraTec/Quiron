/**
 * Pecas dos formularios do Mini CRM: a secao com titulo (o mesmo desenho do
 * painel de tarefas), o campo de dinheiro e o cabecalho/rodape dos paineis
 * laterais de cadastro.
 */
import { Box, Button, CircularProgress, Drawer, IconButton, InputAdornment, TextField, Typography } from "@mui/material"
import { Close } from "@mui/icons-material"
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from "../../utils/mascaras"

export function Secao({ id, titulo, primeira = false, children }) {
  return (
    <Box
      role="group"
      aria-labelledby={id}
      sx={primeira ? undefined : { mt: 3, pt: 3, borderTop: 1, borderColor: "divider" }}
    >
      <Typography id={id} variant="overline" component="h3" color="text.secondary" sx={{ display: "block", lineHeight: 1.6, mb: 1.5 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

/**
 * Dinheiro digitado como numa calculadora ("150000" -> 1.500,00): e o mesmo
 * campo monetario do cadastro de startup, e o unico jeito que nao exige acertar
 * a virgula. `valor` e `onChange` trabalham com NUMERO (ou null).
 */
export function CampoDinheiro({ valor, onChange, ...props }) {
  return (
    <TextField
      size="small"
      fullWidth
      inputMode="numeric"
      value={valor === null || valor === undefined ? "" : numeroParaMoeda(valor)}
      onChange={(e) => onChange(moedaParaNumero(mascararMoeda(e.target.value)))}
      InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
      {...props}
    />
  )
}

/**
 * O painel lateral de cadastro: titulo fixo no alto, corpo que rola, acoes
 * fixas no rodape (Salvar nunca exige rolar ate o fim).
 */
export function PainelCadastro({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  idForm,
  onEnviar,
  salvando = false,
  rotuloSalvar = "Salvar",
  acoesExtras = null,
  largura = 560,
  children,
}) {
  const idTitulo = `${idForm}-titulo`
  return (
    <Drawer
      anchor="right"
      open={aberto}
      // Fechar no meio do salvar deixaria a pessoa sem saber se gravou.
      onClose={salvando ? undefined : onFechar}
      PaperProps={{
        sx: { width: { xs: "100%", sm: largura }, display: "flex", flexDirection: "column" },
        role: "dialog",
        "aria-labelledby": idTitulo,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 3, py: 2, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id={idTitulo} variant="h6" component="h2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
            {titulo}
          </Typography>
          {subtitulo && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              {subtitulo}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={onFechar} aria-label="Fechar" disabled={salvando} sx={{ mt: -0.25 }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Box
        component="form"
        id={idForm}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onEnviar?.()
        }}
        sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}
      >
        {children}
      </Box>

      <Box
        sx={{
          px: 3,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        {acoesExtras}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onFechar} disabled={salvando} color="inherit">
          Cancelar
        </Button>
        <Button
          type="submit"
          form={idForm}
          variant="contained"
          disabled={salvando}
          startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {salvando ? "Salvando..." : rotuloSalvar}
        </Button>
      </Box>
    </Drawer>
  )
}
