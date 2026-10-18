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
const path = require("path")
const nodemailer = require("nodemailer")

const REMETENTE_PADRAO = "Quiron <no-reply@quiron.local>"

// Ilustracoes vao EMBUTIDAS na mensagem (anexo inline, referenciado por
// cid:), nao por URL: Gmail descarta imagem em data: URI, e um link para o
// servidor quebraria em dev, onde o FRONTEND_URL e localhost.
const ASSETS = path.join(__dirname, "../assets/email")

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
 * @param {object[]} [params.anexos] - Anexos no formato do nodemailer; com
 *        `cid`, viram imagem embutida no corpo.
 * @returns {Promise<string|false>} URL de preview (Ethereal) ou false.
 */
async function enviarEmail({ para, assunto, html, remetente = {}, anexos }) {
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
    attachments: anexos,
  })

  const preview = nodemailer.getTestMessageUrl(info)
  if (preview) console.log(`[email] Preview (${assunto}):`, preview)

  return preview
}

/**
 * Cabecalho de todos os emails: a faixa preta com o nome e o traco lima, como
 * a barra do topo do sistema. Cliente de email nao carrega webfont com
 * confianca, entao o nome vai em Impact — o parente de sistema mais proximo da
 * Anton.
 */
function cabecalho() {
  return `
    <div style="background:#000000;padding:14px 24px;border-bottom:4px solid #76db00;">
      <span style="font-family: Impact, 'Arial Narrow', Arial, sans-serif;font-size:22px;
                   letter-spacing:1px;color:#ffffff;">QUIRON</span>
    </div>`
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
      BLOCO.test(p) ? p : `<p style="color:#404040;line-height:1.6;margin:12px 0;">${p}</p>`
    )
    .join("")

  // Botao no par da identidade visual (ver frontend/src/theme.js): lima com
  // texto preto — branco sobre lima seria ilegivel.
  const botao = acao
    ? `<p style="text-align:center;margin:24px 0;">
         <a href="${acao.url}"
            style="background:#76db00;color:#0a0a0a;text-decoration:none;font-weight:bold;
                   padding:12px 24px;border-radius:8px;display:inline-block;">
           ${acao.texto}
         </a>
       </p>`
    : ""

  const nota = rodape
    ? `<p style="color:#737373;font-size:13px;margin-top:24px;">${rodape}</p>`
    : ""

  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: auto;">
      ${cabecalho()}
      <div style="padding:8px 24px 16px;">
        <h2 style="color:#0a0a0a;">${titulo}</h2>
        ${corpo}
        ${botao}
        ${nota}
      </div>
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
 * Corpo do email de redefinicao de senha.
 *
 * Nao usa o layout() dos avisos: e o email que a pessoa recebe quando esta
 * travada fora do sistema, entao ganhou ilustracao e texto centralizado.
 * Estrutura em <table> com estilo inline porque Outlook e Gmail ignoram
 * boa parte do CSS de <div> (largura maxima, centralizacao, padding).
 *
 * Cores: botao lima com texto preto (11:1), como o botao principal do sistema;
 * o link em texto usa um verde escurecido (#3a7d00, 5:1) — lima puro sobre
 * branco fica em 1,8:1, ilegivel (ver frontend/src/theme.js).
 *
 * @param {object} params
 * @param {string} params.link - URL de redefinicao (frontend).
 * @param {string} [params.nome] - Nome do usuario, para a saudacao.
 * @param {string} params.cidIlustracao - cid da imagem anexada.
 * @returns {string} HTML.
 */
function htmlReset({ link, nome, cidIlustracao }) {
  const saudacao = nome ? `Olá, <strong>${escapar(nome)}</strong>!` : "Olá!"
  const texto = "font-family: Arial, sans-serif;color:#404040;font-size:16px;line-height:1.6;"

  return `
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Use o botão para criar uma nova senha. O link expira em 1 hora.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;">
          <tr><td style="padding:0;">${cabecalho()}</td></tr>

          <tr>
            <td align="center" style="padding:32px 24px 8px;">
              <img src="cid:${cidIlustracao}" width="300" alt=""
                   style="display:block;width:100%;max-width:300px;height:auto;border:0;">
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 36px 0;${texto}">
              <h1 style="margin:0 0 16px;font-family: Arial, sans-serif;font-size:24px;
                         line-height:1.3;color:#0a0a0a;">
                Solicitação de alteração de senha
              </h1>
              <p style="margin:0 0 12px;">${saudacao}</p>
              <p style="margin:0 0 12px;">
                Recebemos um pedido para redefinir a senha da sua conta no Quiron.
              </p>
              <p style="margin:0;">Clique no botão abaixo para criar uma nova senha:</p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#76db00" style="border-radius:8px;">
                    <a href="${link}" target="_blank"
                       style="display:inline-block;padding:14px 32px;font-family: Arial, sans-serif;
                              font-size:16px;font-weight:bold;color:#0a0a0a;text-decoration:none;
                              border-radius:8px;">
                      Alterar senha
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 36px;${texto}font-size:14px;color:#525252;">
              Este link só pode ser usado <strong>uma vez</strong> e expira em <strong>1 hora</strong>.
            </td>
          </tr>

          <tr>
            <td style="padding:28px 36px 0;">
              <div style="border-top:1px solid #e5e5e5;padding-top:20px;
                          font-family: Arial, sans-serif;font-size:13px;line-height:1.6;color:#737373;">
                Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                <a href="${link}" target="_blank"
                   style="color:#3a7d00;word-break:break-all;">${link}</a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 36px 32px;${texto}font-size:14px;">
              <p style="margin:0 0 16px;">
                Se você não pediu a troca de senha, ignore este email: sua senha continua a mesma.
              </p>
              <p style="margin:0;">Atenciosamente,<br><strong>Equipe Quiron</strong></p>
            </td>
          </tr>

          <tr>
            <td align="center" style="background:#fafafa;border-top:1px solid #e5e5e5;padding:18px 24px;
                                      font-family: Arial, sans-serif;font-size:12px;line-height:1.5;color:#737373;">
              Esta mensagem foi gerada automaticamente. Por favor, não responda.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

/**
 * Envia o email de redefinicao de senha com o link contendo o token.
 * @param {string} destino - Email do usuario.
 * @param {string} link - URL de redefinicao (frontend).
 * @param {{from?:string, replyTo?:string}} [remetente] - Config da incubadora.
 *        Se omitido, usa o remetente padrao (EMAIL_FROM).
 * @param {string} [nome] - Nome do usuario, para a saudacao.
 * @returns {Promise<string|false>} URL de preview (Ethereal) ou false.
 */
async function enviarEmailReset(destino, link, remetente = {}, nome) {
  const cid = "ilustracao-redefinir-senha@quiron"
  return enviarEmail({
    para: destino,
    assunto: "Redefinição de senha - Quiron",
    remetente,
    html: htmlReset({ link, nome, cidIlustracao: cid }),
    anexos: [
      { filename: "redefinir-senha.png", path: path.join(ASSETS, "redefinir-senha.png"), cid },
    ],
  })
}

module.exports = { enviarEmail, layout, escapar, enviarEmailReset }
