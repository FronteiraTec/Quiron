/**
 * O menu do botao direito (e do "⋮", para quem nao tem botao direito).
 *
 * E so desenho: quem decide o que entra — e o que vale para a selecao atual —
 * e o explorador (AbaMinhaBiblioteca), que monta a lista de acoes. Cada acao
 * mostra o atalho de teclado que faz a mesma coisa, como no Windows.
 */
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from "@mui/material"

/**
 * @param {{ posicao: {x, y} | null, acoes: Array<{rotulo, icone, atalho?, onClick, desabilitada?, perigo?} | "-">, onFechar }} props
 */
export default function MenuContexto({ posicao, acoes = [], onFechar }) {
  const fechar = (fn) => () => {
    onFechar()
    fn?.()
  }

  // A lista chega com `false` no lugar do que nao vale para a selecao. Divisor
  // no comeco, no fim ou repetido nao separa nada.
  const limpas = acoes
    .filter(Boolean)
    .filter((a, i, lista) => a !== "-" || (i > 0 && i < lista.length - 1 && lista[i - 1] !== "-"))

  return (
    <Menu
      open={Boolean(posicao)}
      onClose={onFechar}
      anchorReference="anchorPosition"
      anchorPosition={posicao ? { top: posicao.y, left: posicao.x } : undefined}
      onContextMenu={(e) => {
        // Botao direito por cima do menu aberto fecha-o, e nao abre o do navegador.
        e.preventDefault()
        onFechar()
      }}
      slotProps={{ paper: { sx: { minWidth: 240, borderRadius: "8px" } } }}
    >
      {limpas.map((acao, i) =>
        acao === "-" ? (
          <Divider key={`d${i}`} />
        ) : (
          <MenuItem
            key={acao.rotulo}
            onClick={fechar(acao.onClick)}
            disabled={acao.desabilitada}
            sx={acao.perigo ? { color: "error.main" } : undefined}
          >
            <ListItemIcon sx={acao.perigo ? { color: "error.main" } : undefined}>{acao.icone}</ListItemIcon>
            <ListItemText>{acao.rotulo}</ListItemText>
            {acao.atalho && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {acao.atalho}
              </Typography>
            )}
          </MenuItem>
        )
      )}
    </Menu>
  )
}
