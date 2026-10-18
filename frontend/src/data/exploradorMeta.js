/**
 * O explorador da biblioteca pessoal do mentor (migracao 025): a arvore de
 * pastas e o que cada visao mostra, montados no navegador.
 *
 * A biblioteca vem inteira do servidor (materiais + pastas) e a navegacao entre
 * pastas nao volta a ele — como nas outras listagens do sistema, que filtram em
 * memoria. Quem decide e o servidor; aqui so se arruma o que ja chegou.
 *
 * Funcoes puras, testadas em exploradorMeta.test.js.
 */
import { formatoDoMaterial, normalizarBusca } from "./espacoMentorMeta"

/** A visao especial dos arquivados (nao e uma pasta: os arquivados de todas). */
export const ARQUIVADOS = "arquivados"

/** O teto do nome de pasta, igual ao do backend (mentores/pastas.js). */
export const MAX_NOME_PASTA = 120

/** A chave de um item na selecao: pastas e materiais tem ids de tabelas diferentes. */
export const chaveDe = (item) => (item.id_pasta !== undefined && item.id_material === undefined ? `p:${item.id_pasta}` : `m:${item.id_material}`)
export const ehPasta = (item) => item?.id_material === undefined && item?.id_pasta !== undefined

/** Separa uma lista de chaves nos ids que POST /mover espera. */
export function separarChaves(chaves = []) {
  const pastas = []
  const materiais = []
  for (const chave of chaves) {
    const [tipo, id] = String(chave).split(":")
    if (tipo === "p") pastas.push(Number(id))
    else if (tipo === "m") materiais.push(Number(id))
  }
  return { pastas, materiais }
}

const paiDe = (pasta) => (pasta.id_pasta_pai === null || pasta.id_pasta_pai === undefined ? null : Number(pasta.id_pasta_pai))
const pastaDoMaterial = (m) => (m.id_pasta === null || m.id_pasta === undefined ? null : Number(m.id_pasta))

/** As pastas diretamente dentro de `idPasta` (null = raiz), por nome. */
export function subpastas(pastas = [], idPasta = null) {
  return pastas.filter((p) => paiDe(p) === idPasta).sort(porNome)
}

/**
 * O caminho da raiz ate a pasta, inclusive: [Pitch, Modelos]. Pasta que nao
 * existe (excluida em outra aba) vira caminho vazio — a tela volta para a raiz.
 */
export function caminhoDaPasta(pastas = [], idPasta) {
  if (idPasta === null || idPasta === undefined) return []
  const porId = new Map(pastas.map((p) => [Number(p.id_pasta), p]))
  const caminho = []
  const vistos = new Set()
  for (let atual = Number(idPasta); atual !== null && porId.has(atual) && !vistos.has(atual); ) {
    vistos.add(atual)
    const pasta = porId.get(atual)
    caminho.unshift(pasta)
    atual = paiDe(pasta)
  }
  return caminho.length && Number(caminho[caminho.length - 1].id_pasta) === Number(idPasta) ? caminho : []
}

/** O caminho legivel: "Minha biblioteca › Pitch › Modelos". */
export function rotuloDoLocal(pastas, idPasta, raiz = "Minha biblioteca") {
  return [raiz, ...caminhoDaPasta(pastas, idPasta).map((p) => p.nome)].join(" › ")
}

/** A pasta e todas as que estao dentro dela, em qualquer nivel. */
export function descendentes(pastas = [], idPasta) {
  const ids = new Set([idPasta === null ? null : Number(idPasta)])
  let mudou = true
  while (mudou) {
    mudou = false
    for (const p of pastas) {
      const id = Number(p.id_pasta)
      if (!ids.has(id) && ids.has(paiDe(p))) {
        ids.add(id)
        mudou = true
      }
    }
  }
  return ids
}

/**
 * Da para soltar estes itens nesta pasta? Uma pasta nao vai para dentro dela
 * mesma, nem de uma descendente; e soltar onde ja esta nao e movimento. O
 * servidor confere de novo — isto so evita oferecer o que ele recusaria.
 */
export function podeSoltar(pastas, itens, destino) {
  if (!itens.length) return false
  const alvo = destino === null || destino === undefined ? null : Number(destino)
  let algumMuda = false
  for (const item of itens) {
    if (ehPasta(item)) {
      if (alvo !== null && descendentes(pastas, item.id_pasta).has(alvo)) return false
      if (paiDe(item) !== alvo) algumMuda = true
    } else if (pastaDoMaterial(item) !== alvo) {
      algumMuda = true
    }
  }
  return algumMuda
}

/** Quantos itens estao DIRETAMENTE dentro da pasta (o aviso antes de excluir). */
export function contarConteudo(pastas = [], materiais = [], idPasta) {
  const id = Number(idPasta)
  return {
    pastas: pastas.filter((p) => paiDe(p) === id).length,
    materiais: materiais.filter((m) => pastaDoMaterial(m) === id).length,
  }
}

/**
 * O primeiro nome livre entre as irmas: "Nova pasta", "Nova pasta (2)"... O
 * mesmo do backend (mentores/pastas.nomeLivre), para que o nome que a tela
 * propoe seja o que o servidor aceita.
 */
export function nomeLivre(nome, existentes = []) {
  const usados = new Set(existentes.map((n) => String(n).toLowerCase()))
  if (!usados.has(nome.toLowerCase())) return nome
  for (let n = 2; ; n += 1) {
    const sufixo = ` (${n})`
    const candidato = `${nome.slice(0, MAX_NOME_PASTA - sufixo.length)}${sufixo}`
    if (!usados.has(candidato.toLowerCase())) return candidato
  }
}

const porNome = (a, b) => nomeDoItem(a).localeCompare(nomeDoItem(b), "pt-BR", { numeric: true, sensitivity: "base" })

/** O nome que o item mostra: o da pasta, ou o titulo do material. */
export const nomeDoItem = (item) => (ehPasta(item) ? item.nome : item.titulo) || ""

/** Os campos pelos quais a visao ordena. Pastas sempre antes, como no Windows. */
export const ORDENACOES = {
  nome: { rotulo: "Nome", valor: (i) => nomeDoItem(i) },
  atualizado: { rotulo: "Data de modificação", valor: (i) => new Date(i.atualizado_ts || 0).getTime() },
  tipo: { rotulo: "Tipo", valor: (i) => (ehPasta(i) ? "" : formatoDoMaterial(i)) },
  tamanho: { rotulo: "Tamanho", valor: (i) => (ehPasta(i) ? -1 : Number(i.arquivo_tamanho) || 0) },
}

export function ordenarItens(itens = [], { campo = "nome", direcao = "asc" } = {}) {
  const criterio = ORDENACOES[campo] || ORDENACOES.nome
  const sinal = direcao === "desc" ? -1 : 1
  return [...itens].sort((a, b) => {
    const pa = ehPasta(a)
    const pb = ehPasta(b)
    if (pa !== pb) return pa ? -1 : 1
    const va = criterio.valor(a)
    const vb = criterio.valor(b)
    const comparacao =
      typeof va === "string" ? va.localeCompare(vb, "pt-BR", { numeric: true, sensitivity: "base" }) : va - vb
    return comparacao * sinal || porNome(a, b)
  })
}

/** Ha busca ou filtro? Entao a visao deixa de ser "a pasta" e vira resultado. */
export function temBuscaOuFiltro(busca, filtros = {}) {
  return Boolean(
    normalizarBusca(busca) ||
      filtros.categoria?.length ||
      filtros.formato?.length ||
      filtros.compartilhado
  )
}

/**
 * O que a visao mostra.
 *
 *   pasta comum      as subpastas e os materiais ATIVOS dela.
 *   ARQUIVADOS       os materiais arquivados de toda a biblioteca.
 *   busca/filtro     o resultado na pasta atual E EM TODAS as de dentro, como
 *                    a pesquisa do Windows. Filtro e de material (categoria,
 *                    tipo, compartilhamento): com filtro, pasta nao entra.
 *
 * @returns {{ itens: object[], plana: boolean }} `plana` diz que os itens
 *   vem de varias pastas — a tela mostra onde cada um esta.
 */
export function itensDaVisao({ pastas = [], materiais = [], pasta = null, busca = "", filtros = {} }) {
  const termo = normalizarBusca(busca)
  const filtrando = temBuscaOuFiltro(busca, filtros)
  const arquivados = pasta === ARQUIVADOS

  const casaMaterial = (m) => {
    if (filtros.categoria?.length && !filtros.categoria.includes(m.categoria || "")) return false
    if (filtros.formato?.length && !filtros.formato.includes(formatoDoMaterial(m))) return false
    if (filtros.compartilhado === "SIM" && !(m.total_compartilhamentos > 0)) return false
    if (filtros.compartilhado === "NAO" && m.total_compartilhamentos > 0) return false
    if (termo && !normalizarBusca(`${m.titulo} ${m.descricao || ""} ${m.arquivo_nome || ""}`).includes(termo)) {
      return false
    }
    return true
  }

  if (arquivados) {
    return { itens: materiais.filter((m) => m.arquivado && casaMaterial(m)), plana: true }
  }

  const ativos = materiais.filter((m) => !m.arquivado)
  if (!filtrando) {
    return {
      itens: [...subpastas(pastas, pasta), ...ativos.filter((m) => pastaDoMaterial(m) === pasta)],
      plana: false,
    }
  }

  const dentro = descendentes(pastas, pasta)
  const filtroDeMaterial = filtros.categoria?.length || filtros.formato?.length || filtros.compartilhado
  const pastasAchadas = filtroDeMaterial
    ? []
    : pastas.filter((p) => Number(p.id_pasta) !== pasta && dentro.has(paiDe(p)) && normalizarBusca(p.nome).includes(termo))
  return {
    itens: [...pastasAchadas, ...ativos.filter((m) => dentro.has(pastaDoMaterial(m)) && casaMaterial(m))],
    plana: true,
  }
}

// ---------------------------------------------------------------------------
// PRE-VISUALIZACAO
// ---------------------------------------------------------------------------

const MIMES_DOCX = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
const MIMES_XLSX = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]

/**
 * Como o visualizador mostra o material, ou null quando o navegador nao tem
 * como desenha-lo (apresentacao, .doc e .xls antigos): ai a tela oferece
 * baixar.
 *
 *   IMAGEM   <img> do blob
 *   PDF      paginas desenhadas pelo pdf.js (o CSP da borda nao deixa um
 *            <iframe> de blob:, e o visualizador nativo nem sempre existe)
 *   DOCX     docx-preview
 *   PLANILHA read-excel-file (.xlsx) ou o proprio texto (.csv)
 *   TEXTO    o texto, editavel
 *   LINK     o endereco, para abrir numa aba
 */
export function tipoDePrevia(material) {
  if (!material) return null
  if (material.tipo === "LINK") return "LINK"
  const mime = String(material.arquivo_mime || "").toLowerCase()
  if (mime.startsWith("image/")) return "IMAGEM"
  if (mime === "application/pdf") return "PDF"
  if (MIMES_DOCX.includes(mime)) return "DOCX"
  if (MIMES_XLSX.includes(mime)) return "XLSX"
  if (mime === "text/csv") return "CSV"
  if (mime === "text/plain") return "TEXTO"
  return null
}

/** O conteudo se edita aqui mesmo? So texto: o resto se troca por versao nova. */
export const editavelNoNavegador = (material) => ["TEXTO", "CSV"].includes(tipoDePrevia(material))

/**
 * Le um CSV — com aspas, aspas dobradas e quebra de linha dentro do campo —,
 * descobrindo o separador pela primeira linha: o Excel em portugues grava com
 * ";", o resto do mundo com ",".
 */
export function lerCsv(texto = "") {
  const primeira = texto.split(/\r?\n/, 1)[0] || ""
  const contar = (c) => primeira.split(c).length - 1
  const separador = [";", ",", "\t"].reduce((melhor, c) => (contar(c) > contar(melhor) ? c : melhor), ",")

  const linhas = []
  let linha = []
  let campo = ""
  let aspas = false
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i]
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i += 1
      } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === separador) {
      linha.push(campo)
      campo = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i += 1
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ""
    } else campo += c
  }
  if (campo || linha.length) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas
}

/** "A", "B", ..., "Z", "AA" — o cabecalho de coluna da planilha. */
export function letraDaColuna(indice) {
  let n = indice + 1
  let s = ""
  while (n > 0) {
    const resto = (n - 1) % 26
    s = String.fromCharCode(65 + resto) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
