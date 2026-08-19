/**
 * Onde encaixar uma coluna que voltou a ser exibida (ou que so apareceu
 * depois): ao lado do vizinho que ela tem na DEFINICAO da tabela, e nao no fim
 * da lista.
 *
 * Mora aqui, e nao dentro da tabela, porque duas coisas precisam da mesma
 * resposta: TabelaDados, quando as colunas dos campos personalizaveis chegam do
 * fetch depois do primeiro render, e GerenciarColunas, quando a pessoa remarca
 * uma coluna que havia escondido. Nos dois casos jogar a coluna para a ultima
 * posicao seria tecnicamente correto e visualmente errado — "Cidade" reapareceria
 * depois do progresso, longe de onde a tela a declarou.
 *
 * @param {string[]} ordem - chaves ja exibidas, na ordem da tela.
 * @param {Array<{chave: string}>} colunas - a definicao completa.
 * @param {string} chave - a coluna a posicionar.
 * @returns {number} indice para o splice.
 */
export function posicaoNatural(ordem, colunas, chave) {
  const idx = colunas.findIndex((c) => c.chave === chave)

  // Procura o vizinho mais proximo a esquerda que ja esta na tela: a coluna
  // entra logo depois dele.
  for (let i = idx - 1; i >= 0; i--) {
    const pos = ordem.indexOf(colunas[i].chave)
    if (pos !== -1) return pos + 1
  }
  // Nenhum vizinho a esquerda exibido: entra antes do primeiro vizinho a direita.
  for (let i = idx + 1; i < colunas.length; i++) {
    const pos = ordem.indexOf(colunas[i].chave)
    if (pos !== -1) return pos
  }
  return ordem.length
}
