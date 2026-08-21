/**
 * Repositorio da configuracao da GESTAO DE TAREFAS: os STATUS (as colunas do
 * quadro) e os CAMPOS PERSONALIZAVEIS que cada incubadora define.
 * Tabelas: tarefa_status, tarefa_campo (migracao 014).
 *
 * Dois recursos num arquivo so, como em startupConfigRepository: sao o
 * vocabulario configuravel de UM quadro, sempre carregados juntos (o quadro
 * precisa dos dois, a tela de configuracao edita os dois) e com o mesmo CRUD de
 * ~40 linhas cada.
 *
 * EXCLUIR E DESATIVAR nos dois casos. Status apagado de verdade seria barrado
 * pela FK das tarefas que estao nele; campo apagado deixaria valor orfao dentro
 * do `campos_extras` de cada tarefa. `ativo = FALSE` some do quadro e do
 * formulario e preserva o que ja foi registrado.
 */
const { query } = require("../config/db")
const { STATUS_PADRAO } = require("../tarefas/padroes")

// ---------------------------------------------------------------------------
// STATUS (as colunas do quadro)
// ---------------------------------------------------------------------------

const COLUNAS_STATUS = "id_tenant, chave, rotulo, cor, categoria, ordem, ativo"

/**
 * Status de um tenant, na ordem em que viram colunas do quadro.
 *
 * @param {number} idTenant
 * @param {boolean} [incluirInativos] - A tela de configuracao mostra os
 *   inativos (para reativar); o quadro e o formulario, nao.
 */
async function listarStatus(idTenant, incluirInativos = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_STATUS}
       FROM tarefa_status
      WHERE id_tenant = $1
        ${incluirInativos ? "" : "AND ativo = TRUE"}
      ORDER BY ordem, rotulo`,
    [idTenant]
  )
  return rows
}

/** Um status pela chave (dentro do tenant). */
async function buscarStatus(idTenant, chave) {
  const { rows } = await query(
    `SELECT ${COLUNAS_STATUS} FROM tarefa_status WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/**
 * Cria um status.
 *
 * Sem `ordem` explicita ele entra no FIM do quadro, e nao na posicao 0: uma
 * coluna nova que nasce a esquerda de "A fazer" reorganiza a leitura do quadro
 * inteiro de quem nao pediu nada disso.
 */
async function criarStatus(idTenant, { chave, rotulo, cor, categoria, ordem }) {
  const { rows } = await query(
    `INSERT INTO tarefa_status (id_tenant, chave, rotulo, cor, categoria, ordem)
     VALUES ($1, $2, $3, $4, $5,
             COALESCE($6, (SELECT COALESCE(MAX(ordem), 0) + 1
                             FROM tarefa_status WHERE id_tenant = $1)))
     RETURNING ${COLUNAS_STATUS}`,
    [idTenant, chave, rotulo, cor, categoria, ordem ?? null]
  )
  return rows[0]
}

/**
 * Atualiza rotulo, cor, categoria e ordem. A CHAVE NAO ENTRA: e ela que esta
 * gravada em cada tarefa. Renomear e trocar o `rotulo`, que reetiqueta tudo de
 * graca.
 *
 * A CATEGORIA e editavel, ao contrario da chave: e uma correcao de significado
 * ("na verdade 'Arquivada' e uma tarefa concluida, nao pendente"), e mudar
 * requer reprocessar o `concluida_ts` das tarefas naquele status — quem faz
 * isso e sincronizarConclusaoPorStatus, chamado pelo service.
 */
async function atualizarStatus(idTenant, chave, { rotulo, cor, categoria, ordem }) {
  const { rows } = await query(
    `UPDATE tarefa_status
        SET rotulo = $3, cor = $4, categoria = $5, ordem = COALESCE($6, ordem)
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_STATUS}`,
    [idTenant, chave, rotulo, cor, categoria, ordem ?? null]
  )
  return rows[0]
}

/** Ativa/desativa um status (o "excluir" da tela). */
async function alterarStatusDoStatus(idTenant, chave, ativo) {
  const { rows } = await query(
    `UPDATE tarefa_status SET ativo = $3
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_STATUS}`,
    [idTenant, chave, ativo]
  )
  return rows[0]
}

/** Quantas tarefas estao num status — o aviso antes de desativar. */
async function contarTarefasDoStatus(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM tarefa WHERE id_tenant = $1 AND status = $2`,
    [idTenant, chave]
  )
  return rows[0].total
}

/**
 * Reaplica o `concluida_ts` das tarefas de um status cuja categoria mudou.
 *
 * `tarefa.concluida_ts` e derivado, nao digitado: quem move o cartao para
 * "Entregue" nao informa data nenhuma. Se a categoria do status muda depois —
 * o admin percebe que "Arquivada" era CONCLUIDA e nao PENDENTE —, as tarefas
 * que ja estao la ficariam com a marca errada, e o relatorio do mes contaria
 * como aberto o que a equipe considera fechado.
 *
 * NOW() para as que passam a ser concluidas e NULL para as que deixam de ser.
 * A data e a da CORRECAO, nao a do fechamento real: ninguem sabe qual foi, e
 * inventar uma seria pior do que registrar quando o sistema soube.
 */
async function sincronizarConclusaoPorStatus(idTenant, chave, categoria) {
  const concluida = categoria === "CONCLUIDA"
  await query(
    `UPDATE tarefa
        SET concluida_ts = ${concluida ? "NOW()" : "NULL"},
            atualizado_ts = NOW()
      WHERE id_tenant = $1 AND status = $2
        AND concluida_ts IS ${concluida ? "NULL" : "NOT NULL"}`,
    [idTenant, chave]
  )
}

// ---------------------------------------------------------------------------
// CAMPOS PERSONALIZAVEIS (a DEFINICAO; os valores vivem em tarefa.campos_extras)
// ---------------------------------------------------------------------------

const COLUNAS_CAMPO =
  "id_campo, id_tenant, chave, rotulo, tipo, descricao, obrigatorio, ordem, ativo, config"

/** Campos de um tenant, na ordem em que aparecem no formulario. */
async function listarCampos(idTenant, incluirInativos = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CAMPO}
       FROM tarefa_campo
      WHERE id_tenant = $1
        ${incluirInativos ? "" : "AND ativo = TRUE"}
      ORDER BY ordem, rotulo`,
    [idTenant]
  )
  return rows
}

/** Um campo pelo id. Traz o id_tenant para o service conferir a posse. */
async function buscarCampo(idCampo) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CAMPO} FROM tarefa_campo WHERE id_campo = $1`,
    [idCampo]
  )
  return rows[0]
}

/** Um campo pela chave (dentro do tenant) — a guarda contra chave repetida. */
async function buscarCampoPorChave(idTenant, chave) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CAMPO} FROM tarefa_campo WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/** Cria um campo personalizavel. */
async function criarCampo(idTenant, { chave, rotulo, tipo, descricao, obrigatorio, ordem, config }) {
  const { rows } = await query(
    `INSERT INTO tarefa_campo
       (id_tenant, chave, rotulo, tipo, descricao, obrigatorio, ordem, config)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE),
             COALESCE($7, (SELECT COALESCE(MAX(ordem), 0) + 1
                             FROM tarefa_campo WHERE id_tenant = $1)),
             COALESCE($8, '{}'::jsonb))
     RETURNING ${COLUNAS_CAMPO}`,
    [idTenant, chave, rotulo, tipo, descricao ?? null, obrigatorio, ordem ?? null, config ?? null]
  )
  return rows[0]
}

/**
 * Atualiza um campo. A CHAVE e o TIPO nao entram: a chave e a propriedade
 * gravada no JSONB de cada tarefa, e trocar o tipo transformaria valores ja
 * preenchidos em lixo. Mudar de ideia sobre o tipo e desativar o campo e criar
 * outro.
 */
async function atualizarCampo(idTenant, idCampo, { rotulo, descricao, obrigatorio, ordem, config }) {
  const { rows } = await query(
    `UPDATE tarefa_campo
        SET rotulo = $3, descricao = $4, obrigatorio = COALESCE($5, obrigatorio),
            ordem = COALESCE($6, ordem), config = COALESCE($7, config)
      WHERE id_tenant = $1 AND id_campo = $2
      RETURNING ${COLUNAS_CAMPO}`,
    [idTenant, idCampo, rotulo, descricao ?? null, obrigatorio, ordem ?? null, config ?? null]
  )
  return rows[0]
}

/** Ativa/desativa um campo (o "excluir" da tela). */
async function alterarStatusCampo(idTenant, idCampo, ativo) {
  const { rows } = await query(
    `UPDATE tarefa_campo SET ativo = $3
      WHERE id_tenant = $1 AND id_campo = $2
      RETURNING ${COLUNAS_CAMPO}`,
    [idTenant, idCampo, ativo]
  )
  return rows[0]
}

/**
 * Quantas tarefas ja preencheram um campo — o aviso antes de desativar.
 *
 * `? $2` pergunta se a chave existe no documento; o valor continua la depois de
 * desativar, so deixa de ser pedido no formulario.
 */
async function contarTarefasComCampo(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM tarefa
      WHERE id_tenant = $1 AND campos_extras ? $2`,
    [idTenant, chave]
  )
  return rows[0].total
}

// ---------------------------------------------------------------------------
// SEMEADURA
// ---------------------------------------------------------------------------

/**
 * Semeia os status padrao de um tenant recem-criado.
 *
 * Nao e cosmetico: a FK (id_tenant, status) exige que exista ao menos uma
 * coluna antes da primeira tarefa, entao uma incubadora sem esta linha nasceria
 * com o quadro travado — mesmo papel de semearVocabularioPadrao nas startups.
 *
 * ON CONFLICT DO NOTHING deixa a operacao repetivel: chamar de novo num tenant
 * que ja tem o vocabulario nao duplica nem sobrescreve o que foi personalizado.
 *
 * @param {import('pg').PoolClient} [client] - Para participar de uma transacao.
 */
async function semearStatusPadrao(idTenant, client) {
  const executor = client || { query }

  const valores = []
  const params = [idTenant]
  for (const s of STATUS_PADRAO) {
    const i = params.length
    valores.push(`($1, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5})`)
    params.push(s.chave, s.rotulo, s.cor, s.categoria, s.ordem)
  }

  await executor.query(
    `INSERT INTO tarefa_status (id_tenant, chave, rotulo, cor, categoria, ordem)
     VALUES ${valores.join(", ")}
     ON CONFLICT DO NOTHING`,
    params
  )
}

module.exports = {
  listarStatus,
  buscarStatus,
  criarStatus,
  atualizarStatus,
  alterarStatusDoStatus,
  contarTarefasDoStatus,
  sincronizarConclusaoPorStatus,

  listarCampos,
  buscarCampo,
  buscarCampoPorChave,
  criarCampo,
  atualizarCampo,
  alterarStatusCampo,
  contarTarefasComCampo,

  semearStatusPadrao,
}
