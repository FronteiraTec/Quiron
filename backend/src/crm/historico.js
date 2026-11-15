/**
 * As frases e as comparacoes do historico do CRM — funcoes puras, sem banco.
 *
 * Quem grava o evento e o service, na transacao da escrita; este modulo so
 * responde "o que mudou?" e "como se diz isso?". Separado para ser testado sem
 * Postgres (test/crmHistorico.test.js).
 *
 * A FRASE COMECA PELO VERBO, sem o nome de quem fez: "alterou o valor estimado
 * de R$ 2.000,00 para R$ 3.500,00". A tela escreve o autor na frente, em
 * negrito. Assim a mesma frase serve na linha do tempo, no painel e numa
 * exportacao.
 */
const { ROTULO_STATUS_CLIENTE, ROTULO_TIPO_PESSOA, ROTULO_PRIORIDADE } = require("./padroes")

/** 2000 -> "R$ 2.000,00". Sem Intl de proposito: a frase nao pode depender do ICU da imagem. */
function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === "") return "—"
  const n = Number(valor)
  if (!Number.isFinite(n)) return String(valor)
  const [inteiro, centavos] = Math.abs(n).toFixed(2).split(".")
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${n < 0 ? "-" : ""}R$ ${milhar},${centavos}`
}

/** "2026-11-05" -> "05/11/2026". Pelo texto: e uma DATA, nao um instante. */
function formatarData(valor) {
  if (!valor) return "—"
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-")
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(valor)
}

/** Entre aspas e numa linha so, cortado se for longo demais para uma frase. */
function citar(texto, limite = 120) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim()
  return `"${t.length > limite ? `${t.slice(0, limite - 1)}…` : t}"`
}

/**
 * Os campos da oportunidade que viram evento OPORTUNIDADE_ALTERADA, um por
 * campo. `longo` = texto de varios paragrafos: a frase diz que mudou, e o
 * antes/depois fica nos dados do evento (a tela abre se a pessoa quiser ler).
 *
 * Responsavel, cliente e etapa NAO estao aqui: tem tipo de evento proprio,
 * porque o que importa neles e o NOME, nao o id.
 */
const CAMPOS_OPORTUNIDADE = {
  titulo: { artigo: "o nome", formato: (v) => citar(v) },
  descricao: { artigo: "a descrição", longo: true },
  valor_estimado: { artigo: "o valor estimado", formato: formatarMoeda, numero: true },
  probabilidade: { artigo: "a probabilidade de conversão", formato: (v) => `${v}%`, numero: true },
  previsao_fechamento: { artigo: "a previsão de fechamento", formato: formatarData, data: true },
  origem: { artigo: "a origem", formato: (v) => citar(v) },
  observacoes: { artigo: "as observações", longo: true },
}

/** O nome de cada campo do cliente, para a frase "atualizou o cadastro: ...". */
const CAMPOS_CLIENTE = {
  nome: { rotulo: "nome" },
  tipo_pessoa: { rotulo: "tipo de pessoa", formato: (v) => ROTULO_TIPO_PESSOA[v] || v },
  documento: { rotulo: "documento" },
  email: { rotulo: "e-mail" },
  telefone: { rotulo: "telefone" },
  whatsapp: { rotulo: "WhatsApp" },
  empresa: { rotulo: "empresa" },
  cargo: { rotulo: "cargo" },
  origem: { rotulo: "origem" },
  status: { rotulo: "status", formato: (v) => ROTULO_STATUS_CLIENTE[v] || v },
  observacoes: { rotulo: "observações" },
}

/** Os campos editaveis da tarefa (o status muda por outro caminho). */
const CAMPOS_TAREFA = {
  titulo: { rotulo: "título" },
  descricao: { rotulo: "descrição" },
  id_responsavel: { rotulo: "responsável", numero: true },
  vencimento_ts: { rotulo: "prazo", instante: true },
  prioridade: { rotulo: "prioridade", formato: (v) => ROTULO_PRIORIDADE[v] || v },
}

/**
 * O valor na forma em que se compara: vazio e sempre `null`, numero e numero,
 * data e "AAAA-MM-DD", instante e ISO em UTC. Sem isso, "2000" e 2000.00, ou
 * "" e null, apareceriam no historico como alteracoes que ninguem fez.
 */
function normalizar(valor, def = {}) {
  if (valor === undefined || valor === null || valor === "") return null
  if (def.numero) {
    const n = Number(valor)
    return Number.isFinite(n) ? n : null
  }
  if (def.instante) {
    const ms = valor instanceof Date ? valor.getTime() : Date.parse(valor)
    return Number.isNaN(ms) ? null : new Date(ms).toISOString()
  }
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (def.data) return String(valor).slice(0, 10)
  const texto = String(valor).trim()
  return texto === "" ? null : texto
}

/**
 * O que mudou entre `antes` e `depois`, campo a campo, dentro do conjunto
 * `campos`. So entra campo PRESENTE em `depois`: ausente significa "nao mexi",
 * e isso nao pode virar "apagou".
 *
 * @returns {Array<{campo: string, antes: any, depois: any}>}
 */
function diferencas(antes, depois, campos) {
  const lista = []
  for (const [campo, def] of Object.entries(campos)) {
    if (!(campo in depois)) continue
    const a = normalizar(antes?.[campo], def)
    const d = normalizar(depois[campo], def)
    if (a !== d) lista.push({ campo, antes: a, depois: d })
  }
  return lista
}

/** A frase de UMA alteracao de campo da oportunidade. */
function descreverCampoOportunidade({ campo, antes, depois }) {
  const def = CAMPOS_OPORTUNIDADE[campo]
  if (!def) return `alterou ${campo}`
  if (def.longo) {
    if (antes === null) return `adicionou ${def.artigo}`
    if (depois === null) return `removeu ${def.artigo}`
    return `alterou ${def.artigo}`
  }
  const f = def.formato || String
  if (antes === null) return `definiu ${def.artigo}: ${f(depois)}`
  if (depois === null) return `removeu ${def.artigo} (era ${f(antes)})`
  return `alterou ${def.artigo} de ${f(antes)} para ${f(depois)}`
}

/** "Ana" -> "Bruno", com os casos de quem nao tinha ou deixou de ter. */
function descreverResponsavel(nomeAntes, nomeDepois) {
  if (!nomeAntes) return `definiu ${nomeDepois} como responsável`
  if (!nomeDepois) return `removeu o responsável (era ${nomeAntes})`
  return `alterou o responsável de ${nomeAntes} para ${nomeDepois}`
}

/**
 * A frase da edicao do cadastro do cliente. Um evento so por edicao, listando
 * os campos: no cliente o que importa e "mexeram no cadastro", e um evento por
 * telefone trocado encheria a linha do tempo de ruido. O status, que conta a
 * historia do relacionamento, sai por extenso.
 */
function descreverCliente(difs) {
  const status = difs.find((d) => d.campo === "status")
  const outros = difs.filter((d) => d.campo !== "status").map((d) => CAMPOS_CLIENTE[d.campo]?.rotulo || d.campo)
  const fmt = CAMPOS_CLIENTE.status.formato
  const partes = []
  if (outros.length) partes.push(`atualizou o cadastro (${juntar(outros)})`)
  if (status) {
    const frase = `alterou o status de ${fmt(status.antes) || "—"} para ${fmt(status.depois) || "—"}`
    partes.push(partes.length ? frase.replace("alterou", "e alterou") : frase)
  }
  return partes.join(" ")
}

/** A frase da edicao de uma tarefa: o titulo e o que mudou nela. */
function descreverTarefaEditada(titulo, difs) {
  const nomes = difs.map((d) => CAMPOS_TAREFA[d.campo]?.rotulo || d.campo)
  return `editou a tarefa ${citar(titulo)} (${juntar(nomes)})`
}

/** ["a", "b", "c"] -> "a, b e c". */
function juntar(itens) {
  if (itens.length <= 1) return itens.join("")
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`
}

/**
 * Um objeto so com os campos alterados, de um lado ou do outro — o que vai em
 * dados_anteriores / dados_novos do evento.
 */
function lados(difs) {
  const antes = {}
  const depois = {}
  for (const d of difs) {
    antes[d.campo] = d.antes
    depois[d.campo] = d.depois
  }
  return { antes, depois }
}

module.exports = {
  CAMPOS_OPORTUNIDADE,
  CAMPOS_CLIENTE,
  CAMPOS_TAREFA,
  formatarMoeda,
  formatarData,
  citar,
  normalizar,
  diferencas,
  descreverCampoOportunidade,
  descreverResponsavel,
  descreverCliente,
  descreverTarefaEditada,
  juntar,
  lados,
}
