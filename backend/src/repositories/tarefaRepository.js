/**
 * Repositorio da GESTAO DE TAREFAS (camada de acesso a dados).
 * Tabelas: tarefa, tarefa_status, tarefa_campo (migracao 014).
 *
 * A LISTA VEM INTEIRA, sem paginacao no banco. E deliberado e segue o desenho
 * das outras listagens do sistema (ver TabelaDados no front): as duas
 * visualizacoes da tela — tabela e kanban — precisam do mesmo conjunto ao mesmo
 * tempo, e o kanban em especial nao tem como paginar sem mentir sobre quantos
 * cartoes ha em cada coluna. Uma incubadora tem centenas de tarefas, nao
 * milhoes; quando isso mudar, o lugar de mexer e aqui.
 */
const { query, withTransaction } = require("../config/db")

/**
 * Traz o rotulo, a cor e a CATEGORIA do status junto da tarefa.
 *
 * LEFT JOIN e nao INNER: a FK garante que o status existe, mas um LEFT aqui
 * deixa a lista sobreviver a qualquer estado intermediario de migracao em vez
 * de sumir com a linha inteira.
 */
const JOIN_VOCABULARIO = `
  LEFT JOIN tarefa_status ts
         ON ts.id_tenant = t.id_tenant AND ts.chave = t.status
  LEFT JOIN usuarios resp  ON resp.id_usuario = t.id_responsavel
  LEFT JOIN usuarios autor ON autor.id_usuario = t.criado_por
  LEFT JOIN startup s      ON s.id_startup = t.id_startup
  LEFT JOIN (
    SELECT id_tarefa, COUNT(*) AS total FROM tarefa_anexo GROUP BY id_tarefa
  ) anx ON anx.id_tarefa = t.id_tarefa
`

const CAMPOS_VOCABULARIO = `
  ts.rotulo AS status_rotulo, ts.cor AS status_cor, ts.categoria AS status_categoria,
  ts.ordem AS status_ordem,
  resp.nome AS responsavel_nome, resp.email AS responsavel_email, resp.foto_url AS responsavel_foto,
  autor.nome AS criado_por_nome,
  s.nome AS startup_nome,
  COALESCE(anx.total, 0)::int AS total_anexos
`

const COLUNAS_TAREFA = `
  t.id_tarefa, t.id_tenant, t.titulo, t.descricao, t.status, t.prioridade,
  t.id_responsavel, t.id_startup, t.prazo, t.ordem, t.concluida_ts,
  t.campos_extras, t.criado_por, t.criado_ts, t.atualizado_ts
`

/**
 * A ordem em que as tarefas saem, e a mesma para as duas visualizacoes.
 *
 * Coluna do quadro primeiro, depois a posicao manual dentro dela (`ordem`), e
 * so entao os desempates automaticos. Sem o desempate por prioridade e prazo,
 * duas tarefas criadas no mesmo instante trocariam de lugar entre um refresh e
 * outro — o que no kanban parece o cartao "andando sozinho".
 *
 * A prioridade desempata do mais urgente para o menos, por isso o CASE: o enum
 * ordena alfabeticamente (ALTA < BAIXA < MEDIA < URGENTE), que nao e a ordem
 * que a palavra significa.
 */
const ORDENACAO = `
  ORDER BY ts.ordem NULLS LAST, t.ordem,
           CASE t.prioridade
             WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1
             WHEN 'MEDIA'   THEN 2 ELSE 3
           END,
           t.prazo NULLS LAST, t.id_tarefa
`

/**
 * Lista as tarefas de um tenant.
 *
 * @param {number} idTenant
 * @param {object} [filtros]
 * @param {number} [filtros.doUsuario] - O ESCOPO REDUZIDO: traz so as tarefas
 *   em que esta pessoa e responsavel ou autora. E o que o service passa para
 *   quem nao tem a chave de ver o quadro inteiro — ver tarefaService.
 * @param {number} [filtros.idResponsavel] - So as de uma pessoa (filtro da tela,
 *   independente do escopo).
 * @param {number} [filtros.idStartup] - So as que falam de uma startup.
 * @param {boolean} [filtros.apenasAbertas] - Descarta as de status concluido.
 */
async function listarPorTenant(idTenant, filtros = {}) {
  const condicoes = ["t.id_tenant = $1"]
  const params = [idTenant]

  if (filtros.doUsuario) {
    params.push(filtros.doUsuario)
    // Responsavel OU autor. O autor entra porque nao ha sentido em alguem
    // criar uma tarefa, atribui-la a um colega e perde-la de vista no mesmo
    // instante — e porque o service ja lhe da o direito de exclui-la, que seria
    // impossivel exercer sobre algo que ele nao enxerga.
    condicoes.push(`(t.id_responsavel = $${params.length} OR t.criado_por = $${params.length})`)
  }

  if (filtros.idResponsavel) {
    params.push(filtros.idResponsavel)
    condicoes.push(`t.id_responsavel = $${params.length}`)
  }
  if (filtros.idStartup) {
    params.push(filtros.idStartup)
    condicoes.push(`t.id_startup = $${params.length}`)
  }
  if (filtros.apenasAbertas) {
    // Pela CATEGORIA, e nao pela chave: e o unico jeito de dizer "aberta" sem
    // saber como esta incubadora batizou a ultima coluna.
    condicoes.push(`COALESCE(ts.categoria::TEXT, 'PENDENTE') <> 'CONCLUIDA'`)
  }

  const { rows } = await query(
    `SELECT ${COLUNAS_TAREFA}, ${CAMPOS_VOCABULARIO}
       FROM tarefa t
       ${JOIN_VOCABULARIO}
      WHERE ${condicoes.join(" AND ")}
      ${ORDENACAO}`,
    params
  )
  return rows
}

/** Uma tarefa pelo id, com o vocabulario resolvido. */
async function buscarPorId(idTarefa) {
  const { rows } = await query(
    `SELECT ${COLUNAS_TAREFA}, ${CAMPOS_VOCABULARIO}
       FROM tarefa t
       ${JOIN_VOCABULARIO}
      WHERE t.id_tarefa = $1`,
    [idTarefa]
  )
  return rows[0]
}

/**
 * `concluida_ts` para um status, dado o id_tenant e a chave.
 *
 * O `::varchar` na comparacao nao e decoracao: a chave do status aparece duas
 * vezes na mesma consulta — uma como valor da coluna `status` (character
 * varying) e outra numa comparacao, onde o Postgres a deduziria como `text`. Os
 * dois tipos deduzidos para o mesmo parametro fazem a query inteira ser
 * recusada com 42P08. O cast fixa o tipo de uma vez.
 *
 * Subconsulta e nao parametro: quem cria ou edita uma tarefa escolhe a COLUNA,
 * nunca a data de conclusao. Deixar o cliente mandar `concluida_ts` abriria a
 * porta para a tarefa marcada como "A fazer" na tela e fechada no banco — o
 * mesmo raciocinio de statusDaSituacao em startupRepository.
 *
 * @param {number} iTenant - posicao do id_tenant entre os parametros ($n).
 * @param {number} iStatus - posicao da chave do status.
 */
const conclusaoDoStatus = (iTenant, iStatus) =>
  `CASE WHEN (SELECT categoria FROM tarefa_status
               WHERE id_tenant = $${iTenant} AND chave = $${iStatus}::varchar) = 'CONCLUIDA'
        THEN NOW() ELSE NULL END`

/**
 * Cria uma tarefa.
 *
 * Ela nasce no TOPO da sua coluna (ordem = min - 1), e nao no fim: o que se
 * acabou de anotar e o que se acabou de decidir fazer, e enterra-lo embaixo de
 * quarenta cartoes antigos e a maneira mais rapida de a pessoa nao confiar mais
 * no quadro. Quem discordar arrasta.
 */
async function criar(dados) {
  const {
    idTenant, titulo, descricao, status, prioridade, idResponsavel,
    idStartup, prazo, camposExtras, criadoPor,
  } = dados

  const { rows } = await query(
    `INSERT INTO tarefa
       (id_tenant, titulo, descricao, status, prioridade, id_responsavel,
        id_startup, prazo, ordem, concluida_ts, campos_extras, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             (SELECT COALESCE(MIN(ordem), 0) - 1
                FROM tarefa WHERE id_tenant = $1 AND status = $4::varchar),
             ${conclusaoDoStatus(1, 4)},
             COALESCE($9, '{}'::jsonb), $10)
     RETURNING id_tarefa`,
    [
      idTenant, titulo, descricao ?? null, status, prioridade, idResponsavel ?? null,
      idStartup ?? null, prazo ?? null, JSON.stringify(camposExtras || {}), criadoPor ?? null,
    ]
  )
  return buscarPorId(rows[0].id_tarefa)
}

/**
 * Atualiza uma tarefa.
 *
 * O `concluida_ts` acompanha a categoria do status novo, mas so quando ele
 * MUDA de lado: sem o COALESCE, reeditar o titulo de uma tarefa ja concluida
 * reescreveria a data de conclusao para o momento da edicao, e o "concluidas
 * nesta semana" passaria a contar retoques de texto.
 *
 * A `ordem` nao entra aqui — quem a move e `mover`, e so ela.
 */
async function atualizar(idTarefa, dados) {
  const {
    idTenant, titulo, descricao, status, prioridade, idResponsavel,
    idStartup, prazo, camposExtras,
  } = dados

  await query(
    `UPDATE tarefa
        SET titulo = $3, descricao = $4, status = $5, prioridade = $6,
            id_responsavel = $7, id_startup = $8, prazo = $9,
            campos_extras = COALESCE($10, campos_extras),
            concluida_ts = CASE
              WHEN (SELECT categoria FROM tarefa_status
                     WHERE id_tenant = $2 AND chave = $5::varchar) = 'CONCLUIDA'
                THEN COALESCE(concluida_ts, NOW())
              ELSE NULL
            END,
            atualizado_ts = NOW()
      WHERE id_tarefa = $1 AND id_tenant = $2`,
    [
      idTarefa, idTenant, titulo, descricao ?? null, status, prioridade,
      idResponsavel ?? null, idStartup ?? null, prazo ?? null,
      camposExtras ? JSON.stringify(camposExtras) : null,
    ]
  )
  return buscarPorId(idTarefa)
}

/**
 * Move uma tarefa: para outra coluna, para outra posicao, ou as duas coisas.
 *
 * E o arrasto do kanban, e por isso e uma operacao propria e nao um `atualizar`
 * com dois campos: mexer numa posicao mexe na de todo mundo abaixo, e isso
 * precisa acontecer inteiro ou nao acontecer.
 *
 * RENUMERA A COLUNA INTEIRA, em vez de empurrar os vizinhos com `ordem + 1`.
 * A versao "empurra" e mais curta e esta errada em um caso que acontece o tempo
 * todo: dentro da MESMA coluna, o valor de `ordem` guardado nao e o indice
 * visual — a propria tarefa ocupa uma posicao na contagem —, e mover um cartao
 * para baixo o deixava sempre uma casa antes de onde foi solto. Reescrever a
 * lista toda troca aritmetica esperta por uma regra que se le: a coluna fica
 * exatamente na ordem em que a pessoa a ve.
 *
 * `ordem` e o INDICE NA LISTA SEM ESTA TAREFA (0 = topo). E o que o front tem
 * na mao ao soltar o cartao ("antes de qual cartao isto foi solto?"), e evita
 * que os dois lados precisem concordar sobre o significado dos valores
 * guardados.
 *
 * @param {number} idTarefa
 * @param {number} idTenant
 * @param {string} status - a coluna de destino.
 * @param {number} ordem - a posicao dentro dela, contando a lista sem esta tarefa.
 */
async function mover(idTarefa, idTenant, status, ordem) {
  return withTransaction(async (client) => {
    const { rows: atuais } = await client.query(
      `SELECT status FROM tarefa WHERE id_tarefa = $1 AND id_tenant = $2 FOR UPDATE`,
      [idTarefa, idTenant]
    )
    const atual = atuais[0]
    if (!atual) return null

    // O status vai primeiro: a partir daqui a tarefa ja pertence a coluna de
    // destino, e a renumeracao das duas colunas ve o mundo como ele vai ficar.
    await client.query(
      `UPDATE tarefa
          SET status = $3,
              concluida_ts = CASE
                WHEN (SELECT categoria FROM tarefa_status
                       WHERE id_tenant = $2 AND chave = $3::varchar) = 'CONCLUIDA'
                  THEN COALESCE(concluida_ts, NOW())
                ELSE NULL
              END,
              atualizado_ts = NOW()
        WHERE id_tarefa = $1 AND id_tenant = $2`,
      [idTarefa, idTenant, status]
    )

    /** Grava a posicao de cada id na lista (1..n) numa tacada so. */
    const renumerar = async (ids) => {
      if (!ids.length) return
      await client.query(
        `UPDATE tarefa t
            SET ordem = v.ordem
           FROM unnest($1::int[]) WITH ORDINALITY AS v(id, ordem)
          WHERE t.id_tarefa = v.id`,
        [ids]
      )
    }

    // Destino: a lista atual sem a tarefa, com ela reinserida na posicao pedida.
    const { rows: destino } = await client.query(
      `SELECT id_tarefa FROM tarefa
        WHERE id_tenant = $1 AND status = $2 AND id_tarefa <> $3
        ORDER BY ordem, id_tarefa`,
      [idTenant, status, idTarefa]
    )
    const ids = destino.map((r) => r.id_tarefa)
    // Clamp: a posicao vem do navegador, e uma lista que mudou embaixo de uma
    // aba aberta ha meia hora pode devolver um indice que nao existe mais.
    const alvo = Math.max(0, Math.min(Number(ordem) || 0, ids.length))
    ids.splice(alvo, 0, idTarefa)
    await renumerar(ids)

    // Origem: fecha o buraco que a saida deixou.
    if (atual.status !== status) {
      const { rows: origem } = await client.query(
        `SELECT id_tarefa FROM tarefa
          WHERE id_tenant = $1 AND status = $2
          ORDER BY ordem, id_tarefa`,
        [idTenant, atual.status]
      )
      await renumerar(origem.map((r) => r.id_tarefa))
    }

    const { rows } = await client.query(
      `SELECT ${COLUNAS_TAREFA}, ${CAMPOS_VOCABULARIO}
         FROM tarefa t
         ${JOIN_VOCABULARIO}
        WHERE t.id_tarefa = $1`,
      [idTarefa]
    )
    return rows[0]
  })
}

/**
 * Exclui uma tarefa de vez.
 *
 * DELETE de verdade, ao contrario do "desativar" dos vocabularios: uma tarefa
 * criada por engano nao e historico que alguem queira preservar, e o quadro
 * cheio de cartoes fantasmas invisiveis seria pior do que a exclusao. O que
 * aconteceu fica no audit_log, que e onde essa pergunta se responde.
 */
async function excluir(idTarefa, idTenant) {
  const { rows } = await query(
    `DELETE FROM tarefa WHERE id_tarefa = $1 AND id_tenant = $2 RETURNING id_tarefa`,
    [idTarefa, idTenant]
  )
  return rows[0]
}

/**
 * Contagem por categoria — o resumo do topo da tela e o badge do menu.
 *
 * Uma consulta agregada, e nao a lista inteira contada no cliente: quem so quer
 * saber quantas estao atrasadas nao precisa baixar o quadro.
 *
 * "Atrasada" e prazo no passado E categoria diferente de CONCLUIDA: a tarefa
 * fechada depois do prazo foi entregue com atraso, mas nao esta atrasada.
 */
async function resumoPorTenant(idTenant, idUsuario, { doUsuario } = {}) {
  // O escopo reduzido usa o MESMO recorte da listagem: os numeros do topo da
  // tela precisam falar do que a tela mostra, senao dizem "12 abertas" para
  // quem ve tres.
  const escopo = doUsuario
    ? `AND (t.id_responsavel = $2 OR t.criado_por = $2)`
    : ``

  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (
         WHERE COALESCE(ts.categoria::TEXT, 'PENDENTE') <> 'CONCLUIDA'
       )::int AS abertas,
       COUNT(*) FILTER (
         WHERE COALESCE(ts.categoria::TEXT, 'PENDENTE') <> 'CONCLUIDA'
           AND t.prazo IS NOT NULL AND t.prazo < CURRENT_DATE
       )::int AS atrasadas,
       COUNT(*) FILTER (
         WHERE COALESCE(ts.categoria::TEXT, 'PENDENTE') <> 'CONCLUIDA'
           AND t.id_responsavel = $2
       )::int AS minhas
       FROM tarefa t
       LEFT JOIN tarefa_status ts
              ON ts.id_tenant = t.id_tenant AND ts.chave = t.status
      WHERE t.id_tenant = $1 ${escopo}`,
    [idTenant, idUsuario ?? null]
  )
  return rows[0]
}

// ---------------------------------------------------------------------------
// ANEXOS (migracao 015)
// ---------------------------------------------------------------------------

/** Os anexos de uma tarefa, com o que a tela precisa para listar e abrir. */
async function listarAnexos(idTarefa) {
  const { rows } = await query(
    `SELECT a.id_arquivo, a.nome_original, a.mime, a.tamanho::int, a.criado_ts,
            ta.anexado_por, u.nome AS anexado_por_nome
       FROM tarefa_anexo ta
       JOIN arquivo a ON a.id_arquivo = ta.id_arquivo
       LEFT JOIN usuarios u ON u.id_usuario = ta.anexado_por
      WHERE ta.id_tarefa = $1
      ORDER BY ta.criado_ts, a.nome_original`,
    [idTarefa]
  )
  return rows
}

/**
 * Este arquivo esta anexado NESTA tarefa?
 *
 * E a pergunta da autorizacao de download: quem enxerga a tarefa abre os anexos
 * DELA, e nao um UUID qualquer que tenha descoberto. Ver tarefaService.abrirAnexo.
 */
async function anexoPertence(idTarefa, idArquivo) {
  const { rows } = await query(
    `SELECT 1 FROM tarefa_anexo WHERE id_tarefa = $1 AND id_arquivo = $2`,
    [idTarefa, idArquivo]
  )
  return Boolean(rows[0])
}

/**
 * Reescreve a lista de anexos de uma tarefa.
 *
 * `undefined` significa "nao mexi nos anexos" e o service nem chama isto — a
 * distincao vive la, pelo mesmo motivo dos contatos de startup: um PUT que nao
 * mandasse anexos apagaria a lista inteira em silencio.
 *
 * DELETE + INSERT em vez de calcular a diferenca: a lista tem meia duzia de
 * itens e a linha nao guarda nada que valha preservar alem do vinculo. O
 * `anexado_por` de um anexo que continua na lista e reescrito, e e o preco —
 * pequeno perto de um diff que erra e some com o anexo de alguem.
 *
 * NAO APAGA O ARQUIVO: desanexar desfaz o vinculo, e o arquivo pode estar
 * anexado em outro lugar. Quem apaga bytes e o arquivoService, e ninguem o
 * chama daqui.
 */
async function definirAnexos(idTarefa, idsArquivo, anexadoPor, client) {
  const executor = client || { query }

  await executor.query(`DELETE FROM tarefa_anexo WHERE id_tarefa = $1`, [idTarefa])
  if (!idsArquivo.length) return

  await executor.query(
    `INSERT INTO tarefa_anexo (id_tarefa, id_arquivo, anexado_por)
     SELECT $1, id, $3 FROM unnest($2::uuid[]) AS id
     ON CONFLICT DO NOTHING`,
    [idTarefa, idsArquivo, anexadoPor ?? null]
  )
}

module.exports = {
  listarPorTenant,
  listarAnexos,
  anexoPertence,
  definirAnexos,
  buscarPorId,
  criar,
  atualizar,
  mover,
  excluir,
  resumoPorTenant,
}
