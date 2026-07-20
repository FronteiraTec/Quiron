/**
 * Catalogo central de permissoes do sistema.
 *
 * Esta e a UNICA fonte de verdade das permissoes disponiveis: nenhuma
 * permissao e cadastrada manualmente pela tela de RBAC. Cada modulo/recurso
 * do sistema registra aqui as acoes que expoe; a tabela `permissao` no banco
 * e apenas um espelho sincronizado deste arquivo (ver sincronizarCatalogo.js).
 *
 * Para adicionar permissoes num modulo novo (ou existente), basta editar
 * este array - a tela de gerenciamento de Roles passa a exibi-las
 * automaticamente, agrupadas por modulo e recurso.
 *
 * Estrutura: modulo -> recursos -> acoes. A chave de cada permissao e
 * `${modulo}.${recurso}.${acao}`.
 */

const ACOES_CRUD_PADRAO = [
  { acao: "visualizar", rotulo: "Visualizar" },
  { acao: "criar", rotulo: "Criar" },
  { acao: "editar", rotulo: "Editar" },
  { acao: "excluir", rotulo: "Excluir" },
]

const CATALOGO_PERMISSOES = [
  {
    modulo: "startups",
    rotulo: "Startups",
    recursos: [
      {
        recurso: "startups",
        rotulo: "Startups",
        acoes: [...ACOES_CRUD_PADRAO, { acao: "exportar", rotulo: "Exportar" }],
      },
      {
        recurso: "membros",
        rotulo: "Membros",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "adicionar", rotulo: "Adicionar" },
          { acao: "remover", rotulo: "Remover" },
        ],
      },
      {
        recurso: "mentores",
        rotulo: "Mentores",
        // Gestao da lista de mentores pelo admin: quem acompanha quem.
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "vincular", rotulo: "Vincular" },
          { acao: "desvincular", rotulo: "Desvincular" },
        ],
      },
      {
        recurso: "canvas",
        rotulo: "Business Model Canvas",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "editar", rotulo: "Editar" },
        ],
      },
      {
        recurso: "gut",
        rotulo: "Matriz GUT",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "criar", rotulo: "Criar" },
          { acao: "excluir", rotulo: "Excluir" },
        ],
      },
      {
        recurso: "cinco_w2h",
        rotulo: "5W2H",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "criar", rotulo: "Criar" },
          { acao: "excluir", rotulo: "Excluir" },
        ],
      },
    ],
  },
  {
    modulo: "programa",
    rotulo: "Programa",
    // Fases, Modulos e Tarefas eram TRES recursos porque eram tres CRUDs. A
    // refatoracao os unificou em /trilha — um recurso so, com os tres niveis
    // como nos da mesma arvore —, entao as chaves antigas foram removidas (ver
    // a migracao 005). Jornada nao entra aqui de proposito: e a mesma trilha
    // vista pelo incubado, sobre os dados da propria startup, e exigir
    // permissao para alguem ver o proprio progresso so criaria um jeito novo
    // de travar o incubado fora do sistema.
    recursos: [
      { recurso: "trilha", rotulo: "Trilha do programa", acoes: ACOES_CRUD_PADRAO },
      { recurso: "biblioteca", rotulo: "Biblioteca de conteudos", acoes: ACOES_CRUD_PADRAO },
      { recurso: "questionarios", rotulo: "Questionarios", acoes: ACOES_CRUD_PADRAO },
    ],
  },
  {
    modulo: "avaliacoes",
    rotulo: "Avaliacoes",
    recursos: [
      {
        recurso: "entregas",
        rotulo: "Entregas",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "baixar", rotulo: "Baixar anexos" },
        ],
      },
      {
        recurso: "avaliacoes",
        rotulo: "Avaliacoes",
        // "Reabrir" saiu: nunca existiu no sistema e nao ha como existir do
        // jeito que o dominio funciona — o reenvio APAGA as avaliacoes
        // anteriores (jornadaRepository.reenviar), entao nao ha o que reabrir.
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "avaliar", rotulo: "Avaliar" },
        ],
      },
    ],
  },
  {
    modulo: "eventos",
    rotulo: "Eventos",
    recursos: [
      { recurso: "agenda", rotulo: "Agenda", acoes: ACOES_CRUD_PADRAO },
      {
        recurso: "presenca",
        rotulo: "Presenca",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "marcar", rotulo: "Marcar presenca" },
        ],
      },
    ],
  },
  {
    modulo: "usuarios",
    rotulo: "Usuarios",
    recursos: [
      {
        recurso: "usuarios",
        rotulo: "Usuarios",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "criar", rotulo: "Criar" },
          { acao: "editar", rotulo: "Editar" },
          { acao: "desativar", rotulo: "Desativar" },
          { acao: "redefinir_senha", rotulo: "Redefinir senha" },
        ],
      },
    ],
  },
  {
    modulo: "configuracoes",
    rotulo: "Configuracoes",
    recursos: [
      {
        recurso: "dados_incubadora",
        rotulo: "Dados da incubadora",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "editar", rotulo: "Editar" },
        ],
      },
      {
        recurso: "config_email",
        rotulo: "Configuracao de e-mail",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "editar", rotulo: "Editar" },
        ],
      },
      {
        recurso: "permissoes",
        rotulo: "Permissoes",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "gerenciar", rotulo: "Gerenciar roles e permissoes" },
        ],
      },
      // A auditoria (quem fez o que, e quando) e registro de conformidade, nao
      // relatorio de gestao: mora junto das demais configuracoes da incubadora.
      {
        recurso: "auditoria",
        rotulo: "Auditoria",
        acoes: [{ acao: "visualizar", rotulo: "Visualizar" }],
      },
    ],
  },
  {
    modulo: "relatorios",
    rotulo: "Relatorios",
    // Um recurso por relatorio: sao leituras de dominios diferentes (trilha,
    // avaliacoes, eventos) e cada incubadora escolhe quem enxerga o que — o
    // desempenho por mentor, em especial, nem sempre e para todo mundo.
    recursos: [
      {
        recurso: "progresso",
        rotulo: "Progresso das startups",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "exportar", rotulo: "Exportar" },
        ],
      },
      {
        recurso: "entregas",
        rotulo: "Entregas e avaliacoes",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "exportar", rotulo: "Exportar" },
        ],
      },
      {
        recurso: "gargalos",
        rotulo: "Gargalos do programa",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "exportar", rotulo: "Exportar" },
        ],
      },
      {
        recurso: "engajamento",
        rotulo: "Engajamento e eventos",
        acoes: [
          { acao: "visualizar", rotulo: "Visualizar" },
          { acao: "exportar", rotulo: "Exportar" },
        ],
      },
    ],
  },
]

/** Achata o catalogo em uma lista de permissoes com a chave calculada. */
function achatarCatalogo() {
  const permissoes = []
  for (const mod of CATALOGO_PERMISSOES) {
    for (const rec of mod.recursos) {
      for (const acao of rec.acoes) {
        permissoes.push({
          chave: `${mod.modulo}.${rec.recurso}.${acao.acao}`,
          modulo: mod.modulo,
          recurso: rec.recurso,
          acao: acao.acao,
          rotulo_modulo: mod.rotulo,
          rotulo_recurso: rec.rotulo,
          rotulo_acao: acao.rotulo,
        })
      }
    }
  }
  return permissoes
}

module.exports = { CATALOGO_PERMISSOES, achatarCatalogo }
