/**
 * Os campos personalizaveis (startup_campo) FORA do formulario: como cada tipo
 * se le numa tabela, como se ordena e como se filtra.
 *
 * CampoPersonalizado.jsx cuida da metade "editar"; este arquivo cuida da metade
 * "consultar". A separacao existe porque a listagem precisa de coisas que o
 * formulario nao tem: um valor comparavel para ordenar a coluna, e a definicao
 * do grupo de filtro correspondente ao tipo do campo.
 *
 * O TIPO DECIDE O FILTRO, e essa e a ideia toda: um campo MONETARIO pede um
 * intervalo ("startups com faturamento entre X e Y"), um CATEGORIA pede uma
 * lista de marcar, e um TEXTO pede busca livre. Oferecer busca livre para tudo
 * transformaria "faturamento" numa comparacao de strings.
 */
import {
  aplicarMascara,
  desmascarar,
  formatarMoeda,
  numeroParaMoeda,
} from "./mascaras"

/** Prefixo dos ids de filtro dos campos extras, para nao colidir com os fixos. */
export const PREFIXO_FILTRO_EXTRA = "extra:"

/** O simbolo que abre um campo monetario. Sem Intl para nao formatar o zero. */
export function simboloDaMoeda(moeda = "BRL") {
  const simbolos = { BRL: "R$", USD: "US$", EUR: "€", GBP: "£" }
  return simbolos[moeda] || moeda
}

/**
 * O valor gravado vira o texto que se le.
 *
 * @returns {string|null} `null` quando o campo nao foi preenchido — quem chama
 *   decide se isso vira travessao (tabela) ou some da tela (aba de cadastro).
 */
export function formatarCampoExtra(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return null

  switch (campo.tipo) {
    case "MONETARIO":
      return formatarMoeda(valor, campo.config?.moeda)
    case "DOCUMENTO":
      return aplicarMascara(valor, campo.config?.mascara)
    case "CATEGORIA": {
      const opcao = (campo.config?.opcoes || []).find((o) => o.valor === valor)
      // A opcao pode ter sido removida da definicao depois de gravada: mostrar
      // o valor cru e melhor do que apagar o que a startup respondeu.
      return opcao?.rotulo || String(valor)
    }
    case "NUMERICO": {
      const casas = campo.config?.casas ?? 0
      const numero = Number(valor).toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })
      return campo.config?.sufixo ? `${numero} ${campo.config.sufixo}` : numero
    }
    default:
      return String(valor)
  }
}

/**
 * O valor comparavel na ordenacao da coluna.
 *
 * Numero para o que e numero — senao "1.000,00" viria antes de "9,00" na
 * comparacao de texto — e o ROTULO para categoria, porque e o rotulo que a
 * coluna mostra e e por ele que a ordenacao alfabetica faz sentido.
 */
export function valorOrdenacaoCampoExtra(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return null

  if (campo.tipo === "MONETARIO" || campo.tipo === "NUMERICO") {
    const numero = Number(valor)
    return Number.isNaN(numero) ? null : numero
  }
  return formatarCampoExtra(campo, valor)
}

/**
 * O grupo de filtro que este campo merece, no formato do PainelFiltros.
 * @returns {object|null} `null` para campo que nao vale a pena filtrar.
 */
export function grupoFiltroCampoExtra(campo) {
  const base = { id: PREFIXO_FILTRO_EXTRA + campo.chave, rotulo: campo.rotulo }

  switch (campo.tipo) {
    case "CATEGORIA": {
      const opcoes = campo.config?.opcoes || []
      // Categoria sem opcao cadastrada nao tem o que oferecer.
      if (!opcoes.length) return null
      return {
        ...base,
        tipo: "checkbox",
        itens: opcoes.map((o) => ({ id: String(o.valor), rotulo: o.rotulo })),
      }
    }
    case "NUMERICO":
      return { ...base, tipo: "intervalo", sufixo: campo.config?.sufixo }
    case "MONETARIO":
      return { ...base, tipo: "intervalo", prefixo: simboloDaMoeda(campo.config?.moeda) }
    default:
      // TEXTO e DOCUMENTO: busca livre pelo conteudo.
      return { ...base, tipo: "texto" }
  }
}

/**
 * A linha passa pelo que foi escolhido para este campo?
 *
 * @param {object} campo - a definicao.
 * @param {*} valor - o que a startup gravou em campos_extras.
 * @param {*} selecao - o valor do grupo no PainelFiltros.
 */
export function casaFiltroCampoExtra(campo, valor, selecao) {
  if (selecao === undefined || selecao === null || selecao === "") return true

  if (campo.tipo === "CATEGORIA") {
    const marcados = Array.isArray(selecao) ? selecao : [selecao]
    if (!marcados.length) return true
    return marcados.includes(String(valor ?? ""))
  }

  if (campo.tipo === "NUMERICO" || campo.tipo === "MONETARIO") {
    const { min, max } = selecao
    if ((min === "" || min == null) && (max === "" || max == null)) return true
    // Campo em branco nao esta em intervalo nenhum: com o filtro ligado, sai.
    if (valor === null || valor === undefined || valor === "") return false
    const numero = Number(valor)
    if (Number.isNaN(numero)) return false
    if (min !== "" && min != null && numero < Number(min)) return false
    if (max !== "" && max != null && numero > Number(max)) return false
    return true
  }

  const termo = String(selecao).trim().toLowerCase()
  if (!termo) return true
  if (valor === null || valor === undefined || valor === "") return false

  if (campo.tipo === "DOCUMENTO") {
    // Compara so os caracteres uteis: o documento e gravado sem mascara, e quem
    // digita "123.456" nao encontraria "123456".
    const alvo = desmascarar(valor).toLowerCase()
    const busca = desmascarar(termo).toLowerCase()
    return busca ? alvo.includes(busca) : true
  }

  const texto =
    campo.tipo === "MONETARIO" ? numeroParaMoeda(valor) : String(formatarCampoExtra(campo, valor))
  return texto.toLowerCase().includes(termo)
}
