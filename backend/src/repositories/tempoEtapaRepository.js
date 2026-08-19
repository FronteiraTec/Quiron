/**
 * Repositorio de Tempo por Etapa (camada de acesso a dados).
 * Tabelas relacionadas: passo_evento, startup_programa, trilha_no, startup
 * (schema.sql, migracao 011).
 *
 * Responde "ha quanto tempo esta startup esta nesta fase?" separando o relogio
 * em dois donos, porque a resposta crua acusa a startup por atrasos que nao sao
 * dela: uma entrega enviada e nao corrigida deixa o passo parado sem que haja
 * nada que o incubado possa fazer.
 *
 * O MODELO DE DUAS MAOS
 * `passo_evento` grava cada troca de mao de um passo. Entre dois eventos
 * consecutivos existe um trecho de tempo com um dono so:
 *
 *   entrada na fase ─── INCUBADO ───> ENVIADA ─── MENTOR ───> AJUSTE
 *   ─── INCUBADO ───> ENVIADA ─── MENTOR ───> APROVADO (fim do passo)
 *
 * O trecho aberto no fim (sem evento seguinte) corre ate agora — e por isso a
 * espera de uma correcao que nunca vem cresce sozinha no relatorio.
 *
 * POR QUE UNIAO DE INTERVALOS, E NAO SOMA, NO NIVEL DA FASE
 * Uma fase tem varios passos em paralelo. Somar o tempo de mentor de cada um
 * daria numeros maiores que a propria duracao da fase (tres entregas paradas a
 * dez dias nao sao trinta dias de atraso, sao dez). Entao no nivel da fase o
 * que se mede e a UNIAO dos trechos: quanto do relogio da fase teve alguma
 * coisa na mao de cada lado.
 *
 * Disso sai o numero que interessa: `seg_bloqueada` = duracao da fase menos o
 * tempo em que a startup tinha ALGO para fazer. E o tempo em que tudo que
 * faltava estava na fila do mentor — atraso que nao e do incubado.
 *
 * No nivel do PASSO nao ha sobreposicao possivel (um passo esta em um estado
 * so por vez), entao ali a soma simples ja e exata.
 */
const { query } = require("../config/db")

// ---------------------------------------------------------------------------
// Bloco compartilhado: a janela de cada fase por startup e os trechos de tempo
// com dono dentro dela.
//
// As duas consultas abaixo leem daqui em recortes diferentes — uma agrupa por
// FASE (quanto tempo cada startup leva em cada etapa), outra por PASSO (onde no
// programa o tempo se perde). Manter um bloco so garante que as duas contem a
// mesma historia; duas versoes divergiriam no primeiro ajuste de regra.
//
// $1 = id_tenant
// ---------------------------------------------------------------------------
const SQL_JANELA = `
  -- A matricula da startup numa trilha. A coluna teto fecha o relogio: numa
  -- trilha ja concluida o tempo parou no fim dela, nao corre ate hoje.
  matricula AS (
    SELECT sp.id_startup, sp.id_no AS id_programa, sp.inicio_ts,
           sp.status AS matricula_status,
           COALESCE(sp.fim_ts, NOW()) AS teto,
           s.nome AS startup,
           prog.nome AS programa
      FROM startup_programa sp
      JOIN startup s      ON s.id_startup = sp.id_startup
      JOIN trilha_no prog ON prog.id_no = sp.id_no
     WHERE s.id_tenant = $1
       AND s.status <> 'ENCERRADA'
  ),

  fase AS (
    SELECT f.id_no AS id_fase, f.id_pai AS id_programa, f.nome AS fase, f.ordem
      FROM trilha_no f
     WHERE f.id_tenant = $1 AND f.tipo = 'FASE' AND f.ativo
  ),

  -- O PASSO pendura na FASE pelo MODULO. Passos de modulo inativo saem junto:
  -- a Jornada tambem nao os mostra, e cobrar tempo do que nao aparece na tela
  -- do incubado seria inventar atraso.
  passo AS (
    SELECT p.id_no AS id_passo, p.nome AS passo, p.permite_entrega, p.obrigatoria,
           m.id_pai AS id_fase, m.nome AS modulo
      FROM trilha_no p
      JOIN trilha_no m ON m.id_no = p.id_pai AND m.tipo = 'MODULO' AND m.ativo
     WHERE p.id_tenant = $1 AND p.tipo = 'PASSO' AND p.ativo
  ),

  -- Toda a linha do tempo do tenant, com o evento seguinte de cada passo ao
  -- lado: e o LEAD que transforma eventos pontuais em trechos com duracao.
  ev AS (
    SELECT pe.id_startup, pe.id_no, pe.tipo, pe.ts,
           LEAD(pe.ts) OVER (PARTITION BY pe.id_startup, pe.id_no
                             ORDER BY pe.ts, pe.id_evento) AS prox_ts
      FROM passo_evento pe
      JOIN startup s ON s.id_startup = pe.id_startup AND s.id_tenant = $1
  ),

  -- A primeira aprovacao vale: reprovar depois de aprovado nao e fluxo do
  -- sistema, e MIN evita que um evento tardio empurre o fim da fase.
  aprovacao AS (
    SELECT id_startup, id_no, MIN(ts) AS aprovado_ts
      FROM ev WHERE tipo = 'APROVADO'
     GROUP BY id_startup, id_no
  ),

  -- Quanto falta em cada fase, por startup.
  --
  -- So contam os passos que ACEITAM entrega: um passo informativo
  -- (permite_entrega = FALSE) nunca recebe aprovacao e, contado aqui, deixaria
  -- toda fase eternamente em aberto.
  fase_bruta AS (
    SELECT m.id_startup, m.startup, m.id_programa, m.programa,
           m.inicio_ts, m.teto, m.matricula_status,
           f.id_fase, f.fase, f.ordem,
           COUNT(p.id_passo) FILTER (WHERE p.permite_entrega) AS entregaveis,
           COUNT(ap.aprovado_ts)                              AS aprovados,
           -- '-infinity' e o neutro do GREATEST logo abaixo: uma fase sem nada
           -- aprovado nao deve empurrar a entrada da fase seguinte.
           COALESCE(MAX(ap.aprovado_ts), '-infinity'::TIMESTAMP) AS ultimo_aprovado_ts
      FROM matricula m
      JOIN fase f ON f.id_programa = m.id_programa
      LEFT JOIN passo p ON p.id_fase = f.id_fase
      LEFT JOIN aprovacao ap ON ap.id_startup = m.id_startup
                            AND ap.id_no = p.id_passo
                            AND p.permite_entrega
     GROUP BY m.id_startup, m.startup, m.id_programa, m.programa,
              m.inicio_ts, m.teto, m.matricula_status,
              f.id_fase, f.fase, f.ordem
  ),

  -- Encadeia as fases: a startup entra numa quando terminou a anterior.
  --
  -- Mesma sequencia que a Jornada aplica na tela (jornadaService.carregar:
  -- "uma fase e liberada quando a anterior foi concluida"). Assim as fases
  -- LADRILHAM o tempo — somadas dao exatamente o tempo total de programa, sem
  -- buraco e sem contar o mesmo dia duas vezes.
  fase_encadeada AS (
    SELECT fb.*,
           (fb.entregaveis = 0 OR fb.aprovados >= fb.entregaveis) AS concluida,
           COALESCE(
             BOOL_AND(fb.entregaveis = 0 OR fb.aprovados >= fb.entregaveis)
               OVER (PARTITION BY fb.id_startup, fb.id_programa ORDER BY fb.ordem
                     ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),
             TRUE
           ) AS anteriores_ok,
           MAX(fb.ultimo_aprovado_ts)
             OVER (PARTITION BY fb.id_startup, fb.id_programa ORDER BY fb.ordem
                   ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS fim_anterior
      FROM fase_bruta fb
  ),

  -- entrada NULL = a startup ainda nao chegou nesta fase (alguma anterior
  -- segue aberta). A fase existe na trilha dela, mas ainda nao consome tempo.
  fase_entrada AS (
    SELECT fe.*,
           CASE WHEN fe.anteriores_ok
                THEN GREATEST(fe.inicio_ts, fe.fim_anterior)
           END AS entrada_ts
      FROM fase_encadeada fe
  ),

  janela AS (
    SELECT fen.id_startup, fen.startup, fen.id_programa, fen.programa,
           fen.matricula_status, fen.id_fase, fen.fase, fen.ordem,
           fen.entregaveis, fen.aprovados, fen.concluida, fen.entrada_ts,
           CASE WHEN fen.concluida
                THEN GREATEST(fen.entrada_ts, fen.ultimo_aprovado_ts)
           END AS saida_ts,
           -- Fase aberta corre ate o teto da matricula (hoje, em geral).
           GREATEST(
             fen.entrada_ts,
             CASE WHEN fen.concluida
                  THEN GREATEST(fen.entrada_ts, fen.ultimo_aprovado_ts)
                  ELSE fen.teto
             END
           ) AS fim_efetivo
      FROM fase_entrada fen
     WHERE fen.entrada_ts IS NOT NULL
  ),

  -- Trecho entre dois eventos. Depois de ENVIADA a bola e do mentor; depois de
  -- um pedido de ajuste (ou reprovacao) volta a ser do incubado. APROVADO nao
  -- abre trecho: o passo acabou ali e o que vier depois nao e espera de
  -- ninguem.
  trecho_evento AS (
    SELECT id_startup, id_no,
           CASE WHEN tipo = 'ENVIADA' THEN 'MENTOR' ELSE 'INCUBADO' END AS dono,
           ts AS ini,
           COALESCE(prox_ts, NOW()) AS fim
      FROM ev
     WHERE tipo <> 'APROVADO'
  ),

  primeiro_envio AS (
    SELECT id_startup, id_no, MIN(ts) AS ts
      FROM ev WHERE tipo = 'ENVIADA'
     GROUP BY id_startup, id_no
  ),

  -- Da entrada na fase ate o primeiro envio a bola e do incubado. Sem este
  -- trecho, o passo que ninguem nunca comecou nao custaria tempo a lado nenhum
  -- — e e justamente o caso mais comum de startup parada.
  trecho_inicial AS (
    SELECT j.id_startup, p.id_passo AS id_no, 'INCUBADO' AS dono,
           j.entrada_ts AS ini,
           COALESCE(pv.ts, j.fim_efetivo) AS fim
      FROM janela j
      JOIN passo p ON p.id_fase = j.id_fase AND p.permite_entrega
      LEFT JOIN primeiro_envio pv ON pv.id_startup = j.id_startup
                                 AND pv.id_no = p.id_passo
  ),

  -- Recorta tudo na janela da fase: um trecho que comecou antes da entrada
  -- (ou continua depois da saida) so conta o pedaco que caiu dentro dela.
  trecho AS (
    SELECT j.id_startup, j.id_fase, t.id_no, t.dono,
           GREATEST(t.ini, j.entrada_ts) AS ini,
           LEAST(t.fim, j.fim_efetivo)   AS fim
      FROM (SELECT * FROM trecho_evento
            UNION ALL
            SELECT * FROM trecho_inicial) t
      JOIN passo p  ON p.id_passo = t.id_no
      JOIN janela j ON j.id_fase = p.id_fase AND j.id_startup = t.id_startup
     WHERE t.fim > j.entrada_ts AND t.ini < j.fim_efetivo
  )
`

// Uniao dos trechos de um mesmo dono dentro da fase (gaps and islands): ordena
// por inicio, abre uma ilha nova sempre que o trecho comeca depois do maior fim
// ja visto, e mede cada ilha uma vez so. E o que impede tres entregas paradas
// ao mesmo tempo de virarem o triplo de atraso.
const SQL_UNIAO = `
  marcado AS (
    SELECT t.*,
           MAX(t.fim) OVER (PARTITION BY t.id_startup, t.id_fase, t.dono
                            ORDER BY t.ini, t.fim
                            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING)
             AS teto_anterior
      FROM trecho t
  ),
  ilha AS (
    SELECT m.*,
           COUNT(*) FILTER (WHERE m.teto_anterior IS NULL OR m.ini > m.teto_anterior)
             OVER (PARTITION BY m.id_startup, m.id_fase, m.dono
                   ORDER BY m.ini, m.fim ROWS UNBOUNDED PRECEDING) AS grupo
      FROM marcado m
  ),
  bloco AS (
    SELECT id_startup, id_fase, dono, MIN(ini) AS ini, MAX(fim) AS fim
      FROM ilha
     GROUP BY id_startup, id_fase, dono, grupo
  ),
  ocupacao AS (
    SELECT id_startup, id_fase,
           SUM(EXTRACT(EPOCH FROM (fim - ini))) FILTER (WHERE dono = 'INCUBADO')
             AS seg_incubado,
           SUM(EXTRACT(EPOCH FROM (fim - ini))) FILTER (WHERE dono = 'MENTOR')
             AS seg_mentor
      FROM bloco
     GROUP BY id_startup, id_fase
  )
`

/**
 * Uma linha por (startup, fase alcancada): quanto tempo esta ali e de quem e
 * a demora.
 *
 * @param {number} idTenant
 */
async function tempoPorFase(idTenant) {
  const { rows } = await query(
    `WITH ${SQL_JANELA},
     ${SQL_UNIAO},

     -- O que esta parado na fila AGORA: envio que ainda e o ultimo evento do
     -- passo. E o unico numero do relatorio que da para resolver hoje.
     espera_aberta AS (
       SELECT e.id_startup, p.id_fase,
              MIN(e.ts)  AS desde,
              COUNT(*)   AS passos
         FROM ev e
         JOIN passo p ON p.id_passo = e.id_no
        WHERE e.tipo = 'ENVIADA' AND e.prox_ts IS NULL
        GROUP BY e.id_startup, p.id_fase
     ),

     -- Idas e voltas: cada devolutiva pedindo correcao e um ciclo a mais.
     retrabalho AS (
       SELECT e.id_startup, p.id_fase, COUNT(*) AS devolucoes
         FROM ev e
         JOIN passo p ON p.id_passo = e.id_no
        WHERE e.tipo IN ('AJUSTE', 'REPROVADO')
        GROUP BY e.id_startup, p.id_fase
     )

     SELECT j.id_startup, j.startup, j.id_programa, j.programa,
            j.matricula_status,
            j.id_fase, j.fase, j.ordem,
            j.entrada_ts, j.saida_ts, j.concluida,
            j.entregaveis, j.aprovados,

            EXTRACT(EPOCH FROM (j.fim_efetivo - j.entrada_ts))::FLOAT AS seg_total,
            COALESCE(o.seg_incubado, 0)::FLOAT AS seg_incubado,
            COALESCE(o.seg_mentor, 0)::FLOAT   AS seg_mentor,

            -- Bloqueada = o relogio da fase menos o tempo em que havia ALGO na
            -- mao da startup. Sobra o periodo em que tudo que faltava estava
            -- na fila do mentor: atraso que nao da para cobrar do incubado.
            GREATEST(
              EXTRACT(EPOCH FROM (j.fim_efetivo - j.entrada_ts))
                - COALESCE(o.seg_incubado, 0),
              0
            )::FLOAT AS seg_bloqueada,

            ea.desde                        AS espera_desde_ts,
            COALESCE(ea.passos, 0)::INTEGER AS aguardando_agora,
            COALESCE(rt.devolucoes, 0)::INTEGER AS devolucoes

       FROM janela j
       LEFT JOIN ocupacao o      ON o.id_startup = j.id_startup AND o.id_fase = j.id_fase
       LEFT JOIN espera_aberta ea ON ea.id_startup = j.id_startup AND ea.id_fase = j.id_fase
       LEFT JOIN retrabalho rt    ON rt.id_startup = j.id_startup AND rt.id_fase = j.id_fase

      ORDER BY j.startup, j.programa, j.ordem`,
    [idTenant]
  )
  return rows
}

/**
 * Uma linha por PASSO da trilha: onde o tempo se perde no programa e de que
 * lado.
 *
 * Aqui a soma e direta, sem uniao de intervalos: um passo esta num estado so de
 * cada vez, entao os trechos de uma mesma dupla (startup, passo) nunca se
 * sobrepoem. A media e por startup que passou pelo passo — somar tudo faria o
 * passo mais antigo parecer o mais lento so por ter tido mais gente.
 *
 * @param {number} idTenant
 */
async function tempoPorPasso(idTenant) {
  const { rows } = await query(
    `WITH ${SQL_JANELA},

     por_startup AS (
       SELECT t.id_no, t.id_startup,
              SUM(EXTRACT(EPOCH FROM (t.fim - t.ini))) FILTER (WHERE t.dono = 'INCUBADO')
                AS seg_incubado,
              SUM(EXTRACT(EPOCH FROM (t.fim - t.ini))) FILTER (WHERE t.dono = 'MENTOR')
                AS seg_mentor
         FROM trecho t
        GROUP BY t.id_no, t.id_startup
     ),

     fila_agora AS (
       SELECT e.id_no, COUNT(*) AS parados, MIN(e.ts) AS mais_antigo
         FROM ev e
        WHERE e.tipo = 'ENVIADA' AND e.prox_ts IS NULL
        GROUP BY e.id_no
     ),

     devolvidos AS (
       SELECT e.id_no, COUNT(*) AS devolucoes
         FROM ev e
        WHERE e.tipo IN ('AJUSTE', 'REPROVADO')
        GROUP BY e.id_no
     )

     SELECT p.id_passo AS id_no, p.passo, p.modulo, p.obrigatoria,
            f.fase, f.ordem AS fase_ordem,

            COUNT(ps.id_startup)::INTEGER AS startups,
            AVG(COALESCE(ps.seg_incubado, 0))::FLOAT AS seg_incubado_medio,
            AVG(COALESCE(ps.seg_mentor, 0))::FLOAT   AS seg_mentor_medio,
            MAX(COALESCE(ps.seg_mentor, 0))::FLOAT   AS seg_mentor_maximo,

            COALESCE(MAX(fa.parados), 0)::INTEGER      AS aguardando_agora,
            MAX(fa.mais_antigo)                        AS espera_desde_ts,
            COALESCE(MAX(dv.devolucoes), 0)::INTEGER   AS devolucoes

       FROM passo p
       JOIN fase f ON f.id_fase = p.id_fase
       LEFT JOIN por_startup ps ON ps.id_no = p.id_passo
       LEFT JOIN fila_agora  fa ON fa.id_no = p.id_passo
       LEFT JOIN devolvidos  dv ON dv.id_no = p.id_passo

      WHERE p.permite_entrega
      GROUP BY p.id_passo, p.passo, p.modulo, p.obrigatoria, f.fase, f.ordem
      ORDER BY f.ordem, p.passo`,
    [idTenant]
  )
  return rows
}

module.exports = { tempoPorFase, tempoPorPasso }
