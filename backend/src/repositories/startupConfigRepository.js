/**
 * Repositorio da configuracao do CADASTRO de startup: os TIPOS, as SITUACOES e
 * os CAMPOS PERSONALIZAVEIS que cada incubadora define.
 * Tabelas: startup_tipo, startup_situacao, startup_campo (migracao 010).
 *
 * Tres recursos num arquivo so pelo mesmo motivo de agendaConfigRepository:
 * sao o vocabulario configuravel de UM formulario, sempre carregados juntos (o
 * cadastro de startup precisa dos tres, a tela de configuracao edita os tres) e
 * com o mesmo CRUD de ~40 linhas cada.
 *
 * EXCLUIR E DESATIVAR nos tres casos. Tipo apagado de verdade seria barrado
 * pela FK das startups que o usam; campo apagado deixaria valor orfao dentro do
 * `campos_extras` de cada startup. `ativo = FALSE` some do formulario e
 * preserva o que ja foi cadastrado.
 */
const { query } = require("../config/db")
const { TIPOS_PADRAO, SITUACOES_PADRAO } = require("../startups/padroes")

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

const COLUNAS_TIPO = "id_tenant, chave, rotulo, cor, ordem, ativo"

/**
 * Tipos de um tenant.
 *
 * @param {number} idTenant
 * @param {boolean} [incluirInativos] - A tela de configuracao mostra os
 *   inativos (para reativar); o seletor do cadastro, nao.
 */
async function listarTipos(idTenant, incluirInativos = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TIPO}
       FROM startup_tipo
      WHERE id_tenant = $1
        ${incluirInativos ? "" : "AND ativo = TRUE"}
      ORDER BY ordem, rotulo`,
    [idTenant]
  )
  return rows
}

/** Um tipo pela chave (dentro do tenant). */
async function buscarTipo(idTenant, chave) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TIPO} FROM startup_tipo WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/** Cria um tipo. A chave e imutavel depois disto (ver atualizarTipo). */
async function criarTipo(idTenant, { chave, rotulo, cor, ordem }) {
  const { rows } = await query(
    `INSERT INTO startup_tipo (id_tenant, chave, rotulo, cor, ordem)
     VALUES ($1, $2, $3, $4, COALESCE($5, 0))
     RETURNING ${COLUNAS_TIPO}`,
    [idTenant, chave, rotulo, cor, ordem ?? null]
  )
  return rows[0]
}

/**
 * Atualiza rotulo, cor e ordem. A CHAVE NAO ENTRA: e ela que esta gravada em
 * cada startup. Renomear e trocar o `rotulo`, que reetiqueta tudo de graca.
 */
async function atualizarTipo(idTenant, chave, { rotulo, cor, ordem }) {
  const { rows } = await query(
    `UPDATE startup_tipo
        SET rotulo = $3, cor = $4, ordem = COALESCE($5, ordem)
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_TIPO}`,
    [idTenant, chave, rotulo, cor, ordem ?? null]
  )
  return rows[0]
}

/** Ativa/desativa um tipo (o "excluir" da tela). */
async function alterarStatusTipo(idTenant, chave, ativo) {
  const { rows } = await query(
    `UPDATE startup_tipo SET ativo = $3
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_TIPO}`,
    [idTenant, chave, ativo]
  )
  return rows[0]
}

/** Quantas startups usam um tipo — o aviso antes de desativar. */
async function contarStartupsDoTipo(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM startup WHERE id_tenant = $1 AND tipo = $2`,
    [idTenant, chave]
  )
  return rows[0].total
}

// ---------------------------------------------------------------------------
// SITUACOES
// ---------------------------------------------------------------------------

const COLUNAS_SITUACAO = "id_tenant, chave, rotulo, cor, ciclo, ordem, ativo"

/** Situacoes de um tenant. */
async function listarSituacoes(idTenant, incluirInativas = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_SITUACAO}
       FROM startup_situacao
      WHERE id_tenant = $1
        ${incluirInativas ? "" : "AND ativo = TRUE"}
      ORDER BY ordem, rotulo`,
    [idTenant]
  )
  return rows
}

/** Uma situacao pela chave (dentro do tenant). */
async function buscarSituacao(idTenant, chave) {
  const { rows } = await query(
    `SELECT ${COLUNAS_SITUACAO} FROM startup_situacao WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/** Cria uma situacao. */
async function criarSituacao(idTenant, { chave, rotulo, cor, ciclo, ordem }) {
  const { rows } = await query(
    `INSERT INTO startup_situacao (id_tenant, chave, rotulo, cor, ciclo, ordem)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0))
     RETURNING ${COLUNAS_SITUACAO}`,
    [idTenant, chave, rotulo, cor, ciclo, ordem ?? null]
  )
  return rows[0]
}

/**
 * Atualiza rotulo, cor, ciclo e ordem.
 *
 * O CICLO e editavel, ao contrario da chave: e uma correcao de significado
 * ("na verdade 'Aceleracao' e uma startup ativa, nao encerrada"), e mudar
 * requer reprocessar o status das startups que usam esta situacao — quem faz
 * isso e sincronizarStatusPorSituacao, chamado pelo service.
 */
async function atualizarSituacao(idTenant, chave, { rotulo, cor, ciclo, ordem }) {
  const { rows } = await query(
    `UPDATE startup_situacao
        SET rotulo = $3, cor = $4, ciclo = $5, ordem = COALESCE($6, ordem)
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_SITUACAO}`,
    [idTenant, chave, rotulo, cor, ciclo, ordem ?? null]
  )
  return rows[0]
}

/** Ativa/desativa uma situacao (o "excluir" da tela). */
async function alterarStatusSituacao(idTenant, chave, ativo) {
  const { rows } = await query(
    `UPDATE startup_situacao SET ativo = $3
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_SITUACAO}`,
    [idTenant, chave, ativo]
  )
  return rows[0]
}

/** Quantas startups estao numa situacao — o aviso antes de desativar. */
async function contarStartupsDaSituacao(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM startup WHERE id_tenant = $1 AND situacao = $2`,
    [idTenant, chave]
  )
  return rows[0].total
}

/**
 * Reaplica o `status` das startups que estao numa situacao cujo ciclo mudou.
 *
 * `startup.status` e derivado, nao digitado: quem escolhe a situacao "Graduada"
 * esta dizendo ENCERRADA sem saber. Se o admin corrige o ciclo de uma situacao
 * ja em uso, as startups que a usam ficariam com o status antigo — dentro do
 * programa quando deviam estar fora, ou o contrario, em todo relatorio.
 */
async function sincronizarStatusPorSituacao(idTenant, chave) {
  const { rowCount } = await query(
    `UPDATE startup s
        SET status = sit.ciclo, atualizado_ts = NOW()
       FROM startup_situacao sit
      WHERE sit.id_tenant = s.id_tenant AND sit.chave = s.situacao
        AND s.id_tenant = $1 AND s.situacao = $2
        AND s.status IS DISTINCT FROM sit.ciclo`,
    [idTenant, chave]
  )
  return rowCount
}

// ---------------------------------------------------------------------------
// CAMPOS PERSONALIZAVEIS (a DEFINICAO; os valores vivem em startup.campos_extras)
// ---------------------------------------------------------------------------

const COLUNAS_CAMPO =
  "id_campo, id_tenant, chave, rotulo, tipo, descricao, obrigatorio, ordem, ativo, config"

/** Campos de um tenant, na ordem em que aparecem no formulario. */
async function listarCampos(idTenant, incluirInativos = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CAMPO}
       FROM startup_campo
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
    `SELECT ${COLUNAS_CAMPO} FROM startup_campo WHERE id_campo = $1`,
    [idCampo]
  )
  return rows[0]
}

/** Um campo pela chave (dentro do tenant) — a guarda contra chave repetida. */
async function buscarCampoPorChave(idTenant, chave) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CAMPO} FROM startup_campo WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/** Cria um campo personalizavel. */
async function criarCampo(idTenant, { chave, rotulo, tipo, descricao, obrigatorio, ordem, config }) {
  const { rows } = await query(
    `INSERT INTO startup_campo
       (id_tenant, chave, rotulo, tipo, descricao, obrigatorio, ordem, config)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), COALESCE($7, 0), COALESCE($8, '{}'::jsonb))
     RETURNING ${COLUNAS_CAMPO}`,
    [idTenant, chave, rotulo, tipo, descricao ?? null, obrigatorio, ordem ?? null, config ?? null]
  )
  return rows[0]
}

/**
 * Atualiza um campo. A CHAVE e o TIPO nao entram: a chave e a propriedade
 * gravada no JSONB de cada startup, e trocar o tipo transformaria valores ja
 * preenchidos em lixo (um "12.345.678/0001-95" salvo como DOCUMENTO nao vira
 * numero). Mudar de ideia sobre o tipo e desativar o campo e criar outro.
 */
async function atualizarCampo(idTenant, idCampo, { rotulo, descricao, obrigatorio, ordem, config }) {
  const { rows } = await query(
    `UPDATE startup_campo
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
    `UPDATE startup_campo SET ativo = $3
      WHERE id_tenant = $1 AND id_campo = $2
      RETURNING ${COLUNAS_CAMPO}`,
    [idTenant, idCampo, ativo]
  )
  return rows[0]
}

/**
 * Quantas startups ja preencheram um campo — o aviso antes de desativar.
 *
 * `? $2` pergunta se a chave existe no documento; o valor continua la depois de
 * desativar, so deixa de ser pedido no formulario.
 */
async function contarStartupsComCampo(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM startup
      WHERE id_tenant = $1 AND campos_extras ? $2`,
    [idTenant, chave]
  )
  return rows[0].total
}

// ---------------------------------------------------------------------------
// SEMEADURA
// ---------------------------------------------------------------------------

/**
 * Semeia tipos e situacoes padrao de um tenant recem-criado.
 *
 * Nao e cosmetico: as FKs (id_tenant, tipo) e (id_tenant, situacao) exigem que
 * exista o vocabulario antes da primeira startup, entao uma incubadora sem
 * esta linha nasceria com o cadastro travado — mesmo papel de
 * semearCategoriasPadrao na agenda.
 *
 * ON CONFLICT DO NOTHING deixa a operacao repetivel: chamar de novo num tenant
 * que ja tem o vocabulario nao duplica nem sobrescreve o que foi personalizado.
 *
 * @param {import('pg').PoolClient} [client] - Para participar de uma transacao.
 */
async function semearVocabularioPadrao(idTenant, client) {
  const executor = client || { query }

  const valoresTipo = []
  const paramsTipo = [idTenant]
  for (const t of TIPOS_PADRAO) {
    const i = paramsTipo.length
    valoresTipo.push(`($1, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4})`)
    paramsTipo.push(t.chave, t.rotulo, t.cor, t.ordem)
  }
  await executor.query(
    `INSERT INTO startup_tipo (id_tenant, chave, rotulo, cor, ordem)
     VALUES ${valoresTipo.join(", ")}
     ON CONFLICT DO NOTHING`,
    paramsTipo
  )

  const valoresSituacao = []
  const paramsSituacao = [idTenant]
  for (const s of SITUACOES_PADRAO) {
    const i = paramsSituacao.length
    valoresSituacao.push(`($1, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5})`)
    paramsSituacao.push(s.chave, s.rotulo, s.cor, s.ciclo, s.ordem)
  }
  await executor.query(
    `INSERT INTO startup_situacao (id_tenant, chave, rotulo, cor, ciclo, ordem)
     VALUES ${valoresSituacao.join(", ")}
     ON CONFLICT DO NOTHING`,
    paramsSituacao
  )
}

module.exports = {
  listarTipos,
  buscarTipo,
  criarTipo,
  atualizarTipo,
  alterarStatusTipo,
  contarStartupsDoTipo,

  listarSituacoes,
  buscarSituacao,
  criarSituacao,
  atualizarSituacao,
  alterarStatusSituacao,
  contarStartupsDaSituacao,
  sincronizarStatusPorSituacao,

  listarCampos,
  buscarCampo,
  buscarCampoPorChave,
  criarCampo,
  atualizarCampo,
  alterarStatusCampo,
  contarStartupsComCampo,

  semearVocabularioPadrao,
}
