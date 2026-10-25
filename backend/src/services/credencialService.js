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
const { ICONES_SVG } = require("../engajamento/iconesSvg")

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

/** As iniciais de um nome, para a marca da incubadora quando nao ha logo. */
function iniciais(nome) {
  return (nome || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("")
}

/**
 * Branco ou quase-preto, o que ler melhor sobre a cor do selo.
 *
 * A cor e escolha da incubadora, e as claras (amarelo, ciano) com texto branco
 * por cima ficariam ilegiveis justamente na faixa com o nome do selo.
 */
function textoSobre(hex) {
  const canal = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminancia = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5)
  return luminancia > 0.4 ? "#101828" : "#ffffff"
}

/**
 * O icone do selo como <svg>. Os paths sao estaticos (iconesSvg.js); do banco
 * so vem o NOME, usado como chave — por isso nao passa por esc().
 */
function svgIcone(nome) {
  const desenho = ICONES_SVG[nome] || ICONES_SVG.MilitaryTech
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${desenho}</svg>`
}

/** Os seis vertices de um hexagono de ponta para cima. */
function hexagono(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const angulo = ((i * 60 - 90) * Math.PI) / 180
    return `${(cx + r * Math.cos(angulo)).toFixed(1)},${(cy + r * Math.sin(angulo)).toFixed(1)}`
  }).join(" ")
}

/**
 * O miolo da arte gerada: grade escura, medalha hexagonal com o icone e os
 * "pixels" nos cantos. SVG, e nao CSS, para a composicao inteira escalar junta
 * do desktop ao celular.
 */
function miolo(cor, sobre, icone) {
  const L = 15 // lado da celula da grade
  // O centro da cruz e sempre claro: ele fica sobre o fundo escuro, e nao
  // sobre a cor do selo, entao `sobre` (que pode ser escuro) sumiria ali.
  const cruz = (x, y) =>
    [[0, 0], [-L, 0], [L, 0], [0, -L], [0, L]]
      .map(
        ([dx, dy], i) =>
          `<rect x="${x + dx}" y="${y + dy}" width="${L}" height="${L}" fill="${
            i === 0 ? "#fff" : cor
          }"${i === 0 ? ' fill-opacity=".85"' : ""}/>`
      )
      .join("")
  const solto = (x, y) =>
    `<rect x="${x}" y="${y}" width="${L}" height="${L}" fill="${cor}" fill-opacity=".45"/>`

  return `<svg class="arte-miolo" viewBox="0 0 300 165" preserveAspectRatio="xMidYMid slice"
              aria-hidden="true">
    <defs>
      <pattern id="grade" width="${L}" height="${L}" patternUnits="userSpaceOnUse">
        <path d="M${L} 0H0V${L}" fill="none" stroke="#fff" stroke-opacity=".07"/>
      </pattern>
    </defs>
    <rect width="300" height="165" fill="#121721"/>
    <rect width="300" height="165" fill="url(#grade)"/>
    ${cruz(30, 30)}${cruz(255, 30)}${cruz(30, 120)}${cruz(255, 120)}
    ${solto(75, 15)}${solto(210, 15)}${solto(75, 135)}${solto(210, 135)}
    ${solto(0, 75)}${solto(285, 75)}
    <polygon points="${hexagono(150, 82.5, 70)}" fill="none" stroke="${cor}"
             stroke-width="2" stroke-opacity=".55"/>
    <polygon points="${hexagono(150, 82.5, 58)}" fill="${cor}"/>
    <svg x="122" y="54.5" width="56" height="56" viewBox="0 0 24 24" fill="${sobre}">
      ${ICONES_SVG[icone] || ICONES_SVG.MilitaryTech}
    </svg>
  </svg>`
}

/**
 * A arte do selo, no formato dos badges de credencial (Credly e afins): faixa
 * com o nome, miolo com a medalha, faixa com quem emite.
 *
 * Quando a incubadora SOBE UMA ARTE (imagem_url), ela manda: a arte gerada so
 * existe para o selo sem imagem nao parecer de segunda categoria.
 */
function arte(credencial, { cor, sobre, imagem, logo, revogada }) {
  const classe = `arte${revogada ? " revogada" : ""}`
  if (imagem) {
    return `<div class="${classe} arte-imagem">
      <img src="${esc(imagem)}" alt="${esc(credencial.selo)}">
    </div>`
  }
  return `<div class="${classe}" style="--cor:${esc(cor)};--sobre:${esc(sobre)}" role="img"
       aria-label="${esc(`Selo ${credencial.selo}, emitido por ${credencial.incubadora}`)}">
    <div class="arte-topo">
      <span class="arte-nome">${esc(credencial.selo)}</span>
      <span class="arte-marca">${
        logo ? `<img src="${esc(logo)}" alt="">` : esc(iniciais(credencial.incubadora))
      }</span>
    </div>
    ${miolo(cor, sobre, credencial.icone)}
    <div class="arte-base">
      <span class="arte-selo">${svgIcone("Verified")}</span>
      <span class="arte-emissor">${esc(credencial.incubadora)}</span>
    </div>
  </div>`
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
  --linha: #e5e8ef; --chip: #f1f3f8; --link: #0a66c2;
  --ok-fundo: #ecfdf3; --ok-texto: #067647; --ok-linha: #abefc6;
  --sombra: 0 1px 2px rgba(16,24,40,.06), 0 12px 32px rgba(16,24,40,.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --fundo: #0d1117; --cartao: #161b22; --texto: #e6edf3; --suave: #9aa7b8;
    --linha: #263041; --chip: #1f2632; --link: #4aa3ff;
    --ok-fundo: #0b2a1c; --ok-texto: #75e0a7; --ok-linha: #13573a;
    --sombra: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.35);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 40px 16px 56px; background: var(--fundo); color: var(--texto);
  font-family: "Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
  line-height: 1.55;
}
.pagina { max-width: 1040px; margin: 0 auto; }
.grade {
  display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 48px;
  align-items: start;
}
@media (max-width: 760px) {
  body { padding-top: 24px; }
  .grade { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .arte { max-width: 320px; margin: 0 auto; }
}

/* --- a arte do selo -------------------------------------------------- */
.arte {
  width: 100%; aspect-ratio: 1; display: flex; flex-direction: column;
  border-radius: 4px; overflow: hidden; background: #121721;
  box-shadow: var(--sombra); border: 1px solid rgba(255,255,255,.06);
}
.arte.revogada { filter: grayscale(1); opacity: .6; }
.arte-imagem { background: var(--cartao); border-color: var(--linha); }
.arte-imagem img { width: 100%; height: 100%; object-fit: contain; }
.arte-topo {
  display: grid; grid-template-columns: 1fr 26%; background: var(--cor); color: var(--sobre);
  min-height: 27%;
}
.arte-nome {
  padding: 14px 16px; font-size: clamp(18px, 8.6cqi, 28px); font-weight: 600;
  line-height: 1.12; display: flex; align-items: center; overflow-wrap: anywhere;
}
.arte { container-type: inline-size; }
.arte-marca {
  display: flex; align-items: center; justify-content: center; padding: 10px;
  border-left: 1px solid color-mix(in srgb, var(--sobre) 25%, transparent);
  font-weight: 700; font-size: clamp(16px, 7cqi, 24px); letter-spacing: .02em;
}
.arte-marca img {
  max-width: 100%; max-height: 52px; object-fit: contain; background: #fff;
  border-radius: 6px; padding: 4px;
}
.arte-miolo { display: block; width: 100%; flex: 1; min-height: 0; }
.arte-base {
  display: grid; grid-template-columns: 22% 1fr; flex: 0 0 22%;
  border-top: 1px solid rgba(255,255,255,.08); color: #e6edf3;
}
.arte-selo {
  display: flex; align-items: center; justify-content: center; color: var(--cor);
  border-right: 1px solid rgba(255,255,255,.08);
}
.arte-selo svg { width: 46%; height: auto; }
.arte-emissor {
  display: flex; align-items: center; padding: 0 16px;
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: clamp(12px, 4.6cqi, 16px); overflow-wrap: anywhere; line-height: 1.25;
}

/* --- as informacoes -------------------------------------------------- */
h1 {
  font-family: Georgia, "Times New Roman", serif; font-size: clamp(28px, 4vw, 38px);
  line-height: 1.15; margin: 0 0 10px; font-weight: 700; letter-spacing: -.01em;
}
.emissor { margin: 0; color: var(--suave); }
.emissor strong { color: var(--texto); font-weight: 600; }
.destinatario {
  margin-top: 24px; padding: 18px 20px; border: 1px solid var(--linha); border-radius: 12px;
  background: var(--cartao); display: flex; gap: 16px; align-items: flex-start;
  justify-content: space-between; flex-wrap: wrap;
}
.rotulo {
  font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--suave);
  font-weight: 700; margin-bottom: 4px;
}
.pessoa { font-size: 21px; font-weight: 600; margin: 0; line-height: 1.3; }
.meta { margin: 4px 0 0; font-size: 14px; color: var(--suave); }
.status {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 8px;
  border-radius: 999px; font-size: 13px; font-weight: 600; white-space: nowrap;
  background: var(--ok-fundo); color: var(--ok-texto); border: 1px solid var(--ok-linha);
}
.status svg { width: 16px; height: 16px; }
.status.revogada { background: #fef3f2; color: #b42318; border-color: #fda29b; }
@media (prefers-color-scheme: dark) {
  .status.revogada { background: #3b1614; color: #fda29b; border-color: #7a271a; }
}
.acoes { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
.botao {
  display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 8px;
  font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid transparent;
}
.primario { background: #0a66c2; color: #fff; }
.primario:hover { background: #004182; }
.secundario { border-color: var(--linha); color: var(--texto); background: var(--cartao); }
.descricao { margin: 28px 0 0; font-size: 17px; }
.secao { margin-top: 32px; }
h2 { font-size: 17px; margin: 0 0 10px; font-weight: 700; }
.criterios { margin: 0; padding-left: 22px; }
.criterios li { padding-left: 4px; }
.texto { margin: 0; white-space: pre-wrap; }
.texto a { color: var(--link); overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; }
.chip {
  padding: 7px 14px; border: 1px solid var(--linha); border-radius: 6px; font-size: 14.5px;
  background: var(--chip);
}
.aviso {
  margin: 0 0 28px; padding: 14px 16px; border-radius: 10px; font-size: 14px;
  background: #fef3f2; border: 1px solid #fda29b; color: #912018;
}
@media (prefers-color-scheme: dark) {
  .aviso { background: #3b1614; border-color: #7a271a; color: #fda29b; }
}
.rodape {
  margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--linha);
  font-size: 13px; color: var(--suave); text-align: center;
}
.codigo { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }

/* --- a pagina de "nao encontrada" ------------------------------------ */
.cartao {
  max-width: 640px; margin: 0 auto; background: var(--cartao); border: 1px solid var(--linha);
  border-radius: 16px; box-shadow: var(--sombra); overflow: hidden;
}
.faixa { height: 6px; }
.corpo { padding: 32px 28px; }
.corpo h1 { font-size: 26px; }
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
  const sobre = textoSobre(cor)

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
  <main class="pagina">
    ${
      revogada
        ? `<p class="aviso"><strong>Credencial revogada</strong> em
           ${esc(dataPorExtenso(credencial.revogado_ts))}.${
            credencial.motivo_revogacao ? ` Motivo: ${esc(credencial.motivo_revogacao)}` : ""
          }</p>`
        : ""
    }

    <div class="grade">
      ${arte(credencial, { cor, sobre, imagem, logo, revogada })}

      <div>
        <h1>${esc(credencial.selo)}</h1>
        <p class="emissor">Emitido por <strong>${esc(credencial.incubadora)}</strong></p>

        <div class="destinatario">
          <div>
            <div class="rotulo">Concedido a</div>
            <p class="pessoa">${esc(credencial.usuario)}</p>
            <p class="meta">${credencial.startup ? `${esc(credencial.startup)} &middot; ` : ""}${esc(
              dataPorExtenso(credencial.concedido_ts)
            )}</p>
          </div>
          ${
            revogada
              ? `<span class="status revogada">Revogada</span>`
              : `<span class="status">${svgIcone("Verified")}Credencial válida</span>`
          }
        </div>

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

        ${credencial.descricao ? `<p class="descricao">${esc(credencial.descricao)}</p>` : ""}

        ${
          credencial.criterio
            ? `<section class="secao"><h2>Critério para obter</h2>
               <ul class="criterios"><li>${esc(credencial.criterio)}</li></ul></section>`
            : ""
        }
        ${
          credencial.justificativa
            ? `<section class="secao"><h2>Por que foi concedido</h2>
               <p class="texto">${esc(credencial.justificativa)}</p></section>`
            : ""
        }
        ${
          credencial.evidencia_url
            ? `<section class="secao"><h2>Evidência</h2>
               <p class="texto"><a href="${esc(credencial.evidencia_url)}" rel="nofollow noopener"
               target="_blank">${esc(credencial.evidencia_url)}</a></p></section>`
            : ""
        }
        ${
          credencial.categoria
            ? `<section class="secao"><h2>Categoria</h2>
               <div class="chips"><span class="chip">${esc(credencial.categoria)}</span></div></section>`
            : ""
        }
      </div>
    </div>

    <p class="rodape">
      Credencial verificável emitida por ${esc(credencial.incubadora)} &middot;
      código <span class="codigo">${esc(credencial.codigo)}</span>
    </p>
  </main>
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
