/**
 * Estado e operacoes do Espaco do Mentor (/espaco-mentor) e dos materiais que
 * a startup recebeu (/jornada/materiais).
 *
 * Um hook por aba. Todos recarregam quando `versao` muda: a pagina incrementa
 * a versao depois de qualquer gravacao, porque compartilhar mexe nas tres abas
 * de uma vez — o contador da biblioteca, o do incubado e a lista consolidada.
 * Remendar cada lista a mao no cliente seria repetir regra que mora no
 * servidor (a situacao, o caminho da etapa), com risco de divergir.
 *
 * As listas vem inteiras do servidor e sao filtradas em memoria (ver
 * data/espacoMentorMeta.js), como as outras listagens do sistema.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import api from "../services/api"

/** A mensagem que o backend mandou, ou a padrao. */
export const erroDe = (err, padrao) => err?.response?.data?.erro || err?.message || padrao

/**
 * Carrega uma lista e descarta respostas que chegarem fora de ordem — trocar
 * de startup rapido nao pode deixar a lista da anterior por cima da atual.
 */
function useLista(buscar, deps, padraoErro) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const atual = useRef(0)

  const carregar = useCallback(async () => {
    const id = ++atual.current
    setCarregando(true)
    try {
      const resultado = await buscar()
      if (id !== atual.current) return
      setDados(resultado)
      setErro(null)
    } catch (err) {
      if (id !== atual.current) return
      setErro(erroDe(err, padraoErro))
    } finally {
      if (id === atual.current) setCarregando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    carregar()
  }, [carregar])

  return { dados, carregando, erro, recarregar: carregar }
}

// ---------------------------------------------------------------------------
// MINHA BIBLIOTECA
// ---------------------------------------------------------------------------

export function useMinhaBiblioteca({ idTenant, ativo = true, versao = 0 }) {
  const { dados, carregando, erro, recarregar } = useLista(
    async () => {
      if (!idTenant || !ativo) return { materiais: [], categorias: [], pastas: [] }
      const { data } = await api.get("/espaco-mentor/materiais", { params: { id_tenant: idTenant } })
      return data
    },
    [idTenant, ativo, versao],
    "Erro ao carregar sua biblioteca."
  )

  return {
    materiais: dados?.materiais ?? [],
    categorias: dados?.categorias ?? [],
    // As pastas (migracao 025) vem junto: a tela navega sem voltar ao servidor.
    pastas: dados?.pastas ?? [],
    // `dados` ja chegou ao menos uma vez: recarregar depois de uma gravacao nao
    // apaga a tela, so mostra a barra de progresso.
    carregado: dados !== null,
    carregando,
    erro,
    recarregar,
  }
}

/** As pastas da biblioteca pessoal (migracao 025). */
export const pastasPessoais = {
  async criar(idTenant, { nome, idPastaPai = null }) {
    const { data } = await api.post("/espaco-mentor/pastas", {
      id_tenant: idTenant,
      nome,
      id_pasta_pai: idPastaPai,
    })
    return data.pasta
  },
  async renomear(idPasta, nome) {
    const { data } = await api.patch(`/espaco-mentor/pastas/${idPasta}`, { nome })
    return data.pasta
  },
  /** O conteudo vai para a pasta de cima; nada e apagado. */
  async excluir(idPasta) {
    const { data } = await api.delete(`/espaco-mentor/pastas/${idPasta}`)
    return data
  },
}

/**
 * Move materiais e pastas para `destino` (null = raiz), tudo ou nada.
 * @param {{destino: number|null, pastas?: number[], materiais?: number[]}} movimento
 */
export async function moverItens(idTenant, { destino, pastas = [], materiais = [] }) {
  const { data } = await api.post("/espaco-mentor/mover", {
    id_tenant: idTenant,
    destino,
    pastas,
    materiais,
  })
  return data
}

export const bibliotecaPessoal = {
  async criar(idTenant, corpo) {
    const { data } = await api.post("/espaco-mentor/materiais", { id_tenant: idTenant, ...corpo })
    return data.material
  },
  async atualizar(idMaterial, patch) {
    const { data } = await api.patch(`/espaco-mentor/materiais/${idMaterial}`, patch)
    return data.material
  },
  async excluir(idMaterial) {
    await api.delete(`/espaco-mentor/materiais/${idMaterial}`)
  },
  /** O material com a lista de lugares para onde ele ja foi. */
  async detalhar(idMaterial) {
    const { data } = await api.get(`/espaco-mentor/materiais/${idMaterial}`)
    return data.material
  },
}

/** O caminho de download de um material da propria biblioteca. */
export const urlArquivoDoMaterial = (material) =>
  material?.tipo === "ARQUIVO" ? `/api/espaco-mentor/materiais/${material.id_material}/arquivo` : null

// ---------------------------------------------------------------------------
// MATERIAIS DA INCUBADORA PARA OS MENTORES (migracao 021)
// ---------------------------------------------------------------------------

/** O que a coordenacao publicou para os mentores (quem edita ve os arquivados). */
export function useMateriaisIncubadora({ idTenant, ativo = true, versao = 0 }) {
  const { dados, carregando, erro, recarregar } = useLista(
    async () => {
      if (!idTenant || !ativo) return { materiais: [], categorias: [] }
      const { data } = await api.get("/espaco-mentor/incubadora", { params: { id_tenant: idTenant } })
      return data
    },
    [idTenant, ativo, versao],
    "Erro ao carregar os materiais da incubadora."
  )
  return {
    materiais: dados?.materiais ?? [],
    categorias: dados?.categorias ?? [],
    carregando,
    erro,
    recarregar,
  }
}

export const materiaisIncubadora = {
  async criar(idTenant, corpo) {
    const { data } = await api.post("/espaco-mentor/incubadora", { id_tenant: idTenant, ...corpo })
    return data.material
  },
  async atualizar(idMaterial, patch) {
    const { data } = await api.patch(`/espaco-mentor/incubadora/${idMaterial}`, patch)
    return data.material
  },
  async excluir(idMaterial) {
    await api.delete(`/espaco-mentor/incubadora/${idMaterial}`)
  },
}

/** O caminho de download de um material publicado pela incubadora. */
export const urlArquivoDoMaterialIncubadora = (material) =>
  material?.tipo === "ARQUIVO" ? `/api/espaco-mentor/incubadora/${material.id_material}/arquivo` : null

// ---------------------------------------------------------------------------
// MEUS INCUBADOS
// ---------------------------------------------------------------------------

export function useMeusIncubados({ idTenant, ativo = true, versao = 0 }) {
  const { dados, carregando, erro, recarregar } = useLista(
    async () => {
      if (!idTenant || !ativo) return []
      const { data } = await api.get("/espaco-mentor/incubados", { params: { id_tenant: idTenant } })
      return data.startups
    },
    [idTenant, ativo, versao],
    "Erro ao carregar as startups que você acompanha."
  )
  return { startups: dados ?? [], carregando, erro, recarregar }
}

/** A trilha de uma startup acompanhada: arvore + o que ja foi entregue nela. */
export function useTrilhaDoIncubado({ idStartup, idTrilha, versao = 0 }) {
  const { dados, carregando, erro, recarregar } = useLista(
    async () => {
      if (!idStartup || !idTrilha) return null
      const { data } = await api.get(`/espaco-mentor/incubados/${idStartup}/trilhas/${idTrilha}`)
      return data
    },
    [idStartup, idTrilha, versao],
    "Erro ao carregar a trilha desta startup."
  )
  return {
    trilha: dados?.trilha ?? null,
    compartilhamentos: dados?.compartilhamentos ?? [],
    carregando,
    erro,
    recarregar,
  }
}

// ---------------------------------------------------------------------------
// COMPARTILHAMENTOS
// ---------------------------------------------------------------------------

export function useCompartilhamentos({ idTenant, ativo = true, versao = 0 }) {
  const { dados, carregando, erro, recarregar } = useLista(
    async () => {
      if (!idTenant || !ativo) return []
      const { data } = await api.get("/espaco-mentor/compartilhamentos", {
        params: { id_tenant: idTenant },
      })
      return data.compartilhamentos
    },
    [idTenant, ativo, versao],
    "Erro ao carregar os materiais compartilhados."
  )
  return { compartilhamentos: dados ?? [], carregando, erro, recarregar }
}

export const compartilhamentos = {
  async criar(corpo) {
    const { data } = await api.post("/espaco-mentor/compartilhamentos", corpo)
    return data.compartilhamento
  },
  async atualizar(id, patch) {
    const { data } = await api.patch(`/espaco-mentor/compartilhamentos/${id}`, patch)
    return data.compartilhamento
  },
  async remover(id) {
    await api.delete(`/espaco-mentor/compartilhamentos/${id}`)
  },
}

// ---------------------------------------------------------------------------
// O QUE A STARTUP RECEBEU (Jornada)
// ---------------------------------------------------------------------------

/**
 * Os materiais que os mentores entregaram a startup, numa trilha.
 *
 * Falha aqui nao derruba a Jornada: os materiais sao um acrescimo a trilha, e a
 * startup precisa continuar entregando o passo mesmo que esta lista nao venha.
 */
export function useMateriaisRecebidos({ idStartup, idTrilha }) {
  const { dados, carregando, erro, recarregar } = useLista(
    async () => {
      if (!idStartup || !idTrilha) return []
      const { data } = await api.get("/jornada/materiais", {
        params: { id_startup: idStartup, id_trilha: idTrilha },
      })
      return data.materiais
    },
    [idStartup, idTrilha],
    "Não foi possível carregar os materiais do mentor."
  )
  return { materiais: dados ?? [], carregando, erro, recarregar }
}

/** Um material recebido, inteiro (com o corpo, quando e uma aula). */
export async function detalharRecebido(idCompartilhamento) {
  const { data } = await api.get(`/jornada/materiais/${idCompartilhamento}`)
  return data.material
}
