/**
 * SidebarSearch - busca rapida no menu.
 *
 * Expandida: campo de texto que filtra os itens (ver useSidebar.resultadosBusca).
 * Recolhida: vira um botao de lupa que expande a Sidebar e foca a busca.
 * Atalho: tecla "/" foca o campo (Sidebar expandida, fora de campo de texto).
 */
import { useEffect, useRef } from "react"
import { Box, InputBase, IconButton, Tooltip } from "@mui/material"
import { Search, Close } from "@mui/icons-material"

export default function SidebarSearch({ recolhida, valor, onChange, onExpandir }) {
  const inputRef = useRef(null)

  // Atalho "/" para focar a busca (ignora quem ja esta escrevendo).
  useEffect(() => {
    if (recolhida) return
    const onKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return

      // Area editavel conta como "escrevendo", e nao so <input>/<textarea>: o
      // editor de aulas e um <div contenteditable> (BlockNote), entao o teste
      // por tagName nao o reconhecia e o preventDefault daqui engolia o "/"
      // antes de o editor ve-lo — o menu de blocos nunca abria, e o foco ainda
      // pulava para a busca do menu. E o mesmo teste que o tour ja faz.
      const alvo = e.target
      if (alvo?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName)) {
        return
      }

      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [recolhida])

  if (recolhida) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", px: 1, py: 1.25 }}>
        <Tooltip title="Buscar no menu" placement="right" arrow>
          <IconButton
            aria-label="buscar no menu"
            onClick={onExpandir}
            sx={{
              width: 42,
              height: 42,
              borderRadius: "10px",
              color: "text.secondary",
              transition: "background-color 180ms ease, color 180ms ease",
              "&:hover": { bgcolor: "action.hover", color: "text.primary" },
            }}
          >
            <Search fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          height: 40,
          borderRadius: "10px",
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.035)"),
          border: (t) =>
            `1px solid ${t.palette.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"}`,
          transition: "box-shadow 180ms ease, border-color 180ms ease, background-color 180ms ease",
          "&:hover": {
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)"),
          },
          "&:focus-within": {
            bgcolor: "background.paper",
            borderColor: "primary.main",
            boxShadow: (t) => `0 0 0 3px ${t.palette.primary.main}1a`,
          },
        }}
      >
        <Search fontSize="small" sx={{ color: "text.disabled" }} />
        <InputBase
          inputRef={inputRef}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar no menu…  ( / )"
          inputProps={{ "aria-label": "buscar no menu" }}
          sx={{ flex: 1, fontSize: 14 }}
        />
        {valor && (
          <IconButton size="small" aria-label="limpar busca" onClick={() => onChange("")}>
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}
