/**
 * Os webhooks do LiveKit: o que acontece na sala, contado pelo proprio LiveKit.
 *
 *   room_started                       -> reuniao EM_ANDAMENTO
 *   participant_joined                 -> abre uma sessao (quem entrou)
 *   participant_left / _connection_aborted -> fecha a sessao
 *   room_finished                      -> reuniao ENCERRADA, mesmo que ninguem
 *                                         tenha clicado em encerrar
 *
 * A ROTA E PUBLICA, e quem a protege e a ASSINATURA: um JWT assinado com o
 * segredo da API, que carrega o sha256 do corpo. Sem assinatura valida, 401 —
 * e nada e lido do corpo antes disso.
 *
 * IDEMPOTENTE PELO ESTADO, e nao por um registro dos eventos ja vistos. O
 * LiveKit reenvia o que nao recebeu 200 e pode entregar fora de ordem; cada
 * escrita do reuniaoRepository e feita para dar o mesmo resultado se repetida
 * (o sid da conexao e UNIQUE, o status so anda para a frente). Isso cobre
 * tambem a ordem trocada, que uma tabela de "ids ja processados" nao cobriria.
 *
 * Sala que nao e de reuniao nenhuma (outro ambiente, sala de teste) e ignorada
 * com 200: responder erro so faria o LiveKit insistir.
 */
const { withTransaction } = require("../config/db")
const reuniaoRepository = require("../repositories/reuniaoRepository")
const gravacaoService = require("./reuniaoGravacaoService")
const auditLogService = require("./auditLogService")
const reuniaoService = require("./reuniaoService")
const livekit = require("../reunioes/livekit")
const { erroNegocio } = require("../utils/erros")

/** O instante do evento, em ms. O LiveKit manda epoch em segundos (int64). */
function msDoEvento(evento) {
  const s = Number(evento?.createdAt || 0)
  return s > 0 ? s * 1000 : Date.now()
}

/** Quando a pessoa entrou, segundo o LiveKit — o que o `left` tambem traz. */
function msDaEntrada(participante) {
  const ms = Number(participante?.joinedAtMs || 0)
  if (ms > 0) return ms
  const s = Number(participante?.joinedAt || 0)
  return s > 0 ? s * 1000 : null
}

/**
 * A identidade do token e `u-<id_usuario>` (ver reuniaoService.emitirToken).
 * So vira usuario se for convidado DESTA reuniao: uma identidade que nao bate
 * fica registrada, mas sem dono.
 */
async function usuarioDaIdentidade(reuniao, identidade) {
  const m = /^u-(\d+)$/.exec(String(identidade || ""))
  if (!m) return null
  const convidado = await reuniaoRepository.buscarParticipante(reuniao.id_reuniao, Number(m[1]))
  return convidado ? Number(m[1]) : null
}

/**
 * Confere a assinatura e aplica o evento.
 * @param {string} corpo - o corpo cru, exatamente como chegou.
 * @param {string|undefined} autorizacao - o cabecalho Authorization.
 */
async function receber(corpo, autorizacao) {
  if (!livekit.configurado()) throw erroNegocio(404, "Reuniões por vídeo não configuradas.")

  let evento
  try {
    evento = await livekit.receberWebhook(corpo, autorizacao)
  } catch {
    throw erroNegocio(401, "Assinatura do webhook inválida.")
  }

  const tipo = evento.event
  const sala = evento.room?.name
  if (!sala) return { ignorado: true }

  const reuniao = await reuniaoRepository.buscarPorSala(sala)
  if (!reuniao) return { ignorado: true }

  const ms = msDoEvento(evento)
  const participante = evento.participant

  switch (tipo) {
    case "room_started":
      await iniciou(reuniao, ms)
      break

    case "participant_joined": {
      if (!participante?.sid) break
      await reuniaoRepository.registrarEntrada({
        idTenant: reuniao.id_tenant,
        idReuniao: reuniao.id_reuniao,
        idUsuario: await usuarioDaIdentidade(reuniao, participante.identity),
        identidade: participante.identity,
        sid: participante.sid,
        ms: msDaEntrada(participante) ?? ms,
      })
      // Se o room_started se perdeu, a primeira entrada faz as vezes dele.
      await iniciou(reuniao, ms)
      break
    }

    case "participant_left":
    case "participant_connection_aborted": {
      if (!participante?.sid) break
      await reuniaoRepository.registrarSaida({
        idTenant: reuniao.id_tenant,
        idReuniao: reuniao.id_reuniao,
        idUsuario: await usuarioDaIdentidade(reuniao, participante.identity),
        identidade: participante.identity,
        sid: participante.sid,
        msEntrada: msDaEntrada(participante),
        msSaida: ms,
      })
      break
    }

    case "room_finished": {
      // Na mesma transacao, o job de transcricao (se alguem teve a fala gravada).
      const encerrouAgora = await withTransaction(async (client) => {
        const encerrou = await reuniaoRepository.marcarFinalizada(reuniao.id_reuniao, ms, client)
        if (encerrou) await gravacaoService.aoEncerrar(reuniao, client)
        return encerrou
      })
      if (encerrouAgora) {
        // Sem autor: foi a sala que fechou. Fica na auditoria para ninguem
        // procurar quem "encerrou" uma reuniao que acabou sozinha.
        await auditLogService.registrar({
          idTenant: reuniao.id_tenant,
          idUsuario: null,
          acao: "ENCERRAR",
          entidade: "reuniao",
          entidadeId: String(reuniao.id_reuniao),
          descricao: `A sala da reunião "${reuniao.titulo}" fechou: todos saíram.`,
        })
      }
      break
    }

    default:
      return { ignorado: true }
  }

  return { processado: tipo }
}

/**
 * A sala abriu. Se a reuniao ja estava encerrada ou cancelada, alguem entrou
 * com um token ainda valido (eles duram 10 minutos): a sala e fechada de novo.
 */
async function iniciou(reuniao, ms) {
  const marcou = await reuniaoRepository.marcarIniciada(reuniao.id_reuniao, ms)
  if (!marcou) reuniaoService.fecharSalaEmSegundoPlano(reuniao)
}

module.exports = { receber }
