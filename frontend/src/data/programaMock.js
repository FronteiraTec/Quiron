/**
 * Dados mockados e metadados do Construtor de Programa.
 *
 * O Construtor e a experiencia da incubadora (admin) para montar a trilha de
 * incubacao numa unica tela, estilo Notion/ClickUp. Enquanto nao existe API,
 * a arvore vive so no front, a partir deste mock.
 *
 * Hierarquia:
 *   Programa
 *     └── Fases
 *           └── Modulos
 *                 └── Tarefas
 *
 * Cada no tem: id, tipo, nome, descricao, ordem e ativo. Tarefas ja carregam
 * campos "futuros" (prazo, carga horaria, entregaveis, checklist, links...),
 * exibidos como secoes preparadas para crescer.
 */
import { Timeline, ViewModule, Assignment, AutoStories } from "@mui/icons-material"

// ---------------------------------------------------------------------------
// Metadados por tipo: rotulo, chave dos filhos, icone e cor de acento.
// Centraliza tudo que varia entre niveis para os componentes ficarem genericos.
// ---------------------------------------------------------------------------
export const TIPO_META = {
  programa: {
    label: "Programa",
    plural: "Programas",
    childKey: "fases",
    childTipo: "fase",
    childLabel: "fase",
    icon: AutoStories,
    cor: "#8b5cf6",
  },
  fase: {
    label: "Fase",
    plural: "Fases",
    childKey: "modulos",
    childTipo: "modulo",
    childLabel: "modulo",
    icon: Timeline,
    cor: "#6366f1",
  },
  modulo: {
    label: "Modulo",
    plural: "Modulos",
    childKey: "tarefas",
    childTipo: "tarefa",
    childLabel: "tarefa",
    icon: ViewModule,
    cor: "#0ea5e9",
  },
  tarefa: {
    label: "Tarefa",
    plural: "Tarefas",
    childKey: null,
    childTipo: null,
    childLabel: null,
    icon: Assignment,
    cor: "#10b981",
  },
}

// Gerador de ids estaveis para os nos criados no cliente.
let _seq = 1000
export const novoId = (tipo) => `${tipo}-${++_seq}`

/**
 * Cria um no vazio do tipo informado, ja com a ordem posicionada.
 * @param {"fase"|"modulo"|"tarefa"} tipo
 * @param {number} ordem
 */
export function criarNo(tipo, ordem, nome = "") {
  const base = { id: novoId(tipo), tipo, nome, descricao: "", ordem, ativo: true }
  if (tipo === "fase") return { ...base, modulos: [] }
  if (tipo === "modulo") return { ...base, tarefas: [] }
  // Tarefa: campos preparados para crescer (ainda sem UI de edicao completa).
  return {
    ...base,
    prazo: "",
    cargaHoraria: "",
    entregavel: "",
    links: [],
    checklist: [],
    anexos: [],
  }
}

// ---------------------------------------------------------------------------
// Programa de exemplo (baseado no roteiro do enunciado).
// ---------------------------------------------------------------------------
export const PROGRAMA_INICIAL = {
  id: "programa-1",
  tipo: "programa",
  nome: "Trilha de Incubacao 2026",
  descricao:
    "Programa completo de aceleracao: da ideacao ao produto validado no mercado.",
  ativo: true,
  fases: [
    {
      id: "fase-1",
      tipo: "fase",
      nome: "Ideacao",
      descricao: "Estruturar a ideia, o problema e as primeiras hipoteses.",
      ordem: 1,
      ativo: true,
      modulos: [
        {
          id: "modulo-1",
          tipo: "modulo",
          nome: "Modelo de Negocio",
          descricao: "Desenhar como a startup gera e captura valor.",
          ordem: 1,
          ativo: true,
          tarefas: [
            {
              id: "tarefa-1",
              tipo: "tarefa",
              nome: "Canvas",
              descricao: "Preencher o Business Model Canvas da startup.",
              ordem: 1,
              ativo: true,
              prazo: "2026-08-01",
              cargaHoraria: "2h",
              entregavel: "Canvas preenchido (PDF)",
              links: [],
              checklist: [],
              anexos: [],
            },
            {
              id: "tarefa-2",
              tipo: "tarefa",
              nome: "Persona",
              descricao: "Mapear o cliente ideal e suas dores.",
              ordem: 2,
              ativo: true,
              prazo: "",
              cargaHoraria: "1h30",
              entregavel: "Ficha de persona",
              links: [],
              checklist: [],
              anexos: [],
            },
            {
              id: "tarefa-3",
              tipo: "tarefa",
              nome: "Proposta de Valor",
              descricao: "Definir a proposta de valor unica.",
              ordem: 3,
              ativo: true,
              prazo: "",
              cargaHoraria: "1h",
              entregavel: "Value Proposition Canvas",
              links: [],
              checklist: [],
              anexos: [],
            },
          ],
        },
        {
          id: "modulo-2",
          tipo: "modulo",
          nome: "MVP",
          descricao: "Construir a menor versao testavel do produto.",
          ordem: 2,
          ativo: true,
          tarefas: [
            {
              id: "tarefa-4",
              tipo: "tarefa",
              nome: "Landing Page",
              descricao: "Publicar uma landing para captar interesse.",
              ordem: 1,
              ativo: true,
              prazo: "",
              cargaHoraria: "3h",
              entregavel: "URL da landing publicada",
              links: [],
              checklist: [],
              anexos: [],
            },
          ],
        },
      ],
    },
    {
      id: "fase-2",
      tipo: "fase",
      nome: "Validacao",
      descricao: "Testar hipoteses com clientes reais e medir traction.",
      ordem: 2,
      ativo: true,
      modulos: [],
    },
    {
      id: "fase-3",
      tipo: "fase",
      nome: "Tracao",
      descricao: "Escalar o que funciona e preparar a startup para investimento.",
      ordem: 3,
      ativo: false,
      modulos: [],
    },
  ],
}
