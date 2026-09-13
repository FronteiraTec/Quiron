/**
 * O menu que abre com "/" — a lista de blocos que dá para inserir.
 *
 * O BlockNote cuida da parte dificil (abrir no lugar certo, filtrar pelo que
 * se digita, navegar com as setas, fechar no Esc) atraves do
 * SuggestionMenuController; o que esta aqui e so a APARENCIA: um Paper do MUI
 * com a tipografia e as cores do painel, em vez do menu generico da
 * biblioteca ao lado de componentes do Quiron.
 *
 * Os itens dos blocos nativos ja vem traduzidos pelo dicionario `pt` do
 * BlockNote — o que este arquivo faz com eles e (a) recortar a lista para o
 * que faz sentido numa aula e (b) trocar os icones pelos do Quiron, para o
 * menu nao misturar dois conjuntos de icones na mesma tela.
 */
import { useEffect, useRef } from "react"
import { Box, Paper, Typography } from "@mui/material"
import {
  Notes,
  Title,
  Segment,
  TextFields,
  FormatListBulleted,
  FormatListNumbered,
  Checklist,
  UnfoldMore,
  FormatQuote,
  Code,
  HorizontalRule,
  TableChart,
  Image,
  EmojiEmotions,
} from "@mui/icons-material"

/**
 * Os blocos nativos que entram no menu, e o icone de cada um.
 *
 * E uma lista de PERMITIDOS: o BlockNote oferece titulo ate o nivel 6 e tres
 * variantes de titulo expansivel, o que vira um menu de rolagem para escolher
 * entre coisas que quase ninguem distingue. Uma aula se escreve com titulo,
 * subtitulo e sub-subtitulo.
 */
const NATIVOS = {
  paragraph: Notes,
  heading: Title,
  heading_2: Segment,
  heading_3: TextFields,
  bullet_list: FormatListBulleted,
  numbered_list: FormatListNumbered,
  check_list: Checklist,
  toggle_list: UnfoldMore,
  quote: FormatQuote,
  code_block: Code,
  divider: HorizontalRule,
  table: TableChart,
  image: Image,
  emoji: EmojiEmotions,
}

/**
 * Recorta a lista de itens nativos e troca os icones pelos do Quiron.
 * @param {Array} itens - saida de getDefaultReactSlashMenuItems
 */
export function ajustarItensNativos(itens) {
  return itens
    .filter((item) => NATIVOS[item.key])
    .map((item) => {
      const Icone = NATIVOS[item.key]
      return { ...item, icon: <Icone sx={{ fontSize: 18 }} /> }
    })
}

/**
 * O menu em si.
 *
 * Recebe de `SuggestionMenuController`: os itens ja filtrados pelo que foi
 * digitado, e qual esta selecionado pelo teclado.
 */
export default function MenuBlocos({ items, selectedIndex, onItemClick }) {
  const refSelecionado = useRef(null)

  // Navegar com as setas tem de rolar a lista junto, senao a selecao "some"
  // para fora da caixa e o menu parece travado.
  useEffect(() => {
    refSelecionado.current?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  if (!items.length) {
    return (
      <Paper elevation={8} sx={{ p: 1.5, width: 280 }}>
        <Typography variant="body2" color="text.secondary">
          Nenhum bloco com esse nome.
        </Typography>
      </Paper>
    )
  }

  // Os itens chegam em ordem; o cabecalho aparece quando o grupo muda. Assim
  // a numeracao usada pelo teclado continua sendo a da lista original.
  let grupoAnterior = null

  return (
    <Paper
      elevation={8}
      sx={{
        width: 300,
        maxHeight: 340,
        overflowY: "auto",
        py: 0.5,
        // O menu flutua sobre o editor: sem isso ele herdaria o line-height
        // generoso do texto da aula.
        lineHeight: 1.4,
      }}
    >
      {items.map((item, indice) => {
        const grupo = item.group || null
        const abreGrupo = grupo && grupo !== grupoAnterior
        grupoAnterior = grupo
        const selecionado = indice === selectedIndex

        return (
          <Box key={`${item.title}-${indice}`}>
            {abreGrupo && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 1.5,
                  pt: 1,
                  pb: 0.5,
                  fontWeight: 700,
                  letterSpacing: 0.4,
                  color: "text.disabled",
                  textTransform: "uppercase",
                }}
              >
                {grupo}
              </Typography>
            )}

            <Box
              ref={selecionado ? refSelecionado : null}
              onClick={() => onItemClick?.(item)}
              // `mousedown` tira o cursor do editor antes do clique chegar, e
              // o menu fecharia sem inserir nada.
              onMouseDown={(e) => e.preventDefault()}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.5,
                py: 0.75,
                cursor: "pointer",
                bgcolor: selecionado ? "action.selected" : "transparent",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  width: 30,
                  height: 30,
                  borderRadius: 1,
                  flexShrink: 0,
                  bgcolor: "action.hover",
                  color: "text.secondary",
                }}
              >
                {item.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                  {item.title}
                </Typography>
                {item.subtext && (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {item.subtext}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )
      })}
    </Paper>
  )
}
