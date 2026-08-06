/**
 * TourProvider - estado dos tutoriais guiados ("Fazer Tour").
 *
 * Fica na raiz da aplicacao (dentro do Router) e expoe o hook useTour, usado
 * pelo UserPanel para iniciar o tour da tela em que o usuario esta. Os passos
 * de cada tela ficam em tours.js.
 *
 * Passos cujo alvo nao existe na tela sao pulados: e assim que o mesmo tour
 * funciona para quem pode criar evento e para quem nao pode, e que os passos
 * do formulario so aparecem depois que o drawer abre.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useLocation } from "react-router-dom"
import { Snackbar, Alert } from "@mui/material"
import TourOverlay from "./TourOverlay"
import { tourDaRota } from "./tours"

const TourContext = createContext(null)

const SEM_TOUR = { disponivel: false, ativo: false, iniciar: () => {}, encerrar: () => {} }

/** Hook de acesso ao tour. Fora do provider, devolve um objeto inerte. */
export function useTour() {
  return useContext(TourContext) || SEM_TOUR
}

/** Um passo so pode ser exibido se nao tiver alvo ou se o alvo estiver na tela. */
function passoDisponivel(passo) {
  return !passo.seletor || Boolean(document.querySelector(passo.seletor))
}

export function TourProvider({ children }) {
  const { pathname } = useLocation()
  const [passos, setPassos] = useState([])
  const [indice, setIndice] = useState(-1)
  const [aviso, setAviso] = useState(null)

  const tour = tourDaRota(pathname)
  const ativo = indice >= 0 && indice < passos.length

  /** Proximo indice, a partir de `de` (inclusive), na direcao indicada. */
  const buscarIndice = useCallback((lista, de, direcao) => {
    for (let i = de; i >= 0 && i < lista.length; i += direcao) {
      if (passoDisponivel(lista[i])) return i
    }
    return -1
  }, [])

  const encerrar = useCallback(() => {
    setIndice(-1)
    setPassos([])
  }, [])

  const iniciar = useCallback(() => {
    if (!tour) {
      setAviso("Esta tela ainda não tem um tour disponível.")
      return
    }
    const lista = tour.passos
    const primeiro = buscarIndice(lista, 0, 1)
    if (primeiro < 0) {
      setAviso("Não foi possível iniciar o tour nesta tela.")
      return
    }
    setPassos(lista)
    setIndice(primeiro)
  }, [tour, buscarIndice])

  const proximo = useCallback(() => {
    setIndice((atual) => {
      const seguinte = buscarIndice(passos, atual + 1, 1)
      if (seguinte < 0) {
        // Nada mais a mostrar: encerra no proximo ciclo para nao piscar.
        setTimeout(encerrar, 0)
        return atual
      }
      return seguinte
    })
  }, [passos, buscarIndice, encerrar])

  const anterior = useCallback(() => {
    setIndice((atual) => {
      const antes = buscarIndice(passos, atual - 1, -1)
      return antes < 0 ? atual : antes
    })
  }, [passos, buscarIndice])

  const valor = useMemo(
    () => ({ disponivel: Boolean(tour), ativo, iniciar, encerrar, titulo: tour?.titulo }),
    [tour, ativo, iniciar, encerrar]
  )

  // Ultimo passo = nao ha nenhum passo disponivel depois deste.
  const ultimo = ativo && buscarIndice(passos, indice + 1, 1) < 0
  const primeiro = ativo && buscarIndice(passos, indice - 1, -1) < 0

  return (
    <TourContext.Provider value={valor}>
      {children}

      {ativo && (
        <TourOverlay
          passo={passos[indice]}
          indice={indice}
          total={passos.length}
          primeiro={primeiro}
          ultimo={ultimo}
          onProximo={proximo}
          onAnterior={anterior}
          onFechar={encerrar}
        />
      )}

      <Snackbar
        open={Boolean(aviso)}
        autoHideDuration={4000}
        onClose={() => setAviso(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="info" variant="filled" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
    </TourContext.Provider>
  )
}
