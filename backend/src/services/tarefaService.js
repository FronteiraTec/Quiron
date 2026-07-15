/**
 * Service de Tarefas (regra de negocio).
 */
const tarefaRepository = require("../repositories/tarefaRepository")
const { erroNegocio } = require("../utils/erros")

const TIPOS_VALIDOS = ["TEXTO", "ANEXO", "VIDEO", "QUESTIONARIO"]

/** Lista as tarefas de um modulo. */
async function listar(idModulo) {
  if (!idModulo) throw erroNegocio(400, "Informe o id_modulo.")
  return tarefaRepository.listarPorModulo(idModulo)
}

/** Busca uma tarefa pelo id. */
async function buscar(id) {
  const tarefa = await tarefaRepository.buscarPorId(id)
  if (!tarefa) throw erroNegocio(404, "Tarefa nao encontrada.")
  return tarefa
}

/** Cria uma tarefa. */
async function criar(dados) {
  const { idModulo, titulo, tipo, ordem } = dados
  let { anexo, idQuestionario } = dados
  if (!idModulo || !titulo || ordem == null) {
    throw erroNegocio(400, "Informe id_modulo, titulo e ordem.")
  }
  if (!TIPOS_VALIDOS.includes(tipo)) {
    throw erroNegocio(400, `Tipo invalido. Use: ${TIPOS_VALIDOS.join(", ")}.`)
  }

  // Cada tipo exige (e guarda) uma referencia diferente. Videos e anexos
  // ficam no Drive: guardamos apenas o link. Questionarios sao criados na
  // plataforma: guardamos o id. Normalizamos os campos nao usados como null.
  if (tipo === "VIDEO" || tipo === "ANEXO") {
    if (!anexo) throw erroNegocio(400, "Informe o link do arquivo no Drive.")
    idQuestionario = null
  } else if (tipo === "QUESTIONARIO") {
    if (!idQuestionario) throw erroNegocio(400, "Selecione o questionario da tarefa.")
    anexo = null
  } else {
    // TEXTO nao tem referencia externa.
    anexo = null
    idQuestionario = null
  }

  return tarefaRepository.criar({ ...dados, anexo, idQuestionario })
}

module.exports = { listar, buscar, criar }
