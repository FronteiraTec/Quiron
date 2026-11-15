/**
 * O compositor da linha do tempo: anotacao, contato ou reuniao.
 *
 * O texto vai para o servidor, e e o SERVIDOR que escreve o evento — autor da
 * sessao, data do banco. Daqui nao sai nem a data nem o nome de ninguem.
 *
 * Ctrl+Enter (ou Cmd+Enter) registra, como num chat.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { Alert, Box, Button, CircularProgress, MenuItem, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { CallOutlined, Groups2Outlined, StickyNote2Outlined } from "@mui/icons-material"
import { CANAIS_CONTATO } from "../../data/crmMeta"

const TIPOS = [
  { valor: "ANOTACAO", rotulo: "Anotação", Icone: StickyNote2Outlined, placeholder: "Escreva uma anotação sobre esta negociação…", botao: "Adicionar anotação" },
  { valor: "CONTATO", rotulo: "Contato", Icone: CallOutlined, placeholder: "O que foi conversado no contato?", botao: "Registrar contato" },
  { valor: "REUNIAO", rotulo: "Reunião", Icone: Groups2Outlined, placeholder: "O que foi tratado na reunião?", botao: "Registrar reunião" },
]

const RegistrarAtividade = forwardRef(function RegistrarAtividade({ onRegistrar }, ref) {
  const [tipo, setTipo] = useState("ANOTACAO")
  const [canal, setCanal] = useState("WHATSAPP")
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)
  const campo = useRef(null)

  // O botao "Adicionar anotação" do cabecalho traz o foco para ca.
  useImperativeHandle(ref, () => ({
    focar(novoTipo) {
      if (novoTipo) setTipo(novoTipo)
      campo.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      setTimeout(() => campo.current?.focus(), 250)
    },
  }))

  const atual = TIPOS.find((t) => t.valor === tipo)

  const enviar = async () => {
    if (!texto.trim()) {
      setErro("Escreva o que aconteceu antes de registrar.")
      campo.current?.focus()
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await onRegistrar({ tipo, texto: texto.trim(), ...(tipo === "CONTATO" ? { canal } : {}) })
      setTexto("")
    } catch (err) {
      setErro(err?.response?.data?.erro || "Não foi possível registrar.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Box
      sx={{
        p: 1.5,
        mb: 2.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: (t) => (t.palette.mode === "dark" ? alpha("#fff", 0.02) : alpha("#000", 0.015)),
      }}
    >
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1.25 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={tipo}
          onChange={(_, v) => v && setTipo(v)}
          aria-label="Tipo de registro"
          sx={{ "& .MuiToggleButton-root": { gap: 0.5, px: 1.25, textTransform: "none", fontWeight: 600, letterSpacing: 0 } }}
        >
          {TIPOS.map(({ valor, rotulo, Icone }) => (
            <ToggleButton key={valor} value={valor} aria-label={rotulo}>
              <Icone sx={{ fontSize: 17 }} />
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                {rotulo}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {tipo === "CONTATO" && (
          <TextField
            select
            size="small"
            label="Canal"
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            {CANAIS_CONTATO.map((c) => (
              <MenuItem key={c.valor} value={c.valor}>
                {c.rotulo}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      <TextField
        inputRef={campo}
        fullWidth
        multiline
        minRows={2}
        maxRows={10}
        size="small"
        placeholder={atual.placeholder}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          if (erro) setErro(null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            enviar()
          }
        }}
        inputProps={{ maxLength: 5000, "aria-label": atual.placeholder }}
        error={Boolean(erro)}
      />

      {erro && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={enviar}
          disabled={enviando}
          startIcon={enviando ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          {atual.botao}
        </Button>
      </Box>
    </Box>
  )
})

export default RegistrarAtividade
