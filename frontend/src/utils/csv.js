/**
 * Exportacao de tabela para CSV, no navegador.
 *
 * Roda no cliente porque o relatorio ja esta todo em memoria: pedir ao backend
 * um endpoint de exportacao significaria rodar a mesma agregacao de novo so
 * para mudar o formato da resposta.
 */

/** Escapa um valor para uma celula CSV. */
function celula(valor) {
  if (valor == null) return ""

  // Arrays (mentores, motivos de risco) viram uma lista legivel na celula.
  const texto = Array.isArray(valor) ? valor.join("; ") : String(valor)

  // Aspas, ponto-e-virgula e quebras de linha exigem o campo entre aspas.
  if (/[";\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

/**
 * Baixa `linhas` como CSV.
 *
 * Separador ";" e BOM UTF-8: e o que o Excel em pt-BR abre com acentos certos
 * e colunas separadas sem passar pelo assistente de importacao.
 *
 * @param {string} nomeArquivo - sem extensao
 * @param {Array<{chave: string, rotulo: string}>} colunas
 * @param {Array<object>} linhas
 */
export function baixarCsv(nomeArquivo, colunas, linhas) {
  const cabecalho = colunas.map((c) => celula(c.rotulo)).join(";")
  const corpo = linhas.map((l) => colunas.map((c) => celula(l[c.chave])).join(";"))

  const conteudo = "﻿" + [cabecalho, ...corpo].join("\r\n")
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
