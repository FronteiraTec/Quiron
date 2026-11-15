/**
 * Service dos beneficios que a incubadora concede a cada startup (migracao 026).
 *
 * CONCEDER E REVOGAR SAO DA COORDENACAO: a chave `startups.beneficios.gerenciar`
 * no tenant DA STARTUP, mais o vinculo com ela (startupService.buscarComPermissao
 * — o mesmo par de eixos do resto do cadastro). O admin nasce com a chave; a
 * incubadora pode da-la a quem mais organiza o programa.
 *
 * REVOGAR NAO APAGA NADA. So desliga a flag: o CRM fecha para a startup na hora
 * (crmAcessoService confere o beneficio a cada pedido) e tudo que ela registrou
 * volta a aparecer quando o beneficio for concedido de novo.
 *
 * Quem concedeu e quem revogou, e quando, vai para o audit_log — o registro de
 * conformidade da incubadora, que e onde os atos da coordenacao moram.
 */
const { withTransaction } = require("../config/db")
const beneficioRepository = require("../repositories/beneficioRepository")
const crmEtapaRepository = require("../repositories/crmEtapaRepository")
const startupService = require("./startupService")
const auditLogService = require("./auditLogService")
const { CATALOGO_BENEFICIOS, CHAVES_BENEFICIO } = require("../beneficios/catalogo")
const { ETAPAS_PADRAO } = require("../crm/padroes")
const { erroNegocio } = require("../utils/erros")

/** O catalogo com o estado de cada beneficio nesta startup. */
function comEstado(linhas) {
  return CATALOGO_BENEFICIOS.map((b) => {
    const l = linhas.find((x) => x.beneficio === b.chave)
    return {
      ...b,
      ativo: Boolean(l?.ativo),
      ja_concedido: Boolean(l),
      concedido_ts: l?.concedido_ts ?? null,
      concedido_por_nome: l?.concedido_por_nome ?? null,
      revogado_ts: l?.revogado_ts ?? null,
      revogado_por_nome: l?.revogado_por_nome ?? null,
    }
  })
}

async function listarDaStartup(idStartup, usuario) {
  const startup = await startupService.buscarComPermissao(idStartup, usuario, "startups.beneficios.visualizar")
  return comEstado(await beneficioRepository.listarDaStartup(startup.id_startup))
}

/**
 * Liga ou desliga um beneficio. Pedir o estado em que ele ja esta nao e erro e
 * nao gera auditoria — o switch da tela pode ser clicado duas vezes.
 *
 * Na primeira concessao do CRM a startup ganha as etapas padrao do funil; na
 * re-concessao ela reencontra as dela.
 */
async function definir(idStartup, beneficio, ativo, usuario) {
  const catalogo = CATALOGO_BENEFICIOS.find((b) => b.chave === beneficio)
  if (!CHAVES_BENEFICIO.includes(beneficio) || !catalogo) throw erroNegocio(404, "Benefício não encontrado.")
  if (typeof ativo !== "boolean") throw erroNegocio(400, "Informe se o benefício fica ativo ou não.")

  const startup = await startupService.buscarComPermissao(idStartup, usuario, "startups.beneficios.gerenciar")
  const idUsuario = usuario?.id ?? null

  const mudou = await withTransaction(async (client) => {
    if (!ativo) return beneficioRepository.revogar(client, startup.id_startup, beneficio, idUsuario)
    const linha = await beneficioRepository.conceder(client, startup.id_startup, beneficio, idUsuario)
    if (linha && beneficio === "CRM") {
      await crmEtapaRepository.semearSeVazia(client, startup.id_startup, ETAPAS_PADRAO)
    }
    return linha
  })

  if (mudou) {
    await auditLogService.registrar({
      idTenant: startup.id_tenant,
      idUsuario,
      acao: ativo ? "CONCEDER" : "REVOGAR",
      entidade: "startup_beneficio",
      entidadeId: `${startup.id_startup}:${beneficio}`,
      descricao: ativo
        ? `Concedeu o benefício "${catalogo.nome}" à startup "${startup.nome}".`
        : `Revogou o benefício "${catalogo.nome}" da startup "${startup.nome}". Os dados foram preservados.`,
      dadosDepois: mudou,
    })
  }

  const linhas = await beneficioRepository.listarDaStartup(startup.id_startup)
  return comEstado(linhas).find((b) => b.chave === beneficio)
}

/**
 * Os beneficios ativos que a pessoa logada alcanca, como membro de startup.
 * Nao passa por RBAC: e o que ela mesma pode usar, como a Jornada.
 */
async function meus(idTenant, usuario) {
  const tenant = idTenant ? Number(idTenant) : null
  if (tenant !== null && (!Number.isInteger(tenant) || tenant <= 0)) {
    throw erroNegocio(400, "id_tenant inválido.")
  }
  if (!usuario?.id) return []
  return beneficioRepository.listarDoUsuario(usuario.id, tenant)
}

module.exports = { listarDaStartup, definir, meus }
