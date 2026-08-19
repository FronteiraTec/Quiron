/**
 * Tabela dos relatorios.
 *
 * Um relatorio so vira decisao quando da para reordena-lo: a mesma tabela
 * responde "quem esta mais atrasado?" e "quem avancou mais?" dependendo da
 * coluna clicada. A tabela tambem e a "view em tabela" que os graficos exigem
 * por acessibilidade: nenhum numero existe apenas dentro de um grafico.
 *
 * POR DENTRO E A MESMA TabelaDados DAS LISTAGENS. Este arquivo continua
 * existindo por causa da API que as cinco telas de relatorio ja usam
 * (`colunas` com `chave`/`rotulo`, `linhas`, `chaveId`) e das duas escolhas que
 * so valem aqui:
 *
 *   - coluna nova abre em DESC ("pior primeiro"), que e a pergunta de um
 *     relatorio; numa listagem de nomes o esperado e o alfabetico;
 *   - celula sem `render` proprio formata nulo como travessao e array como
 *     lista, porque os dados vem de agregacoes que devolvem as duas coisas.
 *
 * O que os relatorios ganharam ao passar por ela: paginacao, escolha de colunas
 * e arrasto de cabecalho, iguais aos das listagens.
 */
import { Paper } from "@mui/material"
import TabelaDados from "../tabela/TabelaDados"

/** Celula sem render proprio: nulo vira travessao, array vira lista. */
function formatar(valor) {
  if (valor == null || valor === "") return "—"
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "—"
  return valor
}

/**
 * @param {object} props
 * @param {Array<{
 *   chave: string, rotulo: string, alinhamento?: "left"|"right"|"center",
 *   render?: (linha: object) => React.ReactNode, ordenavel?: boolean,
 *   ajuda?: string
 * }>} props.colunas
 * @param {Array<object>} props.linhas
 * @param {string} props.chaveId - campo unico de cada linha
 * @param {string} [props.chaveStorage] - nome da tabela; com ele, as colunas
 *   exibidas e a ordem delas ficam guardadas no navegador. Precisa ser unico
 *   por tabela — duas telas com a mesma chave trocariam de configuracao.
 * @param {string} [props.ordemInicial] - coluna ordenada ao abrir
 * @param {"asc"|"desc"} [props.direcaoInicial]
 * @param {(linha: object) => void} [props.onClickLinha]
 * @param {string} [props.mensagemVazio]
 */
export default function TabelaRelatorio({
  colunas,
  linhas,
  chaveId,
  chaveStorage,
  ordemInicial,
  direcaoInicial = "desc",
  onClickLinha,
  mensagemVazio = "Nada a exibir no período.",
}) {
  const colunasTabela = colunas.map((c) => ({
    ...c,
    render: c.render || ((linha) => formatar(linha[c.chave])),
  }))

  return (
    // O Paper e daqui, e nao das telas: `relatorio-tabela` e o alvo do tour em
    // todos os cinco relatorios.
    <Paper data-tour="relatorio-tabela" sx={{ borderRadius: 0 }}>
      <TabelaDados
        dados={linhas}
        colunas={colunasTabela}
        chaveId={chaveId}
        chaveStorage={chaveStorage}
        ordemInicial={ordemInicial ?? colunas[0]?.chave}
        direcaoInicial={direcaoInicial}
        direcaoPadraoColuna="desc"
        onClickLinha={onClickLinha}
        mensagemVazio={mensagemVazio}
        // Relatorio nao tem coluna de nome longo como as listagens; a largura
        // minima menor evita rolagem horizontal em tabela de quatro colunas.
        larguraMinima={640}
      />
    </Paper>
  )
}
