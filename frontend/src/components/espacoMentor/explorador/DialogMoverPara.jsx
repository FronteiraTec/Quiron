/**
 * "Mover para…": o caminho de quem nao arrasta — no celular, no teclado, ou com
 * a pasta de destino recolhida na arvore.
 *
 * O destino que nao faz sentido (a propria pasta, uma pasta de dentro dela, o
 * lugar onde tudo ja esta) aparece, mas desabilitado: a pessoa ve a arvore
 * inteira e entende por que aquele nao vale.
 */
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material"
import { LocalLibrary } from "@mui/icons-material"
import IconeItem from "./IconeItem"
import { podeSoltar, subpastas } from "../../../data/exploradorMeta"

export default function DialogMoverPara({ aberto, itens = [], pastas = [], onFechar, onMover }) {
  const [destino, setDestino] = useState(undefined) // undefined = nada escolhido; null = raiz

  useEffect(() => {
    if (aberto) setDestino(undefined)
  }, [aberto])

  const valido = (id) => podeSoltar(pastas, itens, id)
  const rotuloItens = itens.length === 1 ? `"${itens[0].titulo || itens[0].nome}"` : `${itens.length} itens`

  const linha = (id, nome, nivel, icone) => {
    const permitido = valido(id)
    return (
      <ButtonBase
        key={id ?? "raiz"}
        disabled={!permitido}
        onClick={() => setDestino(id)}
        onDoubleClick={() => permitido && onMover(id)}
        sx={{
          width: "100%",
          justifyContent: "flex-start",
          gap: 1,
          py: 0.75,
          pl: 1 + nivel * 2,
          pr: 1,
          borderRadius: "6px",
          opacity: permitido ? 1 : 0.45,
          bgcolor: destino === id ? "action.selected" : "transparent",
          "&:hover": { bgcolor: destino === id ? "action.selected" : "action.hover" },
        }}
      >
        {icone}
        <Typography variant="body2" noWrap sx={{ fontWeight: destino === id ? 700 : 500 }}>
          {nome}
        </Typography>
      </ButtonBase>
    )
  }

  const arvore = (idPai, nivel) =>
    subpastas(pastas, idPai).flatMap((p) => [
      linha(p.id_pasta, p.nome, nivel, <IconeItem item={p} tamanho={20} />),
      ...arvore(p.id_pasta, nivel + 1),
    ])

  return (
    <Dialog open={aberto} onClose={onFechar} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>Mover para…</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Escolha para onde vai {rotuloItens}.
        </Typography>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: "6px", p: 0.5, maxHeight: 360, overflowY: "auto" }}>
          {linha(null, "Minha biblioteca", 0, <LocalLibrary sx={{ fontSize: 20, color: "primary.main" }} />)}
          {arvore(null, 1)}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onFechar} sx={{ textTransform: "none" }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          disabled={destino === undefined || !valido(destino)}
          onClick={() => onMover(destino)}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Mover aqui
        </Button>
      </DialogActions>
    </Dialog>
  )
}
