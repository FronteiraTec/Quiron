/**
 * Controller da credencial publica de selo (HTTP).
 *
 * Devolve HTML, e nao JSON: esta rota nao serve o app, serve o navegador de
 * quem clicou num link do LinkedIn — e o crawler que gera o preview nao
 * executa JavaScript (ver credencialService).
 *
 * NAO EXIGE TOKEN. A autorizacao e o proprio codigo aleatorio, mais o
 * `publico` que o dono da conquista ligou.
 */
const credencialService = require("../services/credencialService")

/**
 * A URL publica desta instalacao, como o visitante a enxerga.
 *
 * Sai dos cabecalhos porque quem responde esta atras do nginx: `req.protocol`
 * e sempre "http" aqui dentro, e a URL gravada na certificacao do LinkedIn
 * precisa ser a de fora.
 */
function baseUrlDe(req) {
  const protocolo = req.get("x-forwarded-proto") || req.protocol
  const host = req.get("x-forwarded-host") || req.get("host")
  return `${protocolo}://${host}`
}

async function pagina(req, res, next) {
  try {
    const { status, html } = await credencialService.pagina(req.params.codigo, baseUrlDe(req))
    res
      .status(status)
      .set("Content-Type", "text/html; charset=utf-8")
      // A pessoa decidiu poder COMPARTILHAR o link, o que nao e o mesmo que
      // pedir para o nome dela aparecer em busca.
      .set("X-Robots-Tag", "noindex")
      .send(html)
  } catch (err) {
    next(err)
  }
}

module.exports = { pagina }
