/**
 * Metadados dos niveis da Trilha (rotulo, icone, cor e qual filho cada um
 * aceita). Substitui o antigo programaMock.js: a arvore agora vem da API
 * (/trilha), entao aqui sobrou apenas o que e de apresentacao.
 *
 * Hierarquia (espelha trilhaNoTipo no banco):
 *   PROGRAMA
 *     └── FASE
 *           └── MODULO
 *                 └── PASSO
 *
 * Todo no traz os filhos em `filhos` — no mock cada nivel tinha sua propria
 * chave (fases, modulos, tarefas), o que obrigava os componentes a saberem em
 * que nivel estavam. Com uma chave so, eles ficam genericos de verdade.
 */
import { Timeline, ViewModule, Assignment, AutoStories } from "@mui/icons-material"

export const TIPO_META = {
  PROGRAMA: {
    label: "Programa",
    plural: "Programas",
    childTipo: "FASE",
    childLabel: "fase",
    icon: AutoStories,
    cor: "#8b5cf6",
  },
  FASE: {
    label: "Fase",
    plural: "Fases",
    childTipo: "MODULO",
    childLabel: "módulo",
    icon: Timeline,
    cor: "#6366f1",
  },
  MODULO: {
    label: "Módulo",
    plural: "Módulos",
    childTipo: "PASSO",
    childLabel: "passo",
    icon: ViewModule,
    cor: "#0ea5e9",
  },
  PASSO: {
    label: "Passo",
    plural: "Passos",
    childTipo: null, // folha
    childLabel: null,
    icon: Assignment,
    cor: "#10b981",
  },
}

/**
 * Tipos de PASSO (o que a startup faz nele). Espelha o enum tarefaTipo.
 */
export const TIPOS_PASSO = [
  { valor: "TEXTO", label: "Resposta em texto" },
  { valor: "ANEXO", label: "Envio de arquivo" },
  { valor: "VIDEO", label: "Vídeo" },
  { valor: "QUESTIONARIO", label: "Questionário" },
]

/** Percorre a arvore aplicando `fn` a cada no (pre-ordem). */
export function percorrer(nos, fn) {
  for (const no of nos) {
    fn(no)
    if (no.filhos?.length) percorrer(no.filhos, fn)
  }
}

/** Encontra um no por id em qualquer profundidade. */
export function acharNo(nos, id) {
  for (const no of nos) {
    if (no.id_no === id) return no
    const achado = no.filhos?.length ? acharNo(no.filhos, id) : null
    if (achado) return achado
  }
  return null
}

/**
 * Caminho da raiz ate o no (usado no breadcrumb).
 * @returns {object[]} Os nos do caminho, incluindo o proprio.
 */
export function caminhoAte(nos, id, trilha = []) {
  for (const no of nos) {
    const atual = [...trilha, no]
    if (no.id_no === id) return atual
    if (no.filhos?.length) {
      const achado = caminhoAte(no.filhos, id, atual)
      if (achado) return achado
    }
  }
  return null
}
