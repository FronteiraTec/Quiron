/**
 * Estado e operacoes da Jornada do incubado.
 *
 * Le e grava na API (/jornada). A jornada e a MESMA trilha que o admin monta
 * no Construtor, vista pelo lado da startup: so o que esta ativo, com o estado
 * de entrega de cada passo derivado no servidor (entrega + avaliacao).
 *
 * A jornada pertence a STARTUP, nao ao usuario: todos os membros veem e editam
 * o mesmo estado. A startup do usuario logado vem de /startups/minha.
 *
 * Navegacao em telas — 3 niveis, espelhando Fase -> Modulo -> Atividade:
 *   "fases"     -> visao geral: cartoes de fase, alguns bloqueados (a fase so
 *                  libera quando a anterior e concluida). Tela inicial.
 *   "modulos"   -> ao escolher uma fase, mostra os MODULOS dela (passos
 *                  agrupados por `frente`) em cartoes.
 *   "atividade" -> ao escolher um modulo, mostra as ATIVIDADES dele; escolher
 *                  uma abre seu conteudo no centro.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { STATUS_CONCLUIDO, STATUS_INICIADO } from "../data/jornadaMeta"

// Lista achatada de passos (com o estagio pai), na ordem da trilha.
function achatarPassos(estagios) {
  const out = []
  for (const est of estagios) {
    for (const p of est.passos) out.push({ ...p, estagio: est })
  }
  return out
}

// Mesma forma que a API devolve — a tela renderiza uma vez antes da resposta
// chegar, e campos ausentes aqui viram erro de acesso a undefined.
const VAZIA = {
  programa: null,
  startup: null,
  equipe: [],
  mentor: null,
  estagios: [],
}

export function useJornada() {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)

  const [jornada, setJornada] = useState(VAZIA)
  const [idStartup, setIdStartup] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // ---------------------------------------------------------------- carregar
  const carregar = useCallback(async (startupId) => {
    if (!startupId) return
    try {
      const { data } = await api.get("/jornada", { params: { id_startup: startupId } })
      setJornada(data.jornada)
      setErro(null)
    } catch (err) {
      setErro(err.response?.data?.erro || "Erro ao carregar sua jornada.")
    }
  }, [])

  // Resolve a startup do usuario e entao carrega a jornada dela.
  useEffect(() => {
    if (!idTenant) {
      setCarregando(false)
      return
    }

    let cancelado = false
    setCarregando(true)

    api
      .get("/startups/minha", { params: { id_tenant: idTenant } })
      .then(async ({ data }) => {
        if (cancelado) return
        const id = data.startup?.id_startup ?? null
        setIdStartup(id)
        if (id) await carregar(id)
        else setErro("Voce ainda nao faz parte de uma startup.")
      })
      .catch((err) => {
        if (!cancelado) setErro(err.response?.data?.erro || "Erro ao carregar sua startup.")
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [idTenant, carregar])

  const passosFlat = useMemo(() => achatarPassos(jornada.estagios), [jornada])

  // Passo selecionado. Default: o "proximo passo" logico.
  const proximoPassoId = useMemo(() => {
    // 1) algo que precisa de ajuste; 2) primeiro rascunho; 3) primeiro nao
    // iniciado em estagio desbloqueado.
    const desbloqueado = (p) => p.estagio.status !== "BLOQUEADO"
    const ajuste = passosFlat.find((p) => desbloqueado(p) && p.entrega.status === "AJUSTE")
    if (ajuste) return ajuste.id
    const rascunho = passosFlat.find((p) => desbloqueado(p) && p.entrega.status === "RASCUNHO")
    if (rascunho) return rascunho.id
    const naoIniciado = passosFlat.find(
      (p) => desbloqueado(p) && p.entrega.status === "NAO_INICIADA"
    )
    if (naoIniciado) return naoIniciado.id
    return passosFlat[0]?.id ?? null
  }, [passosFlat])

  // A fase daquele "proximo passo" — destaca "Continuar" no cartao certo.
  const faseSugeridaId = useMemo(() => {
    const alvo = passosFlat.find((p) => p.id === proximoPassoId)
    return alvo ? alvo.estagio.id : null
  }, [passosFlat, proximoPassoId])

  // ------------------------------------------------- navegacao de telas
  const [tela, setTela] = useState("fases") // "fases" | "modulos" | "atividade"
  const [faseSelecionadaId, setFaseSelecionadaId] = useState(null)
  const [moduloSelecionado, setModuloSelecionado] = useState(null) // nome da `frente`
  const [selecionadoId, setSelecionadoId] = useState(null)

  const estagioSelecionado = useMemo(
    () => jornada.estagios.find((e) => e.id === faseSelecionadaId) ?? null,
    [jornada, faseSelecionadaId]
  )

  // Passos da fase agrupados por `frente` -> os MODULOS da fase. A `frente`
  // vem preenchida pelo servidor com o nome do modulo da trilha.
  const modulosDaFase = useMemo(() => {
    if (!estagioSelecionado) return []
    const porFrente = new Map()
    for (const p of estagioSelecionado.passos) {
      const nome = p.frente || "Geral"
      if (!porFrente.has(nome)) porFrente.set(nome, [])
      porFrente.get(nome).push(p)
    }
    return Array.from(porFrente, ([nome, passos]) => ({ nome, passos }))
  }, [estagioSelecionado])

  const passosDoModulo = useMemo(
    () => modulosDaFase.find((m) => m.nome === moduloSelecionado)?.passos ?? [],
    [modulosDaFase, moduloSelecionado]
  )

  const selecionarFase = useCallback((id) => {
    setFaseSelecionadaId(id)
    setModuloSelecionado(null)
    setSelecionadoId(null)
    setTela("modulos")
  }, [])

  const selecionarModulo = useCallback((nome) => {
    setModuloSelecionado(nome)
    setSelecionadoId(null)
    setTela("atividade")
  }, [])

  const voltarParaFases = useCallback(() => {
    setTela("fases")
    setFaseSelecionadaId(null)
    setModuloSelecionado(null)
    setSelecionadoId(null)
  }, [])

  const voltarParaModulos = useCallback(() => {
    setTela("modulos")
    setModuloSelecionado(null)
    setSelecionadoId(null)
  }, [])

  // "Continuar de onde parei": abre fase + modulo + atividade sugeridos.
  const continuarJornada = useCallback(() => {
    const alvo = passosFlat.find((p) => p.id === proximoPassoId)
    if (!alvo) return
    setFaseSelecionadaId(alvo.estagio.id)
    setModuloSelecionado(alvo.frente || "Geral")
    setSelecionadoId(alvo.id)
    setTela("atividade")
  }, [passosFlat, proximoPassoId])

  const passo = useMemo(
    () => passosFlat.find((p) => p.id === selecionadoId) ?? null,
    [passosFlat, selecionadoId]
  )

  // Os conteudos ja vem resolvidos (com os blocos das aulas) dentro do passo,
  // numa unica resposta — antes eram procurados num mock por id.
  const conteudosDoPasso = useMemo(() => passo?.conteudos ?? [], [passo])

  // ---------------------------------------------------------- progresso
  const progressoEstagio = useCallback((est) => {
    const total = est.passos.length
    if (!total) return { feitos: 0, total: 0, pct: est.status === "CONCLUIDO" ? 100 : 0 }
    const feitos = est.passos.filter((p) => STATUS_CONCLUIDO.includes(p.entrega.status)).length
    return { feitos, total, pct: Math.round((feitos / total) * 100) }
  }, [])

  const progressoModulo = useMemo(() => {
    const total = passosDoModulo.length
    const feitos = passosDoModulo.filter((p) => STATUS_CONCLUIDO.includes(p.entrega.status)).length
    return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 }
  }, [passosDoModulo])

  const progressoGeral = useMemo(() => {
    const total = passosFlat.length
    const feitos = passosFlat.filter((p) => STATUS_CONCLUIDO.includes(p.entrega.status)).length
    return { feitos, total, pct: total ? Math.round((feitos / total) * 100) : 0 }
  }, [passosFlat])

  // -------------------------------------------------- Blueprint da empresa
  // Um cartao por FASE da trilha: a empresa "ganha forma" conforme os passos de
  // cada fase vao sendo aprovados.
  //
  // Antes isto era agregado por `trilha_no.area` — uma lista fixa de 8 areas
  // que o admin etiquetava a mao em cada passo. Nao acompanhava as fases que a
  // incubadora realmente monta no Construtor: areas sem nenhum passo viravam
  // cartoes fantasma e os nomes colidiam com os das fases/modulos. Derivar dos
  // estagios faz o Blueprint valer para qualquer trilha, sem etiquetar nada.
  const blueprintFases = useMemo(() => {
    return jornada.estagios.map((est, i) => {
      const total = est.passos.length
      const feitos = est.passos.filter((p) => STATUS_CONCLUIDO.includes(p.entrega.status)).length
      const emObra = est.passos.some((p) => STATUS_INICIADO.includes(p.entrega.status))
      let status = "VAZIA"
      if (est.status === "BLOQUEADO") status = "BLOQUEADA"
      else if (total > 0 && feitos === total) status = "CONSTRUIDA"
      else if (feitos > 0 || emObra) status = "EM_OBRA"
      const pct = total ? Math.round((feitos / total) * 100) : 0
      return { id: est.id, nome: est.nome, ordem: i + 1, total, feitos, status, pct }
    })
  }, [jornada.estagios])

  // Radar: um eixo por fase que tem passos. Fase vazia nao vira eixo — desenhava
  // um poligono murcho que contradizia o proprio percentual ao lado.
  const radarFases = useMemo(
    () =>
      blueprintFases
        .filter((f) => f.total > 0)
        .map((f) => ({ area: f.nome, valor: f.pct })),
    [blueprintFases]
  )

  // Linha do tempo: marcos de aprovacao, mais recentes primeiro.
  const linhaTempo = useMemo(() => {
    const eventos = []
    for (const p of passosFlat) {
      for (const h of p.entrega.historico || []) {
        if (h.tipo === "aprovada") {
          eventos.push({ data: h.data, titulo: p.titulo, area: p.area, por: h.por })
        }
      }
    }
    return eventos.sort((a, b) => (a.data < b.data ? 1 : -1))
  }, [passosFlat])

  // ---------------------------------------------------------- navegacao
  // Anterior/proximo navegam dentro do modulo aberto.
  const indexAtual = passosDoModulo.findIndex((p) => p.id === selecionadoId)
  const passoAnterior = indexAtual > 0 ? passosDoModulo[indexAtual - 1] : null
  const passoProximo =
    indexAtual >= 0 && indexAtual < passosDoModulo.length - 1
      ? passosDoModulo[indexAtual + 1]
      : null

  const posicaoNoEstagio = useMemo(() => {
    if (!passo) return { atual: 0, total: 0 }
    return { atual: indexAtual + 1, total: passosDoModulo.length }
  }, [passo, indexAtual, passosDoModulo])

  // ---------------------------------------------------------- mutacoes
  /**
   * Grava a entrega e recarrega a jornada.
   *
   * O recarregamento e proposital: o estado do passo e derivado no servidor
   * (entrega + avaliacao) e a conclusao de uma fase pode desbloquear a
   * seguinte. Remendar isso no cliente exigiria repetir a mesma regra aqui,
   * com risco de divergir.
   */
  const gravar = useCallback(
    async (rota, passoId, resposta, anexos = []) => {
      if (!idStartup) return { ok: false, erro: "Startup nao identificada." }

      try {
        await api.post(`/jornada/${rota}`, {
          id_no: passoId,
          id_startup: idStartup,
          texto_resposta: resposta,
          anexos,
        })
        await carregar(idStartup)
        return { ok: true }
      } catch (err) {
        return {
          ok: false,
          erro: err.response?.data?.erro || "Erro ao salvar sua entrega.",
        }
      }
    },
    [idStartup, carregar]
  )

  const salvarRascunho = useCallback(
    (passoId, resposta, anexos = []) => gravar("rascunho", passoId, resposta, anexos),
    [gravar]
  )

  const enviarAvaliacao = useCallback(
    (passoId, resposta, anexos = []) => {
      // Reenvio apos ajuste limpa a avaliacao anterior; o envio comum nao.
      const alvo = passosFlat.find((p) => p.id === passoId)
      const rota = alvo?.entrega.status === "AJUSTE" ? "reenviar" : "enviar"
      return gravar(rota, passoId, resposta, anexos)
    },
    [gravar, passosFlat]
  )

  return {
    jornada,
    carregando,
    erro,
    idStartup,
    passosFlat,
    passo,
    selecionadoId,
    setSelecionadoId,
    conteudosDoPasso,
    proximoPassoId,
    faseSugeridaId,
    progressoEstagio,
    progressoModulo,
    progressoGeral,
    blueprintFases,
    radarFases,
    linhaTempo,
    passoAnterior,
    passoProximo,
    posicaoNoEstagio,
    salvarRascunho,
    enviarAvaliacao,
    recarregar: () => carregar(idStartup),
    STATUS_INICIADO,
    // navegacao em telas
    tela,
    faseSelecionadaId,
    estagioSelecionado,
    modulosDaFase,
    moduloSelecionado,
    passosDoModulo,
    selecionarFase,
    selecionarModulo,
    voltarParaFases,
    voltarParaModulos,
    continuarJornada,
  }
}
