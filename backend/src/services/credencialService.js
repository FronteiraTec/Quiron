/**
 * A CREDENCIAL PUBLICA de um selo — a pagina que a pessoa cola no LinkedIn.
 *
 * POR QUE ELA E RENDERIZADA AQUI, E NAO E UMA ROTA DO REACT
 * O crawler do LinkedIn (e o do WhatsApp, e o do Slack) NAO EXECUTA
 * JAVASCRIPT: ele baixa o HTML, le as meta tags e vai embora. Numa rota do
 * SPA, a credencial de todo mundo teria o mesmo titulo generico do index.html
 * e nenhuma imagem — e o link compartilhado nao mostraria selo nenhum.
 * Servida daqui, ela chega pronta: titulo, descricao, imagem e o texto
 * verificavel ja no corpo da resposta.
 *
 * O segundo motivo e mais simples: a credencial precisa abrir para quem NAO
 * TEM LOGIN. Ela nao carrega o app, nao precisa de token e nao deve puxar 2MB
 * de bundle para mostrar um cartao.
 *
 * COMO ELA VAI PARAR NO PERFIL DO LINKEDIN — sem OAuth e sem app aprovado:
 *
 *   1. "Adicionar ao perfil" usa o deep link oficial de Licencas e
 *      Certificados (linkedin.com/profile/add?startTask=CERTIFICATION_NAME).
 *      O LinkedIn abre o formulario ja preenchido com nome, organizacao, data
 *      e a URL desta pagina como comprovante.
 *   2. "Compartilhar" usa o share-offsite, que publica o link no feed.
 *
 * Os dois sao URLs publicas. A alternativa — postar pela API em nome da
 * pessoa — exigiria app aprovado pela LinkedIn e um OAuth por usuario, para
 * entregar menos: o certificado no perfil vale mais que um post que some do
 * feed em dois dias.
 */
const seloService = require("./seloService")

/** Escapa texto para HTML. Tudo que vem do banco passa por aqui. */
function esc(valor) {
  if (valor === null || valor === undefined) return ""
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/** Torna absoluta uma URL relativa do proprio sistema (logo, imagem do selo). */
function absoluta(url, baseUrl) {
  if (!url) return null
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`
}

/** "22 de agosto de 2026" */
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]
function dataPorExtenso(valor) {
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

/** As iniciais do selo, para o disco colorido quando nao ha imagem. */
function iniciais(nome) {
  return (nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("")
}

/**
 * O deep link de "Adicionar ao perfil".
 *
 * `organizationId` (o id da pagina da incubadora no LinkedIn) e melhor que
 * `organizationName`: com ele a certificacao fica LIGADA a organizacao real,
 * com logo e link; sem ele, o LinkedIn guarda so o texto do nome.
 */
function linkAdicionarAoPerfil(credencial, urlCredencial) {
  const emissao = new Date(credencial.concedido_ts)
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: credencial.selo,
    issueYear: String(emissao.getFullYear()),
    issueMonth: String(emissao.getMonth() + 1),
    certUrl: urlCredencial,
    certId: credencial.codigo,
  })
  if (credencial.linkedin_org_id) params.set("organizationId", credencial.linkedin_org_id)
  else params.set("organizationName", credencial.incubadora)
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

function linkCompartilhar(urlCredencial) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(urlCredencial)}`
}

const ESTILO = `
:root {
  --fundo: #f6f7fb; --cartao: #ffffff; --texto: #101828; --suave: #5b667a;
  --linha: #e5e8ef; --sombra: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px rgba(16,24,40,.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --fundo: #0d1117; --cartao: #161b22; --texto: #e6edf3; --suave: #9aa7b8;
    --linha: #263041; --sombra: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.35);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 32px 16px 56px; background: var(--fundo); color: var(--texto);
  font-family: "Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  line-height: 1.55;
}
.cartao {
  max-width: 640px; margin: 0 auto; background: var(--cartao); border: 1px solid var(--linha);
  border-radius: 16px; box-shadow: var(--sombra); overflow: hidden;
}
.faixa { height: 6px; }
.corpo { padding: 32px 28px; }
.incubadora {
  display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--suave);
  text-transform: uppercase; letter-spacing: .08em; font-weight: 600; margin-bottom: 24px;
}
.incubadora img { height: 28px; width: auto; border-radius: 4px; }
.selo { display: flex; align-items: center; gap: 18px; margin-bottom: 8px; }
.disco {
  width: 76px; height: 76px; border-radius: 50%; flex: 0 0 76px; display: flex;
  align-items: center; justify-content: center; color: #fff; font-weight: 700;
  font-size: 26px; letter-spacing: .02em;
}
.disco img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
h1 { font-size: 26px; line-height: 1.2; margin: 0 0 4px; }
.categoria { font-size: 13px; color: var(--suave); }
.para { margin: 24px 0 4px; font-size: 14px; color: var(--suave); }
.pessoa { font-size: 22px; font-weight: 600; margin: 0; }
.meta { margin-top: 6px; font-size: 14px; color: var(--suave); }
.bloco { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--linha); }
.rotulo {
  font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--suave);
  font-weight: 700; margin-bottom: 6px;
}
.texto { margin: 0; white-space: pre-wrap; }
.acoes { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
.botao {
  display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 8px;
  font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid transparent;
}
.primario { background: #0a66c2; color: #fff; }
.secundario { border-color: var(--linha); color: var(--texto); }
.aviso {
  margin: 0 0 24px; padding: 14px 16px; border-radius: 10px; font-size: 14px;
  background: #fef3f2; border: 1px solid #fda29b; color: #912018;
}
@media (prefers-color-scheme: dark) {
  .aviso { background: #3b1614; border-color: #7a271a; color: #fda29b; }
}
.rodape {
  max-width: 640px; margin: 20px auto 0; text-align: center; font-size: 12.5px;
  color: var(--suave);
}
.codigo { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
`

/** A pagina de "credencial nao encontrada" (tambem serve a privada). */
function paginaNaoEncontrada() {
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Credencial não encontrada</title>
<style>${ESTILO}</style>
</head><body>
  <div class="cartao"><div class="faixa" style="background:#94a3b8"></div>
    <div class="corpo">
      <h1>Credencial não encontrada</h1>
      <p class="meta">Este código não corresponde a nenhuma credencial pública. Ele pode ter
      sido digitado incorretamente, ou a pessoa que o recebeu ainda não tornou a conquista
      pública.</p>
    </div>
  </div>
</body></html>`
}

/**
 * Monta a pagina da credencial.
 *
 * `noindex` de proposito: a pessoa decidiu tornar a conquista publica para
 * poder compartilhar o link, o que nao e o mesmo que pedir para o nome dela
 * aparecer em busca. Quem tem o link ve; buscador nao indexa.
 */
function renderizar(credencial, baseUrl) {
  const url = `${baseUrl}/credencial/${encodeURIComponent(credencial.codigo)}`
  const imagem = absoluta(credencial.imagem_url, baseUrl)
  const logo = absoluta(credencial.incubadora_logo, baseUrl)
  const revogada = Boolean(credencial.revogado_ts)
  const cor = /^#[0-9a-fA-F]{6}$/.test(credencial.cor || "") ? credencial.cor : "#7c3aed"

  const titulo = `${credencial.selo} — ${credencial.usuario}`
  const descricao = revogada
    ? `Credencial revogada pela ${credencial.incubadora}.`
    : credencial.criterio ||
      credencial.descricao ||
      `Selo concedido por ${credencial.incubadora} a ${credencial.usuario}.`

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${esc(url)}">
${imagem ? `<meta property="og:image" content="${esc(imagem)}">` : ""}
<meta name="twitter:card" content="summary${imagem ? "_large_image" : ""}">
<style>${ESTILO}</style>
</head><body>
  <div class="cartao">
    <div class="faixa" style="background:${esc(cor)}"></div>
    <div class="corpo">
      ${
        revogada
          ? `<p class="aviso"><strong>Credencial revogada</strong> em
             ${esc(dataPorExtenso(credencial.revogado_ts))}.${
              credencial.motivo_revogacao ? ` Motivo: ${esc(credencial.motivo_revogacao)}` : ""
            }</p>`
          : ""
      }

      <div class="incubadora">
        ${logo ? `<img src="${esc(logo)}" alt="">` : ""}
        <span>${esc(credencial.incubadora)}</span>
      </div>

      <div class="selo">
        <div class="disco" style="background:${esc(cor)}">
          ${
            imagem
              ? `<img src="${esc(imagem)}" alt="${esc(credencial.selo)}">`
              : esc(iniciais(credencial.selo))
          }
        </div>
        <div>
          <h1>${esc(credencial.selo)}</h1>
          ${credencial.categoria ? `<div class="categoria">${esc(credencial.categoria)}</div>` : ""}
        </div>
      </div>

      <p class="para">Concedido a</p>
      <p class="pessoa">${esc(credencial.usuario)}</p>
      <p class="meta">
        ${credencial.startup ? `${esc(credencial.startup)} &middot; ` : ""}
        ${esc(dataPorExtenso(credencial.concedido_ts))}
      </p>

      ${
        credencial.criterio
          ? `<div class="bloco"><div class="rotulo">Critério do selo</div>
             <p class="texto">${esc(credencial.criterio)}</p></div>`
          : ""
      }
      ${
        credencial.justificativa
          ? `<div class="bloco"><div class="rotulo">Por que foi concedido</div>
             <p class="texto">${esc(credencial.justificativa)}</p></div>`
          : ""
      }
      ${
        credencial.evidencia_url
          ? `<div class="bloco"><div class="rotulo">Evidência</div>
             <p class="texto"><a href="${esc(credencial.evidencia_url)}" rel="nofollow noopener"
             target="_blank">${esc(credencial.evidencia_url)}</a></p></div>`
          : ""
      }

      ${
        revogada
          ? ""
          : `<div class="acoes">
               <a class="botao primario" target="_blank" rel="noopener"
                  href="${esc(linkAdicionarAoPerfil(credencial, url))}">Adicionar ao perfil do LinkedIn</a>
               <a class="botao secundario" target="_blank" rel="noopener"
                  href="${esc(linkCompartilhar(url))}">Compartilhar</a>
             </div>`
      }
    </div>
  </div>
  <p class="rodape">
    Credencial verificável emitida por ${esc(credencial.incubadora)} &middot;
    código <span class="codigo">${esc(credencial.codigo)}</span>
  </p>
</body></html>`
}

/**
 * Resolve o codigo e devolve o HTML pronto, com o status.
 *
 * Codigo inexistente e credencial privada respondem o MESMO 404: distinguir os
 * dois ja diria a um curioso que aquele codigo existe.
 */
async function pagina(codigo, baseUrl) {
  const credencial = await seloService.buscarCredencial(codigo)
  if (!credencial) return { status: 404, html: paginaNaoEncontrada() }
  return { status: 200, html: renderizar(credencial, baseUrl) }
}

module.exports = { pagina }
