/**
 * Metadados das categorias de evento (cor, icone e rotulo).
 *
 * ATE A MIGRACAO 008 este arquivo era a fonte da verdade: um objeto fixo que
 * espelhava o enum `eventoCategoria` do Postgres. Agora as categorias sao
 * configuracao de cada incubadora (tabela evento_categoria) e vem da API pelo
 * useAgendaConfigStore.
 *
 * O QUE SOBROU AQUI, e por que:
 *
 *   ICONES     o mapa nome -> componente MUI. Icone e import, nao string: o
 *              banco guarda "School" e so este arquivo sabe transformar isso
 *              num componente renderizavel. A lista e fechada, e espelha
 *              ICONES_VALIDOS em backend/src/eventos/categoriasPadrao.js.
 *   FALLBACK   as oito categorias originais. Usadas enquanto a API nao
 *              respondeu e quando um evento aponta para categoria que sumiu do
 *              cadastro — melhor um rotulo antigo que um evento sem nome.
 *
 * O hook `useCategorias` devolve um `categoriaInfo` com a MESMA assinatura de
 * antes ({ label, cor, Icone }), de proposito: os onze componentes que exibem
 * categoria continuam com o codigo que ja tinham, so passando a chamar o hook
 * uma vez no topo. Trocar a assinatura renderia onze diffs sem ganho nenhum.
 */
import {
  SupervisorAccount,
  School,
  AssignmentTurnedIn,
  Groups,
  Event,
  Campaign,
  HourglassBottom,
  Place,
  Handshake,
  EmojiEvents,
  Lightbulb,
  Coffee,
  VideoCall,
  MenuBook,
  Flag,
  Star,
} from "@mui/icons-material"
import { useAgendaConfigStore } from "../../store/agendaConfigStore"

/**
 * Icones que uma categoria pode usar. Espelha ICONES_VALIDOS no backend, que
 * rejeita qualquer outro valor antes de gravar.
 */
export const ICONES = {
  SupervisorAccount,
  School,
  AssignmentTurnedIn,
  Groups,
  Event,
  Campaign,
  HourglassBottom,
  Place,
  Handshake,
  EmojiEvents,
  Lightbulb,
  Coffee,
  VideoCall,
  MenuBook,
  Flag,
  Star,
}

export const LISTA_ICONES = Object.keys(ICONES)

/** As oito categorias que eram o enum. Hoje so fallback de exibicao. */
const FALLBACK = {
  MENTORIA: { label: "Mentoria", cor: "#6366f1", Icone: SupervisorAccount },
  WORKSHOP: { label: "Workshop", cor: "#0ea5e9", Icone: School },
  ENTREGA: { label: "Entrega", cor: "#10b981", Icone: AssignmentTurnedIn },
  REUNIAO: { label: "Reuniao", cor: "#f59e0b", Icone: Groups },
  EVENTO: { label: "Evento", cor: "#8b5cf6", Icone: Event },
  PITCH: { label: "Pitch", cor: "#ef4444", Icone: Campaign },
  PRAZO: { label: "Prazo", cor: "#f43f5e", Icone: HourglassBottom },
  VISITA: { label: "Visita", cor: "#14b8a6", Icone: Place },
}

/** Ultimo recurso: categoria que nao esta no cadastro nem no fallback. */
const GENERICA = { label: "Evento", cor: "#8b5cf6", Icone: Event }

/** Converte uma linha de evento_categoria no shape que os componentes esperam. */
function paraInfo(categoria) {
  return {
    label: categoria.rotulo,
    cor: categoria.cor,
    Icone: ICONES[categoria.icone] || Event,
    chave: categoria.chave,
  }
}

/**
 * Categorias da incubadora atual e o resolvedor de metadados.
 *
 * Chame UMA vez no topo do componente e use o `categoriaInfo` devolvido a
 * vontade — inclusive dentro de .map(), que e onde a maioria das telas precisa
 * dele. Fosse `categoriaInfo` um hook, isso violaria as regras de hooks.
 *
 * @returns {{
 *   categorias: Array,
 *   listaCategorias: string[],
 *   categoriaInfo: (chave: string) => {label: string, cor: string, Icone: Function},
 *   carregada: boolean,
 * }}
 */
export function useCategorias() {
  const categorias = useAgendaConfigStore((s) => s.categorias)

  const porChave = new Map((categorias || []).map((c) => [c.chave, c]))

  const categoriaInfo = (chave) => {
    const cadastrada = porChave.get(chave)
    if (cadastrada) return paraInfo(cadastrada)
    // Nao esta no cadastro: ou a API ainda nao respondeu, ou a categoria foi
    // renomeada/removida depois que este evento foi criado. O fallback mantem o
    // evento identificavel nos dois casos.
    return FALLBACK[chave] || GENERICA
  }

  return {
    categorias: categorias || [],
    listaCategorias: (categorias || []).map((c) => c.chave),
    categoriaInfo,
    carregada: categorias !== null,
  }
}

/**
 * Locais cadastrados pela incubadora, para o seletor do formulario.
 *
 * O formulario aceita local do cadastro OU texto avulso (ver a migracao 008),
 * entao esta lista e sugestao, nao restricao.
 */
export function useLocais() {
  const locais = useAgendaConfigStore((s) => s.locais)
  return { locais: locais || [], carregada: locais !== null }
}
