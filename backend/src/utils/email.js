/**
 * Utilitario de envio de email (nodemailer).
 *
 * - Se as variaveis SMTP_* estiverem definidas, usa esse servidor SMTP real.
 * - Caso contrario (dev), cria automaticamente uma conta de teste no Ethereal
 *   e loga uma URL de "preview" para visualizar o email no navegador.
 *   Assim da pra testar sem configurar nenhum servidor de email.
 */
const nodemailer = require("nodemailer")

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
 * Envia o email de redefinicao de senha com o link contendo o token.
 * @param {string} destino - Email do usuario.
 * @param {string} link - URL de redefinicao (frontend).
 * @param {{from?:string, replyTo?:string}} [remetente] - Config da incubadora.
 *        Se omitido, usa o remetente padrao (EMAIL_FROM).
 * @returns {Promise<string|false>} URL de preview (Ethereal) ou false.
 */
async function enviarEmailReset(destino, link, remetente = {}) {
  const transporter = await getTransporter()

  const info = await transporter.sendMail({
    // Remetente da incubadora, com fallback para o padrao.
    from: remetente.from || process.env.EMAIL_FROM || "Quiron <no-reply@quiron.local>",
    replyTo: remetente.replyTo || undefined,
    to: destino,
    subject: "Redefinicao de senha - Quiron",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2>Redefinicao de senha</h2>
        <p>Voce solicitou a redefinicao da sua senha no Quiron.</p>
        <p>Clique no botao abaixo para criar uma nova senha. O link expira em 1 hora.</p>
        <p style="text-align:center; margin: 24px 0;">
          <a href="${link}"
             style="background:#4f46e5;color:#fff;text-decoration:none;
                    padding:12px 24px;border-radius:8px;display:inline-block;">
            Redefinir senha
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">
          Se voce nao solicitou isso, ignore este email.
        </p>
      </div>
    `,
  })

  // No modo Ethereal, imprime a URL de preview do email.
  const preview = nodemailer.getTestMessageUrl(info)
  if (preview) console.log("[email] Preview do email de reset:", preview)

  return preview
}

module.exports = { enviarEmailReset }
