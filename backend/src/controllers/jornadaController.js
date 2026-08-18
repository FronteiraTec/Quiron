/**
 * Controller da Jornada (HTTP). Delega ao jornadaService.
 */
const jornadaService = require("../services/jornadaService")

/**
 * GET /jornada?id_startup=&id_trilha= — uma trilha com o estado de cada passo.
 * Sem `id_trilha`, abre a primeira em andamento.
 */
async function carregar(req, res, next) {
  try {
    const jornada = await jornadaService.carregar(
      req.query.id_startup,
      req.query.id_trilha
    )
    res.json({ jornada })
  } catch (err) {
    next(err)
  }
}

/** GET /jornada/trilhas?id_startup= — trilhas em andamento e concluidas. */
async function listarTrilhas(req, res, next) {
  try {
    const trilhas = await jornadaService.listarTrilhas(req.query.id_startup)
    res.json({ trilhas })
  } catch (err) {
    next(err)
  }
}

/** POST /jornada/rascunho — salva sem enviar ao mentor. */
async function salvarRascunho(req, res, next) {
  try {
    res.json({ entrega: await jornadaService.salvarRascunho(paraServico(req)) })
  } catch (err) {
    next(err)
  }
}

/** POST /jornada/enviar — submete para avaliacao. */
async function enviar(req, res, next) {
  try {
    res.status(201).json({ entrega: await jornadaService.enviar(paraServico(req)) })
  } catch (err) {
    next(err)
  }
}

/** POST /jornada/reenviar — apos pedido de ajuste. */
async function reenviar(req, res, next) {
  try {
    res.json({ entrega: await jornadaService.reenviar(paraServico(req)) })
  } catch (err) {
    next(err)
  }
}

/**
 * Traduz o corpo para o formato do service. O autor sai do token, nunca do
 * corpo — senao daria para registrar uma entrega em nome de outra pessoa.
 */
function paraServico(req) {
  const { id_no, id_startup, texto_resposta, anexos } = req.body
  return {
    idNo: id_no,
    idStartup: id_startup,
    idUsuario: req.usuario?.id ?? null,
    textoResposta: texto_resposta,
    anexos,
  }
}

module.exports = { carregar, listarTrilhas, salvarRascunho, enviar, reenviar }
