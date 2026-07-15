/**
 * Menu de contexto (...) de um no da arvore. Acoes: adicionar filho, ativar/
 * desativar, duplicar (placeholder) e excluir. Controlado pelo pai via
 * ancora + no alvo.
 */
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from "@mui/material"
import {
  Add,
  ToggleOn,
  ToggleOff,
  ContentCopy,
  DeleteOutline,
} from "@mui/icons-material"
import { TIPO_META } from "../../data/programaMock"

export default function ContextMenu({ ancora, no, onFechar, acoes }) {
  if (!no) return null
  const meta = TIPO_META[no.tipo]

  const fechar = (fn) => () => {
    fn?.()
    onFechar()
  }

  return (
    <Menu
      anchorEl={ancora}
      open={Boolean(ancora)}
      onClose={onFechar}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      slotProps={{ paper: { sx: { minWidth: 210, borderRadius: "8px", mt: 0.5 } } }}
    >
      {meta.childTipo && (
        <MenuItem onClick={fechar(() => acoes.adicionar(no.id, meta.childTipo))}>
          <ListItemIcon>
            <Add fontSize="small" />
          </ListItemIcon>
          <ListItemText>Adicionar {meta.childLabel}</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={fechar(() => acoes.alternarAtivo(no.id))}>
        <ListItemIcon>
          {no.ativo ? <ToggleOff fontSize="small" /> : <ToggleOn fontSize="small" />}
        </ListItemIcon>
        <ListItemText>{no.ativo ? "Desativar" : "Ativar"}</ListItemText>
      </MenuItem>
      <MenuItem onClick={fechar(() => acoes.duplicar(no))}>
        <ListItemIcon>
          <ContentCopy fontSize="small" />
        </ListItemIcon>
        <ListItemText>Duplicar</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={fechar(() => acoes.excluir(no))} sx={{ color: "error.main" }}>
        <ListItemIcon>
          <DeleteOutline fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText>Excluir</ListItemText>
      </MenuItem>
    </Menu>
  )
}
