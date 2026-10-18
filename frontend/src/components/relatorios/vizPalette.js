/**
 * Paleta dos graficos dos relatorios.
 *
 * Por que uma paleta propria e nao a cor do tema: o usuario escolhe a cor
 * primaria do painel (preferenciaStore), e cor de dado nao pode depender de
 * gosto — uma primaria clarinha deixaria as series indistinguiveis para quem
 * tem daltonismo. As cores abaixo foram validadas contra as duas superficies
 * do app de entao (#ffffff no claro, #1e293b no escuro) nas checagens de banda
 * de luminosidade, piso de croma, separacao sob CVD e contraste. O papel
 * escuro da identidade atual (#141414) e mais escuro que aquele: o contraste
 * das series contra ele so aumentou.
 *
 * A cor do tema continua mandando em tudo que e interface (botoes, links,
 * barras de progresso). Aqui so os dados.
 */

// Rampa ordinal do funil de entregas: um unico tom (azul), do claro ao escuro.
// A ordem e sempre "quanto mais adiante no funil, mais contraste contra o
// fundo" — no claro isso e escurecer, no escuro e clarear. Assim a etapa final
// (aprovado) salta nos dois modos.
const FUNIL_CLARO = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"]
const FUNIL_ESCURO = ["#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"]

// Series categoricas (envios x avaliacoes). Duas cores em ordem fixa: a serie
// nunca troca de cor quando um filtro muda o conjunto.
const SERIES_CLARO = ["#2a78d6", "#008300"]
const SERIES_ESCURO = ["#3987e5", "#0ca30c"]

// Cores de estado, reservadas: nunca viram "serie 3". Sempre acompanhadas de
// rotulo ou icone — no claro, ATENCAO e ALERTA ficam abaixo de 3:1 de
// contraste de proposito, e o texto ao lado e o que carrega o significado.
export const STATUS = {
  BOM: "#0ca30c",
  ATENCAO: "#fab219",
  ALERTA: "#ec835a",
  CRITICO: "#d03b3b",
}

// Tinta do "chrome" do grafico: eixos, grades e rotulos ficam discretos para
// o dado ser a coisa mais forte da tela.
const CHROME_CLARO = { grade: "#e1e0d9", eixo: "#c3c2b7", rotulo: "#898781" }
const CHROME_ESCURO = { grade: "#2c2c2a", eixo: "#383835", rotulo: "#898781" }

/**
 * Resolve a paleta para o modo do tema atual.
 * @param {"light"|"dark"} modo - theme.palette.mode
 */
export function paletaViz(modo) {
  const escuro = modo === "dark"
  return {
    funil: escuro ? FUNIL_ESCURO : FUNIL_CLARO,
    series: escuro ? SERIES_ESCURO : SERIES_CLARO,
    chrome: escuro ? CHROME_ESCURO : CHROME_CLARO,
    // O papel dos paineis (SUPERFICIES em theme.js): o anel dos pontos dos
    // graficos de linha tem a cor do fundo para "recortar" a linha.
    superficie: escuro ? "#141414" : "#ffffff",
    status: STATUS,
  }
}

/**
 * Cor de estado de uma startup/passo no relatorio de progresso.
 * @param {"ALTO"|"MEDIO"|"OK"} risco
 */
export function corRisco(risco) {
  if (risco === "ALTO") return STATUS.CRITICO
  if (risco === "MEDIO") return STATUS.ATENCAO
  return STATUS.BOM
}
