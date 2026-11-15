/**
 * O contexto do Mini CRM nas telas filhas de CrmLayout:
 *   { api, idStartup, startup, membros, etapas, etapasAtivas, origens,
 *     idUsuario, recarregarContexto, falha(err, padrao), avisar(tipo, texto) }
 */
import { useOutletContext } from "react-router-dom"

export function useCrm() {
  return useOutletContext()
}
