/**
 * Deduplicacao do ECO (docs/reunioes.md, secao 12, item 3).
 *
 * Quem fala sem fone pode ter a voz dos outros captada no proprio microfone.
 * O cancelamento de eco do navegador tira quase tudo, mas o que escapa sai
 * transcrito duas vezes: a mesma frase, no mesmo instante, em nome de duas
 * pessoas.
 *
 * O criterio e conservador de proposito — apagar fala de verdade e pior do que
 * deixar uma repeticao. So conta como eco:
 *   - pessoas diferentes;
 *   - os dois trechos ao mesmo tempo (comecam a ate 2 s um do outro, ou se
 *     sobrepoem em mais da metade do menor);
 *   - pelo menos 4 palavras cada;
 *   - o mesmo texto: 80% ou mais das palavras em comum (Jaccard).
 *
 * Fica o de MAIOR confianca do provedor (a voz que chegou limpa ao microfone
 * do proprio dono). Empate: fica o que comecou antes.
 *
 * Funcao pura: recebe os trechos, devolve os ids a apagar.
 */

const MIN_PALAVRAS = 4
const SIMILARIDADE_MIN = 0.8
const DISTANCIA_INICIO_MS = 2000

function palavras(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

function jaccard(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  let comum = 0
  for (const p of A) if (B.has(p)) comum += 1
  const uniao = A.size + B.size - comum
  return uniao ? comum / uniao : 0
}

function simultaneos(a, b) {
  if (Math.abs(a.inicio_ms - b.inicio_ms) <= DISTANCIA_INICIO_MS) return true
  const sobreposto = Math.min(a.fim_ms, b.fim_ms) - Math.max(a.inicio_ms, b.inicio_ms)
  const menor = Math.max(1, Math.min(a.fim_ms - a.inicio_ms, b.fim_ms - b.inicio_ms))
  return sobreposto > 0 && sobreposto / menor > 0.5
}

/** Qual dos dois sai: o de menor confianca; empate, o que comecou depois. */
function perdedor(a, b) {
  const ca = Number.isFinite(a.confianca) ? a.confianca : 0.5
  const cb = Number.isFinite(b.confianca) ? b.confianca : 0.5
  if (ca !== cb) return ca < cb ? a : b
  if (a.inicio_ms !== b.inicio_ms) return a.inicio_ms > b.inicio_ms ? a : b
  return Number(a.id_trecho) > Number(b.id_trecho) ? a : b
}

/**
 * @param {Array<{id_trecho: number|string, id_usuario: number, texto: string,
 *   confianca: number|null, inicio_ms: number, fim_ms: number}>} trechos
 * @returns {Array<number|string>} ids a apagar
 */
function acharEcos(trechos) {
  const lista = [...trechos]
    .map((t) => ({ ...t, _palavras: palavras(t.texto) }))
    .sort((a, b) => a.inicio_ms - b.inicio_ms)
  const apagar = new Set()

  for (let i = 0; i < lista.length; i++) {
    const a = lista[i]
    if (apagar.has(a.id_trecho) || a._palavras.length < MIN_PALAVRAS) continue
    for (let j = i + 1; j < lista.length; j++) {
      const b = lista[j]
      if (b.inicio_ms > a.fim_ms + DISTANCIA_INICIO_MS) break
      if (apagar.has(b.id_trecho) || b.id_usuario === a.id_usuario || b._palavras.length < MIN_PALAVRAS) continue
      if (!simultaneos(a, b)) continue
      if (jaccard(a._palavras, b._palavras) < SIMILARIDADE_MIN) continue
      const sai = perdedor(a, b)
      apagar.add(sai.id_trecho)
      if (sai === a) break
    }
  }
  return [...apagar]
}

module.exports = { acharEcos, palavras, jaccard }
