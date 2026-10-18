/**
 * Service de Preferencias (regra de negocio).
 *
 * Orquestra o preferenciaRepository, aplica valores padrao quando o usuario
 * ainda nao personalizou nada e valida os dados antes de gravar. Lanca erros
 * de negocio com "status" para o controller traduzir em HTTP.
 */
const preferenciaRepository = require("../repositories/preferenciaRepository")
const { erroNegocio } = require("../utils/erros")

// Preferencias padrao (espelham os DEFAULT do schema.sql). A cor primaria e o
// lima da identidade visual (migracao 019).
const PADRAO = {
  tema: "claro",
  cor_primaria: "#76db00",
  cor_secundaria: "#0ea5e9",
  densidade: "confortavel",
  borda_arredondada: 12,
  sidebar_recolhida: false,
}

// Valores permitidos para os campos com dominio fechado.
const TEMAS = ["claro", "escuro"]
const DENSIDADES = ["confortavel", "compacta"]
// Cor hexadecimal no formato #rrggbb.
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

/**
 * Retorna as preferencias do usuario; se ainda nao existirem, devolve o padrao.
 * @param {number} idUsuario
 * @returns {Promise<object>}
 */
async function obter(idUsuario) {
  const prefs = await preferenciaRepository.buscarPorUsuario(idUsuario)
  return prefs || { id_usuario: idUsuario, ...PADRAO }
}

/**
 * Atualiza as preferencias do usuario. Campos ausentes mantem o valor atual
 * (ou o padrao, se for a primeira vez). Faz upsert no repositorio.
 * @param {number} idUsuario
 * @param {object} dados - Subconjunto das preferencias a atualizar.
 * @returns {Promise<object>}
 */
async function atualizar(idUsuario, dados) {
  // Parte do que ja existe (ou do padrao) e sobrescreve com o que veio.
  const atual = await obter(idUsuario)
  const prefs = {
    tema: dados.tema ?? atual.tema,
    cor_primaria: dados.cor_primaria ?? atual.cor_primaria,
    cor_secundaria: dados.cor_secundaria ?? atual.cor_secundaria,
    densidade: dados.densidade ?? atual.densidade,
    borda_arredondada: dados.borda_arredondada ?? atual.borda_arredondada,
    sidebar_recolhida: dados.sidebar_recolhida ?? atual.sidebar_recolhida,
  }

  // --- Validacoes ---
  if (!TEMAS.includes(prefs.tema)) {
    throw erroNegocio(400, "Tema invalido. Use 'claro' ou 'escuro'.")
  }
  if (!DENSIDADES.includes(prefs.densidade)) {
    throw erroNegocio(400, "Densidade invalida. Use 'confortavel' ou 'compacta'.")
  }
  if (!HEX_REGEX.test(prefs.cor_primaria) || !HEX_REGEX.test(prefs.cor_secundaria)) {
    throw erroNegocio(400, "Cores devem estar no formato hexadecimal (#rrggbb).")
  }
  const borda = Number(prefs.borda_arredondada)
  if (!Number.isInteger(borda) || borda < 0 || borda > 32) {
    throw erroNegocio(400, "Borda arredondada deve ser um numero entre 0 e 32.")
  }
  prefs.borda_arredondada = borda
  prefs.sidebar_recolhida = Boolean(prefs.sidebar_recolhida)

  return preferenciaRepository.salvar(idUsuario, {
    tema: prefs.tema,
    corPrimaria: prefs.cor_primaria,
    corSecundaria: prefs.cor_secundaria,
    densidade: prefs.densidade,
    bordaArredondada: prefs.borda_arredondada,
    sidebarRecolhida: prefs.sidebar_recolhida,
  })
}

module.exports = { obter, atualizar, PADRAO }
