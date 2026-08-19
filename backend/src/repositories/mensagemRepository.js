/**
 * Repositorio de Mensagens internas (camada de acesso a dados).
 *
 * Tabelas: mensagem, mensagem_destino, mensagem_destinatario (migracao 012).
 *
 * O metodo que carrega o desenho e `idsPorDestino`: cada tipo de destino
 * ("a startup Acme", "os mentores", "a role Financeiro") tem uma consulta
 * propria que o traduz em uma lista de PESSOAS. E ela que o service chama no
 * envio para congelar o instantaneo de quem recebe.
 *
 * Toda expansao passa por `tenant_usuarios ... ativo = TRUE`. Isso resolve dois
 * problemas de uma vez: nao avisa quem foi desligado da incubadora e nao deixa
 * uma referencia de outro tenant virar destinatario — ela simplesmente nao
 * casa, e o resultado vem vazio.
 */
const { query } = require("../config/db")

// Consulta de expansao de cada tipo de destino. Sempre $1 = id_tenant e,
// quando ha referencia, $2 = id_startup / id_role / id_usuario.
const EXPANSAO = {
  // Toda a incubadora.
  TENANT: `SELECT tu.id_usuario
             FROM tenant_usuarios tu
            WHERE tu.id_tenant = $1 AND tu.ativo = TRUE`,

  // Os membros ativos de uma startup. O JOIN com `startup` prende a startup ao
  // tenant da mensagem; o JOIN com `tenant_usuarios`, a pessoa.
  STARTUP: `SELECT sm.id_usuario
              FROM startup_membros sm
              JOIN startup s ON s.id_startup = sm.id_startup
              JOIN tenant_usuarios tu
                ON tu.id_usuario = sm.id_usuario
               AND tu.id_tenant = s.id_tenant
               AND tu.ativo = TRUE
             WHERE s.id_tenant = $1 AND sm.id_startup = $2 AND sm.ativo = TRUE`,

  // Os mentores da incubadora (destino sem referencia).
  MENTORES: `SELECT tu.id_usuario
               FROM tenant_usuarios tu
              WHERE tu.id_tenant = $1 AND tu.papel = 'mentor' AND tu.ativo = TRUE`,

  // Os mentores que acompanham UMA startup (referencia = id_startup).
  MENTORES_STARTUP: `SELECT ms.id_usuario_mentor AS id_usuario
                       FROM mentor_startup ms
                       JOIN startup s ON s.id_startup = ms.id_startup
                       JOIN tenant_usuarios tu
                         ON tu.id_usuario = ms.id_usuario_mentor
                        AND tu.id_tenant = s.id_tenant
                        AND tu.ativo = TRUE
                      WHERE s.id_tenant = $1 AND ms.id_startup = $2`,

  // Quem tem uma role RBAC. A role tambem e presa ao tenant da mensagem.
  ROLE: `SELECT ur.id_usuario
           FROM usuario_role ur
           JOIN role r ON r.id_role = ur.id_role
           JOIN tenant_usuarios tu
             ON tu.id_usuario = ur.id_usuario
            AND tu.id_tenant = r.id_tenant
            AND tu.ativo = TRUE
          WHERE r.id_tenant = $1 AND r.id_role = $2`,

  // Uma pessoa especifica, desde que seja da incubadora.
  USUARIO: `SELECT tu.id_usuario
              FROM tenant_usuarios tu
             WHERE tu.id_tenant = $1 AND tu.id_usuario = $2 AND tu.ativo = TRUE`,
}

/**
 * Traduz um destino ("os mentores da Acme") na lista de ids de quem recebe.
 * @param {number} idTenant
 * @param {{tipo:string, idReferencia?:number}} destino
 * @returns {Promise<number[]>}
 */
async function idsPorDestino(idTenant, { tipo, idReferencia }) {
  // MENTORES e o unico tipo com duas leituras: com startup, so quem acompanha
  // aquela; sem startup, o corpo de mentoria inteiro.
  const chave = tipo === "MENTORES" && idReferencia ? "MENTORES_STARTUP" : tipo
  const sql = EXPANSAO[chave]
  if (!sql) return []

  const params = chave === "TENANT" || chave === "MENTORES" ? [idTenant] : [idTenant, idReferencia]
  const { rows } = await query(sql, params)
  return rows.map((r) => r.id_usuario)
}

/** Insere a mensagem. Recebe o client da transacao (ver mensagemService.enviar). */
async function criar(client, { idTenant, idRemetente, assunto, corpo, importante = false, rota = null }) {
  const { rows } = await client.query(
    `INSERT INTO mensagem (id_tenant, id_remetente, assunto, corpo, importante, rota)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_mensagem, id_tenant, id_remetente, assunto, corpo, importante, rota, criado_ts`,
    [idTenant, idRemetente, assunto, corpo, importante, rota]
  )
  return rows[0]
}

/**
 * Grava os criterios escolhidos por quem escreveu (o "para quem" como ele
 * disse), com o rotulo congelado no envio.
 * @param {Array<{tipo:string, idReferencia?:number, rotulo?:string}>} destinos
 */
async function adicionarDestinos(client, idMensagem, destinos) {
  for (const d of destinos) {
    await client.query(
      `INSERT INTO mensagem_destino (id_mensagem, tipo, id_referencia, rotulo)
       VALUES ($1, $2, $3, $4)`,
      [idMensagem, d.tipo, d.idReferencia ?? null, d.rotulo ?? null]
    )
  }
}

/**
 * Grava a entrega: uma linha por pessoa. UNNEST em vez de um INSERT por id —
 * um aviso para a incubadora inteira sao centenas de linhas de uma vez.
 * @param {number[]} idsUsuarios
 */
async function adicionarDestinatarios(client, idMensagem, idsUsuarios) {
  if (idsUsuarios.length === 0) return
  await client.query(
    `INSERT INTO mensagem_destinatario (id_mensagem, id_usuario)
     SELECT $1, id FROM UNNEST($2::int[]) AS id
     ON CONFLICT DO NOTHING`,
    [idMensagem, idsUsuarios]
  )
}

// Os destinos de uma mensagem, como subconsulta JSON. Escrito assim (e nao
// como JOIN) porque a linha ja carrega outras contagens: com dois LEFT JOINs
// agregando ao mesmo tempo, cada um multiplicaria o outro.
const DESTINOS_JSON = `
  (SELECT COALESCE(
            json_agg(json_build_object(
              'tipo', d.tipo, 'id_referencia', d.id_referencia, 'rotulo', d.rotulo
            ) ORDER BY d.id_destino),
            '[]')
     FROM mensagem_destino d
    WHERE d.id_mensagem = m.id_mensagem) AS destinos`

/**
 * A caixa de entrada de uma pessoa no tenant: o que mandaram PARA ELA, do mais
 * recente para o mais antigo.
 * @param {{limite?:number, apenasNaoLidas?:boolean}} opcoes
 */
async function listarCaixaDeEntrada(idTenant, idUsuario, { limite = 50, apenasNaoLidas = false } = {}) {
  const { rows } = await query(
    `SELECT m.id_mensagem, m.assunto, m.corpo, m.importante, m.rota, m.criado_ts,
            m.id_remetente, u.nome AS remetente_nome, u.foto_url AS remetente_foto,
            md.lida_ts, (md.lida_ts IS NOT NULL) AS lida,
            ${DESTINOS_JSON}
       FROM mensagem_destinatario md
       JOIN mensagem m ON m.id_mensagem = md.id_mensagem
       LEFT JOIN usuarios u ON u.id_usuario = m.id_remetente
      WHERE md.id_usuario = $1
        AND m.id_tenant = $2
        AND ($3 = FALSE OR md.lida_ts IS NULL)
      ORDER BY m.criado_ts DESC
      LIMIT $4`,
    [idUsuario, idTenant, apenasNaoLidas, limite]
  )
  return rows
}

/** Quantas mensagens a pessoa ainda nao leu (o numero do sino). */
async function contarNaoLidas(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM mensagem_destinatario md
       JOIN mensagem m ON m.id_mensagem = md.id_mensagem
      WHERE md.id_usuario = $1 AND m.id_tenant = $2 AND md.lida_ts IS NULL`,
    [idUsuario, idTenant]
  )
  return rows[0].total
}

/**
 * Marca UMA mensagem como lida para uma pessoa.
 *
 * O `lida_ts IS NULL` no WHERE preserva a hora da PRIMEIRA leitura: reabrir a
 * mensagem depois nao reescreve quando ela foi vista.
 * @returns {Promise<boolean>} false se a mensagem nao era dela (ou ja estava lida).
 */
async function marcarLida(idMensagem, idUsuario) {
  const { rowCount } = await query(
    `UPDATE mensagem_destinatario
        SET lida_ts = NOW()
      WHERE id_mensagem = $1 AND id_usuario = $2 AND lida_ts IS NULL`,
    [idMensagem, idUsuario]
  )
  return rowCount > 0
}

/** Marca tudo que a pessoa tem no tenant como lido. Devolve quantas mudaram. */
async function marcarTodasLidas(idTenant, idUsuario) {
  const { rowCount } = await query(
    `UPDATE mensagem_destinatario md
        SET lida_ts = NOW()
       FROM mensagem m
      WHERE m.id_mensagem = md.id_mensagem
        AND md.id_usuario = $1
        AND m.id_tenant = $2
        AND md.lida_ts IS NULL`,
    [idUsuario, idTenant]
  )
  return rowCount
}

/**
 * O historico de envios do tenant, com o alcance de cada mensagem.
 * @param {{idRemetente?:number, limite?:number}} opcoes - idRemetente recorta
 *   para "as minhas" (quem envia, mas nao tem a chave de ver as dos outros).
 */
async function listarEnviadas(idTenant, { idRemetente = null, limite = 100 } = {}) {
  const { rows } = await query(
    `SELECT m.id_mensagem, m.assunto, m.corpo, m.importante, m.rota, m.criado_ts,
            m.id_remetente, u.nome AS remetente_nome, u.foto_url AS remetente_foto,
            (SELECT COUNT(*) FROM mensagem_destinatario md
              WHERE md.id_mensagem = m.id_mensagem)::int AS total_destinatarios,
            (SELECT COUNT(*) FROM mensagem_destinatario md
              WHERE md.id_mensagem = m.id_mensagem AND md.lida_ts IS NOT NULL)::int AS total_lidas,
            ${DESTINOS_JSON}
       FROM mensagem m
       LEFT JOIN usuarios u ON u.id_usuario = m.id_remetente
      WHERE m.id_tenant = $1
        AND ($2::int IS NULL OR m.id_remetente = $2)
      ORDER BY m.criado_ts DESC
      LIMIT $3`,
    [idTenant, idRemetente, limite]
  )
  return rows
}

/** Busca uma mensagem pelo id (sem destinos/destinatarios). */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT id_mensagem, id_tenant, id_remetente, assunto, corpo, importante, rota, criado_ts
       FROM mensagem
      WHERE id_mensagem = $1`,
    [id]
  )
  return rows[0]
}

/** Quem recebeu a mensagem, com email — os destinatarios do aviso por email. */
async function listarDestinatarios(idMensagem) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, md.lida_ts
       FROM mensagem_destinatario md
       JOIN usuarios u ON u.id_usuario = md.id_usuario
      WHERE md.id_mensagem = $1
      ORDER BY u.nome`,
    [idMensagem]
  )
  return rows
}

/** Exclui a mensagem. Destinos e destinatarios vao junto (ON DELETE CASCADE). */
async function excluir(id) {
  await query(`DELETE FROM mensagem WHERE id_mensagem = $1`, [id])
}

module.exports = {
  idsPorDestino,
  criar,
  adicionarDestinos,
  adicionarDestinatarios,
  listarCaixaDeEntrada,
  contarNaoLidas,
  marcarLida,
  marcarTodasLidas,
  listarEnviadas,
  buscarPorId,
  listarDestinatarios,
  excluir,
}
