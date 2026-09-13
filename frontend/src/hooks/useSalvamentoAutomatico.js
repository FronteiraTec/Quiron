/**
 * Salvamento automatico com janela de espera.
 *
 * O PROBLEMA
 * Num editor de documento, "Salvar" e uma pergunta que o usuario nao deveria
 * precisar responder — ninguem escreve uma aula de vinte blocos torcendo para
 * nao fechar a aba antes de clicar no botao. Mas salvar a cada tecla seria uma
 * requisicao por caractere: o servidor reescreveria o documento inteiro
 * dezenas de vezes por frase.
 *
 * COMO FUNCIONA
 * Cada alteracao reagenda um relogio. Quando a pessoa para de digitar pelo
 * tempo de `atraso`, o que estiver no `obterValor` e enviado uma vez so.
 *
 *   digita ─ digita ─ digita ─┐
 *                             └── (parou) ── espera ── salva
 *
 * O valor sai de uma FUNCAO, e nao de uma prop: assim quem edita nao precisa
 * guardar o documento no estado do React e re-renderizar a pagina inteira a
 * cada tecla. O unico re-render que este hook provoca e o da troca de estado
 * visivel (ocioso -> pendente -> salvando -> salvo).
 *
 * O QUE DA ERRADO, E O QUE ELE FAZ
 *   rede caiu / API respondeu erro   fica em "erro" e tenta de novo sozinho,
 *                                    dobrando a espera ate um teto
 *   salvou e a pessoa continuou      a alteracao nova reagenda; nada se perde
 *   duas gravacoes ao mesmo tempo    nao acontece: se ja houver uma em curso,
 *                                    a proxima e enfileirada, nao disparada
 *   fechou a aba com pendencia       o navegador pergunta antes de sair
 */
import { useCallback, useEffect, useRef, useState } from "react"

// Espera depois da ultima tecla. Curto o bastante para "Salvo" aparecer
// enquanto a pessoa ainda olha a tela, longo o bastante para uma frase
// inteira caber numa requisicao so.
const ATRASO_PADRAO = 1200

// Primeira espera depois de uma falha, e o teto para onde ela cresce.
const REPETICAO_INICIAL = 4000
const REPETICAO_MAXIMA = 30000

/**
 * @param {object}   opcoes
 * @param {Function} opcoes.obterValor - devolve o que deve ser salvo agora
 * @param {Function} opcoes.salvar     - recebe o valor; deve rejeitar em caso de erro
 * @param {number}   [opcoes.atraso]   - janela de espera, em ms
 * @param {boolean}  [opcoes.ativo]    - false desliga o salvamento (modo leitura)
 * @returns {{estado: string, erro: string|null, salvoEm: Date|null,
 *            pendente: boolean, avisarAlteracao: Function,
 *            salvarAgora: () => Promise<boolean>}}
 */
export function useSalvamentoAutomatico({
  obterValor,
  salvar,
  atraso = ATRASO_PADRAO,
  ativo = true,
}) {
  // ocioso | pendente | salvando | salvo | erro
  const [estado, setEstado] = useState("ocioso")
  const [erro, setErro] = useState(null)
  const [salvoEm, setSalvoEm] = useState(null)

  const relogio = useRef(null)
  const salvando = useRef(false)
  // Alteracao que chegou enquanto uma gravacao estava em curso.
  const refazer = useRef(false)
  const esperaDaFalha = useRef(REPETICAO_INICIAL)
  const montado = useRef(true)

  // As funcoes vem do componente e mudam de identidade a cada render; guardar
  // a ultima numa ref evita reagendar o relogio a toa.
  const refObter = useRef(obterValor)
  const refSalvar = useRef(salvar)
  refObter.current = obterValor
  refSalvar.current = salvar

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
      clearTimeout(relogio.current)
    }
  }, [])

  /**
   * Grava agora. Devolve se a gravacao foi em frente — quem fecha a tela
   * precisa saber se pode sair ou se o trabalho ficou no ar.
   */
  const executar = useCallback(async () => {
    if (!montado.current) return false

    // Ja ha uma gravacao no ar: marca para repetir quando ela terminar, em
    // vez de mandar duas versoes do mesmo documento em paralelo — a ordem de
    // chegada no servidor nao e garantida, e a mais antiga poderia vencer.
    if (salvando.current) {
      refazer.current = true
      return false
    }

    salvando.current = true
    setEstado("salvando")
    setErro(null)
    let deuCerto = false

    try {
      await refSalvar.current(refObter.current())
      deuCerto = true
      if (!montado.current) return true

      esperaDaFalha.current = REPETICAO_INICIAL
      setSalvoEm(new Date())
      setEstado(refazer.current ? "pendente" : "salvo")
    } catch (err) {
      if (!montado.current) return false

      setErro(err?.response?.data?.erro || err?.message || "Não foi possível salvar.")
      setEstado("erro")

      // Tenta de novo sozinho, esperando cada vez mais: uma queda de rede se
      // resolve em segundos, e insistir de meio em meio segundo so multiplica
      // o erro. O botao "Tentar agora" continua disponivel para quem nao quer
      // esperar.
      clearTimeout(relogio.current)
      relogio.current = setTimeout(executar, esperaDaFalha.current)
      esperaDaFalha.current = Math.min(esperaDaFalha.current * 2, REPETICAO_MAXIMA)
    } finally {
      salvando.current = false

      if (refazer.current && montado.current) {
        refazer.current = false
        clearTimeout(relogio.current)
        relogio.current = setTimeout(executar, atraso)
      }
    }

    return deuCerto
  }, [atraso])

  /** Chamada pelo editor a cada alteracao. Reagenda o relogio. */
  const avisarAlteracao = useCallback(() => {
    if (!ativo) return

    setEstado((atual) => (atual === "salvando" ? atual : "pendente"))
    clearTimeout(relogio.current)
    relogio.current = setTimeout(executar, atraso)
  }, [ativo, atraso, executar])

  /** Grava agora, sem esperar. Usada ao fechar o editor e no botao de repetir. */
  const salvarAgora = useCallback(() => {
    clearTimeout(relogio.current)
    return executar()
  }, [executar])

  // Fechar a aba com alteracao por gravar. O navegador so mostra o aviso
  // padrao dele — texto proprio e ignorado ha anos —, mas o aviso e o que
  // importa: sem ele a ultima frase escrita simplesmente sumiria.
  const temPendencia = estado === "pendente" || estado === "salvando" || estado === "erro"
  useEffect(() => {
    if (!temPendencia) return

    const aoSair = (e) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", aoSair)
    return () => window.removeEventListener("beforeunload", aoSair)
  }, [temPendencia])

  return { estado, erro, salvoEm, pendente: temPendencia, avisarAlteracao, salvarAgora }
}
