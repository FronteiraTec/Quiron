/**
 * O atalho "/" da busca do menu.
 *
 * O atalho escuta a janela inteira e chama `preventDefault`, entao ele decide
 * o destino de toda tecla "/" digitada no sistema — inclusive a que abre o
 * menu de blocos do editor de aulas. Ja quebrou uma vez: o teste de "esta
 * escrevendo?" olhava so `tagName`, e o editor do BlockNote e um
 * <div contenteditable>, nao um <input>.
 *
 * O `isContentEditable` e definido a mao nos alvos abaixo: o `jsdom` nao
 * implementa essa propriedade (nem `contentEditable`), e sem isso o teste
 * mediria o vazio do ambiente em vez do componente.
 */
import { describe, test, expect, vi, afterEach } from "vitest"
import { cleanup, render } from "@testing-library/react"
import SidebarSearch from "./SidebarSearch"

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
})

/** Monta a Sidebar expandida, que e quando o atalho existe. */
function montar(props = {}) {
  return render(<SidebarSearch recolhida={false} valor="" onChange={vi.fn()} {...props} />)
}

/** Cria um alvo focado no documento, editavel ou nao. */
function alvoFocado(tag, { editavel = false } = {}) {
  const el = document.createElement(tag)
  if (editavel) {
    el.setAttribute("contenteditable", "true")
    Object.defineProperty(el, "isContentEditable", { value: true })
  }
  document.body.appendChild(el)
  el.focus()
  return el
}

/** Dispara "/" no alvo e devolve se alguem cancelou a tecla. */
function teclarBarra(alvo) {
  const evento = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true })
  alvo.dispatchEvent(evento)
  return evento.defaultPrevented
}

describe("atalho / da busca do menu", () => {
  test("fora de campo de texto, foca a busca", () => {
    const { getByLabelText } = montar()
    const cancelada = teclarBarra(document.body)

    expect(cancelada).toBe(true)
    expect(document.activeElement).toBe(getByLabelText("buscar no menu"))
  })

  test("dentro de area editavel, a tecla segue para quem esta escrevendo", () => {
    montar()
    const editor = alvoFocado("div", { editavel: true })
    const cancelada = teclarBarra(editor)

    // Cancelar aqui mataria o menu de blocos do editor de aulas, que e o
    // proprio recurso que o "/" aciona la dentro.
    expect(cancelada).toBe(false)
    expect(document.activeElement).toBe(editor)
  })

  test("dentro de um campo de texto, a tecla segue para o campo", () => {
    montar()
    const campo = alvoFocado("input")

    expect(teclarBarra(campo)).toBe(false)
    expect(document.activeElement).toBe(campo)
  })

  test("com a Sidebar recolhida, nao ha atalho", () => {
    montar({ recolhida: true, onExpandir: vi.fn() })

    expect(teclarBarra(document.body)).toBe(false)
  })
})
