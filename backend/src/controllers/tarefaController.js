/**
 * Controller de Tarefas (HTTP). Delega ao tarefaService.
 */
const tarefaService = require("../services/tarefaService")

async function listar(req, res, next) {
  try {
    res.json({ tarefas: await tarefaService.listar(req.query.id_modulo) })
  } catch (err) {
    next(err)
  }
}

async function buscar(req, res, next) {
  try {
    res.json({ tarefa: await tarefaService.buscar(req.params.id) })
  } catch (err) {
    next(err)
  }
}

async function criar(req, res, next) {
  try {
    const { id_modulo, titulo, descricao, tipo, ordem, obrigatoria, anexo, id_questionario } =
      req.body
    const tarefa = await tarefaService.criar({
      idModulo: id_modulo,
      titulo,
      descricao,
      tipo,
      ordem,
      obrigatoria,
      // anexo = link do arquivo no Drive (tipos VIDEO/ANEXO).
      anexo,
      // id_questionario = questionario da plataforma (tipo QUESTIONARIO).
      idQuestionario: id_questionario,
    })
    res.status(201).json({ tarefa })
  } catch (err) {
    next(err)
  }
}

module.exports = { listar, buscar, criar }
