/**
 * Repositorio dos beneficios da startup (migracao 026).
 * Tabela: startup_beneficio.
 *
 * Conceder e revogar sao UPDATE da mesma linha: revogar so desliga a flag, e
 * os dados que o beneficio guardou (o CRM inteiro) ficam onde estao.
 */
const { query } = require("../config/db")

const COLUNAS = `
  sb.id_startup, sb.beneficio, sb.ativo,
  sb.concedido_ts, sb.concedido_por, uc.nome AS concedido_por_nome,
  sb.revogado_ts, sb.revogado_por, ur.nome AS revogado_por_nome
`

const JOINS = `
  LEFT JOIN usuarios uc ON uc.id_usuario = sb.concedido_por
  LEFT JOIN usuarios ur ON ur.id_usuario = sb.revogado_por
`

/** Os beneficios ja concedidos (ativos ou revogados) a uma startup. */
async function listarDaStartup(idStartup) {
  const { rows } = await query(
    `SELECT ${COLUNAS}
       FROM startup_beneficio sb
       ${JOINS}
      WHERE sb.id_startup = $1`,
    [idStartup]
  )
  return rows
}

/**
 * Concede, ou reativa um beneficio revogado. Sem linha de volta = ja estava
 * ativo (nada a fazer, e nada a auditar).
 */
async function conceder(client, idStartup, beneficio, idUsuario) {
  const { rows } = await client.query(
    `INSERT INTO startup_beneficio (id_startup, beneficio, ativo, concedido_por, concedido_ts)
     VALUES ($1, $2, TRUE, $3, NOW())
     ON CONFLICT (id_startup, beneficio) DO UPDATE
        SET ativo = TRUE,
            concedido_por = EXCLUDED.concedido_por,
            concedido_ts = NOW(),
            revogado_por = NULL,
            revogado_ts = NULL
      WHERE startup_beneficio.ativo = FALSE
     RETURNING *`,
    [idStartup, beneficio, idUsuario]
  )
  return rows[0] || null
}

/** Revoga. Sem linha de volta = nao estava ativo. */
async function revogar(client, idStartup, beneficio, idUsuario) {
  const { rows } = await client.query(
    `UPDATE startup_beneficio
        SET ativo = FALSE, revogado_por = $3, revogado_ts = NOW()
      WHERE id_startup = $1 AND beneficio = $2 AND ativo = TRUE
      RETURNING *`,
    [idStartup, beneficio, idUsuario]
  )
  return rows[0] || null
}

/**
 * Os beneficios ATIVOS que a pessoa alcanca, um por startup: so as startups de
 * que ela e membro ativo, em incubadoras onde o vinculo dela tambem esta ativo.
 * E o que decide o item "CRM" no menu.
 *
 * @param {number} idUsuario
 * @param {number|null} idTenant - recorta a uma incubadora (a do menu atual).
 */
async function listarDoUsuario(idUsuario, idTenant = null) {
  const { rows } = await query(
    `SELECT sb.beneficio, s.id_startup, s.uuid, s.nome, s.id_tenant
       FROM startup_beneficio sb
       JOIN startup s ON s.id_startup = sb.id_startup
       JOIN startup_membros sm
         ON sm.id_startup = s.id_startup AND sm.id_usuario = $1 AND sm.ativo = TRUE
       JOIN tenant_usuarios tu
         ON tu.id_tenant = s.id_tenant AND tu.id_usuario = $1 AND tu.ativo = TRUE
      WHERE sb.ativo = TRUE
        AND ($2::int IS NULL OR s.id_tenant = $2)
      ORDER BY s.nome`,
    [idUsuario, idTenant]
  )
  return rows
}

/**
 * Tudo que o portao do CRM precisa saber, numa consulta: a startup existe? a
 * pessoa e membro ativo dela (com o vinculo ativo na incubadora)? o beneficio
 * esta ativo? E o nome de quem pede, que vira o autor dos eventos.
 *
 * @returns {Promise<null|{id_startup, id_tenant, nome, membro, beneficio_ativo, autor_nome}>}
 *   null quando a startup nao existe.
 */
async function acessoCrm(idStartup, idUsuario) {
  const { rows } = await query(
    `SELECT s.id_startup, s.id_tenant, s.uuid, s.nome,
            (sm.id_usuario IS NOT NULL AND tu.id_usuario IS NOT NULL) AS membro,
            COALESCE(sb.ativo, FALSE) AS beneficio_ativo,
            u.nome AS autor_nome
       FROM startup s
       LEFT JOIN startup_membros sm
              ON sm.id_startup = s.id_startup AND sm.id_usuario = $2 AND sm.ativo = TRUE
       LEFT JOIN tenant_usuarios tu
              ON tu.id_tenant = s.id_tenant AND tu.id_usuario = $2 AND tu.ativo = TRUE
       LEFT JOIN startup_beneficio sb
              ON sb.id_startup = s.id_startup AND sb.beneficio = 'CRM'
       LEFT JOIN usuarios u ON u.id_usuario = $2
      WHERE s.id_startup = $1`,
    [idStartup, idUsuario]
  )
  return rows[0] || null
}

module.exports = { listarDaStartup, conceder, revogar, listarDoUsuario, acessoCrm }
