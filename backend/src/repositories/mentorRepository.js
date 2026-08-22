/**
 * Repositorio de Mentores (camada de acesso a dados).
 * Tabelas relacionadas: tenant_usuarios, mentor_perfil, mentor_startup,
 * startup, entrega, avaliacao, evento (schema.sql).
 *
 * "Mentor" nao e uma tabela: e um PAPEL em tenant_usuarios. Quem esta na lista
 * sao os usuarios com papel 'mentor' naquele tenant; mentor_startup diz quais
 * startups cada um acompanha. E esse vinculo que recorta a fila de avaliacao
 * (ver entregaService.listarFila).
 *
 * O CADASTRO do mentor (vinculo institucional, area, especialidades, demandas,
 * disponibilidade, formato, status, observacoes) mora em `mentor_perfil`, que e
 * OPCIONAL: a listagem faz LEFT JOIN e aplica os padroes, e a linha nasce no
 * primeiro salvamento (ver migracao 016).
 */
const { query } = require("../config/db")
const { FORMATO_PADRAO, SITUACAO_PADRAO } = require("../mentores/perfil")

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
 * As startups que um mentor acompanha DENTRO do tenant.
 *
 * Sai de `s` (startup ja filtrada pelo tenant) e nao de mentor_startup: um
 * vinculo apontando para startup de outra incubadora nao pode inflar a carga
 * exibida aqui.
 */
const STARTUPS_DO_MENTOR = `
  FROM mentor_startup ms
  JOIN startup s ON s.id_startup = ms.id_startup AND s.id_tenant = $1
 WHERE ms.id_usuario_mentor = u.id_usuario
`

/**
 * O historico de mentoria de um mentor sai da AGENDA: atividades de categoria
 * MENTORIA que ja aconteceram e apontam para ele.
 *
 * Por que a agenda, e nao as avaliacoes: avaliar entrega e devolutiva, nao
 * sessao de mentoria — contar uma como a outra faria o mentor que responde
 * muito e nunca senta com ninguem parecer o mais presente da incubadora.
 *
 * `id_usuario_mentor` (migracao 016), nunca `mentor_nome`: por texto, "Ana
 * Souza" e "ana souza" seriam dois mentores e nenhuma contagem fecharia.
 *
 * A chave 'MENTORIA' e a da categoria padrao (eventos/categoriasPadrao). O
 * rotulo dela e editavel pela incubadora, a chave nao — renomear "Mentoria"
 * para "Sessao 1:1" nao quebra esta contagem.
 */
const MENTORIAS_DO_MENTOR = `
  FROM evento ev
 WHERE ev.id_usuario_mentor = u.id_usuario
   AND ev.id_tenant = $1
   AND ev.categoria = 'MENTORIA'
   AND ev.ativo = TRUE
   AND ev.inicio_ts <= NOW()
`

/**
 * Lista os mentores do tenant: o cadastro de cada um, a carga (startups +
 * entregas paradas) e o historico de mentorias.
 *
 * TUDO EM SUBCONSULTA ESCALAR, e nao em JOIN + GROUP BY. Com o perfil, a
 * carga e as duas contagens de mentoria na mesma linha, agrupar exigiria
 * listar cada coluna de mentor_perfil no GROUP BY — e a proxima coluna do
 * cadastro entraria calada na lista, ou faria a query parar de compilar.
 *
 * @param {number} idTenant
 * @param {number} dias - janela de "mentorias no periodo" (ver o service).
 */
async function listarPorTenant(idTenant, dias) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.celular, u.foto_url,
            tu.criado_ts AS desde,

            -- O cadastro. COALESCE porque o perfil e opcional: quem nunca foi
            -- editado le como ATIVO/HIBRIDO, que e o padrao da tabela.
            p.vinculo, p.area, p.horas_mes, p.observacoes,
            COALESCE(p.especialidades, '{}') AS especialidades,
            COALESCE(p.demandas, '{}')       AS demandas,
            COALESCE(p.formato,  '${FORMATO_PADRAO}')::text  AS formato,
            COALESCE(p.situacao, '${SITUACAO_PADRAO}')::text AS situacao,
            p.atualizado_ts AS perfil_atualizado_ts,

            (SELECT COUNT(*)::int ${STARTUPS_DO_MENTOR}) AS startups,
            (SELECT COALESCE(SUM(${PENDENTES_DA_STARTUP}), 0)::int ${STARTUPS_DO_MENTOR}) AS pendentes,

            (SELECT MAX(ev.inicio_ts) ${MENTORIAS_DO_MENTOR}) AS ultima_mentoria_ts,
            (SELECT COUNT(*)::int ${MENTORIAS_DO_MENTOR}
               AND ev.inicio_ts >= NOW() - make_interval(days => $2)) AS mentorias_periodo
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
       LEFT JOIN mentor_perfil p
              ON p.id_tenant = tu.id_tenant AND p.id_usuario = u.id_usuario
      WHERE tu.id_tenant = $1 AND tu.papel = 'mentor' AND tu.ativo = TRUE
      ORDER BY u.nome`,
    [idTenant, dias]
  )
  return rows
}

/**
 * Grava o cadastro do mentor: cria a linha na primeira vez, substitui depois.
 *
 * UPSERT porque o perfil e opcional — o mentor existe desde que ganhou o papel
 * em /usuarios, e a primeira edicao nesta tela e que faz nascer a linha. Sem o
 * ON CONFLICT, a tela precisaria saber se ja havia cadastro para escolher entre
 * POST e PUT, e essa e uma pergunta que ela nao tem por que fazer.
 */
async function salvarPerfil(idTenant, idUsuario, dados) {
  const { vinculo, area, especialidades, demandas, horasMes, formato, situacao, observacoes } =
    dados
  const { rows } = await query(
    `INSERT INTO mentor_perfil
       (id_tenant, id_usuario, vinculo, area, especialidades, demandas,
        horas_mes, formato, situacao, observacoes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id_tenant, id_usuario) DO UPDATE
       SET vinculo        = EXCLUDED.vinculo,
           area           = EXCLUDED.area,
           especialidades = EXCLUDED.especialidades,
           demandas       = EXCLUDED.demandas,
           horas_mes      = EXCLUDED.horas_mes,
           formato        = EXCLUDED.formato,
           situacao       = EXCLUDED.situacao,
           observacoes    = EXCLUDED.observacoes,
           atualizado_ts  = NOW()
     RETURNING *`,
    [
      idTenant, idUsuario, vinculo, area, especialidades, demandas,
      horasMes, formato, situacao, observacoes,
    ]
  )
  return rows[0]
}

/**
 * Muda so o status do mentor — o que a acao em massa da listagem altera.
 *
 * Tambem e upsert, e pelo mesmo motivo: marcar "Indisponivel" para tres
 * mentores que nunca tiveram cadastro precisa funcionar. Os demais campos
 * nascem com o padrao da tabela.
 */
async function atualizarSituacao(idTenant, idUsuario, situacao) {
  const { rows } = await query(
    `INSERT INTO mentor_perfil (id_tenant, id_usuario, situacao)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_tenant, id_usuario) DO UPDATE
       SET situacao = EXCLUDED.situacao, atualizado_ts = NOW()
     RETURNING id_tenant, id_usuario, situacao`,
    [idTenant, idUsuario, situacao]
  )
  return rows[0]
}

/**
 * Startups que um mentor acompanha dentro do tenant, com o que cada uma tem
 * parado na fila dele.
 */
async function listarStartupsDoMentor(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.status,
            -- O status que a incubadora cadastrou (startup_situacao): sem ele o
            -- painel do mentor mostraria "Ativa" onde a tela de startups mostra
            -- "Em tracao".
            sit.rotulo AS situacao_rotulo, sit.cor AS situacao_cor,
            ${PENDENTES_DA_STARTUP}::int AS pendentes
       FROM mentor_startup ms
       JOIN startup s ON s.id_startup = ms.id_startup
       LEFT JOIN startup_situacao sit
              ON sit.id_tenant = s.id_tenant AND sit.chave = s.situacao
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
  salvarPerfil,
  atualizarSituacao,
  listarStartupsDoMentor,
  listarStartupsDisponiveis,
  listarPorStartup,
  vincular,
  desvincular,
}
