import { describe, expect, it } from "vitest"
import {
  agruparTrechos,
  avisoDeGravacao,
  contagem,
  corpoDoFormulario,
  motivoSemGravacao,
  situacaoTranscricao,
  transcricaoEmTexto,
  duracao,
  formularioInicial,
  iniciais,
  podeEntrarAgora,
  quando,
  segundosParaAbrir,
  separarPorAba,
  situacao,
} from "./reuniaoMeta"

const T0 = 1_800_000_000_000 // um instante qualquer

describe("a sala abre 15 minutos antes", () => {
  const daqui20min = { status: "AGENDADA", meu_papel: "PARTICIPANTE", segundos_para_inicio: 20 * 60 }

  it("conta a partir do que o servidor disse, descontando o tempo que passou", () => {
    expect(segundosParaAbrir(daqui20min, T0, T0)).toBe(5 * 60)
    expect(segundosParaAbrir(daqui20min, T0, T0 + 4 * 60000)).toBe(60)
    expect(segundosParaAbrir(daqui20min, T0, T0 + 6 * 60000)).toBe(-60)
  })

  it("so o convidado entra, e so quando a sala abriu", () => {
    expect(podeEntrarAgora(daqui20min, T0, T0)).toBe(false)
    expect(podeEntrarAgora(daqui20min, T0, T0 + 5 * 60000)).toBe(true)
    expect(podeEntrarAgora({ ...daqui20min, meu_papel: null }, T0, T0 + 5 * 60000)).toBe(false)
    expect(podeEntrarAgora({ ...daqui20min, status: "ENCERRADA" }, T0, T0 + 5 * 60000)).toBe(false)
  })

  it("a agendada cuja sala abriu aparece como Sala aberta", () => {
    expect(situacao(daqui20min, T0, T0).rotulo).toBe("Agendada")
    expect(situacao(daqui20min, T0, T0 + 5 * 60000).rotulo).toBe("Sala aberta")
    expect(situacao({ status: "EM_ANDAMENTO" }).rotulo).toBe("Em andamento")
    expect(situacao({ status: "CANCELADA" }).rotulo).toBe("Cancelada")
  })
})

describe("formatos", () => {
  it("o horario e lido como parede, sem fuso", () => {
    // Sem o cuidado do horaDoEvento, o "Z" faria 14:00 virar 11:00 em Brasilia.
    expect(quando({ inicio_ts: "2026-11-05T14:00:00", fim_ts: "2026-11-05T15:30:00" })).toBe("quinta, 5 de nov · 14:00–15:30")
    expect(quando({ inicio_ts: "2026-11-05T14:00:00.000Z" })).toBe("quinta, 5 de nov · 14:00")
  })

  it("duracao e contagem", () => {
    expect(duracao(40)).toBe("40 s")
    expect(duracao(12 * 60)).toBe("12 min")
    expect(duracao(65 * 60)).toBe("1 h 05 min")
    expect(duracao(null)).toBe("—")
    expect(contagem(10)).toBe("em instantes")
    expect(contagem(4 * 60)).toBe("em 4 min")
  })

  it("iniciais", () => {
    expect(iniciais("Ana Maria Souza")).toBe("AS")
    expect(iniciais("ana")).toBe("A")
    expect(iniciais("")).toBe("?")
  })
})

describe("abas", () => {
  it("proximas pela mais cedo, historico pela mais recente", () => {
    const r = (id, status, inicio) => ({ id_reuniao: id, status, inicio_ts: inicio })
    const { proximas, historico } = separarPorAba([
      r(1, "AGENDADA", "2026-11-10T10:00:00"),
      r(2, "ENCERRADA", "2026-11-01T10:00:00"),
      r(3, "EM_ANDAMENTO", "2026-11-04T10:00:00"),
      r(4, "CANCELADA", "2026-11-03T10:00:00"),
    ])
    expect(proximas.map((x) => x.id_reuniao)).toEqual([3, 1])
    expect(historico.map((x) => x.id_reuniao)).toEqual([4, 2])
  })
})

describe("formulario", () => {
  it("criacao comeca na proxima meia hora, com uma hora de duracao", () => {
    const f = formularioInicial(null, new Date(2026, 10, 5, 14, 10))
    expect([f.data, f.horaInicio, f.horaFim]).toEqual(["2026-11-05", "14:30", "15:30"])
    const g = formularioInicial(null, new Date(2026, 10, 5, 14, 40))
    expect([g.horaInicio, g.horaFim]).toEqual(["15:00", "16:00"])
  })

  it("edicao traz os convidados sem o anfitriao", () => {
    const f = formularioInicial({
      titulo: "Pitch",
      categoria: "MENTORIA",
      inicio_ts: "2026-11-05T14:00:00",
      fim_ts: "2026-11-05T15:00:00",
      participantes: [
        { id_usuario: 1, papel: "ANFITRIAO" },
        { id_usuario: 7, papel: "PARTICIPANTE" },
      ],
    })
    expect(f.participantes).toEqual([7])
    expect(f.horaFim).toBe("15:00")
  })

  it("o fim antes do inicio passa da meia-noite", () => {
    const base = { titulo: "x", categoria: "REUNIAO", data: "2026-11-05", horaInicio: "23:30", participantes: [] }
    expect(corpoDoFormulario({ ...base, horaFim: "00:30" }, 1).fim_ts).toBe("2026-11-06T00:30:00")
    expect(corpoDoFormulario({ ...base, horaFim: "23:45" }, 1).fim_ts).toBe("2026-11-05T23:45:00")
    expect(corpoDoFormulario({ ...base, horaFim: "" }, 1).fim_ts).toBe(null)
    expect(corpoDoFormulario({ ...base, horaFim: "" }, 1).id_tenant).toBe(1)
  })
})

describe("gravacao e transcricao (Etapa 4)", () => {
  it("o formulario manda a gravacao ligada por padrao, e desligada quando o anfitriao desliga", () => {
    const base = { data: "2026-11-05", horaInicio: "14:00", horaFim: "15:00", titulo: "x", categoria: "MENTORIA", idStartup: "", descricao: "", participantes: [] }
    expect(corpoDoFormulario(base, 1).gravar_audio).toBe(true)
    expect(corpoDoFormulario({ ...base, gravarAudio: false }, 1).gravar_audio).toBe(false)
    expect(formularioInicial(null).gravarAudio).toBe(true)
    expect(formularioInicial({ inicio_ts: "2026-11-05T14:00:00", gravar_audio: false, participantes: [] }).gravarAudio).toBe(false)
  })

  it("o aviso diz quem transcreve e por quanto tempo guarda", () => {
    const aviso = avisoDeGravacao({ provedor_rotulo: "OpenAI", retencao: { audio_dias: 0, transcricao_dias: 180 } })
    expect(aviso.join(" ")).toContain("transcrita por OpenAI")
    expect(aviso.join(" ")).toContain("O áudio é apagado logo depois da transcrição; a transcrição fica guardada por 180 dias.")
    expect(aviso.join(" ")).toContain("compartilhado")
    expect(avisoDeGravacao({ provedor_rotulo: "Deepgram", retencao: { audio_dias: 1, transcricao_dias: 30 } }).join(" ")).toContain("1 dia depois da transcrição")
    expect(motivoSemGravacao({ motivo: "SEM_TRANSCRICAO" })).toMatch(/não configurou/)
  })

  it("a situacao da transcricao: o processamento ativo ou falho manda; depois, o estado da reuniao", () => {
    const enc = { status: "ENCERRADA", janela_processamento: { fim: "07:00" } }
    expect(situacaoTranscricao({ status: "EM_ANDAMENTO" })).toBe(null)
    expect(situacaoTranscricao({ ...enc, processamento: { status: "PENDENTE" } })).toMatchObject({ chave: "NA_FILA", detalhe: expect.stringContaining("até as 07:00") })
    expect(situacaoTranscricao({ ...enc, processamento: { status: "PENDENTE", erro_mensagem: "OpenAI falhou (503)." } }).detalhe).toContain("será repetida")
    expect(situacaoTranscricao({ ...enc, processamento: { status: "PROCESSANDO" } }).chave).toBe("TRANSCREVENDO")
    expect(situacaoTranscricao({ ...enc, processamento: { status: "FALHOU", erro_mensagem: "chave recusada" } })).toMatchObject({ chave: "FALHOU", detalhe: "chave recusada" })
    expect(situacaoTranscricao({ ...enc, transcricao: "COMPLETA", processamento: { status: "CONCLUIDO" } }).chave).toBe("COMPLETA")
    expect(situacaoTranscricao({ ...enc, transcricao: "INCOMPLETA", transcricao_obs: "Faltam ~10 s." })).toMatchObject({ chave: "INCOMPLETA", detalhe: "Faltam ~10 s." })
    expect(situacaoTranscricao({ ...enc, transcricao: "DESATIVADA" }).chave).toBe("DESATIVADA")
    expect(situacaoTranscricao({ ...enc, transcricao: null }).chave).toBe("SEM_GRAVACAO")
  })

  it("os trechos seguidos da mesma pessoa viram um bloco; outra pessoa ou 30 s de silencio abrem outro", () => {
    const t = (id, u, nome, ini, fim, texto) => ({ id_trecho: id, id_usuario: u, nome, inicio_ts: ini, fim_ts: fim, texto })
    const trechos = [
      t(1, 1, "Ana", "2026-11-05T17:00:00.000Z", "2026-11-05T17:00:03.000Z", "Bom dia."),
      t(2, 1, "Ana", "2026-11-05T17:00:04.000Z", "2026-11-05T17:00:08.000Z", "Vamos começar."),
      t(3, 2, "Bruno", "2026-11-05T17:00:09.000Z", "2026-11-05T17:00:12.000Z", "Bom dia!"),
      t(4, 2, "Bruno", "2026-11-05T17:01:00.000Z", "2026-11-05T17:01:02.000Z", "Voltei."),
    ]
    const blocos = agruparTrechos(trechos)
    expect(blocos.map((b) => [b.nome, b.textos.join(" ")])).toEqual([
      ["Ana", "Bom dia. Vamos começar."],
      ["Bruno", "Bom dia!"],
      ["Bruno", "Voltei."],
    ])
    const texto = transcricaoEmTexto({ titulo: "Mentoria", inicio_ts: "2026-11-05T14:00:00" }, trechos)
    expect(texto.split("\n")[0]).toContain("Mentoria")
    expect(texto).toContain("Ana: Bom dia. Vamos começar.")
  })
})
