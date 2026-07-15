/**
 * Metadados das categorias de evento do calendario (cor, icone e rotulo).
 * Espelham o enum "eventoCategoria" do backend (database/schema.sql).
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
} from "@mui/icons-material"

export const CATEGORIAS = {
  MENTORIA: { label: "Mentoria", cor: "#6366f1", Icone: SupervisorAccount },
  WORKSHOP: { label: "Workshop", cor: "#0ea5e9", Icone: School },
  ENTREGA: { label: "Entrega", cor: "#10b981", Icone: AssignmentTurnedIn },
  REUNIAO: { label: "Reuniao", cor: "#f59e0b", Icone: Groups },
  EVENTO: { label: "Evento", cor: "#8b5cf6", Icone: Event },
  PITCH: { label: "Pitch", cor: "#ef4444", Icone: Campaign },
  PRAZO: { label: "Prazo", cor: "#f43f5e", Icone: HourglassBottom },
  VISITA: { label: "Visita", cor: "#14b8a6", Icone: Place },
}

export const LISTA_CATEGORIAS = Object.keys(CATEGORIAS)

/** Metadados de uma categoria, com fallback seguro caso venha um valor inesperado. */
export function categoriaInfo(categoria) {
  return CATEGORIAS[categoria] || CATEGORIAS.EVENTO
}
