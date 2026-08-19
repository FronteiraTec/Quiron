/**
 * Exportacao de uma TabelaDados para CSV.
 *
 * EXPORTA O QUE ESTA NA TELA, e nao a definicao inteira: as colunas visiveis,
 * na ordem em que aparecem, sobre as linhas ja filtradas. E o que a pessoa
 * espera de um botao ao lado de uma tabela que ela acabou de moldar — exportar
 * as 20 colunas quando so 6 estao a vista seria uma planilha diferente do que
 * ela esta lendo.
 *
 * As celulas saem de `valorTexto` da coluna (o `render` devolve JSX, que nao
 * cabe numa planilha) e, sem ele, do campo cru da linha.
 */
import { baixarCsv } from "../../utils/csv"

/**
 * @param {string} nomeArquivo - sem extensao.
 * @param {Array} colunas - a definicao completa das colunas.
 * @param {string[]} chavesVisiveis - as colunas exibidas, na ordem da tela.
 * @param {Array<object>} linhas - as linhas ja filtradas.
 */
export function exportarTabelaCsv(nomeArquivo, colunas, chavesVisiveis, linhas) {
  const exibidas = chavesVisiveis
    .map((chave) => colunas.find((c) => c.chave === chave))
    .filter(Boolean)

  const linhasTexto = linhas.map((linha) =>
    Object.fromEntries(
      exibidas.map((coluna) => [
        coluna.chave,
        coluna.valorTexto ? coluna.valorTexto(linha) : linha[coluna.chave],
      ])
    )
  )

  baixarCsv(
    nomeArquivo,
    exibidas.map((c) => ({ chave: c.chave, rotulo: c.rotulo })),
    linhasTexto
  )
}
