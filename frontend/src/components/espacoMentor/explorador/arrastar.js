/**
 * Arrastar e soltar no explorador da biblioteca.
 *
 * Dois tipos de arrasto chegam aos mesmos alvos (uma pasta da area, um no da
 * arvore, um pedaco do caminho):
 *   - ITENS da propria biblioteca: soltar MOVE para a pasta;
 *   - ARQUIVOS do computador: soltar ENVIA para a pasta.
 *
 * Durante o arrasto o navegador so deixa ler os TIPOS do que esta sendo
 * arrastado, nunca o conteudo (dataTransfer.getData so vale no drop). Os itens
 * ficam guardados aqui, no modulo, para que o alvo saiba ja no `dragover` se
 * pode aceitar — uma pasta nao acende para receber ela mesma.
 */
import { useRef, useState } from "react"

const TIPO = "application/x-quiron-biblioteca"

let arrastados = []

export function iniciarArrasto(evento, itens) {
  arrastados = itens
  evento.dataTransfer.effectAllowed = "move"
  evento.dataTransfer.setData(TIPO, String(itens.length))
  // Alguns navegadores so iniciam o arrasto com um tipo de texto presente.
  evento.dataTransfer.setData("text/plain", itens.map((i) => i.titulo || i.nome).join(", "))
}

export function terminarArrasto() {
  arrastados = []
}

const temTipo = (evento, tipo) => Array.from(evento.dataTransfer?.types || []).includes(tipo)

/**
 * Os props de um alvo de soltura e se ele esta "aceso".
 *
 * @param {object} opcoes
 * @param {(itens: object[]) => boolean} [opcoes.aceitaItens] - pode receber estes itens?
 * @param {(itens: object[]) => void} [opcoes.onItens]
 * @param {(arquivos: File[]) => void} [opcoes.onArquivos] - ausente = nao aceita arquivos
 */
export function useAlvoSoltar({ aceitaItens, onItens, onArquivos }) {
  const [aceso, setAceso] = useState(false)
  // dragenter/dragleave disparam a cada filho atravessado: o contador diz se o
  // ponteiro ainda esta dentro do alvo.
  const dentro = useRef(0)

  const qual = (evento) => {
    if (temTipo(evento, TIPO)) return onItens && aceitaItens?.(arrastados) ? "itens" : null
    if (temTipo(evento, "Files")) return onArquivos ? "arquivos" : null
    return null
  }

  return {
    aceso,
    props: {
      onDragEnter: (e) => {
        if (!qual(e)) return
        e.preventDefault()
        e.stopPropagation()
        dentro.current += 1
        setAceso(true)
      },
      onDragOver: (e) => {
        const tipo = qual(e)
        if (!tipo) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = tipo === "itens" ? "move" : "copy"
      },
      onDragLeave: (e) => {
        if (!qual(e)) return
        e.stopPropagation()
        dentro.current = Math.max(0, dentro.current - 1)
        if (dentro.current === 0) setAceso(false)
      },
      onDrop: (e) => {
        const tipo = qual(e)
        dentro.current = 0
        setAceso(false)
        if (!tipo) return
        e.preventDefault()
        e.stopPropagation()
        if (tipo === "itens") {
          const itens = arrastados
          terminarArrasto()
          onItens(itens)
        } else {
          onArquivos(Array.from(e.dataTransfer.files || []))
        }
      },
    },
  }
}
