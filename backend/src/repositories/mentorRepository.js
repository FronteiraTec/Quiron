/**
 * Repositorio de Mentores (camada de acesso a dados).
 * Tabelas relacionadas: tenant_usuarios, mentor_startup, startup, entrega,
 * avaliacao (schema.sql).
 *
 * "Mentor" nao e uma tabela: e um PAPEL em tenant_usuarios. Quem esta na lista
 * sao os usuarios com papel 'mentor' naquele tenant; mentor_startup diz quais
 * startups cada um acompanha. E esse vinculo que recorta a fila de avaliacao
 * (ver entregaService.listarFila).
 */
const { query } = require("../config/db")

/**
 * Uma entrega esta "pendente" quando foi enviada e ainda nao tem avaliacao.
 * Nao existe flag para isso: o reenvio apaga as avaliacoes anteriores
 * (jornadaRepository.reenviar), entao ENVIADA sem avaliacao ja significa
 * "esperando o mentor". Mesma definicao usada pela fila.
 *
 * Ja vem entre parenteses: e uma subquery correlacionada por `s.id_startup` e
 * precisa deles tanto para entrar num SUM() quanto para receber um cast.
 */
const PENDENTES_DA_STARTUP = `(
  SELECT COUNT(*)
    FROM entrega e
   WHERE e.id_startup = s.id_startup
     AND e.status = 'ENVIADA'
     AND NOT EXISTS (SELECT 1 FROM avaliacao a WHERE a.id_entrega = e.id_entrega)
)`

/**
 * Lista os mentores do tenant com a carga de cada um: quantas startups
 * acompanha e quantas entregas esperam resposta dele.
 *
 * A contagem sai de `s` (startup ja filtrada pelo tenant) e nao de
 * mentor_startup: um vinculo apontando para startup de outro tenant nao pode
 * inflar o numero exibido aqui.
 *
 * @param {number} idTenant
 */
async function listarPorTenant(idTenant) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.celular, u.foto_url,
            tu.criado_ts AS desde,
            COUNT(DISTINCT s.id_startup)::int AS startups,
            COALESCE(SUM(${PENDENTES_DA_STARTUP}), 0)::int AS pendentes
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
       LEFT JOIN mentor_startup ms ON ms.id_usuario_mentor = u.id_usuario
       LEFT JOIN startup s
              ON s.id_startup = ms.id_startup AND s.id_tenant = tu.id_tenant
      WHERE tu.id_tenant = $1 AND tu.papel = 'mentor' AND tu.ativo = TRUE
      GROUP BY u.id_usuario, tu.criado_ts
      ORDER BY u.nome`,
    [idTenant]
  )
  return rows
}

/**
 * Startups que um mentor acompanha dentro do tenant, com o que cada uma tem
 * parado na fila dele.
 */
async function listarStartupsDoMentor(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.status,
            ${PENDENTES_DA_STARTUP}::int AS pendentes
       FROM mentor_startup ms
       JOIN startup s ON s.id_startup = ms.id_startup
      WHERE ms.id_usuario_mentor = $2 AND s.id_tenant = $1
      ORDER BY s.nome`,
    [idTenant, idUsuario]
  )
  return rows
}

/**
 * Startups do tenant que este mentor AINDA NAO acompanha — as opcoes de
 * vinculo. Sem isso a tela ofereceria startups ja vinculadas, que so dariam 409.
 */
async function listarStartupsDisponiveis(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.status
       FROM startup s
      WHERE s.id_tenant = $1
        AND NOT EXISTS (
          SELECT 1 FROM mentor_startup ms
           WHERE ms.id_startup = s.id_startup
             AND ms.id_usuario_mentor = $2
        )
      ORDER BY s.nome`,
    [idTenant, idUsuario]
  )
  return rows
}

/** Mentores que acompanham uma startup (visao inversa, pela startup). */
async function listarPorStartup(idStartup) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.foto_url
       FROM mentor_startup ms
       JOIN usuarios u ON u.id_usuario = ms.id_usuario_mentor
      WHERE ms.id_startup = $1
      ORDER BY u.nome`,
    [idStartup]
  )
  return rows
}

/** Cria o vinculo mentor -> startup. */
async function vincular(idUsuario, idStartup) {
  const { rows } = await query(
    `INSERT INTO mentor_startup (id_usuario_mentor, id_startup)
     VALUES ($1, $2)
     RETURNING id_usuario_mentor, id_startup`,
    [idUsuario, idStartup]
  )
  return rows[0]
}

/** Remove o vinculo. Devolve undefined se ele nao existia. */
async function desvincular(idUsuario, idStartup) {
  const { rows } = await query(
    `DELETE FROM mentor_startup
      WHERE id_usuario_mentor = $1 AND id_startup = $2
      RETURNING id_usuario_mentor, id_startup`,
    [idUsuario, idStartup]
  )
  return rows[0]
}

module.exports = {
  listarPorTenant,
  listarStartupsDoMentor,
  listarStartupsDisponiveis,
  listarPorStartup,
  vincular,
  desvincular,
}
