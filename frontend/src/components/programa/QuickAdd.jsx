/**
 * Entrada rapida de criacao (estilo Notion): um botao "+ Nova fase/modulo/tarefa"
 * que vira um campo de texto ao clicar. Enter cria e mantem o foco para digitar
 * o proximo item em sequencia; Esc cancela. Vazio + blur fecha sem criar.
 */
import { useState, useRef, useEffect } from "react"
import { Box, InputBase, Button } from "@mui/material"
import { Add } from "@mui/icons-material"
import { TIPO_META } from "../../data/programaMock"

export default function QuickAdd({ tipoFilho, cor, indent = 0, onAdd }) {
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState("")
  const inputRef = useRef(null)
  const meta = TIPO_META[tipoFilho]

  useEffect(() => {
    if (aberto) inputRef.current?.focus()
  }, [aberto])

  const confirmar = (continuar) => {
    const nome = valor.trim()
    if (nome) onAdd(nome)
    setValor("")
    if (continuar && nome) {
      // Mantem aberto para adicionar o proximo em sequencia.
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setAberto(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      confirmar(true)
    } else if (e.key === "Escape") {
      setValor("")
      setAberto(false)
    }
  }

  if (!aberto) {
    return (
      <Button
        onClick={() => setAberto(true)}
        startIcon={<Add sx={{ fontSize: 16 }} />}
        size="small"
        sx={{
          ml: `${indent * 22 + 8}px`,
          my: 0.25,
          color: "text.secondary",
          textTransform: "none",
          fontWeight: 500,
          fontSize: 13,
          justifyContent: "flex-start",
          borderRadius: "6px",
          px: 1,
          "&:hover": { bgcolor: "action.hover", color: cor },
        }}
      >
        Nova {meta.label.toLowerCase()}
      </Button>
    )
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        ml: `${indent * 22 + 8}px`,
        my: 0.25,
        px: 1,
        py: 0.5,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: cor,
        bgcolor: "background.paper",
      }}
    >
      <Add sx={{ fontSize: 16, color: cor }} />
      <InputBase
        inputRef={inputRef}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => confirmar(false)}
        placeholder={`Nome da ${meta.label.toLowerCase()} e Enter…`}
        sx={{ flex: 1, fontSize: 13.5 }}
      />
    </Box>
  )
}
