/**
 * Repositorio de Startups (camada de acesso a dados).
 * Tabelas relacionadas: startup, startup_membros, mentor_startup, startup_trilha,
 * startup_contato, startup_tipo, startup_situacao (migracao 010).
 */
const { query, withTransaction } = require("../config/db")

/**
 * Traz o rotulo e a cor do tipo e da situacao junto da startup.
 *
 * LEFT JOIN nos dois: tipo e opcional no cadastro, e uma startup criada antes
 * da migracao pode nao ter situacao. A tela precisa desenhar essas linhas
 * mesmo assim.
 */
const JOIN_VOCABULARIO = `
  LEFT JOIN startup_tipo st_tipo
         ON st_tipo.id_tenant = s.id_tenant AND st_tipo.chave = s.tipo
  LEFT JOIN startup_situacao st_sit
         ON st_sit.id_tenant = s.id_tenant AND st_sit.chave = s.situacao
`

const CAMPOS_VOCABULARIO = `
  st_tipo.rotulo AS tipo_rotulo, st_tipo.cor AS tipo_cor,
  st_sit.rotulo AS situacao_rotulo, st_sit.cor AS situacao_cor, st_sit.ciclo AS situacao_ciclo
`

/**
 * O `status` (enum do ciclo) e DERIVADO da situacao escolhida, nunca digitado.
 *
 * Quem cadastra escolhe "Graduada"; que isso significa ENCERRADA — e portanto
 * fora das contagens do programa em todo relatorio — e o que esta subconsulta
 * resolve. Deixar o cliente mandar o status abriria a porta para a startup
 * marcada como "Ativa" na tela e ENCERRADA no banco.
 *
 * COALESCE para 'ATIVA' cobre o cadastro sem situacao: a coluna tem default e o
 * programa precisa de um estado.
 *
 * @param {number} iTenant - posicao do id_tenant entre os parametros ($n).
 * @param {number} iSituacao - posicao da chave da situacao.
 */
const statusDaSituacao = (iTenant, iSituacao) =>
  `COALESCE((SELECT ciclo FROM startup_situacao
              WHERE id_tenant = $${iTenant} AND chave = $${iSituacao}), 'ATIVA')`

/**
 * Junta a fase atual (primeira fase ativa da trilha ainda nao aprovada) e a
 * contagem de fases totais/aprovadas a uma consulta na tabela startup.
 * Usado por listarPorTenant e buscarPorId para calcular o progresso na
 * trilha de incubacao sem precisar de uma coluna dedicada.
 *
 * As fases agora sao nos da arvore (trilha_no com tipo = 'FASE'), e o
 * progresso vive em startup_trilha.
 */
const JOIN_PROGRESSO = `
  LEFT JOIN (
    SELECT id_tenant, COUNT(*) AS total_fases
      FROM trilha_no
     WHERE tipo = 'FASE' AND ativo = TRUE
     GROUP BY id_tenant
  ) tf ON tf.id_tenant = s.id_tenant
  LEFT JOIN (
    SELECT st.id_startup, COUNT(*) AS fases_aprovadas
      FROM startup_trilha st
      JOIN trilha_no n ON n.id_no = st.id_no AND n.tipo = 'FASE'
     WHERE st.status = 'APROVADA'
     GROUP BY st.id_startup
  ) sfok ON sfok.id_startup = s.id_startup
  LEFT JOIN LATERAL (
    SELECT f.nome
      FROM trilha_no f
     WHERE f.id_tenant = s.id_tenant AND f.tipo = 'FASE' AND f.ativo = TRUE
       AND NOT EXISTS (
         SELECT 1 FROM startup_trilha x
          WHERE x.id_startup = s.id_startup AND x.id_no = f.id_no AND x.status = 'APROVADA'
       )
     ORDER BY f.ordem
     LIMIT 1
  ) prox ON TRUE
`

/** Calcula o percentual de progresso (0-100) a partir das contagens de fases. */
function comProgresso(row) {
  const total = Number(row.total_fases) || 0
  const aprovadas = Number(row.fases_aprovadas) || 0
  return {
    ...row,
    total_fases: total,
    fases_aprovadas: aprovadas,
    fase_atual: row.fase_atual_nome || null,
    progresso_pct: total > 0 ? Math.round((aprovadas / total) * 100) : 0,
  }
}

/**
 * Lista as startups de um tenant, com fase atual e progresso na trilha.
 *
 * @param {number} idTenant
 * @param {number[]|null} [idsPermitidos] - Quando informado, restringe a lista
 *   a essas startups (mentor/usuario veem apenas as que acompanham).
 *   `null` = sem restricao (admin/root veem todas).
 */
async function listarPorTenant(idTenant, idsPermitidos = null) {
  const condicoes = ["s.id_tenant = $1"]
  const params = [idTenant]

  if (idsPermitidos) {
    params.push(idsPermitidos)
    condicoes.push(`s.id_startup = ANY($${params.length}::int[])`)
  }

  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.cnpj, s.email, s.status, s.tipo, s.situacao,
            s.cidade, s.uf, s.campos_extras, s.criado_ts,
            ${CAMPOS_VOCABULARIO},
            COALESCE(tf.total_fases, 0) AS total_fases,
            COALESCE(sfok.fases_aprovadas, 0) AS fases_aprovadas,
            prox.nome AS fase_atual_nome
       FROM startup s
       ${JOIN_PROGRESSO}
       ${JOIN_VOCABULARIO}
      WHERE ${condicoes.join(" AND ")}
      ORDER BY s.nome`,
    params
  )
  return rows.map(comProgresso)
}

/** Busca uma startup pelo id, com fase atual e progresso na trilha. */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT s.*, ${CAMPOS_VOCABULARIO},
            COALESCE(tf.total_fases, 0) AS total_fases,
            COALESCE(sfok.fases_aprovadas, 0) AS fases_aprovadas,
            prox.nome AS fase_atual_nome
       FROM startup s
       ${JOIN_PROGRESSO}
       ${JOIN_VOCABULARIO}
      WHERE s.id_startup = $1`,
    [id]
  )
  return rows[0] && comProgresso(rows[0])
}

/**
 * As colunas do cadastro, na ordem em que os parametros entram. Uma lista so
 * porque INSERT e UPDATE gravam exatamente o mesmo conjunto — manter duas
 * copias garantiria que um campo novo entrasse em um e faltasse no outro.
 *
 * O id_tenant e o nome ficam de fora: o primeiro nunca muda depois de criada,
 * e o segundo abre a lista nas duas queries.
 */
const COLUNAS_CADASTRO = [
  "cnpj",
  "inscricao_estadual",
  "email",
  "tipo",
  "situacao",
  "observacoes",
  "cep",
  "uf",
  "cidade",
  "bairro",
  "rua",
  "numero",
  "complemento",
]

/** Os valores de COLUNAS_CADASTRO, na mesma ordem, a partir do objeto do service. */
function valoresCadastro(dados) {
  return COLUNAS_CADASTRO.map((coluna) => dados[coluna] ?? null)
}

/**
 * Atualiza os dados cadastrais de uma startup.
 *
 * O `status` sai da situacao (ver statusDaSituacao) e o `campos_extras` chega
 * ja normalizado pelo service — aqui ele so e gravado.
 */
async function atualizar(id, dados) {
  // $1 = id, $2 = nome, $3..$n = COLUNAS_CADASTRO, depois id_tenant, situacao
  // (de novo) e extras.
  const params = [id, dados.nome, ...valoresCadastro(dados)]
  const sets = COLUNAS_CADASTRO.map((coluna, i) => `${coluna} = $${i + 3}`)

  params.push(dados.idTenant)
  const iTenant = params.length
  // A SITUACAO VAI DUAS VEZES, de proposito. Reaproveitar a posicao dela na
  // lista de colunas faria o Postgres deduzir dois tipos para o mesmo
  // parametro — varchar no SET, text na comparacao dentro da subconsulta —, e
  // ele recusa a query com "inconsistent types deduced for parameter".
  params.push(dados.situacao ?? null)
  const iSituacao = params.length
  params.push(JSON.stringify(dados.camposExtras ?? {}))
  const iExtras = params.length

  const { rows } = await query(
    `UPDATE startup
        SET nome = $2,
            ${sets.join(", ")},
            status = ${statusDaSituacao(iTenant, iSituacao)},
            campos_extras = $${iExtras}::jsonb,
            atualizado_ts = NOW()
      WHERE id_startup = $1
      RETURNING *`,
    params
  )
  return rows[0]
}

/**
 * Troca a SITUACAO de uma startup (o "status" que a incubadora ve), e com ela
 * o estado de ciclo derivado.
 */
async function atualizarSituacao(id, idTenant, situacao) {
  const { rows } = await query(
    `UPDATE startup
        SET situacao = $3,
            status = ${statusDaSituacao(2, 4)},
            atualizado_ts = NOW()
      WHERE id_startup = $1 AND id_tenant = $2
      RETURNING *`,
    // $3 e $4 sao a mesma situacao: ver o comentario em atualizar sobre a
    // deducao de tipo do Postgres.
    [id, idTenant, situacao, situacao]
  )
  return rows[0]
}

/** Cria uma nova startup dentro de um tenant. */
async function criar(dados) {
  // $1 = id_tenant, $2 = nome, $3..$n = COLUNAS_CADASTRO, depois situacao (de
  // novo) e extras.
  const params = [dados.idTenant, dados.nome, ...valoresCadastro(dados)]
  const placeholders = COLUNAS_CADASTRO.map((_, i) => `$${i + 3}`)

  // Duas vezes, como em atualizar — ver o comentario la.
  params.push(dados.situacao ?? null)
  const iSituacao = params.length
  params.push(JSON.stringify(dados.camposExtras ?? {}))
  const iExtras = params.length

  const { rows } = await query(
    `INSERT INTO startup (id_tenant, nome, ${COLUNAS_CADASTRO.join(", ")}, status, campos_extras)
     VALUES ($1, $2, ${placeholders.join(", ")}, ${statusDaSituacao(1, iSituacao)}, $${iExtras}::jsonb)
     RETURNING *`,
    params
  )
  return rows[0]
}

// ---------------------------------------------------------------------------
// CONTATOS
// ---------------------------------------------------------------------------

/** Contatos de uma startup, o principal primeiro. */
async function listarContatos(idStartup) {
  const { rows } = await query(
    `SELECT id_contato, id_startup, nome, cargo, email, telefone, principal, ordem
       FROM startup_contato
      WHERE id_startup = $1
      ORDER BY principal DESC, ordem, nome`,
    [idStartup]
  )
  return rows
}

/**
 * Substitui a lista inteira de contatos de uma startup.
 *
 * REESCREVE TUDO, em vez de um CRUD por contato, porque e assim que o
 * formulario funciona: a lista e editada como um bloco (adiciona linha, apaga
 * linha, salva) e mandar tres requisicoes para o que o usuario percebeu como
 * um "Salvar" abriria a janela de o telefone gravar e a exclusao falhar.
 *
 * DELETE + INSERT dentro de uma transacao, e nao diff linha a linha: os
 * contatos nao sao referenciados por nada (nenhuma FK aponta para
 * startup_contato), entao o id nao precisa sobreviver, e o diff so
 * acrescentaria caminhos para errar.
 */
async function substituirContatos(idStartup, contatos) {
  return withTransaction(async (client) => {
    await client.query(`DELETE FROM startup_contato WHERE id_startup = $1`, [idStartup])

    if (contatos.length === 0) return []

    const valores = []
    const params = [idStartup]
    contatos.forEach((c, indice) => {
      const i = params.length
      valores.push(`($1, $${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6})`)
      params.push(c.nome, c.cargo, c.email, c.telefone, c.principal, indice)
    })

    const { rows } = await client.query(
      `INSERT INTO startup_contato (id_startup, nome, cargo, email, telefone, principal, ordem)
       VALUES ${valores.join(", ")}
       RETURNING id_contato, id_startup, nome, cargo, email, telefone, principal, ordem`,
      params
    )
    return rows
  })
}

/**
 * Adiciona um membro (usuario) a uma startup.
 *
 * Remover um membro so desativa o vinculo (ativo = FALSE), e a linha fica na
 * tabela com a mesma chave (id_startup, id_usuario). Por isso quem ja saiu e
 * readicionado reativando essa linha, com nova entrada_dt. Se o vinculo ja
 * estiver ativo, nada e alterado e a funcao devolve undefined.
 */
async function adicionarMembro(idStartup, idUsuario, lider = false) {
  const { rows } = await query(
    `INSERT INTO startup_membros (id_startup, id_usuario, lider)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_startup, id_usuario) DO UPDATE
        SET ativo = TRUE, lider = EXCLUDED.lider,
            entrada_dt = NOW(), saida_dt = NULL
      WHERE startup_membros.ativo = FALSE
     RETURNING *`,
    [idStartup, idUsuario, lider]
  )
  return rows[0]
}

/** Lista os membros ativos de uma startup, com nome/email do usuario. */
async function listarMembros(idStartup) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, sm.lider, sm.ativo, sm.entrada_dt
       FROM startup_membros sm
       JOIN usuarios u ON u.id_usuario = sm.id_usuario
      WHERE sm.id_startup = $1 AND sm.ativo = TRUE
      ORDER BY sm.lider DESC, u.nome`,
    [idStartup]
  )
  return rows
}

/**
 * Todos os membros ativos das startups do tenant, um por VINCULO.
 *
 * Uma pessoa em duas startups aparece duas vezes, de proposito: aqui a unidade
 * e o vinculo (quem e lider de que, desde quando), nao a pessoa. E a visao que
 * a aba de membros de UMA startup nao da.
 */
async function listarMembrosPorTenant(idTenant) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.foto_url,
            s.id_startup, s.nome AS startup, s.status AS startup_status,
            st_sit.rotulo AS startup_situacao_rotulo, st_sit.cor AS startup_situacao_cor,
            sm.lider, sm.entrada_dt
       FROM startup s
       JOIN startup_membros sm ON sm.id_startup = s.id_startup AND sm.ativo = TRUE
       JOIN usuarios u ON u.id_usuario = sm.id_usuario
       LEFT JOIN startup_situacao st_sit
              ON st_sit.id_tenant = s.id_tenant AND st_sit.chave = s.situacao
      WHERE s.id_tenant = $1
      ORDER BY s.nome, sm.lider DESC, u.nome`,
    [idTenant]
  )
  return rows
}

/**
 * Incubados do tenant que nao estao em NENHUMA startup.
 *
 * Este e o estado que a tela existe para achar: sem vinculo, a pessoa entra no
 * sistema e nao tem jornada, nao tem entrega, nao tem nada — e nada na
 * interface dela explica por que. So o papel 'usuario' conta; admin e mentor
 * nao pertencem a startup nenhuma por definicao.
 */
async function listarSemStartup(idTenant) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email, u.foto_url, tu.criado_ts AS desde
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
      WHERE tu.id_tenant = $1 AND tu.papel = 'usuario' AND tu.ativo = TRUE
        AND NOT EXISTS (
          SELECT 1
            FROM startup_membros sm
            JOIN startup s ON s.id_startup = sm.id_startup
           WHERE sm.id_usuario = u.id_usuario
             AND sm.ativo = TRUE
             AND s.id_tenant = tu.id_tenant
        )
      ORDER BY u.nome`,
    [idTenant]
  )
  return rows
}

/**
 * Lista os ids das startups (dentro de um tenant) as quais o usuario esta
 * ligado, seja como membro (startup_membros) ou como mentor (mentor_startup).
 * Usado para restringir a visibilidade de eventos direcionados.
 * @param {number} idTenant
 * @param {number} idUsuario
 * @returns {Promise<number[]>}
 */
async function listarIdsPorUsuario(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT DISTINCT s.id_startup
       FROM startup s
       LEFT JOIN startup_membros sm ON sm.id_startup = s.id_startup AND sm.id_usuario = $2 AND sm.ativo = TRUE
       LEFT JOIN mentor_startup ms ON ms.id_startup = s.id_startup AND ms.id_usuario_mentor = $2
      WHERE s.id_tenant = $1
        AND (sm.id_usuario IS NOT NULL OR ms.id_usuario_mentor IS NOT NULL)`,
    [idTenant, idUsuario]
  )
  return rows.map((r) => r.id_startup)
}

/**
 * Lista os ids das startups que o usuario acompanha COMO MENTOR.
 *
 * Diferente de listarIdsPorUsuario, que soma membro + mentor para decidir o
 * que a pessoa enxerga. Aqui o vinculo de membro nao serve: quem avalia a
 * fila de entregas precisa ser mentor da startup, e nao alguem do time dela.
 *
 * @param {number} idTenant
 * @param {number} idUsuario
 * @returns {Promise<number[]>}
 */
async function listarIdsPorMentor(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT ms.id_startup
       FROM mentor_startup ms
       JOIN startup s ON s.id_startup = ms.id_startup
      WHERE s.id_tenant = $1 AND ms.id_usuario_mentor = $2`,
    [idTenant, idUsuario]
  )
  return rows.map((r) => r.id_startup)
}

/**
 * Mentores que acompanham a startup, com email — os destinatarios do aviso de
 * entrega enviada.
 *
 * So mentores com vinculo ATIVO no tenant: quem foi desligado da incubadora
 * continua em mentor_startup (o vinculo nao e apagado) e voltaria a receber
 * email de startup que nao acompanha mais.
 */
async function listarMentores(idStartup) {
  const { rows } = await query(
    `SELECT u.id_usuario, u.nome, u.email
       FROM mentor_startup ms
       JOIN startup s  ON s.id_startup = ms.id_startup
       JOIN usuarios u ON u.id_usuario = ms.id_usuario_mentor
       JOIN tenant_usuarios tu
         ON tu.id_usuario = u.id_usuario
        AND tu.id_tenant = s.id_tenant
        AND tu.ativo = TRUE
      WHERE ms.id_startup = $1
      ORDER BY u.nome`,
    [idStartup]
  )
  return rows
}

/** O usuario e mentor desta startup? Guarda da avaliacao de entregas. */
async function ehMentorDe(idStartup, idUsuario) {
  const { rows } = await query(
    `SELECT 1
       FROM mentor_startup
      WHERE id_startup = $1 AND id_usuario_mentor = $2`,
    [idStartup, idUsuario]
  )
  return rows.length > 0
}

/**
 * Busca a startup (ativa) a qual o usuario logado pertence como membro,
 * dentro do tenant informado. Usada pela tela "Minha Startup".
 */
async function buscarStartupDoUsuario(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT s.*, ${CAMPOS_VOCABULARIO}, sm.lider
       FROM startup s
       JOIN startup_membros sm ON sm.id_startup = s.id_startup
       ${JOIN_VOCABULARIO}
      WHERE s.id_tenant = $1 AND sm.id_usuario = $2 AND sm.ativo = TRUE
      LIMIT 1`,
    [idTenant, idUsuario]
  )
  return rows[0]
}

/** Remove (desativa) um membro de uma startup. */
async function removerMembro(idStartup, idUsuario) {
  const { rows } = await query(
    `UPDATE startup_membros
        SET ativo = FALSE, saida_dt = NOW()
      WHERE id_startup = $1 AND id_usuario = $2 AND ativo = TRUE
      RETURNING *`,
    [idStartup, idUsuario]
  )
  return rows[0]
}

/** Lista as fases ja concluidas (aprovadas) de uma startup, em ordem da trilha. */
async function listarFasesConcluidas(idStartup) {
  const { rows } = await query(
    `SELECT st.id_startup_fase, f.nome, f.descricao, f.ordem, st.fim_ts,
            u.nome AS aprovado_por_nome
       FROM startup_trilha st
       JOIN trilha_no f ON f.id_no = st.id_no AND f.tipo = 'FASE'
       LEFT JOIN usuarios u ON u.id_usuario = st.aprovado_por
      WHERE st.id_startup = $1 AND st.status = 'APROVADA'
      ORDER BY f.ordem`,
    [idStartup]
  )
  return rows
}

module.exports = {
  listarPorTenant,
  buscarPorId,
  criar,
  atualizar,
  atualizarSituacao,
  listarContatos,
  substituirContatos,
  adicionarMembro,
  listarMembros,
  listarMembrosPorTenant,
  listarSemStartup,
  listarIdsPorUsuario,
  listarIdsPorMentor,
  listarMentores,
  ehMentorDe,
  buscarStartupDoUsuario,
  removerMembro,
  listarFasesConcluidas,
}
