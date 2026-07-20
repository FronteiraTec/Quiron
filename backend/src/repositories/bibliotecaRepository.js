/**
 * Repositorio da Biblioteca (camada de acesso a dados).
 * Tabelas relacionadas: conteudo, conteudo_bloco, trilha_conteudo (schema.sql).
 *
 * A Biblioteca e o acervo reutilizavel do que a incubadora ensina. Um conteudo
 * nao tem posicao nem prazo — quem da contexto a ele e o PASSO da trilha que o
 * referencia (ver trilhaRepository.vincularConteudo).
 */
const { query, withTransaction } = require("../config/db")

const CAMPOS = [
  "id_conteudo", "id_tenant", "tipo", "titulo", "resumo", "tags",
  "url", "nome_arquivo", "duracao", "logo_url",
  "criado_por", "criado_ts", "atualizado_ts",
]

const cols = (prefixo = "") => CAMPOS.map((c) => prefixo + c).join(", ")
const COLUNAS = cols()

/**
 * Lista os conteudos de um tenant, com filtros opcionais.
 *
 * Traz junto `usos` — os passos da trilha que referenciam o conteudo, no mesmo
 * formato de buscarPorId (lista de { fase, modulo, passo }). Manter o mesmo
 * tipo nas duas rotas evita que a tela precise saber de onde o dado veio.
 * E o que alimenta o aviso "usado em N passos" antes de excluir; antes esse
 * numero era um campo estatico no mock, que nunca batia com a realidade.
 *
 * @param {number} idTenant
 * @param {{tipo?:string, tag?:string, termo?:string}} [filtros]
 */
async function listarPorTenant(idTenant, filtros = {}) {
  const { tipo, tag, termo } = filtros
  const condicoes = ["c.id_tenant = $1"]
  const valores = [idTenant]

  if (tipo) {
    valores.push(tipo)
    condicoes.push(`c.tipo = $${valores.length}`)
  }

  if (tag) {
    valores.push([tag])
    condicoes.push(`c.tags @> $${valores.length}`)
  }

  if (termo) {
    valores.push(`%${termo}%`)
    const p = `$${valores.length}`
    // array_to_string permite buscar tambem pelo texto das tags.
    condicoes.push(
      `(c.titulo ILIKE ${p} OR c.resumo ILIKE ${p} OR array_to_string(c.tags, ' ') ILIKE ${p})`
    )
  }

  const { rows } = await query(
    `SELECT ${cols("c.")},
            COALESCE(u.usos, '[]'::json) AS usos
       FROM conteudo c
       LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'id_no', passo.id_no,
                    'passo', passo.nome,
                    'modulo', modulo.nome,
                    'fase', fase.nome
                  ) ORDER BY fase.ordem, modulo.ordem, passo.ordem
                ) AS usos
           FROM trilha_conteudo tc
           JOIN trilha_no passo   ON passo.id_no = tc.id_no
           LEFT JOIN trilha_no modulo ON modulo.id_no = passo.id_pai
           LEFT JOIN trilha_no fase   ON fase.id_no = modulo.id_pai
          WHERE tc.id_conteudo = c.id_conteudo
       ) u ON TRUE
      WHERE ${condicoes.join(" AND ")}
      ORDER BY c.atualizado_ts DESC`,
    valores
  )
  return rows
}

/** Conta os conteudos por tipo (alimenta os chips de filtro da tela). */
async function contarPorTipo(idTenant) {
  const { rows } = await query(
    `SELECT tipo, COUNT(*)::INTEGER AS total
       FROM conteudo WHERE id_tenant = $1 GROUP BY tipo`,
    [idTenant]
  )

  const contagem = rows.reduce((acc, r) => ({ ...acc, [r.tipo]: r.total }), {})
  contagem.TODOS = rows.reduce((soma, r) => soma + r.total, 0)
  return contagem
}

/**
 * Busca um conteudo pelo id, com os blocos (quando AULA) e a lista de passos
 * que o referenciam.
 */
async function buscarPorId(id) {
  const { rows } = await query(
    `SELECT ${COLUNAS} FROM conteudo WHERE id_conteudo = $1`,
    [id]
  )
  const conteudo = rows[0]
  if (!conteudo) return undefined

  if (conteudo.tipo === "AULA") {
    conteudo.blocos = await listarBlocos(id)
  }
  conteudo.usos = await listarUsos(id)

  return conteudo
}

/** Blocos de uma aula, em ordem. */
async function listarBlocos(idConteudo) {
  const { rows } = await query(
    `SELECT id_bloco, tipo, ordem, texto, url, nome, variante
       FROM conteudo_bloco
      WHERE id_conteudo = $1
      ORDER BY ordem`,
    [idConteudo]
  )
  return rows
}

/** Passos da trilha que referenciam este conteudo (com o caminho legivel). */
async function listarUsos(idConteudo) {
  const { rows } = await query(
    `SELECT passo.id_no, passo.nome AS passo,
            modulo.nome AS modulo, fase.nome AS fase
       FROM trilha_conteudo tc
       JOIN trilha_no passo  ON passo.id_no = tc.id_no
       LEFT JOIN trilha_no modulo ON modulo.id_no = passo.id_pai
       LEFT JOIN trilha_no fase   ON fase.id_no = modulo.id_pai
      WHERE tc.id_conteudo = $1
      ORDER BY fase.ordem, modulo.ordem, passo.ordem`,
    [idConteudo]
  )
  return rows
}

/** Cria um conteudo. Os blocos, quando houver, entram na mesma transacao. */
async function criar(dados) {
  const {
    idTenant, tipo, titulo, resumo = null, tags = [],
    url = null, nomeArquivo = null, duracao = null, logoUrl = null,
    criadoPor = null, blocos = null,
  } = dados

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO conteudo (
         id_tenant, tipo, titulo, resumo, tags, url, nome_arquivo, duracao,
         logo_url, criado_por
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${COLUNAS}`,
      [idTenant, tipo, titulo, resumo, tags, url, nomeArquivo, duracao,
       logoUrl, criadoPor]
    )
    const conteudo = rows[0]

    if (tipo === "AULA" && Array.isArray(blocos)) {
      await gravarBlocos(client, conteudo.id_conteudo, blocos)
      conteudo.blocos = await listarBlocosNaTransacao(client, conteudo.id_conteudo)
    }

    return conteudo
  })
}

const CAMPOS_EDITAVEIS = {
  titulo: "titulo",
  resumo: "resumo",
  tags: "tags",
  url: "url",
  nomeArquivo: "nome_arquivo",
  duracao: "duracao",
  logoUrl: "logo_url",
}

/**
 * Aplica um patch ao conteudo. Quando `blocos` vem no patch, a lista inteira e
 * substituida (apaga e regrava) — o editor sempre manda o documento completo,
 * e reconciliar bloco a bloco seria mais caro e mais fragil que reescrever.
 */
async function atualizar(id, patch) {
  return withTransaction(async (client) => {
    const sets = []
    const valores = []

    for (const [chave, coluna] of Object.entries(CAMPOS_EDITAVEIS)) {
      if (patch[chave] !== undefined) {
        valores.push(patch[chave])
        sets.push(`${coluna} = $${valores.length}`)
      }
    }

    let conteudo

    if (sets.length) {
      sets.push("atualizado_ts = NOW()")
      valores.push(id)
      const { rows } = await client.query(
        `UPDATE conteudo SET ${sets.join(", ")}
          WHERE id_conteudo = $${valores.length}
          RETURNING ${COLUNAS}`,
        valores
      )
      conteudo = rows[0]
    } else {
      const { rows } = await client.query(
        `SELECT ${COLUNAS} FROM conteudo WHERE id_conteudo = $1`,
        [id]
      )
      conteudo = rows[0]
    }

    if (!conteudo) return undefined

    if (Array.isArray(patch.blocos)) {
      await client.query(`DELETE FROM conteudo_bloco WHERE id_conteudo = $1`, [id])
      await gravarBlocos(client, id, patch.blocos)
      await client.query(
        `UPDATE conteudo SET atualizado_ts = NOW() WHERE id_conteudo = $1`,
        [id]
      )
    }

    if (conteudo.tipo === "AULA") {
      conteudo.blocos = await listarBlocosNaTransacao(client, id)
    }

    return conteudo
  })
}

/** Grava a lista de blocos, numerando a ordem pela posicao no array. */
async function gravarBlocos(client, idConteudo, blocos) {
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i]
    await client.query(
      `INSERT INTO conteudo_bloco (id_conteudo, tipo, ordem, texto, url, nome, variante)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [idConteudo, b.tipo, i + 1, b.texto ?? null, b.url ?? null,
       b.nome ?? null, b.variante ?? null]
    )
  }
}

/** Mesma leitura de listarBlocos, mas dentro de uma transacao em curso. */
async function listarBlocosNaTransacao(client, idConteudo) {
  const { rows } = await client.query(
    `SELECT id_bloco, tipo, ordem, texto, url, nome, variante
       FROM conteudo_bloco WHERE id_conteudo = $1 ORDER BY ordem`,
    [idConteudo]
  )
  return rows
}

/**
 * Duplica um conteudo (com os blocos). A copia nasce sem vinculos com a
 * trilha: duplicar e para variar o material, nao para herdar onde ele era
 * usado.
 */
async function duplicar(id) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO conteudo (
         id_tenant, tipo, titulo, resumo, tags, url, nome_arquivo, duracao,
         logo_url, criado_por
       )
       SELECT id_tenant, tipo, titulo || ' (copia)', resumo, tags,
              url, nome_arquivo, duracao, logo_url, criado_por
         FROM conteudo WHERE id_conteudo = $1
       RETURNING ${COLUNAS}`,
      [id]
    )
    const copia = rows[0]
    if (!copia) return undefined

    await client.query(
      `INSERT INTO conteudo_bloco (id_conteudo, tipo, ordem, texto, url, nome, variante)
       SELECT $1, tipo, ordem, texto, url, nome, variante
         FROM conteudo_bloco WHERE id_conteudo = $2`,
      [copia.id_conteudo, id]
    )

    if (copia.tipo === "AULA") {
      copia.blocos = await listarBlocosNaTransacao(client, copia.id_conteudo)
    }

    return copia
  })
}

/**
 * Exclui um conteudo.
 * A FK trilha_conteudo -> conteudo e ON DELETE RESTRICT, entao o banco recusa
 * se o conteudo estiver em uso; o service checa antes para dar 409 legivel.
 */
async function excluir(id) {
  const { rows } = await query(
    `DELETE FROM conteudo WHERE id_conteudo = $1 RETURNING id_conteudo`,
    [id]
  )
  return rows[0]
}

/** Quantos passos usam este conteudo. */
async function contarUsos(id) {
  const { rows } = await query(
    `SELECT COUNT(*)::INTEGER AS total FROM trilha_conteudo WHERE id_conteudo = $1`,
    [id]
  )
  return rows[0].total
}

module.exports = {
  listarPorTenant,
  contarPorTipo,
  buscarPorId,
  listarBlocos,
  listarUsos,
  criar,
  atualizar,
  duplicar,
  excluir,
  contarUsos,
}
