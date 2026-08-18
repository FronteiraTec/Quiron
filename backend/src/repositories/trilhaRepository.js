/**
 * Repositorio da Trilha (camada de acesso a dados).
 * Tabelas relacionadas: trilha_no, trilha_conteudo, startup_trilha (schema.sql).
 *
 * Substitui faseRepository + moduloRepository + tarefaRepository. Os tres
 * niveis viraram uma arvore auto-referenciada (PROGRAMA > FASE > MODULO >
 * PASSO), entao as mesmas funcoes servem para qualquer nivel — o `tipo` do no
 * e so mais uma coluna.
 */
const { query, withTransaction } = require("../config/db")

// Colunas devolvidas ao cliente. Lista explicita em vez de SELECT * para nao
// vazar coluna nova sem querer e manter o contrato da API estavel.
const CAMPOS = [
  "id_no", "id_tenant", "id_pai", "tipo", "nome", "descricao", "ordem", "ativo",
  "tipo_passo", "permite_entrega", "obrigatoria", "id_questionario", "anexo",
  "prazo", "carga_horaria", "entregavel",
  // Moldura pedagogica (so em PASSO) — o que a Jornada mostra ao incubado.
  "objetivo", "porque", "competencias", "area",
  "criado_ts", "atualizado_ts",
]

/** Monta a lista de colunas, opcionalmente com alias de tabela ("n."). */
const cols = (prefixo = "") => CAMPOS.map((c) => prefixo + c).join(", ")

const COLUNAS = cols()

/**
 * Carrega a arvore inteira de um tenant, ja aninhada.
 *
 * Uma unica query recursiva traz todos os nos; a montagem em arvore acontece
 * em memoria. Bem mais barato que N+1 queries por nivel, que era o efeito das
 * telas antigas (buscar fases -> por fase buscar modulos -> por modulo buscar
 * tarefas).
 *
 * @param {number} idTenant
 * @returns {Promise<object[]>} Nos raiz (PROGRAMA), cada um com `filhos[]`.
 */
async function arvorePorTenant(idTenant) {
  const { rows } = await query(
    `WITH RECURSIVE arv AS (
       SELECT ${COLUNAS}, 0 AS nivel
         FROM trilha_no
        WHERE id_tenant = $1 AND id_pai IS NULL
       UNION ALL
       SELECT ${cols("n.")}, a.nivel + 1
         FROM trilha_no n
         JOIN arv a ON a.id_no = n.id_pai
     )
     SELECT * FROM arv ORDER BY nivel, ordem, id_no`,
    [idTenant]
  )
  return aninhar(rows)
}

/**
 * Transforma a lista achatada em arvore.
 * Os nos vem ordenados por nivel, entao todo pai ja foi visto quando seu
 * filho aparece — basta um mapa de id -> no.
 */
function aninhar(rows) {
  const porId = new Map()
  const raizes = []

  for (const row of rows) {
    const { nivel, ...no } = row
    no.filhos = []
    porId.set(no.id_no, no)

    if (no.id_pai == null) {
      raizes.push(no)
    } else {
      porId.get(no.id_pai)?.filhos.push(no)
    }
  }

  return raizes
}

/** Busca um no pelo id (sem os filhos). */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM trilha_no WHERE id_no = $1`,
    [id]
  )
  return rows[0]
}

/** Lista os filhos diretos de um no, em ordem. */
async function listarFilhos(idPai) {
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM trilha_no WHERE id_pai = $1 ORDER BY ordem`,
    [idPai]
  )
  return rows
}

/**
 * Cria um no ao final da lista de irmaos.
 * A ordem e calculada aqui (MAX+1) para nao depender do cliente mandar um
 * valor coerente e para evitar corrida entre dois cliques simultaneos.
 */
async function criar(dados) {
  const {
    idTenant, idPai, tipo, nome, descricao = null,
    tipoPasso = null, permiteEntrega = false, obrigatoria = true,
    idQuestionario = null, anexo = null,
    prazo = null, cargaHoraria = null, entregavel = null,
    objetivo = null, porque = null, competencias = [], area = null,
  } = dados

  const { rows } = await query(
    `INSERT INTO trilha_no (
       id_tenant, id_pai, tipo, nome, descricao, ordem,
       tipo_passo, permite_entrega, obrigatoria, id_questionario, anexo,
       prazo, carga_horaria, entregavel,
       objetivo, porque, competencias, area
     )
     VALUES (
       $1, $2, $3, $4, $5,
       COALESCE((SELECT MAX(ordem) + 1 FROM trilha_no WHERE id_pai IS NOT DISTINCT FROM $2), 1),
       $6, $7, $8, $9, $10, $11, $12, $13,
       $14, $15, $16, $17
     )
     RETURNING ${COLUNAS}`,
    [
      idTenant, idPai, tipo, nome, descricao,
      tipoPasso, permiteEntrega, obrigatoria, idQuestionario, anexo,
      prazo, cargaHoraria, entregavel,
      objetivo, porque, competencias, area,
    ]
  )
  return rows[0]
}

// Campos que `atualizar` aceita, mapeados para a coluna correspondente.
// Lista fixa de proposito: impede que um body malicioso escreva em id_tenant,
// id_pai ou tipo, que so mudam por operacoes dedicadas (mover).
const CAMPOS_EDITAVEIS = {
  nome: "nome",
  descricao: "descricao",
  ativo: "ativo",
  tipoPasso: "tipo_passo",
  permiteEntrega: "permite_entrega",
  obrigatoria: "obrigatoria",
  idQuestionario: "id_questionario",
  anexo: "anexo",
  prazo: "prazo",
  cargaHoraria: "carga_horaria",
  entregavel: "entregavel",
  objetivo: "objetivo",
  porque: "porque",
  competencias: "competencias",
  area: "area",
}

/**
 * Aplica um patch parcial ao no. Ignora chaves desconhecidas.
 * @returns {Promise<object|undefined>} O no atualizado, ou undefined se o
 *   patch nao trouxe nenhum campo valido.
 */
async function atualizar(id, patch) {
  const sets = []
  const valores = []

  for (const [chave, coluna] of Object.entries(CAMPOS_EDITAVEIS)) {
    if (patch[chave] !== undefined) {
      valores.push(patch[chave])
      sets.push(`${coluna} = $${valores.length}`)
    }
  }

  if (!sets.length) return undefined

  sets.push("atualizado_ts = NOW()")
  valores.push(id)

  const { rows } = await query(
    `UPDATE trilha_no SET ${sets.join(", ")}
      WHERE id_no = $${valores.length}
      RETURNING ${COLUNAS}`,
    valores
  )
  return rows[0]
}

/** Remove um no (a subarvore cai junto, por ON DELETE CASCADE). */
async function excluir(id) {
  const { rows } = await query(
    `DELETE FROM trilha_no WHERE id_no = $1 RETURNING id_no`,
    [id]
  )
  return rows[0]
}

/**
 * Reordena os filhos de um pai conforme a lista de ids informada.
 *
 * Roda numa transacao unica: a constraint uk_trilha_no_ordem e DEFERRABLE
 * INITIALLY DEFERRED, entao a checagem de unicidade so acontece no COMMIT —
 * e por isso que reescrever ordem 1..n em lote nao colide consigo mesmo.
 *
 * @param {number|null} idPai
 * @param {number[]} idsNaOrdem
 */
async function reordenar(idPai, idsNaOrdem) {
  return withTransaction(async (client) => {
    for (let i = 0; i < idsNaOrdem.length; i++) {
      await client.query(
        `UPDATE trilha_no SET ordem = $1, atualizado_ts = NOW()
          WHERE id_no = $2 AND id_pai IS NOT DISTINCT FROM $3`,
        [i + 1, idsNaOrdem[i], idPai]
      )
    }

    const { rows } = await client.query(
      `SELECT ${COLUNAS} FROM trilha_no
        WHERE id_pai IS NOT DISTINCT FROM $1 ORDER BY ordem`,
      [idPai]
    )
    return rows
  })
}

/**
 * Move um no para outro pai, ao final da nova lista.
 * O trigger trg_trilha_no_hierarquia recusa destinos invalidos (por exemplo,
 * um PASSO sob uma FASE), entao aqui nao ha checagem de tipo.
 */
async function mover(id, novoPaiId) {
  return withTransaction(async (client) => {
    const { rows: antes } = await client.query(
      `SELECT id_pai FROM trilha_no WHERE id_no = $1`,
      [id]
    )
    if (!antes[0]) return undefined
    const paiAntigo = antes[0].id_pai

    const { rows } = await client.query(
      `UPDATE trilha_no
          SET id_pai = $1,
              ordem = COALESCE(
                (SELECT MAX(ordem) + 1 FROM trilha_no WHERE id_pai IS NOT DISTINCT FROM $1), 1
              ),
              atualizado_ts = NOW()
        WHERE id_no = $2
        RETURNING ${COLUNAS}`,
      [novoPaiId, id]
    )

    // Fecha o buraco deixado na lista de origem.
    await compactarOrdem(client, paiAntigo)

    return rows[0]
  })
}

/** Reescreve ordem 1..n entre os filhos de um pai, sem buracos. */
async function compactarOrdem(client, idPai) {
  await client.query(
    `UPDATE trilha_no t
        SET ordem = novo.pos
       FROM (
         SELECT id_no, ROW_NUMBER() OVER (ORDER BY ordem, id_no) AS pos
           FROM trilha_no
          WHERE id_pai IS NOT DISTINCT FROM $1
       ) novo
      WHERE t.id_no = novo.id_no AND t.ordem <> novo.pos`,
    [idPai]
  )
}

// ---------------------------------------------------------------------------
// Vinculo com a Biblioteca (trilha_conteudo)
// ---------------------------------------------------------------------------

/** Lista os conteudos que um PASSO ensina, ja resolvidos da Biblioteca. */
async function listarConteudos(idNo) {
  const { rows } = await query(
    `SELECT c.id_conteudo, c.tipo, c.titulo, c.resumo, c.tags,
            c.url, c.nome_arquivo, c.duracao, tc.ordem
       FROM trilha_conteudo tc
       JOIN conteudo c ON c.id_conteudo = tc.id_conteudo
      WHERE tc.id_no = $1
      ORDER BY tc.ordem, c.titulo`,
    [idNo]
  )
  return rows
}

/** Vincula um conteudo da Biblioteca a um passo (idempotente). */
async function vincularConteudo(idNo, idConteudo) {
  const { rows } = await query(
    `INSERT INTO trilha_conteudo (id_no, id_conteudo, ordem)
     VALUES ($1, $2,
       COALESCE((SELECT MAX(ordem) + 1 FROM trilha_conteudo WHERE id_no = $1), 1))
     ON CONFLICT (id_no, id_conteudo) DO NOTHING
     RETURNING id_no, id_conteudo, ordem`,
    [idNo, idConteudo]
  )
  return rows[0]
}

/** Desvincula um conteudo de um passo (o conteudo continua na Biblioteca). */
async function desvincularConteudo(idNo, idConteudo) {
  const { rows } = await query(
    `DELETE FROM trilha_conteudo
      WHERE id_no = $1 AND id_conteudo = $2
      RETURNING id_no`,
    [idNo, idConteudo]
  )
  return rows[0]
}

// ---------------------------------------------------------------------------
// Trilhas do tenant (as raizes) e matricula de startups
// ---------------------------------------------------------------------------

/**
 * Lista as trilhas (nos PROGRAMA) de um tenant, com o tamanho de cada uma e
 * quantas startups estao matriculadas.
 *
 * Alimenta o seletor do Construtor, que precisa dessas contagens para dizer
 * "3 fases · 12 passos · 5 startups" sem carregar as tres arvores inteiras.
 */
async function listarProgramas(idTenant) {
  const { rows } = await query(
    `SELECT p.id_no, p.nome, p.descricao, p.ativo, p.padrao,
            p.criado_ts, p.atualizado_ts,
            (SELECT COUNT(*) FROM trilha_no f
              WHERE f.id_pai = p.id_no AND f.tipo = 'FASE')::INT AS fases,
            -- Passos: netos das fases, ou seja, tres niveis abaixo da raiz.
            (SELECT COUNT(*)
               FROM trilha_no f
               JOIN trilha_no m ON m.id_pai = f.id_no
               JOIN trilha_no s ON s.id_pai = m.id_no
              WHERE f.id_pai = p.id_no)::INT AS passos,
            (SELECT COUNT(*) FROM startup_programa sp
              WHERE sp.id_no = p.id_no)::INT AS startups
       FROM trilha_no p
      WHERE p.id_tenant = $1 AND p.tipo = 'PROGRAMA'
      ORDER BY p.padrao DESC, p.nome, p.id_no`,
    [idTenant]
  )
  return rows
}

/**
 * Carrega UMA trilha inteira a partir da raiz.
 * Mesma CTE recursiva de `arvorePorTenant`, ancorada num id em vez do tenant.
 */
async function arvorePorPrograma(idPrograma) {
  const { rows } = await query(
    `WITH RECURSIVE arv AS (
       SELECT ${COLUNAS}, 0 AS nivel
         FROM trilha_no
        WHERE id_no = $1
       UNION ALL
       SELECT ${cols("n.")}, a.nivel + 1
         FROM trilha_no n
         JOIN arv a ON a.id_no = n.id_pai
     )
     SELECT * FROM arv ORDER BY nivel, ordem, id_no`,
    [idPrograma]
  )
  return aninhar(rows)[0] ?? null
}

/**
 * Marca uma trilha como padrao do tenant.
 *
 * Numa transacao, e desmarcando as outras ANTES: `uk_trilha_no_padrao` e um
 * indice unico normal (nao deferrable), entao marcar a nova primeiro
 * colidiria com a antiga no meio do caminho.
 */
async function definirPadrao(idTenant, idPrograma) {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE trilha_no SET padrao = FALSE
        WHERE id_tenant = $1 AND tipo = 'PROGRAMA' AND padrao`,
      [idTenant]
    )
    const { rows } = await client.query(
      `UPDATE trilha_no SET padrao = TRUE, atualizado_ts = NOW()
        WHERE id_no = $1 AND id_tenant = $2 AND tipo = 'PROGRAMA'
        RETURNING ${COLUNAS}, padrao`,
      [idPrograma, idTenant]
    )
    return rows[0]
  })
}

/** A trilha padrao do tenant, ou undefined se nenhuma foi marcada. */
async function programaPadrao(idTenant) {
  const { rows } = await query(
    `SELECT ${COLUNAS}, padrao FROM trilha_no
      WHERE id_tenant = $1 AND tipo = 'PROGRAMA' AND padrao`,
    [idTenant]
  )
  return rows[0]
}

/** Startups matriculadas numa trilha. */
async function listarStartupsDoPrograma(idPrograma) {
  const { rows } = await query(
    `SELECT s.id_startup, s.nome, s.status AS status_startup,
            sp.status, sp.inicio_ts, sp.fim_ts
       FROM startup_programa sp
       JOIN startup s ON s.id_startup = sp.id_startup
      WHERE sp.id_no = $1
      ORDER BY s.nome`,
    [idPrograma]
  )
  return rows
}

/**
 * Trilhas em que uma startup esta matriculada, com o progresso de cada uma.
 *
 * O progresso e derivado das entregas aprovadas, pelo mesmo criterio da
 * Jornada — guardar um percentual aqui abriria espaco para ele discordar do
 * que a tela mostra passo a passo.
 */
async function programasDaStartup(idStartup) {
  const { rows } = await query(
    `WITH passos AS (
       SELECT p.id_no AS id_programa, s.id_no AS id_passo
         FROM startup_programa sp
         JOIN trilha_no p ON p.id_no = sp.id_no
         JOIN trilha_no f ON f.id_pai = p.id_no AND f.ativo
         JOIN trilha_no m ON m.id_pai = f.id_no AND m.ativo
         JOIN trilha_no s ON s.id_pai = m.id_no AND s.ativo
        WHERE sp.id_startup = $1
     ),
     concluidos AS (
       SELECT pa.id_programa, COUNT(*)::INT AS total
         FROM passos pa
         JOIN entrega e ON e.id_no = pa.id_passo AND e.id_startup = $1
         JOIN LATERAL (
           SELECT status FROM avaliacao
            WHERE id_entrega = e.id_entrega
            ORDER BY criado_ts DESC, id_avaliacao DESC
            LIMIT 1
         ) a ON a.status = 'APROVADO'
        GROUP BY pa.id_programa
     )
     SELECT p.id_no, p.nome, p.descricao, p.ativo,
            sp.status, sp.inicio_ts, sp.fim_ts,
            (SELECT COUNT(*) FROM passos pa WHERE pa.id_programa = p.id_no)::INT AS passos,
            COALESCE(c.total, 0) AS passos_concluidos
       FROM startup_programa sp
       JOIN trilha_no p ON p.id_no = sp.id_no
       LEFT JOIN concluidos c ON c.id_programa = p.id_no
      WHERE sp.id_startup = $1
      ORDER BY sp.status, sp.inicio_ts DESC, p.nome`,
    [idStartup]
  )
  return rows
}

/** Matricula uma startup numa trilha (idempotente). */
async function matricular(idPrograma, idStartup) {
  const { rows } = await query(
    `INSERT INTO startup_programa (id_startup, id_no)
     VALUES ($1, $2)
     ON CONFLICT (id_startup, id_no) DO NOTHING
     RETURNING id_startup, id_no, status, inicio_ts`,
    [idStartup, idPrograma]
  )
  return rows[0]
}

/** Remove a matricula. As entregas ja feitas continuam no banco. */
async function desmatricular(idPrograma, idStartup) {
  const { rows } = await query(
    `DELETE FROM startup_programa
      WHERE id_no = $1 AND id_startup = $2
      RETURNING id_startup`,
    [idPrograma, idStartup]
  )
  return rows[0]
}

/** Alterna a matricula entre EM_ANDAMENTO e CONCLUIDA. */
async function definirStatusMatricula(idPrograma, idStartup, status) {
  const { rows } = await query(
    `UPDATE startup_programa
        SET status = $3,
            fim_ts = CASE WHEN $3 = 'CONCLUIDA' THEN NOW() ELSE NULL END
      WHERE id_no = $1 AND id_startup = $2
      RETURNING id_startup, id_no, status, inicio_ts, fim_ts`,
    [idPrograma, idStartup, status]
  )
  return rows[0]
}

/** A startup esta matriculada nesta trilha? Guarda de acesso da Jornada. */
async function startupMatriculada(idStartup, idPrograma) {
  const { rows } = await query(
    `SELECT 1 FROM startup_programa WHERE id_startup = $1 AND id_no = $2`,
    [idStartup, idPrograma]
  )
  return rows.length > 0
}

module.exports = {
  arvorePorTenant,
  arvorePorPrograma,
  buscarPorId,
  listarFilhos,
  criar,
  atualizar,
  excluir,
  reordenar,
  mover,
  listarConteudos,
  vincularConteudo,
  desvincularConteudo,
  listarProgramas,
  definirPadrao,
  programaPadrao,
  listarStartupsDoPrograma,
  programasDaStartup,
  matricular,
  desmatricular,
  definirStatusMatricula,
  startupMatriculada,
}
