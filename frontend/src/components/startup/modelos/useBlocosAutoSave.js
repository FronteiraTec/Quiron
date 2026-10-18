/**
 * Estado e salvamento automatico dos modelos de texto livre por bloco (o
 * Business Model Canvas e a Analise SWOT).
 *
 * Carrega o mapa chave -> conteudo, salva cada bloco com debounce enquanto a
 * pessoa digita (ou na hora, ao sair do campo) e guarda o status de cada um:
 * saving | saved | error.
 *
 * As duas APIs tem o mesmo formato: GET `endpoint` devolve `{ [lista]: [{ [campo], conteudo }] }`
 * e PUT `${endpoint}/${chave}` recebe `{ conteudo }`.
 */
import { useEffect, useRef, useState } from "react"
import api from "../../../services/api"

const ATRASO_AUTOSAVE_MS = 900

/**
 * @param {string} endpoint - ex.: `/startups/12/canvas`.
 * @param {{ lista: string, campo: string, erroCarregar: string }} formato -
 *   a chave da lista na resposta do GET, o campo que identifica cada bloco e a
 *   mensagem quando o GET falha sem erro da API.
 */
export function useBlocosAutoSave(endpoint, { lista, campo, erroCarregar }) {
  const [blocos, setBlocos] = useState({})
  const [statusBlocos, setStatusBlocos] = useState({}) // chave -> saving | saved | error
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  const timersRef = useRef({}) // debounce por bloco
  const salvosRef = useRef({}) // ultimo conteudo confirmado no servidor

  useEffect(() => {
    setCarregando(true)
    api
      .get(endpoint)
      .then(({ data }) => {
        const mapa = {}
        data[lista].forEach((b) => (mapa[b[campo]] = b.conteudo))
        setBlocos(mapa)
        salvosRef.current = { ...mapa }
      })
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || erroCarregar }))
      .finally(() => setCarregando(false))
  }, [endpoint, lista, campo, erroCarregar])

  // Limpa os debounces pendentes ao desmontar.
  useEffect(() => () => Object.values(timersRef.current).forEach(clearTimeout), [])

  const salvarBloco = async (chave, conteudo) => {
    if ((salvosRef.current[chave] || "") === conteudo) {
      setStatusBlocos((s) => ({ ...s, [chave]: "saved" }))
      return
    }
    try {
      await api.put(`${endpoint}/${chave}`, { conteudo })
      salvosRef.current[chave] = conteudo
      setStatusBlocos((s) => ({ ...s, [chave]: "saved" }))
    } catch {
      setStatusBlocos((s) => ({ ...s, [chave]: "error" }))
    }
  }

  const aoDigitar = (chave, valor) => {
    setBlocos((b) => ({ ...b, [chave]: valor }))
    setStatusBlocos((s) => ({ ...s, [chave]: "saving" }))
    clearTimeout(timersRef.current[chave])
    timersRef.current[chave] = setTimeout(() => salvarBloco(chave, valor), ATRASO_AUTOSAVE_MS)
  }

  const aoSairDoCampo = (chave, valor) => {
    if (!timersRef.current[chave]) return
    clearTimeout(timersRef.current[chave])
    delete timersRef.current[chave]
    salvarBloco(chave, valor)
  }

  const status = Object.values(statusBlocos)
  return {
    blocos,
    statusBlocos,
    carregando,
    aviso,
    setAviso,
    aoDigitar,
    aoSairDoCampo,
    salvando: status.includes("saving"),
    comErro: status.includes("error"),
  }
}
