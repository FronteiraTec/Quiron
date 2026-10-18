/**
 * Repositorio dos COMPARTILHAMENTOS do Espaco do Mentor (camada de acesso a
 * dados). Tabelas relacionadas: mentor_compartilhamento, mentor_material,
 * conteudo, arquivo, trilha_no, startup_programa, startup (migracao 020).
 *
 * Um compartilhamento e um vinculo: aponta para a origem (material pessoal OU
 * conteudo da Biblioteca) e para o lugar (startup, trilha, etapa). Toda leitura
 * passa pela mesma SELECAO, que resolve as duas pontas numa consulta so — o
 * titulo vem da origem, o caminho vem da arvore — para que a tela do mentor e a
 * Jornada da startup nunca discordem sobre o que foi entregue e onde.
 *
 * Quem pode ler o que e do mentorCompartilhamentoService.
 */
const { query } = require("../config/db")

/**
 * A linha completa de um compartilhamento.
 *
 * ETAPA. `id_no` e uma FASE ou um PASSO; o caminho ate ele (fase > modulo >
 * passo) vem de dois LEFT JOINs para cima. `etapa_visivel` responde se a
 * startup ainda enxerga aquele lugar na Jornada: a etapa pode ter sido
 * desativada no Construtor, ou movida para outra trilha. Nesses casos o
 * material nao some — a Jornada o mostra no nivel da trilha.
 *
 * MATRICULA. `matriculada` diz se a startup ainda esta na trilha do
 * compartilhamento. Fora dela, a startup nao abre a trilha na Jornada, e o
 * service esconde o material dela.
 *
 * ORIGEM. Titulo, descricao, tipo e endereco saem do material pessoal ou do
 * conteudo, o que existir. `tipo` tem vocabularios diferentes nas duas origens
 * (ARQUIVO|LINK no pessoal; AULA|VIDEO|ARQUIVO|TEMPLATE|LINK na Biblioteca), e
 * `origem` e o que desambigua.
 */
const SELECAO = `
  SELECT mc.id_compartilhamento, mc.id_tenant, mc.id_startup, mc.id_programa, mc.id_no,
         mc.id_material, mc.id_conteudo, mc.finalidade, mc.orientacao,
         mc.compartilhado_por, au.nome AS compartilhado_por_nome,
         mc.criado_ts, mc.atualizado_ts,

         s.nome AS startup_nome,
         pr.nome AS programa_nome,

         etp.tipo AS etapa_tipo, etp.nome AS etapa_nome,
         CASE etp.tipo WHEN 'FASE' THEN etp.id_no WHEN 'PASSO' THEN fa.id_no END AS id_fase,
         CASE etp.tipo WHEN 'FASE' THEN etp.nome WHEN 'PASSO' THEN fa.nome END AS fase_nome,
         CASE WHEN etp.tipo = 'PASSO' THEN mo.nome END AS modulo_nome,
         COALESCE(
           CASE
             WHEN mc.id_no IS NULL THEN TRUE
             WHEN etp.tipo = 'FASE' THEN etp.ativo AND etp.id_pai = mc.id_programa
             ELSE etp.ativo AND mo.ativo AND fa.ativo AND fa.id_pai = mc.id_programa
           END,
           FALSE
         ) AS etapa_visivel,
         EXISTS (
           SELECT 1 FROM startup_programa sp
            WHERE sp.id_startup = mc.id_startup AND sp.id_no = mc.id_programa
         ) AS matriculada,

         CASE WHEN mc.id_material IS NOT NULL THEN 'PESSOAL' ELSE 'INSTITUCIONAL' END AS origem,
         COALESCE(mm.titulo, ct.titulo) AS titulo,
         COALESCE(mm.descricao, ct.resumo) AS descricao,
         mm.categoria,
         COALESCE(mm.tipo, ct.tipo::text) AS tipo,
         COALESCE(mm.url, ct.url) AS url,
         mm.id_mentor AS material_dono,
         mm.arquivado_ts AS material_arquivado_ts,
         ct.nome_arquivo AS conteudo_nome_arquivo,
         ct.duracao AS conteudo_duracao,
         ar.nome_original AS arquivo_nome, ar.mime AS arquivo_mime,
         ar.tamanho::int AS arquivo_tamanho
    FROM mentor_compartilhamento mc
    JOIN startup s ON s.id_startup = mc.id_startup
    JOIN trilha_no pr ON pr.id_no = mc.id_programa
    LEFT JOIN trilha_no etp ON etp.id_no = mc.id_no
    LEFT JOIN trilha_no mo ON etp.tipo = 'PASSO' AND mo.id_no = etp.id_pai
    LEFT JOIN trilha_no fa ON fa.id_no = mo.id_pai
    LEFT JOIN usuarios au ON au.id_usuario = mc.compartilhado_por
    LEFT JOIN mentor_material mm ON mm.id_material = mc.id_material
    LEFT JOIN arquivo ar ON ar.id_arquivo = mm.id_arquivo
    LEFT JOIN conteudo ct ON ct.id_conteudo = mc.id_conteudo
`

async function buscarPorId(idCompartilhamento) {
  const { rows } = await query(`${SELECAO} WHERE mc.id_compartilhamento = $1`, [idCompartilhamento])
  return rows[0]
}

async function criar(dados) {
  const {
    idTenant, idStartup, idPrograma, idNo, idMaterial, idConteudo,
    finalidade, orientacao, compartilhadoPor,
  } = dados
  const { rows } = await query(
    `INSERT INTO mentor_compartilhamento
       (id_tenant, id_startup, id_programa, id_no, id_material, id_conteudo,
        finalidade, orientacao, compartilhado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_compartilhamento`,
    [idTenant, idStartup, idPrograma, idNo, idMaterial, idConteudo,
     finalidade, orientacao, compartilhadoPor]
  )
  return buscarPorId(rows[0].id_compartilhamento)
}

/**
 * O que o mentor ve: o que ELE compartilhou (com quem quer que seja, inclusive
 * startup que deixou de acompanhar) mais o que foi compartilhado com as
 * startups que ele acompanha, por qualquer mentor.
 *
 * @param {{idTenant:number, idAutor:number, idsStartups:number[]|null, idStartup?:number}} filtro
 *   `idsStartups` null = todas as startups do tenant (admin e root).
 */
async function listar({ idTenant, idAutor, idsStartups, idStartup = null }) {
  const { rows } = await query(
    `${SELECAO}
      WHERE mc.id_tenant = $1
        AND (mc.compartilhado_por = $2 OR $3::int[] IS NULL OR mc.id_startup = ANY($3::int[]))
        AND ($4::int IS NULL OR mc.id_startup = $4)
      ORDER BY mc.criado_ts DESC, mc.id_compartilhamento DESC`,
    [idTenant, idAutor, idsStartups, idStartup]
  )
  return rows
}

/**
 * O que a STARTUP recebeu — so das trilhas em que ela continua matriculada.
 * Na ordem da trilha nao da para ordenar aqui (a etapa pode ser fase ou passo);
 * a Jornada agrupa por lugar, e dentro de cada lugar o mais novo vem primeiro.
 */
async function listarDaStartup(idStartup, idPrograma = null) {
  const { rows } = await query(
    `${SELECAO}
      WHERE mc.id_startup = $1
        AND ($2::int IS NULL OR mc.id_programa = $2)
        AND EXISTS (
          SELECT 1 FROM startup_programa sp
           WHERE sp.id_startup = mc.id_startup AND sp.id_no = mc.id_programa
        )
      ORDER BY mc.criado_ts DESC, mc.id_compartilhamento DESC`,
    [idStartup, idPrograma]
  )
  return rows
}

/** So a orientacao e a finalidade mudam depois de compartilhado. */
async function atualizar(idCompartilhamento, { orientacao, finalidade }) {
  await query(
    `UPDATE mentor_compartilhamento
        SET orientacao = $2, finalidade = $3, atualizado_ts = NOW()
      WHERE id_compartilhamento = $1`,
    [idCompartilhamento, orientacao, finalidade]
  )
  return buscarPorId(idCompartilhamento)
}

async function excluir(idCompartilhamento) {
  const { rows } = await query(
    `DELETE FROM mentor_compartilhamento WHERE id_compartilhamento = $1
     RETURNING id_compartilhamento`,
    [idCompartilhamento]
  )
  return rows[0]
}

/**
 * A etapa, se ela pertence a subarvore ATIVA desta trilha.
 *
 * Ativa como na Jornada: um no desativado esconde tudo abaixo dele, e
 * compartilhar num lugar que a startup nao enxerga seria entregar para lugar
 * nenhum.
 */
async function etapaDaTrilha(idPrograma, idNo) {
  const { rows } = await query(
    `WITH RECURSIVE arv AS (
       SELECT id_no, tipo, nome FROM trilha_no WHERE id_no = $1 AND ativo
       UNION ALL
       SELECT n.id_no, n.tipo, n.nome
         FROM trilha_no n
         JOIN arv a ON a.id_no = n.id_pai
        WHERE n.ativo
     )
     SELECT id_no, tipo, nome FROM arv WHERE id_no = $2`,
    [idPrograma, idNo]
  )
  return rows[0]
}

/** O minimo de um conteudo da Biblioteca para validar o compartilhamento. */
async function conteudoResumo(idConteudo) {
  const { rows } = await query(
    `SELECT id_conteudo, id_tenant, tipo, titulo FROM conteudo WHERE id_conteudo = $1`,
    [idConteudo]
  )
  return rows[0]
}

/** Quantos materiais cada startup recebeu — no total e de quem pergunta. */
async function contarPorStartup(idsStartups, idAutor) {
  if (!idsStartups.length) return []
  const { rows } = await query(
    `SELECT id_startup,
            COUNT(*)::int AS total,
            (COUNT(*) FILTER (WHERE compartilhado_por = $2))::int AS meus
       FROM mentor_compartilhamento
      WHERE id_startup = ANY($1::int[])
      GROUP BY id_startup`,
    [idsStartups, idAutor]
  )
  return rows
}

/**
 * A fase em que cada startup esta, em cada trilha: a primeira fase ativa (na
 * ordem do Construtor) com algum passo de entrega ainda nao aprovado.
 *
 * E o mesmo criterio da Jornada (jornadaService.carregar): so passo que aceita
 * entrega conta, e fase aprovada em startup_trilha vale como concluida. Fase sem
 * nenhum passo de entrega nao prende ninguem. Sem linha para a trilha = nada
 * pendente, a startup percorreu tudo.
 */
async function fasesAtuais(idsStartups) {
  if (!idsStartups.length) return []
  const { rows } = await query(
    `WITH fases AS (
       SELECT sp.id_startup, sp.id_no AS id_programa, f.id_no AS id_fase, f.nome, f.ordem
         FROM startup_programa sp
         JOIN trilha_no f ON f.id_pai = sp.id_no AND f.tipo = 'FASE' AND f.ativo
        WHERE sp.id_startup = ANY($1::int[])
     ),
     pendentes AS (
       SELECT DISTINCT fa.id_startup, fa.id_programa, fa.id_fase
         FROM fases fa
         JOIN trilha_no m ON m.id_pai = fa.id_fase AND m.ativo
         JOIN trilha_no p ON p.id_pai = m.id_no AND p.ativo AND p.permite_entrega
         LEFT JOIN entrega e ON e.id_no = p.id_no AND e.id_startup = fa.id_startup
         LEFT JOIN LATERAL (
           SELECT status FROM avaliacao
            WHERE id_entrega = e.id_entrega
            ORDER BY criado_ts DESC, id_avaliacao DESC
            LIMIT 1
         ) a ON TRUE
        WHERE a.status IS DISTINCT FROM 'APROVADO'
          AND NOT EXISTS (
            SELECT 1 FROM startup_trilha st
             WHERE st.id_startup = fa.id_startup AND st.id_no = fa.id_fase
               AND st.status = 'APROVADA'
          )
     )
     SELECT DISTINCT ON (fa.id_startup, fa.id_programa)
            fa.id_startup, fa.id_programa, fa.id_fase, fa.nome
       FROM fases fa
       JOIN pendentes pe
         ON pe.id_startup = fa.id_startup
        AND pe.id_programa = fa.id_programa
        AND pe.id_fase = fa.id_fase
      ORDER BY fa.id_startup, fa.id_programa, fa.ordem, fa.id_fase`,
    [idsStartups]
  )
  return rows
}

module.exports = {
  buscarPorId,
  criar,
  listar,
  listarDaStartup,
  atualizar,
  excluir,
  etapaDaTrilha,
  conteudoResumo,
  contarPorStartup,
  fasesAtuais,
}
