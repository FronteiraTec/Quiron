/**
 * Store de Preferencias visuais (zustand).
 *
 * Guarda as preferencias do usuario (tema, cores do painel, densidade, etc.)
 * e expoe acoes para carregar do backend e salvar. O App observa este estado
 * para reconstruir o tema do MUI em tempo real.
 *
 * As ultimas preferencias conhecidas ficam tambem no localStorage, so como
 * ponto de partida: sem isso, a cada recarga o tema comecava no padrao (claro)
 * e trocava quando o GET /preferencias respondia — um clarao branco antes do
 * preto, para quem usa o tema escuro. O backend continua sendo a fonte de
 * verdade; a copia local e sobrescrita assim que ele responde.
 */
import { create } from "zustand"
import api from "../services/api"
import { PREFERENCIAS_PADRAO } from "../theme"

const CHAVE_LOCAL = "quiron:preferencias"

// O localStorage pode nao existir ou recusar acesso (modo privado, cota,
// cookies bloqueados). Em qualquer falha, segue-se sem a copia local.
function lerLocal() {
  try {
    const texto = localStorage.getItem(CHAVE_LOCAL)
    return texto ? { ...PREFERENCIAS_PADRAO, ...JSON.parse(texto) } : null
  } catch {
    return null
  }
}

function gravarLocal(preferencias) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(preferencias))
  } catch {
    // sem copia local: so o clarao na proxima recarga
  }
}

function apagarLocal() {
  try {
    localStorage.removeItem(CHAVE_LOCAL)
  } catch {
    // nada a apagar
  }
}

export const usePreferenciaStore = create((set, get) => ({
  // Comeca na copia local (ou no padrao) ate carregar as preferencias reais.
  preferencias: lerLocal() || PREFERENCIAS_PADRAO,

  /**
   * Carrega as preferencias do usuario logado (GET /preferencias).
   */
  carregar: async () => {
    const { data } = await api.get("/preferencias")
    set({ preferencias: data.preferencias })
    gravarLocal(data.preferencias)
    return data.preferencias
  },

  /**
   * Salva um subconjunto das preferencias (PUT /preferencias) e atualiza
   * o estado com a resposta do backend.
   * @param {object} patch - Campos a atualizar.
   */
  salvar: async (patch) => {
    const { data } = await api.put("/preferencias", patch)
    set({ preferencias: data.preferencias })
    gravarLocal(data.preferencias)
    return data.preferencias
  },

  /**
   * Aplica um patch localmente sem esperar o backend, para refletir a
   * mudanca (ex.: tema, cor) na interface de forma imediata.
   * @param {object} patch - Campos a atualizar.
   */
  atualizarLocal: (patch) => {
    set((s) => ({ preferencias: { ...s.preferencias, ...patch } }))
    gravarLocal(get().preferencias)
  },

  /**
   * Restaura o padrao local (ex.: no logout), sem tocar no backend. Apaga a
   * copia local junto: o proximo usuario deste navegador nao herda o tema.
   */
  resetar: () => {
    set({ preferencias: PREFERENCIAS_PADRAO })
    apagarLocal()
  },
}))
