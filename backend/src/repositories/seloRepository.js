/**
 * Repositorio dos SELOS e das concessoes. Tabelas `selo` e `selo_concessao`
 * (migracao 017).
 *
 * O selo e a OUTRA MOEDA do engajamento, e nao se soma a primeira: mede
 * evolucao e protagonismo, vale reconhecimento publico (credencial +
 * LinkedIn) e ZERO ponto. Por isso este arquivo nao importa nem toca em
 * `engajamento_ponto` — nao ha caminho de um para o outro, e nao e para haver
 * (ver o cabecalho da migracao 017).
 */
const { query, withTransaction } = require("../config/db")

// ---------------------------------------------------------------------------
// SELOS (a definicao)
// ---------------------------------------------------------------------------

const COLUNAS_SELO = `id_selo, id_tenant, nome, descricao, criterio, categoria,
  cor, icone, imagem_url, permite_repetir, ativo, criado_por, criado_ts`

/**
 * Selos da incubadora, com quantas vezes cada um ja foi concedido.
 *
 * A contagem vem junto porque e a informacao que muda a decisao na tela: um
 * selo concedido 40 vezes nao e mais "raro", e um que nunca saiu provavelmente
 * tem criterio impossivel.
 */
async function listarSelos(idTenant, incluirInativos = false) {
  const { rows } = await query(
    `SELECT ${COLUNAS_SELO.split(", ")
      .map((c) => `s.${c.trim()}`)
      .join(", ")},
            COALESCE(c.total, 0)::int    AS concedidos,
            COALESCE(c.pessoas, 0)::int  AS pessoas
       FROM selo s
       LEFT JOIN LATERAL (
            SELECT COUNT(*)::int AS total,
                   COUNT(DISTINCT id_usuario)::int AS pessoas
              FROM selo_concessao sc
             WHERE sc.id_selo = s.id_selo AND sc.revogado_ts IS NULL
       ) c ON TRUE
      WHERE s.id_tenant = $1
        ${incluirInativos ? "" : "AND s.ativo = TRUE"}
      ORDER BY s.categoria NULLS LAST, s.nome`,
    [idTenant]
  )
  return rows
}

async function buscarSelo(idTenant, idSelo) {
  const { rows } = await query(
    `SELECT ${COLUNAS_SELO} FROM selo WHERE id_tenant = $1 AND id_selo = $2`,
    [idTenant, idSelo]
  )
  return rows[0]
}

/**
 * As categorias de selo ja em uso na incubadora — o autocomplete da tela.
 *
 * E isto que faz o vocabulario convergir sem tabela de cadastro: quem cria o
 * quinto selo ve "Protagonismo" na lista e escolhe, em vez de digitar
 * "protagonismo" e criar um grupo novo com o mesmo nome.
 */
async function categoriasEmUso(idTenant) {
  const { rows } = await query(
    `SELECT DISTINCT categoria
       FROM selo
      WHERE id_tenant = $1 AND categoria IS NOT NULL AND categoria <> ''
      ORDER BY categoria`,
    [idTenant]
  )
  return rows.map((r) => r.categoria)
}

async function criarSelo(idTenant, dados, idCriador) {
  const { rows } = await query(
    `INSERT INTO selo (id_tenant, nome, descricao, criterio, categoria, cor, icone,
                       imagem_url, permite_repetir, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${COLUNAS_SELO}`,
    [
      idTenant,
      dados.nome,
      dados.descricao ?? null,
      dados.criterio ?? null,
      dados.categoria ?? null,
      dados.cor,
      dados.icone,
      dados.imagem_url ?? null,
      dados.permite_repetir ?? false,
      idCriador ?? null,
    ]
  )
  return rows[0]
}

/**
 * Atualiza o selo. Tudo e editavel, INCLUSIVE nome e criterio — e de proposito:
 * a credencial publica LE a definicao atual, entao corrigir um criterio mal
 * escrito conserta todas as credenciais ja emitidas de uma vez. O que ficou
 * congelado na concessao e a justificativa individual, que e sobre a pessoa.
 */
async function atualizarSelo(idTenant, idSelo, dados) {
  const { rows } = await query(
    `UPDATE selo
        SET nome = $3, descricao = $4, criterio = $5, categoria = $6,
            cor = $7, icone = $8, imagem_url = $9, permite_repetir = $10
      WHERE id_tenant = $1 AND id_selo = $2
      RETURNING ${COLUNAS_SELO}`,
    [
      idTenant,
      idSelo,
      dados.nome,
      dados.descricao ?? null,
      dados.criterio ?? null,
      dados.categoria ?? null,
      dados.cor,
      dados.icone,
      dados.imagem_url ?? null,
      dados.permite_repetir ?? false,
    ]
  )
  return rows[0]
}

async function alterarAtivoSelo(idTenant, idSelo, ativo) {
  const { rows } = await query(
    `UPDATE selo SET ativo = $3 WHERE id_tenant = $1 AND id_selo = $2
     RETURNING ${COLUNAS_SELO}`,
    [idTenant, idSelo, ativo]
  )
  return rows[0]
}

/**
 * Exclui o selo. So funciona para selo que NUNCA foi concedido — a FK
 * (ON DELETE RESTRICT) barra o resto, e o service transforma isso em um 409
 * com a orientacao de desativar. Selo concedido nao pode sumir: ha credencial
 * publicada apontando para ele.
 */
async function excluirSelo(idTenant, idSelo) {
  const { rowCount } = await query(`DELETE FROM selo WHERE id_tenant = $1 AND id_selo = $2`, [
    idTenant,
    idSelo,
  ])
  return rowCount > 0
}

async function contarConcessoes(idSelo) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS total FROM selo_concessao WHERE id_selo = $1`,
    [idSelo]
  )
  return rows[0].total
}

// ---------------------------------------------------------------------------
// CONCESSOES
// ---------------------------------------------------------------------------

/**
 * Concede o selo a varias pessoas de uma vez, numa transacao.
 *
 * EM LOTE porque o ato real e em lote: "os cinco que apresentaram no Demoday".
 * Uma requisicao por pessoa deixaria metade concedida quando a rede caisse no
 * meio, e a coordenacao nao teria como saber quais.
 *
 * @param {Array<{id_usuario:number, codigo:string, id_startup?:number}>} destinatarios
 */
async function conceder(idTenant, idSelo, destinatarios, { justificativa, evidencia_url }, idConcedente) {
  return withTransaction(async (client) => {
    const criadas = []
    for (const destino of destinatarios) {
      const { rows } = await client.query(
        `INSERT INTO selo_concessao
           (id_tenant, id_selo, id_usuario, id_startup, justificativa, evidencia_url,
            codigo, concedido_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id_concessao, id_selo, id_usuario, codigo, publico, concedido_ts`,
        [
          idTenant,
          idSelo,
          destino.id_usuario,
          destino.id_startup ?? null,
          justificativa ?? null,
          evidencia_url ?? null,
          destino.codigo,
          idConcedente ?? null,
        ]
      )
      criadas.push(rows[0])
    }
    return criadas
  })
}

/** Ja tem este selo (nao revogado)? A pergunta de `permite_repetir`. */
async function jaConcedido(idSelo, idUsuario) {
  const { rows } = await query(
    `SELECT 1 FROM selo_concessao
      WHERE id_selo = $1 AND id_usuario = $2 AND revogado_ts IS NULL LIMIT 1`,
    [idSelo, idUsuario]
  )
  return rows.length > 0
}

const COLUNAS_CONCESSAO = `sc.id_concessao, sc.id_selo, sc.id_usuario, sc.id_startup,
  sc.justificativa, sc.evidencia_url, sc.codigo, sc.publico, sc.concedido_ts,
  sc.revogado_ts, sc.motivo_revogacao`

/**
 * As concessoes de uma pessoa — o mural do perfil dela.
 *
 * Traz as REVOGADAS tambem: a pessoa precisa entender por que a credencial
 * que ela publicou parou de valer, e esconder a linha so geraria a duvida.
 */
async function listarDoUsuario(idTenant, idUsuario) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CONCESSAO},
            s.nome AS selo, s.descricao, s.criterio, s.categoria, s.cor, s.icone,
            s.imagem_url,
            st.nome AS startup,
            q.nome  AS concedido_por_nome
       FROM selo_concessao sc
       JOIN selo s ON s.id_selo = sc.id_selo
       LEFT JOIN startup st ON st.id_startup = sc.id_startup
       LEFT JOIN usuarios q ON q.id_usuario = sc.concedido_por
      WHERE sc.id_tenant = $1 AND sc.id_usuario = $2
      ORDER BY sc.revogado_ts IS NOT NULL, sc.concedido_ts DESC`,
    [idTenant, idUsuario]
  )
  return rows
}

/**
 * As concessoes da incubadora — o mural coletivo e a tela de gestao.
 * Filtra por selo e/ou pessoa; sem filtro, traz as mais recentes.
 */
async function listarDoTenant(idTenant, { idSelo = null, idUsuario = null, limite = 200 } = {}) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CONCESSAO},
            s.nome AS selo, s.categoria, s.cor, s.icone, s.imagem_url,
            u.nome AS usuario, u.foto_url,
            st.nome AS startup,
            q.nome AS concedido_por_nome
       FROM selo_concessao sc
       JOIN selo s ON s.id_selo = sc.id_selo
       JOIN usuarios u ON u.id_usuario = sc.id_usuario
       LEFT JOIN startup st ON st.id_startup = sc.id_startup
       LEFT JOIN usuarios q ON q.id_usuario = sc.concedido_por
      WHERE sc.id_tenant = $1
        AND ($2::int IS NULL OR sc.id_selo = $2)
        AND ($3::int IS NULL OR sc.id_usuario = $3)
      ORDER BY sc.concedido_ts DESC
      LIMIT $4`,
    [idTenant, idSelo, idUsuario, limite]
  )
  return rows
}

async function buscarConcessao(idTenant, idConcessao) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CONCESSAO}, s.nome AS selo, u.nome AS usuario
       FROM selo_concessao sc
       JOIN selo s ON s.id_selo = sc.id_selo
       JOIN usuarios u ON u.id_usuario = sc.id_usuario
      WHERE sc.id_tenant = $1 AND sc.id_concessao = $2`,
    [idTenant, idConcessao]
  )
  return rows[0]
}

/**
 * A credencial publica, pelo codigo. SEM id_tenant: quem abre o link nao tem
 * sessao nem incubadora — o codigo aleatorio e a chave.
 *
 * Traz a REVOGADA tambem, e de proposito: a pagina precisa poder dizer
 * "credencial revogada" em vez de sumir. Um link que vira 404 parece link
 * quebrado; um que diz que foi revogado e o que sustenta a credibilidade dos
 * selos de todo mundo.
 *
 * Quem decide se pode exibir e o service, olhando `publico`.
 */
async function buscarPorCodigo(codigo) {
  const { rows } = await query(
    `SELECT ${COLUNAS_CONCESSAO},
            s.nome AS selo, s.descricao, s.criterio, s.categoria, s.cor, s.icone,
            s.imagem_url,
            u.nome AS usuario,
            st.nome AS startup,
            t.id_tenant, t.nome AS incubadora, t.logo AS incubadora_logo,
            t.linkedin_org_id
       FROM selo_concessao sc
       JOIN selo s     ON s.id_selo = sc.id_selo
       JOIN usuarios u ON u.id_usuario = sc.id_usuario
       JOIN tenant t   ON t.id_tenant = sc.id_tenant
       LEFT JOIN startup st ON st.id_startup = sc.id_startup
      WHERE sc.codigo = $1`,
    [codigo]
  )
  return rows[0]
}

async function codigoEmUso(codigo) {
  const { rows } = await query(`SELECT 1 FROM selo_concessao WHERE codigo = $1 LIMIT 1`, [codigo])
  return rows.length > 0
}

/** Revoga (estado, nunca DELETE — ver o cabecalho da migracao). */
async function revogar(idTenant, idConcessao, idRevogador, motivo) {
  const { rows } = await query(
    `UPDATE selo_concessao
        SET revogado_ts = NOW(), revogado_por = $3, motivo_revogacao = $4
      WHERE id_tenant = $1 AND id_concessao = $2 AND revogado_ts IS NULL
      RETURNING ${COLUNAS_CONCESSAO.replace(/sc\./g, "")}`,
    [idTenant, idConcessao, idRevogador, motivo ?? null]
  )
  return rows[0]
}

/**
 * Liga/desliga a credencial publica.
 *
 * FILTRA POR id_usuario NA PROPRIA QUERY: e o dono do nome que decide expor o
 * nome, e amarrar isso aqui garante que nenhum caminho de chamada consiga
 * tornar publica a conquista de outra pessoa por engano.
 */
async function alterarPublico(idTenant, idConcessao, idUsuario, publico) {
  const { rows } = await query(
    `UPDATE selo_concessao SET publico = $4
      WHERE id_tenant = $1 AND id_concessao = $2 AND id_usuario = $3
        AND revogado_ts IS NULL
      RETURNING id_concessao, codigo, publico`,
    [idTenant, idConcessao, idUsuario, publico]
  )
  return rows[0]
}

module.exports = {
  listarSelos,
  buscarSelo,
  categoriasEmUso,
  criarSelo,
  atualizarSelo,
  alterarAtivoSelo,
  excluirSelo,
  contarConcessoes,

  conceder,
  jaConcedido,
  listarDoUsuario,
  listarDoTenant,
  buscarConcessao,
  buscarPorCodigo,
  codigoEmUso,
  revogar,
  alterarPublico,
}
