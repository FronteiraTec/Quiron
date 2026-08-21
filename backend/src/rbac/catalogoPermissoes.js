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
    modulo: "comunicacao",
    rotulo: "Comunicacao",
    // Mensagens internas (migracao 012). RECEBER nao entra no catalogo, pelo
    // mesmo motivo da Jornada: a caixa de entrada e do proprio usuario, e uma
    // chave para ler o que mandaram PARA ELE so criaria um jeito novo de deixar
    // alguem sem os avisos da incubadora.
    //
    // O que se controla e a EMISSAO, e em duas camadas: `enviar` diz se a
    // pessoa escreve; as chaves `enviar_*` dizem ate onde a voz dela alcanca.
    // Sao separadas porque o risco cresce com o publico — mandar um recado para
    // um colega e o caso comum; falar com a incubadora inteira e um megafone, e
    // nem toda incubadora quer o mesmo numero de pessoas segurando um.
    recursos: [
      {
        recurso: "mensagens",
        rotulo: "Mensagens",
        acoes: [
          // Ver o que OS OUTROS enviaram (o historico do tenant). Quem tem
          // `enviar` sempre enxerga as proprias, com ou sem esta chave.
          { acao: "visualizar", rotulo: "Ver mensagens enviadas por todos" },
          { acao: "enviar", rotulo: "Enviar para pessoas especificas" },
          // RESPONDER e separado de `enviar` porque e outra coisa: nao e
          // escolher um publico, e devolver a palavra a quem ja falou com voce
          // (o service exige uma conversa existente). Nasce concedida a TODAS
          // as roles padrao — inclusive ao incubado, que sem ela receberia
          // recado sem poder dizer "recebi". Fica no catalogo para a incubadora
          // que precise de um canal de mao unica poder desmarcar.
          { acao: "responder", rotulo: "Responder a quem falou com voce" },
          { acao: "enviar_startup", rotulo: "Enviar para os membros de uma startup" },
          { acao: "enviar_mentores", rotulo: "Enviar para os mentores" },
          { acao: "enviar_role", rotulo: "Enviar para uma role inteira" },
          { acao: "enviar_tenant", rotulo: "Enviar para toda a incubadora" },
          // Excluir a mensagem de outra pessoa. O autor sempre pode apagar a
          // propria (o mesmo desenho de `visualizar`).
          { acao: "excluir", rotulo: "Excluir mensagens de qualquer pessoa" },
        ],
      },
    ],
  },
  {
    modulo: "tarefas",
    rotulo: "Tarefas",
    // Gestao interna da incubadora (migracao 014): o quadro do que a EQUIPE tem
    // para fazer, distinto das entregas, que sao o trabalho da startup.
    //
    // Quem entra e definido aqui, e nao pelo papel, porque a equipe muda de
    // incubadora para incubadora: numa delas o mentor coordena o programa e
    // precisa do quadro, noutra ele so avalia entregas.
    //
    // NAO HA acao "ver as minhas", e a ausencia e proposital: quem esta
    // envolvido numa tarefa — o responsavel e quem a criou — SEMPRE a enxerga,
    // com chave ou sem. Uma tarefa atribuida e a unica coisa do sistema que
    // entra na lista de alguem sem que essa pessoa tenha feito nada; exigir uma
    // chave para ela ver o que lhe pediram so criaria um jeito novo de deixar
    // gente trabalhando no escuro. E o mesmo raciocinio de RECEBER mensagem,
    // que tambem nao esta neste catalogo.
    //
    // `visualizar` e o degrau ACIMA disso: o quadro INTEIRO da incubadora, o
    // que cada um esta fazendo. E a chave de quem coordena.
    recursos: [
      {
        recurso: "tarefas",
        rotulo: "Tarefas",
        acoes: [
          {
            acao: "visualizar",
            rotulo: "Ver as tarefas de toda a incubadora",
          },
          { acao: "criar", rotulo: "Criar" },
          // EDITAR e sobre o trabalho DOS OUTROS: o responsavel sempre pode
          // mexer na propria tarefa, com ou sem esta chave. Sem isso, o quadro
          // vira um mural que so o coordenador atualiza e para de refletir a
          // realidade em uma semana.
          { acao: "editar", rotulo: "Editar tarefas de qualquer pessoa" },
          // Idem: o autor sempre pode apagar a que criou (o mesmo desenho de
          // `excluir` nas mensagens).
          { acao: "excluir", rotulo: "Excluir tarefas de qualquer pessoa" },
          { acao: "exportar", rotulo: "Exportar" },
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
      // Categorias e locais do calendario. So a ESCRITA mora aqui: LER as
      // categorias exige `eventos.agenda.visualizar`, porque sao o rotulo e a
      // cor de cada evento na tela — quem enxerga a agenda precisa delas, ou o
      // calendario do incubado renderiza cinza e sem nome.
      {
        recurso: "agenda",
        rotulo: "Categorias e locais da agenda",
        acoes: [{ acao: "gerenciar", rotulo: "Gerenciar categorias e locais" }],
      },
      // Tipos, situacoes e campos personalizaveis do cadastro de startup. Como
      // na agenda, so a ESCRITA mora aqui: LER exige
      // `startups.startups.visualizar`, porque tipo, situacao e a definicao dos
      // campos sao a estrutura e os rotulos da propria tela de startups — sem
      // eles a lista renderiza a chave crua e os campos extras somem.
      {
        recurso: "startups",
        rotulo: "Cadastro de startups",
        acoes: [{ acao: "gerenciar", rotulo: "Gerenciar tipos, situacoes e campos" }],
      },
      // Colunas e campos personalizaveis do quadro de tarefas. Como na agenda e
      // no cadastro de startup, so a ESCRITA mora aqui: LER exige
      // `tarefas.tarefas.visualizar`, porque o rotulo e a cor de cada status
      // sao as COLUNAS do quadro — sem elas o kanban renderiza colunas sem nome
      // e os campos extras somem.
      {
        recurso: "tarefas",
        rotulo: "Quadro de tarefas",
        acoes: [{ acao: "gerenciar", rotulo: "Gerenciar colunas e campos" }],
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
      // Chave separada de "gargalos" porque o publico e outro: este relatorio
      // mede o tempo de resposta da propria incubadora, e nem toda equipe de
      // mentoria deve enxergar o quanto a fila dela atrasa as startups.
      {
        recurso: "tempo",
        rotulo: "Tempo por etapa",
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
