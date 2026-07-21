/**
 * Repositorio da configuracao da agenda: as CATEGORIAS e os LOCAIS que cada
 * incubadora cadastra para usar no calendario.
 * Tabelas: evento_categoria, evento_local (schema.sql, migracao 008).
 *
 * Dois recursos num arquivo so porque sao a mesma coisa vista de dois angulos —
 * vocabulario configuravel da agenda, sempre carregados juntos (o formulario de
 * evento precisa dos dois, a tela de configuracao edita os dois) e com o mesmo
 * CRUD de ~40 linhas. Separar renderia dois arquivos gemeos sem nada a dizer um
 * sobre o outro.
 *
 * EXCLUIR E DESATIVAR, nos dois casos. Categoria apagada de verdade seria
 * barrada pela FK dos eventos historicos; local apagado deixaria orfao o evento
 * que aconteceu ali. `ativo = FALSE` some do seletor e preserva o historico.
 */
const { query } = require("../config/db")
const { CATEGORIAS_PADRAO } = require("../eventos/categoriasPadrao")

// ---------------------------------------------------------------------------
// CATEGORIAS
// ---------------------------------------------------------------------------

/**
 * Categorias de um tenant.
 *
 * @param {number} idTenant
 * @param {boolean} [incluirInativas] - A tela de configuracao mostra as
 *   inativas (para reativar); o seletor de evento novo, nao.
 */
async function listarCategorias(idTenant, incluirInativas = false) {
  const { rows } = await query(
    `SELECT id_tenant, chave, rotulo, cor, icone, ordem, ativo
       FROM evento_categoria
      WHERE id_tenant = $1
        ${incluirInativas ? "" : "AND ativo = TRUE"}
      ORDER BY ordem, rotulo`,
    [idTenant]
  )
  return rows
}

/** Uma categoria pela chave (dentro do tenant). */
async function buscarCategoria(idTenant, chave) {
  const { rows } = await query(
    `SELECT id_tenant, chave, rotulo, cor, icone, ordem, ativo
       FROM evento_categoria
      WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/** Cria uma categoria. A chave e imutavel depois disto (ver atualizarCategoria). */
async function criarCategoria(idTenant, { chave, rotulo, cor, icone, ordem }) {
  const { rows } = await query(
    `INSERT INTO evento_categoria (id_tenant, chave, rotulo, cor, icone, ordem)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0))
     RETURNING id_tenant, chave, rotulo, cor, icone, ordem, ativo`,
    [idTenant, chave, rotulo, cor, icone, ordem ?? null]
  )
  return rows[0]
}

/**
 * Atualiza rotulo, cor, icone e ordem. A CHAVE NAO ENTRA: e ela que esta
 * gravada em cada evento, e troca-la exigiria reescrever o historico inteiro.
 * Renomear e trocar o `rotulo`, que reetiqueta tudo de graca.
 */
async function atualizarCategoria(idTenant, chave, { rotulo, cor, icone, ordem }) {
  const { rows } = await query(
    `UPDATE evento_categoria
        SET rotulo = $3, cor = $4, icone = $5, ordem = COALESCE($6, ordem)
      WHERE id_tenant = $1 AND chave = $2
      RETURNING id_tenant, chave, rotulo, cor, icone, ordem, ativo`,
    [idTenant, chave, rotulo, cor, icone, ordem ?? null]
  )
  return rows[0]
}

/** Ativa/desativa uma categoria (o "excluir" da tela). */
async function alterarStatusCategoria(idTenant, chave, ativo) {
  const { rows } = await query(
    `UPDATE evento_categoria SET ativo = $3
      WHERE id_tenant = $1 AND chave = $2
      RETURNING id_tenant, chave, rotulo, cor, icone, ordem, ativo`,
    [idTenant, chave, ativo]
  )
  return rows[0]
}

/** Quantos eventos usam uma categoria — o aviso antes de desativar. */
async function contarEventosDaCategoria(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM evento
      WHERE id_tenant = $1 AND categoria = $2 AND ativo = TRUE`,
    [idTenant, chave]
  )
  return rows[0].total
}

/**
 * Semeia as categorias padrao de um tenant recem-criado.
 *
 * ON CONFLICT DO NOTHING deixa a operacao repetivel: chamar de novo num tenant
 * que ja tem as categorias nao duplica nem sobrescreve o que a incubadora ja
 * personalizou.
 *
 * @param {import('pg').PoolClient} [client] - Para participar de uma transacao.
 */
async function semearCategoriasPadrao(idTenant, client) {
  const executor = client || { query }
  const valores = []
  const params = [idTenant]
  for (const c of CATEGORIAS_PADRAO) {
    const i = params.length
    valores.push(`($1, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5})`)
    params.push(c.chave, c.rotulo, c.cor, c.icone, c.ordem)
  }
  await executor.query(
    `INSERT INTO evento_categoria (id_tenant, chave, rotulo, cor, icone, ordem)
     VALUES ${valores.join(", ")}
     ON CONFLICT DO NOTHING`,
    params
  )
}

// ---------------------------------------------------------------------------
// LOCAIS
// ---------------------------------------------------------------------------

/** Locais de um tenant. */
async function listarLocais(idTenant, incluirInativos = false) {
  const { rows } = await query(
    `SELECT id_local, id_tenant, nome, endereco, capacidade, ativo
       FROM evento_local
      WHERE id_tenant = $1
        ${incluirInativos ? "" : "AND ativo = TRUE"}
      ORDER BY nome`,
    [idTenant]
  )
  return rows
}

/** Um local pelo id. Traz o id_tenant para o service conferir a posse. */
async function buscarLocal(idLocal) {
  const { rows } = await query(
    `SELECT id_local, id_tenant, nome, endereco, capacidade, ativo
       FROM evento_local
      WHERE id_local = $1`,
    [idLocal]
  )
  return rows[0]
}

/** Cria um local. */
async function criarLocal(idTenant, { nome, endereco, capacidade }) {
  const { rows } = await query(
    `INSERT INTO evento_local (id_tenant, nome, endereco, capacidade)
     VALUES ($1, $2, $3, $4)
     RETURNING id_local, id_tenant, nome, endereco, capacidade, ativo`,
    [idTenant, nome, endereco ?? null, capacidade ?? null]
  )
  return rows[0]
}

/** Atualiza um local. O id_tenant no WHERE impede editar sala de outra incubadora. */
async function atualizarLocal(idTenant, idLocal, { nome, endereco, capacidade }) {
  const { rows } = await query(
    `UPDATE evento_local
        SET nome = $3, endereco = $4, capacidade = $5
      WHERE id_tenant = $1 AND id_local = $2
      RETURNING id_local, id_tenant, nome, endereco, capacidade, ativo`,
    [idTenant, idLocal, nome, endereco ?? null, capacidade ?? null]
  )
  return rows[0]
}

/** Ativa/desativa um local (o "excluir" da tela). */
async function alterarStatusLocal(idTenant, idLocal, ativo) {
  const { rows } = await query(
    `UPDATE evento_local SET ativo = $3
      WHERE id_tenant = $1 AND id_local = $2
      RETURNING id_local, id_tenant, nome, endereco, capacidade, ativo`,
    [idTenant, idLocal, ativo]
  )
  return rows[0]
}

/** Quantos eventos acontecem num local — o aviso antes de desativar. */
async function contarEventosDoLocal(idTenant, idLocal) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM evento
      WHERE id_tenant = $1 AND id_local = $2 AND ativo = TRUE`,
    [idTenant, idLocal]
  )
  return rows[0].total
}

module.exports = {
  listarCategorias,
  buscarCategoria,
  criarCategoria,
  atualizarCategoria,
  alterarStatusCategoria,
  contarEventosDaCategoria,
  semearCategoriasPadrao,

  listarLocais,
  buscarLocal,
  criarLocal,
  atualizarLocal,
  alterarStatusLocal,
  contarEventosDoLocal,
}
