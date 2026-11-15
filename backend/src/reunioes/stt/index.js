/**
 * Monta o provedor de transcricao a partir da configuracao da incubadora
 * (`tenant_ia_config`, finalidade TRANSCRICAO, com a chave ja decifrada).
 *
 * Nenhum codigo de reuniao sabe qual provedor esta atras: todos expoem
 *   capacidades() -> { devolveTempos, limiteBytes }
 *   transcrever({ audio, mime, idioma, sinal }) -> [{ texto, inicioMs, fimMs, confianca }]
 *   testar({ sinal })
 *   origem, rotulo
 */
const { criarOpenAI } = require("./openai")
const { criarDeepgram } = require("./deepgram")
const { ErroProvedor, TIPOS } = require("../provedores")

/** Os provedores de transcricao e o rotulo de cada um, para a tela. */
const PROVEDORES_STT = {
  OPENAI: { rotulo: "OpenAI", modeloPadrao: "whisper-1", modelos: ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"] },
  DEEPGRAM: { rotulo: "Deepgram", modeloPadrao: "nova-2", modelos: ["nova-2", "nova-3"] },
  OPENAI_COMPATIVEL: { rotulo: "Compatível com a OpenAI", modeloPadrao: "whisper-large-v3", modelos: [] },
}

/**
 * @param {{provedor: string, modelo: string, chave: string, url_base?: string|null}} config
 */
function criarProvedorSTT(config) {
  if (!config?.chave) throw new ErroProvedor(TIPOS.SEM_CONFIGURACAO, "A chave do provedor de transcrição não está disponível.")
  switch (config.provedor) {
    case "OPENAI":
      return criarOpenAI({ chave: config.chave, modelo: config.modelo })
    case "OPENAI_COMPATIVEL":
      return criarOpenAI({ chave: config.chave, modelo: config.modelo, urlBase: config.url_base, rotulo: "o provedor compatível" })
    case "DEEPGRAM":
      return criarDeepgram({ chave: config.chave, modelo: config.modelo })
    default:
      throw new ErroProvedor(TIPOS.SEM_CONFIGURACAO, `Provedor de transcrição desconhecido: ${config.provedor}.`)
  }
}

module.exports = { criarProvedorSTT, PROVEDORES_STT }
