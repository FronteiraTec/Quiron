/**
 * Os beneficios que a incubadora pode conceder a uma startup.
 *
 * Espelho do enum `beneficioTipo` (migracao 026), com o que a tela de
 * concessao mostra. Um beneficio novo entra nos dois lugares e traz o codigo
 * que ele libera — sem codigo atras, nao e beneficio, e so um rotulo.
 */
const CATALOGO_BENEFICIOS = [
  {
    chave: "CRM",
    nome: "Mini CRM",
    descricao:
      "Gestão comercial da startup: carteira de clientes, oportunidades num funil, " +
      "tarefas de venda e o histórico de cada negociação.",
  },
]

const CHAVES_BENEFICIO = CATALOGO_BENEFICIOS.map((b) => b.chave)

module.exports = { CATALOGO_BENEFICIOS, CHAVES_BENEFICIO }
