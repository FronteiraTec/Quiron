/**
 * Os formatos do Mini CRM. O que se prende aqui e a diferenca entre DATA
 * (lida pelo texto, nunca volta um dia) e INSTANTE (convertido para o fuso de
 * quem le), e o estado do prazo de uma tarefa.
 */
import { describe, expect, it } from "vitest"
import {
  dataBR,
  deCampoDataHora,
  diasDesde,
  formatarDocumento,
  linkWhatsapp,
  mascararDocumento,
  moeda,
  paraCampoDataHora,
  rotuloDoDia,
  situacaoVencimento,
  tempoRelativo,
} from "./crmMeta"

describe("datas e instantes", () => {
  it("data sem hora e lida pelo texto", () => {
    expect(dataBR("2026-07-01")).toBe("01/07/2026")
    expect(dataBR("2026-07-01T00:00:00.000Z")).toBe("01/07/2026")
    expect(dataBR(null)).toBe("")
  })

  it("o campo datetime-local vai e volta sem perder a hora", () => {
    const iso = "2026-11-05T17:30:00.000Z"
    expect(deCampoDataHora(paraCampoDataHora(iso))).toBe(iso)
    expect(deCampoDataHora("")).toBeNull()
  })

  it("tempo relativo", () => {
    const agora = new Date("2026-11-05T15:00:00")
    expect(tempoRelativo(new Date("2026-11-05T14:59:30").toISOString(), agora)).toBe("agora")
    expect(tempoRelativo(new Date("2026-11-05T14:40:00").toISOString(), agora)).toBe("há 20 min")
    expect(tempoRelativo(new Date("2026-11-04T10:00:00").toISOString(), agora)).toBe("ontem")
    expect(tempoRelativo(new Date("2026-11-01T10:00:00").toISOString(), agora)).toBe("há 4 dias")
  })

  it("o dia da linha do tempo", () => {
    const agora = new Date("2026-11-05T15:00:00")
    expect(rotuloDoDia(new Date("2026-11-05T08:00:00").toISOString(), agora)).toBe("Hoje")
    expect(rotuloDoDia(new Date("2026-11-04T23:00:00").toISOString(), agora)).toBe("Ontem")
    expect(rotuloDoDia(new Date("2025-03-02T10:00:00").toISOString(), agora)).toMatch(/2025/)
  })

  it("dias na etapa", () => {
    const agora = new Date("2026-11-05T15:00:00Z")
    expect(diasDesde("2026-11-02T15:00:00Z", agora)).toBe(3)
    expect(diasDesde("2026-11-05T14:00:00Z", agora)).toBe(0)
  })
})

describe("prazo da tarefa", () => {
  const agora = new Date("2026-11-05T15:00:00")
  const tarefa = (venc, status = "PENDENTE") => ({ vencimento_ts: venc && new Date(venc).toISOString(), status })

  it("concluida ou cancelada nunca esta atrasada", () => {
    expect(situacaoVencimento(tarefa("2026-10-01T10:00:00", "CONCLUIDA"), agora).tipo).toBe("encerrada")
    expect(situacaoVencimento(tarefa("2026-10-01T10:00:00", "CANCELADA"), agora).tipo).toBe("encerrada")
  })

  it("atrasada em dias, ou vencida hoje mais cedo", () => {
    expect(situacaoVencimento(tarefa("2026-11-02T10:00:00"), agora)).toEqual({ tipo: "atrasada", rotulo: "Atrasada 3 dias" })
    expect(situacaoVencimento(tarefa("2026-11-05T09:00:00"), agora).rotulo).toMatch(/^Venceu às/)
  })

  it("hoje, amanha, em breve e depois", () => {
    expect(situacaoVencimento(tarefa("2026-11-05T18:00:00"), agora).tipo).toBe("hoje")
    expect(situacaoVencimento(tarefa("2026-11-06T09:00:00"), agora).tipo).toBe("amanha")
    expect(situacaoVencimento(tarefa("2026-11-08T09:00:00"), agora)).toEqual({ tipo: "proxima", rotulo: "Em 3 dias" })
    expect(situacaoVencimento(tarefa("2026-12-20T09:00:00"), agora).tipo).toBe("futura")
  })

  it("sem prazo", () => {
    expect(situacaoVencimento(tarefa(null), agora).tipo).toBe("sem-prazo")
  })
})

describe("documentos e contato", () => {
  it("CPF e CNPJ formatados pelo tamanho", () => {
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25")
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81")
  })

  it("a mascara do campo segue o tipo de pessoa", () => {
    expect(mascararDocumento("5299822", "PF")).toBe("529.982.2")
    expect(mascararDocumento("112223330001", "PJ")).toBe("11.222.333/0001")
    expect(mascararDocumento("529982247251234", "PF")).toBe("529.982.247-25")
  })

  it("link do WhatsApp com o codigo do pais", () => {
    expect(linkWhatsapp("11988887777")).toBe("https://wa.me/5511988887777")
    expect(linkWhatsapp("")).toBeNull()
  })

  it("moeda em reais", () => {
    expect(moeda(3500).replace(/\s/g, " ")).toBe("R$ 3.500,00")
    expect(moeda(null)).toBe("—")
  })
})
