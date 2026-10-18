/**
 * Construtor do tema MUI a partir das preferencias do usuario.
 *
 * As preferencias (tema claro/escuro, cor principal, densidade e raio das
 * bordas) sao carregadas do backend e transformadas aqui num tema do MUI.
 * O App recria o tema sempre que as preferencias mudam.
 *
 * IDENTIDADE VISUAL
 * Segue o modelo de apresentacao do Desafio Empreende UFFS 2026 (INNE /
 * FronteiraTec): preto, branco e lima, com as quatro cores do logo EMPREENDE
 * UFFS como apoio. Os valores de MARCA foram amostrados do proprio PDF, nao
 * estimados a olho.
 *
 * A cor principal nao entra crua no tema: lima puro sobre branco tem 1,6:1 de
 * contraste, ilegivel como texto. Cada cor vira duas, conforme a aparencia:
 *   - main: a versao que funciona como TEXTO e ICONE sobre as superficies do
 *     modo. No claro o lima escurece ate um verde fundo; no escuro fica como
 *     esta, porque sobre preto ele ja brilha. E o que as telas usam em
 *     `color: "primary.main"`, avatares, abas, links e campos em foco.
 *   - vivo: a versao para PREENCHIMENTO (botao principal, item selecionado).
 *     No claro, cor clara demais para texto branco (lima, amarelo) entra pura,
 *     com texto preto — o par lima + preto do circulo da seta no PDF. Nas
 *     demais situacoes e o proprio main.
 */
import {
  createTheme,
  alpha,
  darken,
  lighten,
  getContrastRatio,
  rgbToHex,
  decomposeColor,
} from "@mui/material/styles"

/** Cores da identidade, amostradas do PDF do modelo de apresentacao. */
export const MARCA = {
  lima: "#76db00",
  // O circulo da seta e a barra vertical ao lado dos textos.
  limaClaro: "#c1ff72",
  // O painel verde do slide "No xadrez e nas startups".
  verde: "#44b200",
  preto: "#000000",
  branco: "#ffffff",
  // As quatro cores do logo EMPREENDE UFFS, na ordem: EM, PRE, ENDE, UFFS.
  logo: { verde: "#009937", magenta: "#be2d71", amarelo: "#fbd200", azul: "#3b88c3" },
}

/**
 * Familias tipograficas, empacotadas pelo @fontsource (importadas no main.jsx)
 * em vez de buscadas no Google Fonts.
 *
 * Anton e a mesma dos titulos do PDF. O texto do PDF usa a Agrandir Wide, que
 * e paga (Pangram Pangram); a Unbounded e a substituta aberta mais proxima —
 * larga, geometrica, o mesmo "t" inclinado — e fica nos rotulos em caixa alta.
 * O corpo e a Plus Jakarta Sans: o texto largo do PDF funciona em slide, mas
 * numa tela de tabelas e formularios cortaria rotulos; esta e legivel e quase
 * da largura da Arial que o sistema usava ate aqui.
 */
export const FONTES = {
  titulo: '"Anton", Impact, "Arial Narrow", sans-serif',
  larga: '"Unbounded Variable", "Plus Jakarta Sans Variable", sans-serif',
  corpo: '"Plus Jakarta Sans Variable", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

/**
 * Cores principais oferecidas no painel de conta: primeiro as da identidade
 * (o lima, que e o padrao, e as quatro do logo), depois a paleta que o painel
 * ja oferecia antes dela. Cada uma e ajustada a aparencia em paletaDaCor,
 * como qualquer cor salva.
 */
export const CORES_PRINCIPAIS = [
  { nome: "Lima", cor: MARCA.lima },
  { nome: "Verde UFFS", cor: MARCA.logo.verde },
  { nome: "Magenta UFFS", cor: MARCA.logo.magenta },
  { nome: "Amarelo UFFS", cor: MARCA.logo.amarelo },
  { nome: "Azul UFFS", cor: MARCA.logo.azul },
  { nome: "Índigo", cor: "#4f46e5" },
  { nome: "Verde", cor: "#16a34a" },
  { nome: "Laranja", cor: "#f97316" },
  { nome: "Vermelho", cor: "#dc2626" },
  { nome: "Roxo", cor: "#9333ea" },
  { nome: "Rosa", cor: "#db2777" },
  { nome: "Ciano", cor: "#0891b2" },
  { nome: "Amarelo", cor: "#ca8a04" },
]

// Preferencias padrao (espelham os DEFAULT do backend/schema.sql). Usadas
// antes do login ou enquanto as preferencias reais nao carregaram.
export const PREFERENCIAS_PADRAO = {
  tema: "claro",
  cor_primaria: MARCA.lima,
  cor_secundaria: "#0ea5e9",
  densidade: "confortavel",
  borda_arredondada: 12,
  sidebar_recolhida: false,
}

/** Superficies de cada aparencia: o fundo da pagina e o papel dos paineis. */
export const SUPERFICIES = {
  claro: { fundo: "#f5f5f5", papel: "#ffffff" },
  escuro: { fundo: "#0a0a0a", papel: "#141414" },
}

// Contraste minimo do `main` contra as duas superficies do modo. No claro e o
// minimo de texto (4,5:1). No escuro e mais alto de proposito: uma cor
// saturada no limite parece apagada sobre preto, e a versao mais luminosa
// conversa com o lima "aceso" do PDF.
const ALVO_CLARO = 4.5
const ALVO_ESCURO = 6

// Uma cor "clara" aguenta texto preto com folga (lima 11:1, amarelo 13:1,
// laranja 7:1): no tema claro ela preenche botoes e a barra pura, com texto
// preto, sem ser escurecida — laranja e amarelo escurecidos viram marrom.
const ALVO_COR_CLARA = 6.5

const TINTA_ESCURA = "#0a0a0a"
const TINTA_CLARA = "#ffffff"
const HEX = /^#[0-9a-f]{6}$/i

/** Texto (preto ou branco) de maior contraste sobre `fundo`. */
function textoSobre(fundo) {
  return getContrastRatio(fundo, TINTA_ESCURA) >= getContrastRatio(fundo, TINTA_CLARA)
    ? TINTA_ESCURA
    : TINTA_CLARA
}

/**
 * Escurece (claro) ou clareia (escuro) a cor ate ela ter o contraste-alvo
 * contra o fundo e o papel do modo. So a luminosidade muda: o lima continua
 * lima, so mais fundo. Devolve sempre #rrggbb — ha telas que concatenam um
 * alpha hexadecimal ao `main` (ex.: `${main}1a`).
 */
function ajustarAoModo(cor, escuro) {
  const { fundo, papel } = escuro ? SUPERFICIES.escuro : SUPERFICIES.claro
  const alvo = escuro ? ALVO_ESCURO : ALVO_CLARO
  const mover = escuro ? lighten : darken

  for (let passo = 0; passo <= 50; passo += 1) {
    const candidata = passo === 0 ? cor : mover(cor, passo / 50)
    if (Math.min(getContrastRatio(candidata, fundo), getContrastRatio(candidata, papel)) >= alvo) {
      return rgbToHex(candidata)
    }
  }
  return escuro ? TINTA_CLARA : TINTA_ESCURA
}

/**
 * Paleta MUI de uma cor para a aparencia atual (main/vivo — ver o cabecalho
 * do arquivo).
 * @param {string} cor - #rrggbb: a preferencia do usuario ou uma cor da marca.
 * @param {boolean} escuro
 */
export function paletaDaCor(cor, escuro) {
  const main = ajustarAoModo(cor, escuro)
  const clara = getContrastRatio(cor, TINTA_ESCURA) >= ALVO_COR_CLARA
  const vivo = !escuro && clara ? cor : main
  return {
    main,
    contrastText: textoSobre(main),
    vivo,
    vivoContraste: textoSobre(vivo),
  }
}

/** Cor solida de `cor` aplicada com `peso` (0..1) sobre `base`. */
function misturar(cor, base, peso) {
  const a = decomposeColor(cor).values
  const b = decomposeColor(base).values
  return rgbToHex(`rgb(${a.slice(0, 3).map((v, i) => Math.round(v * peso + b[i] * (1 - peso))).join(", ")})`)
}

/**
 * Cores da barra do topo (Navbar + cabecalho da Sidebar), que pinta na cor
 * escolhida e muda com a aparencia:
 *   - claro: a propria cor, viva, com texto preto ou branco (lima + preto);
 *   - escuro: um tom escuro da cor (o brilho verde dos slides pretos do PDF),
 *     com texto branco e o destaque (logo, avatar) na cor clareada — a cor
 *     viva numa faixa larga sobre a tela preta ofuscaria.
 * `destaque` e o que se apoia sobre a barra: o centauro, o avatar, a faixa.
 * @param {ReturnType<typeof paletaDaCor>} primaria - Paleta da cor no modo atual.
 * @param {string} cor - A cor escolhida (#rrggbb).
 * @param {boolean} escuro
 */
function paletaDaBarra(primaria, cor, escuro) {
  if (escuro) {
    return {
      fundo: misturar(cor, SUPERFICIES.escuro.fundo, 0.22),
      texto: "#fafafa",
      destaque: primaria.main,
      destaqueTexto: primaria.contrastText,
    }
  }
  return {
    fundo: primaria.vivo,
    texto: primaria.vivoContraste,
    destaque: primaria.vivoContraste,
    destaqueTexto: primaria.vivo,
  }
}

/**
 * Resolve se o tema deve ser escuro, incluindo o modo "automatico" (segue a
 * preferencia de cor do sistema operacional/navegador).
 */
function resolverEscuro(tema) {
  if (tema === "escuro") return true
  if (tema === "automatico") {
    return (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
    )
  }
  return false
}

/**
 * Monta um tema do MUI a partir das preferencias.
 * @param {object} prefs - Preferencias do usuario.
 * @returns {import('@mui/material').Theme}
 */
export function construirTema(prefs = PREFERENCIAS_PADRAO) {
  const escuro = resolverEscuro(prefs.tema)
  const compacta = prefs.densidade === "compacta"
  const superficie = escuro ? SUPERFICIES.escuro : SUPERFICIES.claro
  const cor = HEX.test(prefs.cor_primaria ?? "") ? prefs.cor_primaria : MARCA.lima
  const primaria = paletaDaCor(cor, escuro)
  const barra = paletaDaBarra(primaria, cor, escuro)

  // Selecao (menu, lista, item ativo da Sidebar): um veu do preenchimento
  // vivo. No claro isso da o verde-lima palido do PDF, e nao o verde
  // acinzentado que sairia do `main` escurecido. Foco por teclado e toque
  // entram junto, senao o MUI volta ao veu do `main` nesses dois casos.
  const selecao = alpha(primaria.vivo, escuro ? 0.16 : 0.22)
  const selecaoForte = alpha(primaria.vivo, escuro ? 0.24 : 0.32)
  const itemSelecionado = {
    "&.Mui-selected": {
      backgroundColor: selecao,
      "&.Mui-focusVisible": { backgroundColor: selecaoForte },
    },
    "&.Mui-selected:hover": {
      backgroundColor: selecaoForte,
      "@media (hover: none)": { backgroundColor: selecao },
    },
  }

  // Texto selecionado (::selection): a cor escolhida pela metade sobre o
  // papel do modo — tom claro no claro, escuro no escuro — com o texto de
  // maior contraste por cima. Com o lima padrao da quase o limaClaro do PDF.
  const grifo = misturar(cor, superficie.papel, 0.5)

  // Anton tem um peso so. Sem `fontSynthesis: none`, o fontWeight={700} que
  // as telas passam aos titulos faria o navegador engordar a letra na marra.
  const titulo = {
    fontFamily: FONTES.titulo,
    fontWeight: 400,
    fontSynthesis: "none",
    textTransform: "uppercase",
    letterSpacing: "0.01em",
  }

  return createTheme({
    palette: {
      mode: escuro ? "dark" : "light",
      primary: primaria,
      // A secundaria e a tinta da marca — preto no claro, branco no escuro — e
      // nao vem da preferencia `cor_secundaria`: o par preto/branco e metade
      // da identidade, e nenhuma tela deixa escolher a secundaria.
      secondary: escuro
        ? { main: "#fafafa", contrastText: TINTA_ESCURA }
        : { main: TINTA_ESCURA, contrastText: TINTA_CLARA },
      success: paletaDaCor(MARCA.logo.verde, escuro),
      info: paletaDaCor(MARCA.logo.azul, escuro),
      background: { default: superficie.fundo, paper: superficie.papel },
      text: escuro
        ? { primary: "#fafafa", secondary: "#a3a3a3", disabled: "rgba(255, 255, 255, 0.38)" }
        : { primary: TINTA_ESCURA, secondary: "#525252", disabled: "rgba(0, 0, 0, 0.38)" },
      divider: escuro ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      // Cores fixas da identidade, iguais nas duas aparencias (o painel preto
      // do login, o lima das faixas). No sx: `bgcolor: "marca.preto"`.
      marca: MARCA,
      // A barra do topo na cor escolhida (ver paletaDaBarra). No sx:
      // `bgcolor: "barra.fundo"`.
      barra,
    },
    typography: {
      fontFamily: FONTES.corpo,
      // Titulos de pagina e numeros de destaque: o "TITULO" do PDF.
      h1: { ...titulo, lineHeight: 1 },
      h2: { ...titulo, lineHeight: 1 },
      h3: { ...titulo, lineHeight: 1.05 },
      h4: { ...titulo, lineHeight: 1.1 },
      h5: { ...titulo, lineHeight: 1.2 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      // Rotulos de secao em caixa alta e largos, como a faixa do PDF.
      overline: { fontFamily: FONTES.larga, fontWeight: 600, letterSpacing: "0.12em" },
      button: { fontWeight: 700, letterSpacing: "0.04em" },
    },
    shape: { borderRadius: prefs.borda_arredondada },
    // Densidade "compacta" reduz o espacamento base e o tamanho dos controles.
    spacing: compacta ? 6 : 8,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // Barras de rolagem e controles nativos acompanham a aparencia —
          // sem isso, o tema escuro ganha barras de rolagem brancas.
          html: { colorScheme: escuro ? "dark" : "light" },
          body: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
          "::selection": { backgroundColor: grifo, color: textoSobre(grifo) },
        },
      },
      MuiButton: {
        defaultProps: { size: compacta ? "small" : "medium", disableElevation: true },
        styleOverrides: {
          // O botao principal usa o preenchimento vivo: no claro, lima com
          // texto preto. O hover de toque precisa vir junto, senao o MUI volta
          // ao `main` nos aparelhos sem mouse.
          containedPrimary: {
            backgroundColor: primaria.vivo,
            color: primaria.vivoContraste,
            "&:hover": {
              backgroundColor: darken(primaria.vivo, 0.12),
              "@media (hover: none)": { backgroundColor: primaria.vivo },
            },
          },
        },
      },
      MuiTextField: { defaultProps: { size: compacta ? "small" : "medium" } },
      // A barra do topo pinta na cor escolhida, ajustada a aparencia
      // (paletaDaBarra). A linha de baixo e sombra interna, e nao borda: borda
      // somaria 1px a altura e desalinharia a barra do cabecalho da Sidebar ao
      // lado (que usa a mesma linha). `border: 0` tira a borda que a regra de
      // paineis abaixo poria em volta toda.
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: barra.fundo,
            color: barra.texto,
            border: 0,
            boxShadow: `inset 0 -1px 0 ${alpha(barra.texto, 0.12)}`,
          },
        },
      },
      // Paineis de secao (elevation 1-4) ficam solidos: sem sombra, sem
      // gradiente de overlay do modo escuro, com borda fina no lugar da
      // sombra. Elevacoes altas (menu, popover, dialog) mantem a sombra —
      // sao overlays temporarios de verdade, nao "cards" de pagina.
      MuiPaper: {
        styleOverrides: {
          root: ({ theme, ownerState }) => ({
            backgroundImage: "none",
            ...(ownerState.elevation !== undefined && ownerState.elevation <= 4
              ? { boxShadow: "none", border: `1px solid ${theme.palette.divider}` }
              : {}),
          }),
        },
      },
      // No escuro, os overlays ficam um degrau acima do papel: sobre o fundo
      // quase preto, a sombra sozinha nao separa nada.
      ...(escuro && {
        MuiPopover: { styleOverrides: { paper: { backgroundColor: "#1c1c1c" } } },
        MuiDialog: { styleOverrides: { paper: { backgroundColor: "#1c1c1c" } } },
        MuiAutocomplete: { styleOverrides: { paper: { backgroundColor: "#1c1c1c" } } },
      }),
      MuiListItemButton: { styleOverrides: { root: itemSelecionado } },
      MuiMenuItem: { styleOverrides: { root: itemSelecionado } },
      MuiTabs: { styleOverrides: { indicator: { height: 3 } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: escuro ? "#2a2a2a" : alpha(TINTA_ESCURA, 0.92),
            fontWeight: 500,
          },
          arrow: { color: escuro ? "#2a2a2a" : alpha(TINTA_ESCURA, 0.92) },
        },
      },
    },
  })
}
