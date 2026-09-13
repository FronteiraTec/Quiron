/**
 * O leitor de documentos — a aula do jeito que o incubado a ve.
 *
 * Mesmo motor e mesmo esquema do editor, e e esse o ponto: o que o autor
 * escreveu e exatamente o que aparece aqui, sem um segundo renderizador para
 * manter em dia a cada bloco novo.
 *
 * O que MUDA e tudo o que serve para editar: barra de formatacao, menu "/",
 * alca de arrastar, painel de arquivo, alcas de tabela, seletor de emoji. Sem
 * isso a pagina tem cara de documento pronto, e nao de formulario aberto.
 * Alem de aparencia, e menos coisa montada: cada um desses controles e um
 * componente que ficaria escutando selecao e posicao do cursor a toa.
 *
 * @param {Array} props.documento - documento no formato BlockNote
 */
import { Box } from "@mui/material"
import { useTheme } from "@mui/material/styles"
import { pt } from "@blocknote/core/locales"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/ariakit"
// Ver a nota em EditorDocumento.jsx: os pacotes do BlockNote nao importam a
// propria folha de estilos, e o leitor precisa dela tanto quanto o editor.
import "@blocknote/ariakit/style.css"
import { esquemaQuiron } from "./esquema"
import { estilosLeitura } from "./estilos"
import { conteudoInicial } from "./documento"

export default function VisualizadorDocumento({ documento }) {
  const theme = useTheme()

  const editor = useCreateBlockNote({
    schema: esquemaQuiron,
    initialContent: conteudoInicial(documento),
    dictionary: pt,
    // Sem o bloco fantasma do fim: ele existe para dar onde clicar e
    // continuar escrevendo, e aqui nao se escreve.
    trailingBlock: false,
  })

  return (
    <Box sx={estilosLeitura}>
      <BlockNoteView
        editor={editor}
        editable={false}
        theme={theme.palette.mode}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
        sideMenu={false}
        filePanel={false}
        tableHandles={false}
        emojiPicker={false}
      />
    </Box>
  )
}
