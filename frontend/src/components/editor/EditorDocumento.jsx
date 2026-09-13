/**
 * O editor de documentos do Quiron — blocos, no espirito do Notion.
 *
 * Motor: BlockNote. Atalhos de markdown ("# ", "- ", "> ", "1. ", "```"),
 * atalhos de teclado (Ctrl/Cmd+B/I/U/K), menu "/", alca de arrastar e
 * aninhamento com Tab vem todos dele — nada disso e reimplementado aqui.
 *
 * O que este componente acrescenta e o encaixe no Quiron: o esquema com os
 * blocos da casa (esquema.jsx), as cores e a tipografia do painel
 * (estilos.js), o menu "/" desenhado com MUI (MenuBlocos.jsx), o envio de
 * imagem pela API de arquivos que ja existe, e a adaptacao do celular.
 *
 * NAO E CONTROLADO. O documento vive dentro do editor; `documento` e so o
 * estado inicial. E assim de proposito: um editor de texto controlado
 * refaz o conteudo a cada tecla e briga com o cursor. Para trocar o
 * documento exibido, troque a `key` do componente.
 *
 * @param {Array}    props.documento - documento inicial (formato BlockNote)
 * @param {Function} props.onChange  - recebe o documento a cada alteracao
 * @param {boolean}  props.editavel  - false deixa so a leitura
 * @param {number}   props.idTenant  - dono das imagens enviadas
 */
import { useMemo } from "react"
import { Box, useMediaQuery, useTheme } from "@mui/material"
import { filterSuggestionItems } from "@blocknote/core"
import { pt } from "@blocknote/core/locales"
import {
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  SideMenuController,
  SideMenu,
  DragHandleButton,
  AddBlockButton,
  FormattingToolbarController,
  FormattingToolbar,
  ExperimentalMobileFormattingToolbarController,
} from "@blocknote/react"
import { BlockNoteView } from "@blocknote/ariakit"
// A folha de estilos do BlockNote. Os pacotes publicados NAO a importam
// sozinhos (o `import "./style.css"` existe so no fonte em TypeScript), entao
// sem esta linha o editor sobe sem marcador de lista, sem caixa de checklist e
// sem os menus flutuantes posicionados — e sem nenhum erro no console.
//
// A da @blocknote/ariakit ja contem a do core e a do react inteiras; importar
// as tres traria as mesmas regras tres vezes. Fica junto do componente que
// monta o editor, e nao no main.jsx, para viajar no mesmo pedaco carregado sob
// demanda — quem nunca abre uma aula nao baixa 54KB de CSS.
import "@blocknote/ariakit/style.css"
import { esquemaQuiron, itensDosBlocosQuiron } from "./esquema"
import MenuBlocos, { ajustarItensNativos } from "./MenuBlocos"
import { estilosDocumento } from "./estilos"
import { conteudoInicial } from "./documento"
import { enviarArquivo, reduzirImagem } from "../../services/arquivos"

// Lado maximo da imagem gravada. Uma foto de celular tem 4000px de largura e
// aparece numa coluna de 700 — subir o original gastaria disco e faria o
// incubado baixar megabytes para ler uma aula. O regime PUBLICO tambem tem
// teto de 2MB (arquivoService), que uma foto crua estoura com facilidade.
const LADO_MAX_IMAGEM = 1600

// O texto que aparece no bloco vazio. O dicionario `pt` do BlockNote traz
// "Digite texto ou use '/' para comandos"; aqui ele fala como o resto do
// Quiron fala com quem escreve uma aula.
const DICIONARIO = {
  ...pt,
  placeholders: {
    ...pt.placeholders,
    default: "Escreva aqui, ou digite '/' para inserir um bloco…",
  },
  file_panel: {
    ...pt.file_panel,
    upload: {
      ...pt.file_panel.upload,
      // O padrao e "Erro: Falha no upload", que nao diz o que fazer. Os dois
      // motivos que aparecem na pratica sao tamanho e formato, entao a
      // mensagem ja os nomeia — o resto vai para o console (ver uploadFile).
      upload_error:
        "Não foi possível enviar. A imagem precisa ter até 2 MB e ser PNG, JPG, WebP ou GIF.",
    },
  },
}

export default function EditorDocumento({
  documento,
  onChange,
  editavel = true,
  idTenant,
}) {
  const theme = useTheme()
  const celular = useMediaQuery(theme.breakpoints.down("sm"))

  const editor = useCreateBlockNote({
    schema: esquemaQuiron,
    initialContent: conteudoInicial(documento),
    dictionary: DICIONARIO,
    // Imagem e o unico bloco de arquivo do esquema, entao todo envio que
    // passa por aqui e imagem. Sobe como PUBLICO porque termina num
    // <img src>, e a tag nao manda cabecalho Authorization — a mesma razao
    // do logo do conteudo (ver LogoConteudo).
    uploadFile: async (arquivo) => {
      if (!arquivo.type.startsWith("image/")) {
        throw new Error("Só é possível enviar imagens. Use o bloco Anexo para outros arquivos.")
      }

      try {
        const reduzida = await reduzirImagem(arquivo, { ladoMax: LADO_MAX_IMAGEM })
        const enviada = await enviarArquivo(reduzida, { idTenant, visibilidade: "PUBLICO" })
        return enviada.url
      } catch (err) {
        // O painel de arquivo mostra uma frase fixa (ver DICIONARIO). O motivo
        // real — 500 do servidor, rede fora, tipo recusado — so existe aqui,
        // entao vai para o console: sem isto, um upload quebrado vira "nao
        // funciona" sem nenhum rastro para seguir.
        console.error(
          "[Quiron] falha ao enviar a imagem:",
          err?.response?.status,
          err?.response?.data?.erro || err?.message
        )
        throw err
      }
    },
  })

  // Os itens do menu "/": os nativos (ja em portugues, recortados e com os
  // icones do Quiron) seguidos dos blocos da casa.
  const itens = useMemo(
    () => [...ajustarItensNativos(getDefaultReactSlashMenuItems(editor)), ...itensDosBlocosQuiron(editor)],
    [editor]
  )

  return (
    <Box sx={estilosDocumento}>
      <BlockNoteView
        editor={editor}
        editable={editavel}
        theme={theme.palette.mode}
        onChange={() => onChange?.(editor.document)}
        // Substituidos logo abaixo pelas versoes adaptadas.
        slashMenu={false}
        sideMenu={false}
        formattingToolbar={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          suggestionMenuComponent={MenuBlocos}
          getItems={async (consulta) => filterSuggestionItems(itens, consulta)}
        />

        {/*
          No celular a barra de formatacao flutuante disputa espaco com as
          alcas de selecao do proprio sistema e com o teclado virtual. A
          versao movel do BlockNote se ancora acima do teclado, que e o
          comportamento que se espera de um app no telefone.
        */}
        {celular ? (
          <ExperimentalMobileFormattingToolbarController />
        ) : (
          <FormattingToolbarController formattingToolbar={FormattingToolbar} />
        )}

        {/*
          A calha lateral encolhe no celular (ver estilos.js) e so cabe uma
          alca. Fica a de ARRASTAR, que tambem abre o menu do bloco; inserir
          bloco continua possivel pelo "/", que no telefone e mais rapido que
          mirar um botao de 24px.
        */}
        <SideMenuController
          sideMenu={(props) => (
            <SideMenu {...props}>
              {!celular && <AddBlockButton {...props} />}
              <DragHandleButton {...props} />
            </SideMenu>
          )}
        />
      </BlockNoteView>
    </Box>
  )
}
