/**
 * Liga a gravacao da propria fala ao microfone da sala (dentro do
 * <LiveKitRoom>). Ver gravacao.js para o que acontece com cada pedaco.
 *
 * QUANDO GRAVA: `ativo` (a reuniao grava E a pessoa aceitou) e ha uma faixa
 * de microfone publicada. Quem entra com o microfone desligado so passa a
 * gravar quando o liga pela primeira vez — e a partir dai, silenciar grava
 * silencio, sem fechar a gravacao.
 *
 * UMA FAIXA NOVA, UMA GRAVACAO NOVA: a reconexao e a troca de microfone criam
 * outra MediaStreamTrack. A faixa e conferida pelos eventos do LiveKit e por
 * um relogio de 2 s (a troca de microfone substitui a faixa sem evento
 * proprio); mudou, a gravacao anterior e fechada e outra abre.
 */
import { useEffect, useState } from "react"
import { useLocalParticipant } from "@livekit/components-react"
import { ParticipantEvent, Track } from "livekit-client"
import { reunioesApi } from "../../../services/reunioesApi"
import { SessaoDeGravacao } from "./gravacao"

const PARADA = { fase: "parada", mensagem: null }

/** A MediaStreamTrack do microfone publicado, ou null. */
function faixaDoMicrofone(participante) {
  const faixa = participante?.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack
  return faixa && faixa.readyState !== "ended" ? faixa : null
}

/**
 * @param {{idReuniao: number|string, ativo: boolean}} p
 * @returns {{fase: string, mensagem: string|null}}
 */
export function useGravacao({ idReuniao, ativo }) {
  const { localParticipant } = useLocalParticipant()
  const [faixa, setFaixa] = useState(() => faixaDoMicrofone(localParticipant))
  const [estado, setEstado] = useState(PARADA)

  useEffect(() => {
    if (!localParticipant) return undefined
    const atualizar = () => setFaixa(faixaDoMicrofone(localParticipant))
    const eventos = [ParticipantEvent.LocalTrackPublished, ParticipantEvent.LocalTrackUnpublished]
    eventos.forEach((e) => localParticipant.on(e, atualizar))
    const relogio = setInterval(atualizar, 2000)
    atualizar()
    return () => {
      eventos.forEach((e) => localParticipant.off(e, atualizar))
      clearInterval(relogio)
    }
  }, [localParticipant])

  useEffect(() => {
    if (!ativo || !faixa) {
      setEstado(PARADA)
      return undefined
    }
    // A sessao que esta saindo ainda avisa "parada" quando termina de mandar o
    // que faltava — e isso nao pode apagar o estado da sessao nova.
    let vigente = true
    const sessao = new SessaoDeGravacao({
      idReuniao,
      trilha: faixa,
      api: reunioesApi,
      aoEstado: (e) => vigente && setEstado(e),
    })
    sessao.iniciar()
    const relogio = setInterval(() => sessao.conferir(), 5000)
    return () => {
      vigente = false
      clearInterval(relogio)
      sessao.parar()
    }
  }, [ativo, faixa, idReuniao])

  return estado
}
