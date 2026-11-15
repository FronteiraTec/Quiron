/**
 * Repete `fn` a cada `intervalo` ms enquanto a aba estiver visivel, e de novo
 * quando a pessoa volta para ela — quem estava fora quer o estado de agora.
 * O mesmo desenho da sondagem das Mensagens (useConversas).
 */
import { useEffect, useState } from "react"

export function useSondagem(fn, intervalo) {
  useEffect(() => {
    if (!fn || !intervalo) return undefined
    const rodar = () => {
      if (document.visibilityState === "visible") fn()
    }
    const timer = setInterval(rodar, intervalo)
    document.addEventListener("visibilitychange", rodar)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", rodar)
    }
  }, [fn, intervalo])
}

/** O agora, atualizado a cada `intervalo` ms — para contagens na tela. */
export function useAgora(intervalo = 1000) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), intervalo)
    return () => clearInterval(timer)
  }, [intervalo])
  return agora
}
