/**
 * Utilitario de envio de email (nodemailer).
 *
 * - Se as variaveis SMTP_* estiverem definidas, usa esse servidor SMTP real.
 * - Caso contrario (dev), cria automaticamente uma conta de teste no Ethereal
 *   e loga uma URL de "preview" para visualizar o email no navegador.
 *   Assim da pra testar sem configurar nenhum servidor de email.
 *
 * Aqui mora o TRANSPORTE e o LAYOUT — nao a regra de quem recebe o que. Quem
 * decide os destinatarios de cada aviso e o notificacaoService.
 */
const nodemailer = require("nodemailer")

const REMETENTE_PADRAO = "Quiron <no-reply@quiron.local>"

// Itens do corpo que ja sao elementos de bloco e nao devem ser embrulhados em <p>.
const BLOCO = /^\s*<(blockquote|div|table|ul|ol|p|h[1-6])\b/i

// Cria o transporter uma unica vez (memoizado).
let transporterPromise

async function getTransporter() {
  if (transporterPromise) return transporterPromise

  transporterPromise = (async () => {
    // SMTP real, se configurado.
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    }

    // Fallback de desenvolvimento: conta de teste Ethereal.
    const conta = await nodemailer.createTestAccount()
    console.log("[email] Modo teste (Ethereal). Login:", conta.user)
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: conta.user, pass: conta.pass },
    })
  })()

  return transporterPromise
}

/**
 * Envia um email para um ou varios destinatarios.
 *
 * Com mais de um destinatario a lista vai em BCC e o "to" fica sendo o proprio
 * remetente: sao pessoas de startups diferentes, e um "to" com todo mundo
 * entregaria a lista de emails da incubadora inteira a cada aviso.
 *
 * @param {object} params
 * @param {string|string[]} params.para - Destinatario(s).
 * @param {string} params.assunto
 * @param {string} params.html
 * @param {{from?:string, replyTo?:string}} [params.remetente] - Config da incubadora.
 * @returns {Promise<string|false>} URL de preview (Ethereal) ou false.
 */
async function enviarEmail({ para, assunto, html, remetente = {} }) {
  // Um destinatario invalido (usuario sem email cadastrado) nao pode derrubar
  // o aviso dos outros.
  const destinatarios = [...new Set([].concat(para).filter(Boolean))]
  if (destinatarios.length === 0) return false

  const transporter = await getTransporter()
  const from = remetente.from || process.env.EMAIL_FROM || REMETENTE_PADRAO
  const varios = destinatarios.length > 1

  const info = await transporter.sendMail({
    from,
    replyTo: remetente.replyTo || undefined,
    to: varios ? from : destinatarios[0],
    bcc: varios ? destinatarios : undefined,
    subject: assunto,
    html,
  })

  const preview = nodemailer.getTestMessageUrl(info)
  if (preview) console.log(`[email] Preview (${assunto}):`, preview)

  return preview
}

/**
 * Molde HTML compartilhado por todos os emails do sistema.
 *
 * @param {object} params
 * @param {string} params.titulo
 * @param {string[]} params.paragrafos - Cada item vira um <p>. Aceita HTML.
 * @param {{texto:string, url:string}} [params.acao] - Botao principal.
 * @param {string} [params.rodape]
 */
function layout({ titulo, paragrafos = [], acao, rodape }) {
  // Um item que ja e bloco (ex.: o blockquote do comentario do mentor) entra
  // como esta: <p><blockquote> e invalido, e cliente de email rigoroso quebra
  // o resto do corpo ao tentar consertar a aninhacao.
  const corpo = paragrafos
    .map((p) =>
      BLOCO.test(p) ? p : `<p style="color:#374151;line-height:1.6;margin:12px 0;">${p}</p>`
    )
    .join("")

  const botao = acao
    ? `<p style="text-align:center;margin:24px 0;">
         <a href="${acao.url}"
            style="background:#4f46e5;color:#fff;text-decoration:none;
                   padding:12px 24px;border-radius:8px;display:inline-block;">
           ${acao.texto}
         </a>
       </p>`
    : ""

  const nota = rodape
    ? `<p style="color:#6b7280;font-size:13px;margin-top:24px;">${rodape}</p>`
    : ""

  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
      <h2 style="color:#111827;">${titulo}</h2>
      ${corpo}
      ${botao}
      ${nota}
    </div>
  `
}

/**
 * Escapa texto vindo do banco (titulo de evento, comentario do mentor) antes de
 * interpolar no HTML. Sem isso, um apostrofo ou um "<" digitado pelo usuario
 * quebraria o email — e uma tag fecharia o layout no meio.
 */
function escapar(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Envia o email de redefinicao de senha com o link contendo o token.
 * @param {string} destino - Email do usuario.
 * @param {string} link - URL de redefinicao (frontend).
 * @param {{from?:string, replyTo?:string}} [remetente] - Config da incubadora.
 *        Se omitido, usa o remetente padrao (EMAIL_FROM).
 * @returns {Promise<string|false>} URL de preview (Ethereal) ou false.
 */
async function enviarEmailReset(destino, link, remetente = {}) {
  return enviarEmail({
    para: destino,
    assunto: "Redefinicao de senha - Quiron",
    remetente,
    html: layout({
      titulo: "Redefinicao de senha",
      paragrafos: [
        "Voce solicitou a redefinicao da sua senha no Quiron.",
        "Clique no botao abaixo para criar uma nova senha. O link expira em 1 hora.",
      ],
      acao: { texto: "Redefinir senha", url: link },
      rodape: "Se voce nao solicitou isso, ignore este email.",
    }),
  })
}

module.exports = { enviarEmail, layout, escapar, enviarEmailReset }
