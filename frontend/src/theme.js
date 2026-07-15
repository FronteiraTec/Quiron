/**
 * Construtor do tema MUI a partir das preferencias do usuario.
 *
 * As preferencias (tema claro/escuro, cores do painel, densidade e raio das
 * bordas) sao carregadas do backend e transformadas aqui num tema do MUI.
 * O App recria o tema sempre que as preferencias mudam.
 */
import { createTheme } from "@mui/material"

// Preferencias padrao (espelham os DEFAULT do backend/schema.sql). Usadas
// antes do login ou enquanto as preferencias reais nao carregaram.
export const PREFERENCIAS_PADRAO = {
  tema: "claro",
  cor_primaria: "#4f46e5",
  cor_secundaria: "#0ea5e9",
  densidade: "confortavel",
  borda_arredondada: 12,
  sidebar_recolhida: false,
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

  return createTheme({
    palette: {
      mode: escuro ? "dark" : "light",
      primary: { main: prefs.cor_primaria },
      secondary: { main: prefs.cor_secundaria },
      background: {
        default: escuro ? "#0f172a" : "#f5f7fb",
        paper: escuro ? "#1e293b" : "#ffffff",
      },
    },
    shape: { borderRadius: prefs.borda_arredondada },
    // Densidade "compacta" reduz o espacamento base e o tamanho dos controles.
    spacing: compacta ? 6 : 8,
    components: {
      MuiButton: { defaultProps: { size: compacta ? "small" : "medium" } },
      MuiTextField: { defaultProps: { size: compacta ? "small" : "medium" } },
    },
  })
}
