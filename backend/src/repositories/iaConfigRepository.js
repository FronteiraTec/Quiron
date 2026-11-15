/**
 * A configuracao de IA de cada incubadora (`tenant_ia_config`, migracao 028)
 * e a retencao das reunioes gravadas (colunas de `tenant`).
 *
 * A CHAVE DE API e cifrada AQUI, no repositorio — como os tokens do Google
 * (googleAgendaRepository) —, com o contexto `ia:<id_tenant>:<finalidade>`
 * como dado autenticado. Fora deste arquivo so existem duas formas dela:
 * em texto, dentro do lote noturno e do "testar conexao"; e os 4 ultimos
 * caracteres (`chave_final`), que e o que a tela mostra.
 */
const { query } = require("../config/db")
const { instante } = require("../crm/sql")
const { cifrar, decifrar } = require("../utils/cripto")

const contexto = (idTenant, finalidade) => `ia:${Number(idTenant)}:${finalidade}`

/** Tudo menos a chave cifrada. */
const COLUNAS_PUBLICAS = `
  c.id_tenant, c.finalidade, c.provedor, c.modelo, c.url_base, c.chave_final, c.prompt_personalizado, c.ativo,
  ${instante("c.ultima_validacao_ts", "ultima_validacao_ts")},
  c.ultima_validacao_ok, c.ultima_validacao_erro,
  c.atualizado_por, u.nome AS atualizado_por_nome,
  ${instante("c.atualizado_ts", "atualizado_ts")}
`

/** As configuracoes da incubadora, SEM a chave. */
async function listar(idTenant) {
  const { rows } = await query(
    `SELECT ${COLUNAS_PUBLICAS}
       FROM tenant_ia_config c
       LEFT JOIN usuarios u ON u.id_usuario = c.atualizado_por
      WHERE c.id_tenant = $1
      ORDER BY c.finalidade`,
    [idTenant]
  )
  return rows
}

/** Uma configuracao, SEM a chave. */
async function buscar(idTenant, finalidade) {
  const { rows } = await query(
    `SELECT ${COLUNAS_PUBLICAS}
       FROM tenant_ia_config c
       LEFT JOIN usuarios u ON u.id_usuario = c.atualizado_por
      WHERE c.id_tenant = $1 AND c.finalidade = $2::iaFinalidade`,
    [idTenant, finalidade]
  )
  return rows[0]
}

/**
 * A configuracao COM a chave em texto — so para chamar o provedor. `chave`
 * vem null se o pacote nao decifra (SECRET_KEY trocada, linha copiada).
 */
async function buscarComChave(idTenant, finalidade) {
  const { rows } = await query(
    `SELECT c.id_tenant, c.finalidade, c.provedor, c.modelo, c.url_base, c.prompt_personalizado, c.ativo, c.chave_cifrada
       FROM tenant_ia_config c
      WHERE c.id_tenant = $1 AND c.finalidade = $2::iaFinalidade`,
    [idTenant, finalidade]
  )
  if (!rows[0]) return undefined
  const { chave_cifrada: pacote, ...resto } = rows[0]
  return { ...resto, chave: decifrar(pacote, contexto(idTenant, finalidade)) }
}

/**
 * Grava a configuracao. `chave` undefined/vazia = mantem a atual (a tela nunca
 * recebe a chave de volta, entao salvar sem redigitar nao pode apaga-la).
 *
 * Sao dois caminhos, e nao um upsert so: o INSERT ... ON CONFLICT confere o
 * NOT NULL da linha proposta ANTES de achar o conflito, e a linha sem chave
 * seria recusada mesmo quando ja existe uma com chave. Quem chama garante que
 * a linha existe quando nao manda a chave (iaConfigService.salvar).
 *
 * Trocar provedor, modelo, endereco ou chave invalida o ultimo teste de
 * conexao: o "funcionou" antigo nao vale para a configuracao nova.
 */
async function salvar({ idTenant, finalidade, provedor, modelo, urlBase, chave, promptPersonalizado, ativo, idUsuario }) {
  if (chave) {
    await query(
      `INSERT INTO tenant_ia_config
         (id_tenant, finalidade, provedor, modelo, url_base, chave_cifrada, chave_final, prompt_personalizado, ativo, atualizado_por)
       VALUES ($1, $2::iaFinalidade, $3::iaProvedor, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id_tenant, finalidade) DO UPDATE
          SET provedor = EXCLUDED.provedor,
              modelo = EXCLUDED.modelo,
              url_base = EXCLUDED.url_base,
              chave_cifrada = EXCLUDED.chave_cifrada,
              chave_final = EXCLUDED.chave_final,
              prompt_personalizado = EXCLUDED.prompt_personalizado,
              ativo = EXCLUDED.ativo,
              atualizado_por = EXCLUDED.atualizado_por,
              atualizado_ts = NOW(),
              ultima_validacao_ts = NULL,
              ultima_validacao_ok = NULL,
              ultima_validacao_erro = NULL`,
      [
        idTenant,
        finalidade,
        provedor,
        modelo,
        urlBase ?? null,
        cifrar(chave, contexto(idTenant, finalidade)),
        String(chave).slice(-4),
        promptPersonalizado ?? null,
        ativo,
        idUsuario ?? null,
      ]
    )
    return
  }

  await query(
    `UPDATE tenant_ia_config c
        SET provedor = $3::iaProvedor,
            modelo = $4,
            url_base = $5,
            prompt_personalizado = $6,
            ativo = $7,
            atualizado_por = $8,
            atualizado_ts = NOW(),
            ultima_validacao_ts = CASE WHEN mudou THEN NULL ELSE c.ultima_validacao_ts END,
            ultima_validacao_ok = CASE WHEN mudou THEN NULL ELSE c.ultima_validacao_ok END,
            ultima_validacao_erro = CASE WHEN mudou THEN NULL ELSE c.ultima_validacao_erro END
       FROM (
         SELECT (provedor <> $3::iaProvedor OR modelo <> $4 OR url_base IS DISTINCT FROM $5) AS mudou
           FROM tenant_ia_config WHERE id_tenant = $1 AND finalidade = $2::iaFinalidade
       ) antes
      WHERE c.id_tenant = $1 AND c.finalidade = $2::iaFinalidade`,
    [idTenant, finalidade, provedor, modelo, urlBase ?? null, promptPersonalizado ?? null, ativo, idUsuario ?? null]
  )
}

/** Ha linha para esta finalidade (com chave)? */
async function existe(idTenant, finalidade) {
  const { rows } = await query(
    `SELECT 1 FROM tenant_ia_config WHERE id_tenant = $1 AND finalidade = $2::iaFinalidade`,
    [idTenant, finalidade]
  )
  return rows.length > 0
}

async function registrarValidacao(idTenant, finalidade, { ok, erro }) {
  await query(
    `UPDATE tenant_ia_config
        SET ultima_validacao_ts = NOW(), ultima_validacao_ok = $3, ultima_validacao_erro = $4
      WHERE id_tenant = $1 AND finalidade = $2::iaFinalidade`,
    [idTenant, finalidade, ok, erro ?? null]
  )
}

/** A transcricao esta ligada nesta incubadora? (decide se a sala grava) */
async function transcricaoAtiva(idTenant) {
  const { rows } = await query(
    `SELECT provedor FROM tenant_ia_config
      WHERE id_tenant = $1 AND finalidade = 'TRANSCRICAO' AND ativo`,
    [idTenant]
  )
  return rows[0]?.provedor || null
}

// ---------------------------------------------------------------------------
// RETENCAO
// ---------------------------------------------------------------------------

async function buscarRetencao(idTenant) {
  const { rows } = await query(
    `SELECT reuniao_retencao_audio_dias AS audio_dias, reuniao_retencao_transcricao_dias AS transcricao_dias
       FROM tenant WHERE id_tenant = $1`,
    [idTenant]
  )
  return rows[0]
}

async function salvarRetencao(idTenant, { audioDias, transcricaoDias }) {
  await query(
    `UPDATE tenant SET reuniao_retencao_audio_dias = $2, reuniao_retencao_transcricao_dias = $3, atualizado_ts = NOW()
      WHERE id_tenant = $1`,
    [idTenant, audioDias, transcricaoDias]
  )
}

module.exports = {
  contexto,
  listar,
  buscar,
  buscarComChave,
  salvar,
  existe,
  registrarValidacao,
  transcricaoAtiva,
  buscarRetencao,
  salvarRetencao,
}
