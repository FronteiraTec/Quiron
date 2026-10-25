/**
 * Cliente do conversor de documentos: o servico `conversor` do
 * docker-compose.yml (Gotenberg, que e o LibreOffice atras de uma API HTTP).
 * Transforma apresentacao e .doc em PDF, para o incubado ver na propria
 * pagina da Jornada o que o navegador nao sabe desenhar.
 *
 * POR QUE UM SERVICO A PARTE, e nao o LibreOffice dentro da imagem da API:
 *
 *   memoria  o LibreOffice convertendo passa de 100MB, e a API tem teto de
 *            384MB. No mesmo container, um PPTX pesado faria o OOM matar a API
 *            inteira; separado, o pior caso e uma conversao que falha.
 *   rede     o conversor fica numa rede `internal`, sem saida. Um documento
 *            montado para buscar recurso remoto (imagem vinculada, objeto OLE)
 *            nao alcanca nada — nem a internet, nem o banco.
 *   imagem   a da API continua pequena e com o build de sempre.
 *
 * Sem CONVERSOR_URL (os testes, um ambiente sem o servico) a conversao
 * responde 503, e o front volta a oferecer o download.
 */
const { erroNegocio } = require("./erros")

// Um pouco acima do --api-timeout do conversor (45s), e os dois abaixo dos 60s
// do nginx: estourar la devolveria 504 em HTML, sem passar por aqui.
const TEMPO_LIMITE_MS = 50_000

/**
 * Converte um documento em PDF.
 *
 * @param {Buffer} bytes
 * @param {string} nomeArquivo - com a extensao: e por ela que o LibreOffice
 *   escolhe o leitor.
 * @returns {Promise<Buffer>} o PDF
 */
async function paraPdf(bytes, nomeArquivo) {
  // Lido a cada chamada, e nao na carga: os testes trocam o endereco.
  const base = (process.env.CONVERSOR_URL || "").replace(/\/+$/, "")
  if (!base) throw erroNegocio(503, "A conversao para PDF nao esta disponivel neste servidor.")

  const form = new FormData()
  form.append("files", new Blob([bytes]), nomeArquivo)

  let resposta
  try {
    resposta = await fetch(`${base}/forms/libreoffice/convert`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    })
  } catch (err) {
    console.error("[conversor] sem resposta:", err.message)
    throw erroNegocio(503, "O conversor de documentos nao respondeu. Tente de novo em instantes.")
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "")
    console.error(`[conversor] ${resposta.status} ao converter ${nomeArquivo}: ${detalhe.slice(0, 300)}`)
    // 503 e o conversor dizendo que estourou o tempo ou a fila: passa.
    if (resposta.status === 503 || resposta.status === 429) {
      throw erroNegocio(503, "O conversor de documentos esta ocupado. Tente de novo em instantes.")
    }
    throw erroNegocio(422, "Nao foi possivel converter este arquivo para PDF.")
  }

  return Buffer.from(await resposta.arrayBuffer())
}

module.exports = { paraPdf }
