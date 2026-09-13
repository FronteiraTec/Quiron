/**
 * A ponte entre o tema do Quiron e o editor de blocos.
 *
 * O BlockNote desenha menus, botoes e balões a partir de variaveis CSS
 * (`--bn-*`) declaradas em `.bn-root`. Isso e uma sorte: em vez de reescrever
 * o CSS da biblioteca — que mudaria a cada versao —, basta apontar essas
 * variaveis para a paleta que o usuario escolheu nas preferencias.
 *
 * Vale lembrar que o tema do Quiron nao e fixo: cor primaria, raio de borda,
 * densidade e claro/escuro sao preferencia de cada pessoa (ver theme.js). Um
 * editor com cores cravadas no codigo ficaria visivelmente "de fora" para
 * quem trocou a cor do painel.
 */

/**
 * Estilos do editor e do leitor, no formato `sx` do MUI.
 *
 * Use na forma de funcao (`sx={estilosDocumento}`), que e como o MUI entrega
 * o tema ja resolvido.
 *
 * @param {import('@mui/material').Theme} theme
 */
export function estilosDocumento(theme) {
  const escuro = theme.palette.mode === "dark"

  return {
    // ---------------------------------------------------------------- cores
    "& .bn-root": {
      "--bn-colors-editor-text": theme.palette.text.primary,
      // Transparente de proposito: o editor mora dentro de um painel do
      // Quiron, e pintar um fundo proprio criaria um retangulo branco
      // flutuando sobre o painel no tema escuro.
      "--bn-colors-editor-background": "transparent",
      "--bn-colors-menu-text": theme.palette.text.primary,
      "--bn-colors-menu-background": theme.palette.background.paper,
      "--bn-colors-tooltip-text": theme.palette.common.white,
      "--bn-colors-tooltip-background": escuro
        ? theme.palette.grey[700]
        : theme.palette.grey[800],
      "--bn-colors-hovered-text": theme.palette.text.primary,
      "--bn-colors-hovered-background": theme.palette.action.hover,
      "--bn-colors-selected-text": theme.palette.primary.contrastText,
      "--bn-colors-selected-background": theme.palette.primary.main,
      "--bn-colors-disabled-text": theme.palette.text.disabled,
      "--bn-colors-disabled-background": theme.palette.action.disabledBackground,
      "--bn-colors-shadow": escuro ? "rgba(0,0,0,.5)" : theme.palette.grey[300],
      "--bn-colors-border": theme.palette.divider,
      "--bn-colors-side-menu": theme.palette.text.disabled,
      "--bn-font-family": theme.typography.fontFamily,
      "--bn-border-radius": `${theme.shape.borderRadius}px`,
      "--bn-shadow-light": theme.shadows[2],
      "--bn-shadow-medium": theme.shadows[8],
    },

    // --------------------------------------------------------------- tipografia
    "& .bn-editor": {
      fontSize: 15,
      lineHeight: 1.7,
      // A calha lateral e o que da espaco para o ⋮⋮ de arrastar. 54px e o
      // padrao da biblioteca; no celular ela come metade da largura util,
      // entao encolhe para caber so a alca (ver EditorDocumento, que tambem
      // esconde o "+" nessa faixa).
      // Em texto explicito: `paddingInline` nao passa pela escala de
      // espacamento do MUI, e um numero cru aqui e facil de ler como "54 *
      // spacing" por engano.
      paddingInline: "54px",
      [theme.breakpoints.down("sm")]: { paddingInline: "28px" },
    },

    // Titulos no tamanho do Quiron. O BlockNote deriva o tamanho de `--level`,
    // entao mexer na variavel basta — nao ha regra de CSS duplicada aqui.
    "& [data-content-type='heading']": { "--level": "1.75em", fontWeight: 800 },
    "& [data-content-type='heading'][data-level='2']": { "--level": "1.35em", fontWeight: 700 },
    "& [data-content-type='heading'][data-level='3']": { "--level": "1.15em", fontWeight: 700 },

    // ------------------------------------------------------------- blocos
    "& [data-content-type='quote']": {
      borderLeft: `3px solid ${theme.palette.primary.main}`,
      paddingLeft: theme.spacing(1.75),
      color: theme.palette.text.secondary,
      fontStyle: "italic",
    },

    "& [data-content-type='codeBlock']": {
      borderRadius: `${theme.shape.borderRadius}px`,
      border: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.action.hover,
      fontSize: 13.5,
    },

    "& [data-content-type='divider']": {
      color: theme.palette.divider,
    },

    // Links com a cor do painel, e nao o azul padrao do navegador.
    "& .bn-inline-content a": {
      color: theme.palette.primary.main,
      textDecorationColor: theme.palette.primary.main,
    },

    // Codigo no meio da frase.
    "& .bn-inline-content code": {
      backgroundColor: theme.palette.action.hover,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 4,
      padding: "1px 4px",
      fontSize: "0.875em",
    },

    // Imagem: limitada a largura da coluna, com o mesmo raio do resto.
    "& .bn-visual-media": {
      borderRadius: `${theme.shape.borderRadius}px`,
      maxWidth: "100%",
    },
  }
}

/**
 * Estilos so do LEITOR.
 *
 * Some a calha lateral: sem alca de arrastar e sem botao de adicionar, os
 * 54px a esquerda seriam um recuo sem motivo, e o texto do incubado ficaria
 * desalinhado do resto da pagina do passo.
 */
export function estilosLeitura(theme) {
  const base = estilosDocumento(theme)

  return {
    ...base,
    "& .bn-editor": {
      ...base["& .bn-editor"],
      paddingInline: 0,
      [theme.breakpoints.down("sm")]: { paddingInline: 0 },
    },
  }
}
