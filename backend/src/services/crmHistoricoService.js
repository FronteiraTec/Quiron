/**
 * O historico do CRM: gravar um evento e ler a linha do tempo.
 *
 * QUEM GRAVA E SEMPRE O BACKEND, dentro da transacao da escrita que originou o
 * fato. O autor sai do contexto da sessao (crmAcessoService.exigirAcesso), a
 * data sai do NOW() do banco — nada disso e aceito do pedido.
 *
 * Os unicos eventos que nascem de um pedido "registre isto" sao as atividades
 * manuais (anotacao, contato, reuniao), e mesmo elas sao escritas pelo servidor:
 * o pedido traz o texto, nao o evento.
 */
const crmEventoRepository = require("../repositories/crmEventoRepository")
const { ATIVIDADES_MANUAIS, CANAIS_CONTATO, ROTULO_CANAL } = require("../crm/padroes")
const { citar } = require("../crm/historico")
const v = require("../crm/validacao")
const { erroNegocio } = require("../utils/erros")

const TEXTO_MAX = 5000
const PAGINA_MAX = 100

/**
 * Grava um evento com o autor e a startup do contexto.
 * @param {import('pg').PoolClient} client - o da transacao.
 * @param {object} ctx - de crmAcessoService.exigirAcesso.
 * @param {{tipo: string, descricao: string, idOportunidade?: number,
 *   idCliente?: number, idTarefa?: number, antes?: object, depois?: object,
 *   metadados?: object}} evento
 */
function registrar(client, ctx, evento) {
  return crmEventoRepository.registrar(client, {
    ...evento,
    idStartup: ctx.idStartup,
    idUsuario: ctx.idUsuario,
    autorNome: ctx.autorNome,
  })
}

/**
 * Valida o pedido de atividade manual e devolve o evento pronto para gravar
 * (sem o alvo, que quem chama acrescenta).
 */
function prepararAtividade(dados = {}) {
  const tipo = v.umDe(dados.tipo ?? "ANOTACAO", ATIVIDADES_MANUAIS, "o tipo de registro")
  const texto = v.texto(dados.texto, { rotulo: "o texto do registro", max: TEXTO_MAX, obrigatorio: true })
  const canal = tipo === "CONTATO" && dados.canal ? v.umDe(dados.canal, CANAIS_CONTATO, "o canal do contato") : null

  const resumo = citar(texto, 160)
  const descricao = {
    ANOTACAO: `adicionou uma anotação: ${resumo}`,
    CONTATO: canal ? `registrou um contato por ${ROTULO_CANAL[canal]}: ${resumo}` : `registrou um contato: ${resumo}`,
    REUNIAO: `registrou uma reunião: ${resumo}`,
  }[tipo]

  return { tipo, descricao, metadados: canal ? { texto, canal } : { texto } }
}

/** Le os parametros de pagina da query string, com limite. */
function lerPagina(query = {}) {
  const antes = query.antes ? Number(query.antes) : null
  if (antes !== null && (!Number.isInteger(antes) || antes <= 0)) {
    throw erroNegocio(400, "Parâmetro de página inválido.")
  }
  const limite = Math.min(Math.max(Number(query.limite) || 30, 1), PAGINA_MAX)
  return { antes, limite }
}

module.exports = { registrar, prepararAtividade, lerPagina }
