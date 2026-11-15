/**
 * O vocabulario do Mini CRM (migracao 026): as etapas com que o funil nasce e
 * os valores fechados que o backend aceita.
 *
 * As listas abaixo sao espelho dos enums do banco. Ficam aqui tambem porque o
 * service valida ANTES de chegar no banco: um valor errado vira 400 com uma
 * frase que a pessoa entende, e nao um 500 de "invalid input value for enum".
 */

/**
 * As etapas ABERTAS do funil, semeadas na primeira concessao do CRM a uma
 * startup. Ganho e Perdido nao estao aqui: sao a situacao da oportunidade, nao
 * uma etapa (ver o cabecalho da migracao).
 *
 * As cores vao do cinza (ainda frio) ao ambar (perto de fechar): o quadro le
 * da esquerda para a direita como um termometro.
 */
const ETAPAS_PADRAO = [
  { nome: "Sem contato", cor: "#94a3b8" },
  { nome: "Contato feito", cor: "#64748b" },
  { nome: "Identificação do interesse", cor: "#0ea5e9" },
  { nome: "Apresentação", cor: "#3b88c3" },
  { nome: "Proposta enviada", cor: "#8b5cf6" },
  { nome: "Negociação", cor: "#f59e0b" },
]

const TIPOS_PESSOA = ["PF", "PJ"]
const STATUS_CLIENTE = ["LEAD", "ATIVO", "INATIVO"]
const SITUACOES = ["ABERTA", "GANHA", "PERDIDA"]
const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA"]
const STATUS_TAREFA = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]

/** Status em que a tarefa ainda pede trabalho (conta como pendente/atrasada). */
const STATUS_TAREFA_ABERTA = ["PENDENTE", "EM_ANDAMENTO"]

/** Os registros manuais da linha do tempo: o que a pessoa escreve, nao o sistema. */
const ATIVIDADES_MANUAIS = ["ANOTACAO", "CONTATO", "REUNIAO"]

/** Por onde o contato aconteceu (metadados.canal de um evento CONTATO). */
const CANAIS_CONTATO = ["TELEFONE", "WHATSAPP", "EMAIL", "PRESENCIAL", "OUTRO"]

/** Origens sugeridas no cadastro, alem das que a startup ja usa. */
const ORIGENS_SUGERIDAS = [
  "Indicação",
  "Site",
  "Redes sociais",
  "Evento",
  "Prospecção ativa",
  "WhatsApp",
]

const ROTULO_STATUS_CLIENTE = { LEAD: "Lead", ATIVO: "Cliente ativo", INATIVO: "Inativo" }
const ROTULO_TIPO_PESSOA = { PF: "Pessoa física", PJ: "Pessoa jurídica" }
const ROTULO_PRIORIDADE = { BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta" }
const ROTULO_STATUS_TAREFA = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
}
const ROTULO_CANAL = {
  TELEFONE: "telefone",
  WHATSAPP: "WhatsApp",
  EMAIL: "e-mail",
  PRESENCIAL: "presencial",
  OUTRO: "outro canal",
}

module.exports = {
  ETAPAS_PADRAO,
  TIPOS_PESSOA,
  STATUS_CLIENTE,
  SITUACOES,
  PRIORIDADES,
  STATUS_TAREFA,
  STATUS_TAREFA_ABERTA,
  ATIVIDADES_MANUAIS,
  CANAIS_CONTATO,
  ORIGENS_SUGERIDAS,
  ROTULO_STATUS_CLIENTE,
  ROTULO_TIPO_PESSOA,
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_TAREFA,
  ROTULO_CANAL,
}
