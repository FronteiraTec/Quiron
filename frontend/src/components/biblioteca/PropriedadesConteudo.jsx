/**
 * As propriedades de um conteudo da Biblioteca — resumo, tags, duracao, url.
 *
 * POR QUE ELAS FICAM ASSIM
 * Antes eram um formulario: cada campo numa caixa com rotulo flutuante, e as
 * dez tags do acervo desenhadas como chips, todas, o tempo todo. O resultado
 * e que a parte que importa — escrever a aula — aparecia no fim da pagina,
 * espremida, depois de atravessar o cadastro.
 *
 * Aqui elas viram o que sao: metadado. Uma lista discreta logo abaixo do
 * titulo, sem borda, com o rotulo a esquerda e o valor a direita. O valor so
 * ganha fundo ao passar o mouse — a dica de que da para clicar e editar ali
 * mesmo. Nenhum campo foi removido; todos continuam alimentando o card, a
 * busca e os filtros do acervo.
 *
 * As tags seguem a mesma ideia: mostram as ESCOLHIDAS, e as outras entram
 * pelo "+". Quem nunca usa "Juridico" nao precisa ver "Juridico".
 */
import { useState } from "react"
import {
  Box,
  Typography,
  TextField,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material"
import { Add, Check } from "@mui/icons-material"

// Largura da coluna de rotulos. Fixa para que os valores alinhem entre si —
// e desaparece no celular, onde rotulo e valor empilham.
const LARGURA_ROTULO = 108

/**
 * Uma linha de propriedade: rotulo a esquerda, valor a direita.
 */
export function Propriedade({ rotulo, children }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "flex-start" },
        gap: { xs: 0.25, sm: 1 },
        minHeight: 34,
      }}
    >
      <Typography
        component="div"
        sx={{
          width: { xs: "auto", sm: LARGURA_ROTULO },
          flexShrink: 0,
          pt: { xs: 0, sm: 0.9 },
          fontSize: 13,
          color: "text.secondary",
        }}
      >
        {rotulo}
      </Typography>
      {/*
        O valor tem 8px de recuo interno (o respiro do fundo que aparece no
        hover). No celular, onde rotulo e valor empilham, esses 8px deixariam
        a coluna torta — o recuo negativo os devolve a mesma vertical.
      */}
      <Box sx={{ flex: 1, minWidth: 0, ml: { xs: "-8px", sm: 0 } }}>{children}</Box>
    </Box>
  )
}

/**
 * Campo de texto sem caixa, para o valor de uma propriedade.
 *
 * O fundo aparece no hover e no foco. E o unico enfeite: sem ele o campo some
 * completamente e ninguem descobre que da para clicar.
 */
export function ValorTexto({ valor, onChange, placeholder, multiline = false, maxLength }) {
  return (
    <TextField
      variant="standard"
      fullWidth
      multiline={multiline}
      value={valor ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      InputProps={{ disableUnderline: true }}
      inputProps={maxLength ? { maxLength } : undefined}
      sx={{
        "& .MuiInputBase-root": {
          px: 1,
          py: 0.5,
          borderRadius: 1,
          fontSize: 14,
          lineHeight: 1.55,
          transition: "background-color .12s",
        },
        "& .MuiInputBase-root:hover": { bgcolor: "action.hover" },
        "& .MuiInputBase-root.Mui-focused": { bgcolor: "action.hover" },
      }}
    />
  )
}

/**
 * As tags escolhidas, mais um "+" que abre o vocabulario do acervo.
 *
 * @param {string[]} props.tags        - vocabulario completo
 * @param {string[]} props.escolhidas
 * @param {Function} props.onAlternar  - recebe a tag clicada
 */
export function ValorTags({ tags, escolhidas, onAlternar }) {
  const [menu, setMenu] = useState(null)

  return (
    <Box
      sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, py: 0.5, px: 1 }}
    >
      {escolhidas.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          size="small"
          onDelete={() => onAlternar(tag)}
          sx={{ fontWeight: 500 }}
        />
      ))}

      <Tooltip title="Adicionar tag" arrow>
        <IconButton
          size="small"
          onClick={(e) => setMenu(e.currentTarget)}
          sx={{ color: "text.disabled", p: 0.25 }}
        >
          <Add sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {escolhidas.length === 0 && (
        <Typography variant="caption" sx={{ color: "text.disabled" }}>
          Sem tags
        </Typography>
      )}

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {tags.map((tag) => {
          const ativa = escolhidas.includes(tag)
          return (
            <MenuItem key={tag} dense selected={ativa} onClick={() => onAlternar(tag)}>
              <ListItemIcon sx={{ minWidth: 30 }}>
                {ativa && <Check sx={{ fontSize: 17 }} />}
              </ListItemIcon>
              <ListItemText primary={tag} />
            </MenuItem>
          )
        })}
      </Menu>
    </Box>
  )
}
