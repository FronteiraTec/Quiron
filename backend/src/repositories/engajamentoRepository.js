/**
 * Repositorio do engajamento: temporadas, acoes que pontuam, niveis e o
 * extrato de pontos. Tabelas da migracao 017.
 *
 * NAO HA COLUNA DE SALDO em lugar nenhum: todo total e SUM() sobre
 * `engajamento_ponto`. Saldo materializado precisaria ser corrigido a cada
 * estorno, a cada presenca desmarcada e a cada reprecificacao de acao — e a
 * primeira divergencia entre saldo e extrato transformaria o ranking em algo
 * que ninguem consegue explicar para quem perdeu.
 *
 * Selos moram em seloRepository: sao a outra moeda, e nao se somam a esta.
 */
const { query, withTransaction } = require("../config/db")

// ---------------------------------------------------------------------------
// TEMPORADAS
// ---------------------------------------------------------------------------

const COLUNAS_TEMPORADA =
  "id_temporada, id_tenant, nome, inicio_dt, fim_dt, premiacao, encerrada, criado_ts"

/** Temporadas do tenant, da mais recente para a mais antiga. */
async function listarTemporadas(idTenant) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TEMPORADA}
       FROM engajamento_temporada
      WHERE id_tenant = $1
      ORDER BY inicio_dt DESC`,
    [idTenant]
  )
  return rows
}

async function buscarTemporada(idTenant, idTemporada) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TEMPORADA}
       FROM engajamento_temporada
      WHERE id_tenant = $1 AND id_temporada = $2`,
    [idTenant, idTemporada]
  )
  return rows[0]
}

/**
 * A temporada que CONTEM uma data — e a que decide onde o ponto cai.
 *
 * Recebe a data do FATO, nao a de hoje: marcar hoje a presenca de um evento do
 * mes passado tem que pontuar na temporada do mes passado.
 */
async function temporadaDaData(idTenant, data) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TEMPORADA}
       FROM engajamento_temporada
      WHERE id_tenant = $1 AND $2::date BETWEEN inicio_dt AND fim_dt
      ORDER BY inicio_dt DESC
      LIMIT 1`,
    [idTenant, data]
  )
  return rows[0]
}

/**
 * A temporada corrente (a de hoje) ou, na falta dela, a ultima que existiu.
 *
 * O fallback existe para a tela nunca abrir vazia entre um semestre e o
 * cadastro do proximo: mostrar o resultado do ciclo que acabou de fechar e
 * melhor do que mostrar "nenhuma temporada".
 */
async function temporadaCorrente(idTenant) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TEMPORADA}
       FROM engajamento_temporada
      WHERE id_tenant = $1
      ORDER BY (CURRENT_DATE BETWEEN inicio_dt AND fim_dt) DESC, inicio_dt DESC
      LIMIT 1`,
    [idTenant]
  )
  return rows[0]
}

/**
 * Temporada que colide com um periodo. E o que o service usa para recusar
 * sobreposicao — e para dizer COM QUAL delas colidiu, que e o que o admin
 * precisa saber para corrigir.
 */
async function temporadaSobreposta(idTenant, inicio, fim, idIgnorar = null) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TEMPORADA}
       FROM engajamento_temporada
      WHERE id_tenant = $1
        AND ($4::int IS NULL OR id_temporada <> $4)
        AND inicio_dt <= $3::date AND fim_dt >= $2::date
      LIMIT 1`,
    [idTenant, inicio, fim, idIgnorar]
  )
  return rows[0]
}

async function criarTemporada(idTenant, { nome, inicio_dt, fim_dt, premiacao }) {
  const { rows } = await query(
    `INSERT INTO engajamento_temporada (id_tenant, nome, inicio_dt, fim_dt, premiacao)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUNAS_TEMPORADA}`,
    [idTenant, nome, inicio_dt, fim_dt, premiacao ?? null]
  )
  return rows[0]
}

/**
 * Atualiza a temporada e RECLASSIFICA os pontos afetados.
 *
 * Mexer nas datas muda quais fatos pertencem a ela: sem a reclassificacao, o
 * ponto de um evento que passou a estar dentro do periodo continuaria fora do
 * ranking (ou o contrario), e a soma da tela nao bateria com o extrato de
 * ninguem. Por isso vai numa transacao.
 */
async function atualizarTemporada(idTenant, idTemporada, { nome, inicio_dt, fim_dt, premiacao }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE engajamento_temporada
          SET nome = $3, inicio_dt = $4, fim_dt = $5, premiacao = $6
        WHERE id_tenant = $1 AND id_temporada = $2
        RETURNING ${COLUNAS_TEMPORADA}`,
      [idTenant, idTemporada, nome, inicio_dt, fim_dt, premiacao ?? null]
    )
    if (!rows[0]) return undefined

    // Solta o que saiu do periodo...
    await client.query(
      `UPDATE engajamento_ponto
          SET id_temporada = NULL
        WHERE id_tenant = $1 AND id_temporada = $2
          AND ocorrido_dt NOT BETWEEN $3::date AND $4::date`,
      [idTenant, idTemporada, inicio_dt, fim_dt]
    )
    // ...e recolhe o que entrou (inclusive o que estava sem temporada).
    await client.query(
      `UPDATE engajamento_ponto
          SET id_temporada = $2
        WHERE id_tenant = $1 AND id_temporada IS DISTINCT FROM $2
          AND ocorrido_dt BETWEEN $3::date AND $4::date`,
      [idTenant, idTemporada, inicio_dt, fim_dt]
    )
    return rows[0]
  })
}

/** Encerra/reabre a temporada (fecha para novos lancamentos). */
async function alterarEncerradaTemporada(idTenant, idTemporada, encerrada) {
  const { rows } = await query(
    `UPDATE engajamento_temporada SET encerrada = $3
      WHERE id_tenant = $1 AND id_temporada = $2
      RETURNING ${COLUNAS_TEMPORADA}`,
    [idTenant, idTemporada, encerrada]
  )
  return rows[0]
}

/**
 * Exclui a temporada. Os pontos NAO somem: a FK e ON DELETE SET NULL, e eles
 * voltam a ser historico sem disputa. O aviso de quantos sao vem de
 * contarPontosDaTemporada.
 */
async function excluirTemporada(idTenant, idTemporada) {
  const { rowCount } = await query(
    `DELETE FROM engajamento_temporada WHERE id_tenant = $1 AND id_temporada = $2`,
    [idTenant, idTemporada]
  )
  return rowCount > 0
}

async function contarPontosDaTemporada(idTenant, idTemporada) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM engajamento_ponto WHERE id_tenant = $1 AND id_temporada = $2`,
    [idTenant, idTemporada]
  )
  return rows[0].total
}

// ---------------------------------------------------------------------------
// ACOES (o catalogo do que pontua)
// ---------------------------------------------------------------------------

const COLUNAS_ACAO = `id_tenant, chave, rotulo, descricao, gatilho, categoria_evento,
  liga, pontos, teto_pontos, teto_periodo, icone, cor, ordem, ativo`

async function listarAcoes(idTenant, incluirInativas = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_ACAO}
       FROM engajamento_acao
      WHERE id_tenant = $1
        ${incluirInativas ? "" : "AND ativo = TRUE"}
      ORDER BY ordem, rotulo`,
    [idTenant]
  )
  return rows
}

async function buscarAcao(idTenant, chave) {
  const { rows } = await query(
    `SELECT ${COLUNAS_ACAO} FROM engajamento_acao WHERE id_tenant = $1 AND chave = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

/**
 * A acao que pontua a presenca numa categoria de agenda — a pergunta que o
 * motor faz a cada check-in.
 *
 * Devolve no maximo uma (uq_engajamento_acao_categoria garante), e so se
 * estiver ATIVA: desativar a acao para de pontuar dali em diante sem apagar o
 * que ja foi pontuado.
 */
async function acaoDaCategoria(idTenant, categoria) {
  const { rows } = await query(
    `SELECT ${COLUNAS_ACAO}
       FROM engajamento_acao
      WHERE id_tenant = $1 AND categoria_evento = $2
        AND gatilho = 'PRESENCA_EVENTO' AND ativo = TRUE`,
    [idTenant, categoria]
  )
  return rows[0]
}

/** A acao que pontua o mentor dono da atividade (no maximo uma por tenant). */
async function acaoDeMentoria(idTenant) {
  const { rows } = await query(
    `SELECT ${COLUNAS_ACAO}
       FROM engajamento_acao
      WHERE id_tenant = $1 AND gatilho = 'MENTORIA_MINISTRADA' AND ativo = TRUE`,
    [idTenant]
  )
  return rows[0]
}

async function criarAcao(idTenant, dados) {
  const { rows } = await query(
    `INSERT INTO engajamento_acao
       (id_tenant, chave, rotulo, descricao, gatilho, categoria_evento, liga,
        pontos, teto_pontos, teto_periodo, icone, cor, ordem)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
             COALESCE($13, (SELECT COALESCE(MAX(ordem), 0) + 1
                              FROM engajamento_acao WHERE id_tenant = $1)))
     RETURNING ${COLUNAS_ACAO}`,
    [
      idTenant,
      dados.chave,
      dados.rotulo,
      dados.descricao ?? null,
      dados.gatilho,
      dados.categoria_evento ?? null,
      dados.liga ?? null,
      dados.pontos,
      dados.teto_pontos ?? null,
      dados.teto_periodo ?? null,
      dados.icone,
      dados.cor,
      dados.ordem ?? null,
    ]
  )
  return rows[0]
}

/**
 * Atualiza a acao. A CHAVE, O GATILHO E A CATEGORIA NAO ENTRAM: a chave esta
 * gravada em cada ponto ja lancado, e trocar gatilho/categoria mudaria o
 * SIGNIFICADO do que ja foi pontuado ("presenca em workshop" viraria
 * "indicacao" no extrato de quem foi ao workshop). Para mudar isso, desative
 * e crie outra.
 *
 * REPRECIFICAR (mexer em `pontos`) NAO reprocessa o passado, de proposito: o
 * ponto ja lancado guarda o valor que valia no dia. Recalcular mudaria o
 * ranking de um semestre que as pessoas ja acompanharam — e quem estava em
 * primeiro amanheceria em terceiro sem ter feito nada.
 */
async function atualizarAcao(idTenant, chave, dados) {
  const { rows } = await query(
    `UPDATE engajamento_acao
        SET rotulo = $3, descricao = $4, liga = $5, pontos = $6,
            teto_pontos = $7, teto_periodo = $8, icone = $9, cor = $10,
            ordem = COALESCE($11, ordem)
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_ACAO}`,
    [
      idTenant,
      chave,
      dados.rotulo,
      dados.descricao ?? null,
      dados.liga ?? null,
      dados.pontos,
      dados.teto_pontos ?? null,
      dados.teto_periodo ?? null,
      dados.icone,
      dados.cor,
      dados.ordem ?? null,
    ]
  )
  return rows[0]
}

/** Ativa/desativa a acao (o "excluir" da tela — a FK dos pontos impede apagar). */
async function alterarAtivoAcao(idTenant, chave, ativo) {
  const { rows } = await query(
    `UPDATE engajamento_acao SET ativo = $3
      WHERE id_tenant = $1 AND chave = $2
      RETURNING ${COLUNAS_ACAO}`,
    [idTenant, chave, ativo]
  )
  return rows[0]
}

/** Quantos lancamentos a acao ja gerou — o aviso antes de desativar. */
async function contarPontosDaAcao(idTenant, chave) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(pontos), 0)::int AS pontos
       FROM engajamento_ponto WHERE id_tenant = $1 AND chave_acao = $2`,
    [idTenant, chave]
  )
  return rows[0]
}

// ---------------------------------------------------------------------------
// NIVEIS
// ---------------------------------------------------------------------------

const COLUNAS_NIVEL = "id_tenant, liga, ordem, nome, pontos_min, cor, icone"

async function listarNiveis(idTenant, liga = null) {
  const { rows } = await query(
    `SELECT ${COLUNAS_NIVEL}
       FROM engajamento_nivel
      WHERE id_tenant = $1 AND ($2::engajamentoLiga IS NULL OR liga = $2)
      ORDER BY liga, ordem`,
    [idTenant, liga]
  )
  return rows
}

/**
 * Substitui a escada inteira de uma liga.
 *
 * A escada e uma lista ORDENADA curta, e a edicao real e "mexi nos degraus":
 * um CRUD linha a linha exigiria orquestrar inserir + renumerar + excluir do
 * lado do cliente e deixaria a escada num estado intermediario invalido (dois
 * degraus no mesmo corte) entre uma requisicao e outra.
 */
async function substituirNiveis(idTenant, liga, niveis) {
  return withTransaction(async (client) => {
    await client.query(`DELETE FROM engajamento_nivel WHERE id_tenant = $1 AND liga = $2`, [
      idTenant,
      liga,
    ])
    for (const [i, nivel] of niveis.entries()) {
      await client.query(
        `INSERT INTO engajamento_nivel (id_tenant, liga, ordem, nome, pontos_min, cor, icone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [idTenant, liga, i + 1, nivel.nome, nivel.pontos_min, nivel.cor, nivel.icone]
      )
    }
    const { rows } = await client.query(
      `SELECT ${COLUNAS_NIVEL} FROM engajamento_nivel
        WHERE id_tenant = $1 AND liga = $2 ORDER BY ordem`,
      [idTenant, liga]
    )
    return rows
  })
}

// ---------------------------------------------------------------------------
// LIGA DE CADA PESSOA
// ---------------------------------------------------------------------------

/**
 * A liga de cada usuario dentro do tenant, ou NULL para quem nao disputa.
 *
 * TRES REGRAS, e as tres tem motivo:
 *   - papel 'mentor'  -> MENTOR.
 *   - papel 'usuario' -> INCUBADO, mas SO se for membro ativo de startup nao
 *     encerrada. E o mesmo criterio de "publico" dos eventos (ver
 *     eventoRepository.listarPublico): quem nao esta em startup nenhuma nao
 *     esta no programa, e nao tem contra quem disputar.
 *   - papel 'admin'   -> NULL. A coordenacao nao disputa premio com quem ela
 *     avalia, e e ela quem marca a presenca que vira ponto.
 *
 * @returns {Promise<Map<number, string>>} id_usuario -> liga
 */
async function ligasDeUsuarios(idTenant, idsUsuarios) {
  if (!idsUsuarios?.length) return new Map()
  const { rows } = await query(
    `SELECT tu.id_usuario,
            CASE
              WHEN tu.papel = 'mentor' THEN 'MENTOR'
              WHEN tu.papel = 'usuario' AND EXISTS (
                     SELECT 1
                       FROM startup_membros sm
                       JOIN startup s ON s.id_startup = sm.id_startup
                      WHERE sm.id_usuario = tu.id_usuario
                        AND sm.ativo = TRUE
                        AND s.id_tenant = tu.id_tenant
                        AND s.status <> 'ENCERRADA')
                THEN 'INCUBADO'
            END AS liga
       FROM tenant_usuarios tu
      WHERE tu.id_tenant = $1 AND tu.ativo = TRUE AND tu.id_usuario = ANY($2::int[])`,
    [idTenant, idsUsuarios]
  )
  return new Map(rows.filter((r) => r.liga).map((r) => [r.id_usuario, r.liga]))
}

/** A liga de uma pessoa so. */
async function ligaDoUsuario(idTenant, idUsuario) {
  const mapa = await ligasDeUsuarios(idTenant, [idUsuario])
  return mapa.get(Number(idUsuario)) ?? null
}

/**
 * Quem pode receber ponto ou selo na incubadora, com a liga de cada um.
 *
 * E a lista das duas telas de acao — lancar participacao e conceder selo. Traz
 * TAMBEM quem esta sem liga (o admin, e o incubado sem startup ativa) com
 * `liga = null`, em vez de filtra-los fora: a coordenacao precisa entender por
 * que aquela pessoa nao aparece como opcao, e uma lista que simplesmente omite
 * gente parece lista incompleta.
 *
 * A mesma regra de `ligasDeUsuarios`, com nome e startup para a tela.
 */
async function listarParticipantes(idTenant) {
  const { rows } = await query(
    `SELECT u.id_usuario,
            u.nome,
            u.email,
            u.foto_url,
            tu.papel,
            CASE
              WHEN tu.papel = 'mentor' THEN 'MENTOR'
              WHEN tu.papel = 'usuario' AND s.id_startup IS NOT NULL THEN 'INCUBADO'
            END AS liga,
            s.nome AS startup,
            s.id_startup
       FROM tenant_usuarios tu
       JOIN usuarios u ON u.id_usuario = tu.id_usuario
       LEFT JOIN LATERAL (
            SELECT st.id_startup, st.nome
              FROM startup_membros sm
              JOIN startup st ON st.id_startup = sm.id_startup
             WHERE sm.id_usuario = tu.id_usuario AND sm.ativo = TRUE
               AND st.id_tenant = tu.id_tenant AND st.status <> 'ENCERRADA'
             ORDER BY sm.lider DESC, st.nome
             LIMIT 1
       ) s ON TRUE
      WHERE tu.id_tenant = $1 AND tu.ativo = TRUE
      ORDER BY u.nome`,
    [idTenant]
  )
  return rows
}

// ---------------------------------------------------------------------------
// PONTOS
// ---------------------------------------------------------------------------

const COLUNAS_PONTO = `id_ponto, id_tenant, id_temporada, id_usuario, liga, chave_acao,
  pontos, limitado_por_teto, origem_tipo, origem_id, lancado_por, observacao,
  ocorrido_dt, criado_ts`

/**
 * Grava (ou regrava) o ponto de um fato automatico.
 *
 * UPSERT pela chave natural (quem, por qual acao, por causa de qual fato): a
 * lista de chamada e corrigida o tempo todo, e cada correcao reenvia as mesmas
 * pessoas. Sem isso, marcar presenca duas vezes pontuaria duas vezes.
 */
async function sincronizarPonto(dados) {
  const { rows } = await query(
    `INSERT INTO engajamento_ponto
       (id_tenant, id_temporada, id_usuario, liga, chave_acao, pontos,
        limitado_por_teto, origem_tipo, origem_id, ocorrido_dt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id_tenant, id_usuario, chave_acao, origem_tipo, origem_id)
       WHERE origem_tipo <> 'MANUAL'
     DO UPDATE SET pontos = EXCLUDED.pontos,
                   limitado_por_teto = EXCLUDED.limitado_por_teto,
                   id_temporada = EXCLUDED.id_temporada,
                   liga = EXCLUDED.liga,
                   ocorrido_dt = EXCLUDED.ocorrido_dt
     RETURNING ${COLUNAS_PONTO}`,
    [
      dados.id_tenant,
      dados.id_temporada ?? null,
      dados.id_usuario,
      dados.liga,
      dados.chave_acao,
      dados.pontos,
      dados.limitado_por_teto ?? false,
      dados.origem_tipo,
      dados.origem_id,
      dados.ocorrido_dt,
    ]
  )
  return rows[0]
}

/** Lancamento manual da coordenacao. Sem upsert: repetir e legitimo. */
async function lancarPontoManual(dados) {
  const { rows } = await query(
    `INSERT INTO engajamento_ponto
       (id_tenant, id_temporada, id_usuario, liga, chave_acao, pontos,
        limitado_por_teto, origem_tipo, origem_id, lancado_por, observacao, ocorrido_dt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'MANUAL', NULL, $8, $9, $10)
     RETURNING ${COLUNAS_PONTO}`,
    [
      dados.id_tenant,
      dados.id_temporada ?? null,
      dados.id_usuario,
      dados.liga,
      dados.chave_acao,
      dados.pontos,
      dados.limitado_por_teto ?? false,
      dados.lancado_por ?? null,
      dados.observacao ?? null,
      dados.ocorrido_dt,
    ]
  )
  return rows[0]
}

/** Apaga o ponto de um fato que deixou de ser verdade (presenca desmarcada). */
async function removerPontoDeOrigem(idTenant, idUsuario, chaveAcao, origemTipo, origemId) {
  const { rowCount } = await query(
    `DELETE FROM engajamento_ponto
      WHERE id_tenant = $1 AND id_usuario = $2 AND chave_acao = $3
        AND origem_tipo = $4 AND origem_id = $5`,
    [idTenant, idUsuario, chaveAcao, origemTipo, origemId]
  )
  return rowCount
}

/** Todos os pontos gerados por um evento (usado quando o evento e apagado). */
async function removerPontosDoEvento(idEvento) {
  const { rowCount } = await query(
    `DELETE FROM engajamento_ponto WHERE origem_tipo = 'EVENTO' AND origem_id = $1`,
    [idEvento]
  )
  return rowCount
}

/**
 * Os pontos que um evento deu a certas pessoas, sem olhar a acao.
 *
 * Apaga POR ORIGEM e nao por chave de acao de proposito: quando a presenca e
 * desmarcada, o ponto tem de sair mesmo que a acao que o gerou tenha sido
 * desativada ou trocada desde entao — e ai o motor nem sabe mais qual chave
 * procurar.
 */
async function removerPontosDeEventoParaUsuarios(idEvento, idsUsuarios) {
  if (!idsUsuarios?.length) return 0
  const { rowCount } = await query(
    `DELETE FROM engajamento_ponto
      WHERE origem_tipo = 'EVENTO' AND origem_id = $1 AND id_usuario = ANY($2::int[])`,
    [idEvento, idsUsuarios]
  )
  return rowCount
}

/** Os pontos de UMA acao gerados por um evento (o ponto do mentor dono). */
async function removerPontosDoEventoPorAcao(idEvento, chaveAcao) {
  const { rowCount } = await query(
    `DELETE FROM engajamento_ponto
      WHERE origem_tipo = 'EVENTO' AND origem_id = $1 AND chave_acao = $2`,
    [idEvento, chaveAcao]
  )
  return rowCount
}

/** Quem esteve presente num evento (so os marcados como presentes). */
async function listarPresentesDoEvento(idEvento) {
  const { rows } = await query(
    `SELECT id_usuario FROM evento_presenca WHERE id_evento = $1 AND presente = TRUE`,
    [idEvento]
  )
  return rows.map((r) => r.id_usuario)
}

/**
 * O minimo do evento de que o motor precisa. Fica aqui, e nao no
 * eventoRepository, porque quem chama e o recalculo — que recebe so um id
 * (evento alterado, evento apagado) e nao o objeto que a tela ja tinha.
 */
async function buscarEventoParaPontuacao(idEvento) {
  const { rows } = await query(
    `SELECT id_evento, id_tenant, categoria, inicio_ts, id_usuario_mentor
       FROM evento WHERE id_evento = $1`,
    [idEvento]
  )
  return rows[0]
}

async function buscarPonto(idPonto) {
  const { rows } = await query(
    `SELECT ${COLUNAS_PONTO} FROM engajamento_ponto WHERE id_ponto = $1`,
    [idPonto]
  )
  return rows[0]
}

/** Estorno de um lancamento manual. */
async function excluirPonto(idPonto) {
  const { rowCount } = await query(`DELETE FROM engajamento_ponto WHERE id_ponto = $1`, [idPonto])
  return rowCount > 0
}

/**
 * Quanto a pessoa ja acumulou numa acao dentro de uma janela — a conta do teto.
 *
 * `ignorarOrigem` existe por causa da idempotencia: ao RE-sincronizar um fato
 * que ja tem linha, o proprio valor antigo nao pode entrar na soma, senao cada
 * remarcacao de presenca empurraria o lancamento para mais perto do teto ate
 * zera-lo sozinho.
 */
async function somaNoPeriodo(idTenant, idUsuario, chaveAcao, de, ate, ignorarOrigem = null) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(pontos), 0)::int AS total
       FROM engajamento_ponto
      WHERE id_tenant = $1 AND id_usuario = $2 AND chave_acao = $3
        AND ocorrido_dt BETWEEN $4::date AND $5::date
        AND NOT ($6::text IS NOT NULL AND origem_tipo = $6 AND origem_id = $7::int)`,
    [
      idTenant,
      idUsuario,
      chaveAcao,
      de,
      ate,
      ignorarOrigem?.origem_tipo ?? null,
      ignorarOrigem?.origem_id ?? null,
    ]
  )
  return rows[0].total
}

/**
 * O extrato de uma pessoa: o que rendeu ponto, quando e por que.
 *
 * A tela existe para responder "de onde vieram os meus pontos" sem ninguem
 * precisar acreditar num numero. Por isso traz o rotulo da acao e o titulo do
 * evento, e nao so a chave.
 */
async function listarExtrato(idTenant, idUsuario, idTemporada = null, limite = 200) {
  const { rows } = await query(
    `SELECT p.id_ponto, p.pontos, p.limitado_por_teto, p.ocorrido_dt, p.observacao,
            p.origem_tipo, p.origem_id, p.chave_acao, p.liga, p.id_temporada,
            a.rotulo AS acao, a.icone, a.cor,
            e.titulo AS evento,
            l.nome AS lancado_por_nome
       FROM engajamento_ponto p
       JOIN engajamento_acao a ON a.id_tenant = p.id_tenant AND a.chave = p.chave_acao
       LEFT JOIN evento e ON p.origem_tipo = 'EVENTO' AND e.id_evento = p.origem_id
       LEFT JOIN usuarios l ON l.id_usuario = p.lancado_por
      WHERE p.id_tenant = $1 AND p.id_usuario = $2
        AND ($3::int IS NULL OR p.id_temporada = $3)
      ORDER BY p.ocorrido_dt DESC, p.id_ponto DESC
      LIMIT $4`,
    [idTenant, idUsuario, idTemporada, limite]
  )
  return rows
}

/**
 * O ranking de uma liga numa temporada.
 *
 * DESEMPATE POR DATA DO ULTIMO PONTO, do mais antigo para o mais novo: com a
 * mesma pontuacao, quem chegou la primeiro fica a frente. Qualquer outro
 * criterio (ordem alfabetica, id) premiaria o acaso.
 *
 * Quem ficou com zero (teto) continua na lista: participou, e sumir do placar
 * depois de ter comparecido e pior do que aparecer com zero.
 */
async function ranking(idTenant, idTemporada, liga) {
  const { rows } = await query(
    `SELECT p.id_usuario,
            u.nome,
            u.foto_url,
            SUM(p.pontos)::int         AS pontos,
            COUNT(*)::int              AS participacoes,
            MAX(p.ocorrido_dt)         AS ultimo_dt,
            s.nome                     AS startup,
            COALESCE(sel.total, 0)::int AS selos
       FROM engajamento_ponto p
       JOIN usuarios u ON u.id_usuario = p.id_usuario
       LEFT JOIN LATERAL (
            SELECT st.nome
              FROM startup_membros sm
              JOIN startup st ON st.id_startup = sm.id_startup
             WHERE sm.id_usuario = p.id_usuario AND sm.ativo = TRUE
               AND st.id_tenant = p.id_tenant
             ORDER BY sm.lider DESC, st.nome
             LIMIT 1
       ) s ON TRUE
       LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS total
              FROM selo_concessao sc
             WHERE sc.id_usuario = p.id_usuario AND sc.id_tenant = p.id_tenant
               AND sc.revogado_ts IS NULL
       ) sel ON TRUE
      WHERE p.id_tenant = $1 AND p.liga = $2
        AND ($3::int IS NULL OR p.id_temporada = $3)
      GROUP BY p.id_usuario, u.nome, u.foto_url, s.nome, sel.total
      ORDER BY pontos DESC, ultimo_dt ASC, u.nome`,
    [idTenant, liga, idTemporada]
  )
  return rows
}

/**
 * O placar por startup, pela MEDIA dos membros ativos.
 *
 * MEDIA, e nao soma: pela soma, uma startup de seis pessoas venceria uma de
 * duas sem que ninguem la participasse mais — o placar mediria tamanho de
 * time, nao engajamento. A soma vai junto como coluna, porque ela responde
 * outra pergunta legitima ("quanta gente daqui apareceu").
 *
 * Startup encerrada fica de fora; membro inativo tambem nao entra no divisor.
 */
async function rankingStartups(idTenant, idTemporada) {
  const { rows } = await query(
    `WITH membros AS (
        SELECT st.id_startup, st.nome, st.logo, sm.id_usuario
          FROM startup st
          JOIN startup_membros sm ON sm.id_startup = st.id_startup AND sm.ativo = TRUE
         WHERE st.id_tenant = $1 AND st.status <> 'ENCERRADA'
     ),
     pontos AS (
        SELECT id_usuario, SUM(pontos)::int AS pontos
          FROM engajamento_ponto
         WHERE id_tenant = $1 AND liga = 'INCUBADO'
           AND ($2::int IS NULL OR id_temporada = $2)
         GROUP BY id_usuario
     )
     SELECT m.id_startup,
            m.nome,
            m.logo,
            COUNT(DISTINCT m.id_usuario)::int              AS membros,
            COALESCE(SUM(p.pontos), 0)::int                AS pontos_total,
            COUNT(DISTINCT p.id_usuario)::int              AS membros_pontuaram,
            ROUND(COALESCE(SUM(p.pontos), 0)::numeric
                  / NULLIF(COUNT(DISTINCT m.id_usuario), 0), 1)::float8 AS pontos_media
       FROM membros m
       LEFT JOIN pontos p ON p.id_usuario = m.id_usuario
      GROUP BY m.id_startup, m.nome, m.logo
      ORDER BY pontos_media DESC NULLS LAST, pontos_total DESC, m.nome`,
    [idTenant, idTemporada]
  )
  return rows
}

/** Total e numero de participacoes de uma pessoa numa temporada. */
async function totalDoUsuario(idTenant, idUsuario, idTemporada = null) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(pontos), 0)::int AS pontos,
            COUNT(*)::int                 AS participacoes
       FROM engajamento_ponto
      WHERE id_tenant = $1 AND id_usuario = $2
        AND ($3::int IS NULL OR id_temporada = $3)`,
    [idTenant, idUsuario, idTemporada]
  )
  return rows[0]
}

/**
 * Onde a pessoa esta no placar da propria liga.
 *
 * Calculado com RANK() na mesma ordenacao do `ranking`, e nao com um
 * `indexOf` sobre a lista carregada: a tela do incubado mostra a posicao dele
 * sem baixar o placar inteiro, e as duas contas precisam concordar.
 */
async function posicaoDoUsuario(idTenant, idUsuario, idTemporada, liga) {
  const { rows } = await query(
    `WITH placar AS (
        SELECT id_usuario,
               SUM(pontos)::int AS pontos,
               MAX(ocorrido_dt) AS ultimo_dt,
               RANK() OVER (ORDER BY SUM(pontos) DESC, MAX(ocorrido_dt) ASC) AS posicao
          FROM engajamento_ponto
         WHERE id_tenant = $1 AND liga = $2 AND ($3::int IS NULL OR id_temporada = $3)
         GROUP BY id_usuario
     )
     SELECT (SELECT COUNT(*)::int FROM placar)                       AS competidores,
            (SELECT posicao::int FROM placar WHERE id_usuario = $4)  AS posicao`,
    [idTenant, liga, idTemporada, idUsuario]
  )
  return rows[0]
}

/** Quantas pessoas estiveram presentes num evento — a prova de que ele aconteceu. */
async function contarPresentes(idEvento) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total
       FROM evento_presenca WHERE id_evento = $1 AND presente = TRUE`,
    [idEvento]
  )
  return rows[0].total
}

// ---------------------------------------------------------------------------
// SEMEADURA (tenant novo)
// ---------------------------------------------------------------------------

/**
 * Semeia o vocabulario de engajamento de uma incubadora nova: a temporada do
 * semestre, as acoes e as duas escadas de nivel.
 *
 * Roda DEPOIS de semearCategoriasPadrao: as acoes de presenca tem FK para
 * `evento_categoria`, e sem as categorias nao ha o que pontuar.
 *
 * Tolerante a categoria ausente (o INSERT das acoes de presenca e um JOIN com
 * o que existe): uma incubadora que apagar "Pitch" so nao ganha aquela acao.
 */
async function semearPadroes(idTenant, padroes, client = null) {
  const executar = client ? (sql, params) => client.query(sql, params) : query
  const { temporada, pontosPorCategoria, prefixoPresenca, acaoMentoria, acoesManuais, niveis } =
    padroes

  await executar(
    `INSERT INTO engajamento_temporada (id_tenant, nome, inicio_dt, fim_dt)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [idTenant, temporada.nome, temporada.inicio_dt, temporada.fim_dt]
  )

  for (const { categoria, pontos, ordem } of pontosPorCategoria) {
    await executar(
      `INSERT INTO engajamento_acao
         (id_tenant, chave, rotulo, descricao, gatilho, categoria_evento, pontos, icone, cor, ordem)
       SELECT c.id_tenant, $2 || c.chave, 'Presença em ' || c.rotulo,
              'Pontua quem teve presença confirmada em atividades da categoria "'
                || c.rotulo || '".',
              'PRESENCA_EVENTO'::engajamentoGatilho, c.chave, $4, c.icone, c.cor, $5
         FROM evento_categoria c
        WHERE c.id_tenant = $1 AND c.chave = $3
       ON CONFLICT DO NOTHING`,
      [idTenant, prefixoPresenca, categoria, pontos, ordem]
    )
  }

  for (const acao of [acaoMentoria, ...acoesManuais]) {
    await executar(
      `INSERT INTO engajamento_acao
         (id_tenant, chave, rotulo, descricao, gatilho, liga, pontos,
          teto_pontos, teto_periodo, icone, cor, ordem)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT DO NOTHING`,
      [
        idTenant,
        acao.chave,
        acao.rotulo,
        acao.descricao,
        acao.gatilho,
        acao.liga ?? null,
        acao.pontos,
        acao.teto_pontos ?? null,
        acao.teto_periodo ?? null,
        acao.icone,
        acao.cor,
        acao.ordem,
      ]
    )
  }

  for (const nivel of niveis) {
    await executar(
      `INSERT INTO engajamento_nivel (id_tenant, liga, ordem, nome, pontos_min, cor, icone)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [idTenant, nivel.liga, nivel.ordem, nivel.nome, nivel.pontos_min, nivel.cor, nivel.icone]
    )
  }
}

module.exports = {
  // Temporadas
  listarTemporadas,
  buscarTemporada,
  temporadaDaData,
  temporadaCorrente,
  temporadaSobreposta,
  criarTemporada,
  atualizarTemporada,
  alterarEncerradaTemporada,
  excluirTemporada,
  contarPontosDaTemporada,

  // Acoes
  listarAcoes,
  buscarAcao,
  acaoDaCategoria,
  acaoDeMentoria,
  criarAcao,
  atualizarAcao,
  alterarAtivoAcao,
  contarPontosDaAcao,

  // Niveis
  listarNiveis,
  substituirNiveis,

  // Ligas
  ligasDeUsuarios,
  ligaDoUsuario,
  listarParticipantes,

  // Pontos
  sincronizarPonto,
  lancarPontoManual,
  removerPontoDeOrigem,
  removerPontosDoEvento,
  removerPontosDeEventoParaUsuarios,
  removerPontosDoEventoPorAcao,
  listarPresentesDoEvento,
  buscarEventoParaPontuacao,
  buscarPonto,
  excluirPonto,
  somaNoPeriodo,
  listarExtrato,
  ranking,
  rankingStartups,
  totalDoUsuario,
  posicaoDoUsuario,
  contarPresentes,

  // Semeadura
  semearPadroes,
}
