/**
 * O campo de senha provisoria dos cadastros feitos pela gestao, com tres
 * atalhos: GERAR uma senha aleatoria, MOSTRAR/OCULTAR o que foi digitado e
 * COPIAR OS DADOS DE ACESSO (link do login, e-mail e senha) num texto pronto
 * para colar no WhatsApp ou no e-mail.
 *
 * A senha gerada ja aparece visivel: quem cadastra precisa conferi-la antes de
 * repassar. O minimo de 6 caracteres e o de backend/src/utils/senha.js; a
 * gerada tem 10, sem os caracteres que se confundem ao ler (0/O, 1/l/I).
 */
import { useState } from "react"
import { Box, Button, IconButton, InputAdornment, TextField, Tooltip } from "@mui/material"
import { Autorenew, Check, ContentCopy, Visibility, VisibilityOff } from "@mui/icons-material"

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
const TAMANHO_GERADA = 10

function gerarSenha() {
  const sorteio = crypto.getRandomValues(new Uint32Array(TAMANHO_GERADA))
  return Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join("")
}

export default function CampoSenhaProvisoria({ value, onChange, email, helperText, ...props }) {
  const [mostrar, setMostrar] = useState(false)
  // null, "ok" ou "falhou": o rotulo do botao de copiar volta sozinho em 2 s.
  const [copia, setCopia] = useState(null)

  const gerar = () => {
    onChange(gerarSenha())
    setMostrar(true)
  }

  const copiar = async () => {
    const texto = [
      "Seus dados de acesso ao Quiron:",
      `Link: ${window.location.origin}/login`,
      `E-mail: ${email}`,
      `Senha provisória: ${value}`,
      "No primeiro acesso, você vai definir uma senha nova.",
    ].join("\n")
    try {
      await navigator.clipboard.writeText(texto)
      setCopia("ok")
    } catch {
      // Fora de HTTPS/localhost o navegador nao expoe a area de transferencia;
      // a senha continua visivel no olho para copiar a mao.
      setCopia("falhou")
    }
    setTimeout(() => setCopia(null), 2000)
  }

  return (
    <>
      <TextField
        label="Senha provisória"
        type={mostrar ? "text" : "password"}
        fullWidth
        required
        autoComplete="new-password"
        helperText={helperText}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Gerar senha">
                <IconButton onClick={gerar} aria-label="gerar senha">
                  <Autorenew />
                </IconButton>
              </Tooltip>
              <Tooltip title={mostrar ? "Ocultar senha" : "Mostrar senha"}>
                <IconButton
                  onClick={() => setMostrar((v) => !v)}
                  edge="end"
                  aria-label={mostrar ? "ocultar senha" : "mostrar senha"}
                >
                  {mostrar ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
        {...props}
      />
      <Box sx={{ mt: 1 }}>
        <Button
          size="small"
          startIcon={copia === "ok" ? <Check /> : <ContentCopy />}
          color={copia === "falhou" ? "error" : "primary"}
          onClick={copiar}
          disabled={!email || !value}
        >
          {copia === "ok"
            ? "Dados copiados"
            : copia === "falhou"
              ? "Não foi possível copiar"
              : "Copiar dados de acesso"}
        </Button>
      </Box>
    </>
  )
}
