/**
 * Registro dos tours (tutoriais em cards) de cada tela.
 *
 * O botao "Fazer Tour" do UserPanel procura aqui o tour da rota atual e o
 * inicia. Para dar tour a uma tela nova basta:
 *   1. marcar os elementos-alvo da tela com data-tour="algum-nome";
 *   2. acrescentar a rota neste objeto com a lista de passos.
 *
 * Formato de um passo:
 *   seletor           Seletor CSS do alvo. Sem seletor => card centralizado
 *                     (bom para abertura/encerramento). Se o alvo nao existir
 *                     no momento (botao sem permissao, drawer fechado...), o
 *                     passo e pulado automaticamente.
 *   titulo, texto     Conteudo do card.
 *   posicao           "auto" (padrao) | "cima" | "baixo" | "esquerda" | "direita".
 *                     E so uma preferencia: se nao couber, o card vira sozinho.
 *   permitirInteracao Deixa o usuario clicar/digitar no elemento destacado.
 *   avancarAoClicar   Avanca sozinho quando o usuario clica no alvo.
 *
 * SOBRE OS PASSOS QUE SOMEM: varias telas aqui tem mais de um estado (a Jornada
 * tem quatro; o Construtor muda quando ainda nao ha trilha; metade dos botoes
 * depende de permissao). Em vez de um tour por estado, cada tour lista TODOS os
 * passos possiveis da tela — o TourProvider descarta os que nao tem alvo na
 * tela. Assim existe um tour por tela, e nao um por combinacao de papel/estado.
 */

/** Passo final, igual em todas as telas. */
function fim(texto) {
  return {
    titulo: "É só isso!",
    texto: `${texto} Você pode refazer este tour quando quiser pelo menu da sua conta, em Ajuda > Fazer Tour.`,
  }
}

// ---------------------------------------------------------------------------
// Dashboard (/) — tambem serve de tour do sistema: e a unica tela que todo
// papel abre, entao e nela que a Navbar e o menu lateral sao apresentados.
// ---------------------------------------------------------------------------
const TOUR_DASHBOARD = {
  titulo: "Conhecendo o Quiron",
  passos: [
    {
      titulo: "Bem-vindo ao Quiron",
      texto:
        "Esta é a tela inicial: o que acontece nesta semana e como o programa de incubação está indo. Vamos passar pelos pontos principais da plataforma.",
    },
    {
      seletor: '[data-tour="sidebar-menu"]',
      posicao: "direita",
      titulo: "O menu lateral",
      texto:
        "Todas as telas ficam aqui, agrupadas por assunto. O menu muda conforme o seu papel: você vê o que pode usar. Passando o mouse num item aparece um alfinete, que fixa o item nos Favoritos.",
    },
    {
      seletor: '[data-tour="sidebar-busca"]',
      posicao: "direita",
      titulo: "Ache a tela pelo nome",
      texto:
        "Digite parte do nome da página em vez de procurar pelo menu inteiro — útil quando o menu está recolhido.",
    },
    {
      seletor: '[data-tour="nav-busca"]',
      posicao: "baixo",
      titulo: "Busca de startups",
      texto:
        "Procure uma startup pelo nome e vá direto para a página dela. Admin busca todas; mentor, as que acompanha.",
    },
    {
      seletor: '[data-tour="nav-agenda"]',
      posicao: "baixo",
      titulo: "Atalho para a Agenda",
      texto: "Leva ao calendário da incubação de qualquer tela em que você esteja.",
    },
    {
      seletor: '[data-tour="nav-notificacoes"]',
      posicao: "baixo",
      titulo: "Notificações",
      texto:
        "O sino reúne as mensagens que enviaram para você e as atividades criadas recentemente na agenda.",
    },
    {
      seletor: '[data-tour="nav-conta"]',
      posicao: "esquerda",
      titulo: "Sua conta",
      texto:
        "Aqui ficam tema claro/escuro, cor principal, perfil e a Ajuda — inclusive o \"Fazer Tour\", que abre o tutorial da tela em que você estiver.",
    },
    {
      seletor: '[data-tour="dashboard-agenda"]',
      posicao: "auto",
      titulo: "A semana",
      texto:
        "Os eventos de hoje até o fim da semana, agrupados por dia. Clicar num deles abre o calendário no evento.",
    },
    {
      seletor: '[data-tour="dashboard-kpis"]',
      posicao: "cima",
      titulo: "Números de destaque",
      texto:
        "Um resumo do programa. Cada card vem do relatório correspondente — você só vê os cards dos relatórios que tem permissão para abrir.",
    },
    fim("Sempre que se perder, volte ao Dashboard."),
  ],
}

// ---------------------------------------------------------------------------
// Perfil (/perfil)
// ---------------------------------------------------------------------------
const TOUR_PERFIL = {
  titulo: "Seus dados",
  passos: [
    {
      titulo: "Seu perfil",
      texto: "Os dados que o resto da incubadora vê sobre você. São poucos campos — vamos por eles.",
    },
    {
      seletor: '[data-tour="perfil-foto"]',
      posicao: "direita",
      titulo: "Foto de perfil",
      texto:
        "Clique na câmera para trocar a foto (até 2MB). Ela aparece nas avaliações, nos membros da startup e no menu da conta.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="perfil-dados"]',
      posicao: "cima",
      titulo: "Nome e celular",
      texto: "O nome é como você aparece para mentores e colegas. O celular é o contato da incubadora.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="perfil-email"]',
      posicao: "cima",
      titulo: "E-mail",
      texto:
        "O e-mail é o seu login e não pode ser alterado por aqui — peça ao administrador da sua incubadora.",
    },
    {
      seletor: '[data-tour="perfil-salvar"]',
      posicao: "cima",
      titulo: "Salve as mudanças",
      texto: "Nome e celular só valem depois de salvar. A foto é enviada na hora em que você a escolhe.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="nav-conta"]',
      posicao: "esquerda",
      titulo: "E a aparência?",
      texto:
        "Tema claro/escuro, cor principal e densidade ficam no menu da sua conta, não nesta tela — são preferências de exibição, não dados de cadastro.",
    },
    fim("Pronto."),
  ],
}

// ---------------------------------------------------------------------------
// Minha Jornada (/jornada) — quatro telas em uma rota (trilhas, fases, modulos
// e atividade). Os passos de cada uma aparecem quando ela esta aberta.
// ---------------------------------------------------------------------------
const TOUR_JORNADA = {
  titulo: "Sua jornada de incubação",
  passos: [
    {
      titulo: "Bem-vindo à sua Jornada",
      texto:
        "Aqui é onde a sua startup estuda e entrega. A trilha se abre em três níveis: fases, módulos dentro de cada fase e atividades dentro de cada módulo.",
    },
    {
      seletor: '[data-tour="jornada-trilhas"]',
      posicao: "auto",
      titulo: "Suas trilhas",
      texto:
        "Sua startup está em mais de uma trilha. Escolha por qual quer começar — o progresso de cada uma é separado.",
    },
    {
      seletor: '[data-tour="jornada-progresso"]',
      posicao: "baixo",
      titulo: "Quanto já andou",
      texto:
        "A barra conta as atividades aprovadas sobre o total da trilha. Ela só sobe quando o mentor aprova, não quando você envia.",
    },
    {
      seletor: '[data-tour="jornada-equipe"]',
      posicao: "baixo",
      titulo: "A jornada é da equipe",
      texto:
        "Todos os membros da startup veem e editam o mesmo progresso. O que um envia, o outro enxerga.",
    },
    {
      seletor: '[data-tour="jornada-continuar"]',
      posicao: "esquerda",
      titulo: "Continuar de onde parou",
      texto: "Leva direto à fase em que a sua startup está agora — o caminho mais curto para voltar ao trabalho.",
    },
    {
      seletor: '[data-tour="jornada-fases"]',
      posicao: "auto",
      titulo: "As fases da trilha",
      texto:
        "Cada cartão é uma fase. As fases que você ainda não alcançou aparecem bloqueadas: elas abrem conforme você avança nas anteriores.",
    },
    {
      seletor: '[data-tour="jornada-modulos"]',
      posicao: "auto",
      titulo: "Os módulos da fase",
      texto:
        "Dentro da fase, os módulos agrupam as atividades por assunto. Escolha um para ver o que ele pede.",
    },
    {
      seletor: '[data-tour="jornada-atividades"]',
      posicao: "direita",
      titulo: "As atividades do módulo",
      texto:
        "A lista da esquerda mostra cada atividade e a situação dela (rascunho, enviada, aprovada, em ajuste). Clique para abrir.",
    },
    {
      seletor: '[data-tour="jornada-conteudo"]',
      posicao: "auto",
      titulo: "A atividade",
      texto:
        "No centro ficam o objetivo, o material de apoio e o campo da entrega. Você pode salvar rascunho quantas vezes quiser e só depois enviar para avaliação.",
    },
    fim("Bom trabalho."),
  ],
}

// ---------------------------------------------------------------------------
// Minha Startup (/minha-startup)
// ---------------------------------------------------------------------------
const TOUR_MINHA_STARTUP = {
  titulo: "A sua startup",
  passos: [
    {
      titulo: "Minha Startup",
      texto:
        "A ficha da sua startup na incubadora: quem faz parte, os modelos de gestão, o que já foi concluído e como ela evoluiu.",
    },
    {
      seletor: '[data-tour="minha-startup-cabecalho"]',
      posicao: "baixo",
      titulo: "Nome e situação",
      texto:
        "O status diz se a startup está ativa, pausada ou já graduada. Se você for o líder, isso também aparece aqui.",
    },
    {
      seletor: '[data-tour="minha-startup-aba-membros"]',
      posicao: "baixo",
      titulo: "Membros",
      texto:
        "Quem está na equipe — clique numa pessoa para ver o perfil dela. Quem entra e quem sai da equipe é definido pela incubadora.",
    },
    {
      seletor: '[data-tour="minha-startup-aba-modelos"]',
      posicao: "baixo",
      titulo: "Modelos",
      texto:
        "Business Model Canvas, Matriz GUT e 5W2H preenchidos direto na tela. Ficam salvos e podem ser retomados a qualquer momento.",
    },
    {
      seletor: '[data-tour="minha-startup-aba-fases"]',
      posicao: "baixo",
      titulo: "Fases concluídas",
      texto: "As fases da trilha que já foram aprovadas para a sua startup.",
    },
    {
      seletor: '[data-tour="minha-startup-aba-evolucao"]',
      posicao: "baixo",
      titulo: "Evolução",
      texto:
        "O retrato da empresa: o blueprint das fases, o radar de maturidade e a linha do tempo do que foi construído.",
    },
    {
      seletor: '[data-tour="minha-startup-conteudo"]',
      posicao: "auto",
      titulo: "O conteúdo da aba",
      texto: "Troque de aba acima; o conteúdo aparece aqui embaixo, sem sair da tela.",
    },
    fim("Essa é a sua ficha."),
  ],
}

// ---------------------------------------------------------------------------
// Construtor de Programa (/programa)
// ---------------------------------------------------------------------------
const TOUR_PROGRAMA = {
  titulo: "Montar a trilha",
  passos: [
    {
      titulo: "O Construtor de Programa",
      texto:
        "É aqui que a trilha da incubação é montada: Trilha → Fases → Módulos → Passos, tudo numa tela só, sem abrir formulário em outra página.",
    },
    {
      seletor: '[data-tour="programa-criar-trilha"]',
      posicao: "cima",
      titulo: "Comece pela trilha",
      texto:
        "Sua incubadora ainda não tem trilha nenhuma. A árvore precisa de uma raiz antes de aceitar fases — crie a primeira para começar.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="programa-seletor-trilha"]',
      posicao: "baixo",
      titulo: "Qual trilha você está editando",
      texto:
        "O título é o nome da trilha aberta. Clique nele para trocar de trilha, criar outra ou definir qual é a padrão no cadastro de startups.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="programa-arvore"]',
      posicao: "direita",
      titulo: "A árvore",
      texto:
        "A estrutura inteira do programa. Crie itens pelo + de cada nível, arraste para reordenar e clique com o botão direito para duplicar, desativar ou excluir.",
    },
    {
      seletor: '[data-tour="programa-inspector"]',
      posicao: "esquerda",
      titulo: "As propriedades do item",
      texto:
        "Selecione um item na árvore e edite aqui: nome, descrição, conteúdo da Biblioteca, questionário e prazo. Não há modal — o que você digita é salvo neste painel.",
    },
    {
      seletor: '[data-tour="programa-expandir"]',
      posicao: "baixo",
      titulo: "Abrir e fechar tudo",
      texto: "Expande ou recolhe a árvore inteira — ajuda quando a trilha já tem muitas fases.",
    },
    {
      seletor: '[data-tour="programa-startups"]',
      posicao: "baixo",
      titulo: "Quem faz esta trilha",
      texto:
        "Matricule startups nesta trilha. Só quem estiver aqui vai vê-la em Minha Jornada.",
    },
    {
      seletor: '[data-tour="programa-preview"]',
      posicao: "baixo",
      titulo: "Ver como a incubada vê",
      texto:
        "Abre a trilha do jeito que ela chega para a startup. Use antes de publicar: é o teste mais rápido de que a ordem faz sentido.",
    },
    fim("A trilha é sua."),
  ],
}

// ---------------------------------------------------------------------------
// Biblioteca (/biblioteca)
// ---------------------------------------------------------------------------
const TOUR_BIBLIOTECA = {
  titulo: "O acervo da incubadora",
  passos: [
    {
      titulo: "Biblioteca de Conhecimento",
      texto:
        "Tudo o que a sua incubadora ensina fica aqui. O material é criado uma vez e reaproveitado em qualquer passo de qualquer trilha.",
    },
    {
      seletor: '[data-tour="biblioteca-busca"]',
      posicao: "baixo",
      titulo: "Encontre um conteúdo",
      texto: "A busca olha título, resumo e tags ao mesmo tempo.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="biblioteca-tipos"]',
      posicao: "baixo",
      titulo: "Filtre por tipo",
      texto:
        "Materiais, aulas, vídeos, templates, links... Um clique mostra só os conteúdos daquele tipo.",
    },
    {
      seletor: '[data-tour="biblioteca-filtros"]',
      posicao: "baixo",
      titulo: "Filtre por trilha e tema",
      texto:
        "Aqui ficam os filtros por trilha e por tag. Eles se combinam com o filtro de tipo, e o número no botão mostra quantos estão ativos.",
    },
    {
      seletor: '[data-tour="biblioteca-grade"]',
      posicao: "auto",
      titulo: "Os conteúdos",
      texto:
        "Clique num card para editar. Cada card também permite duplicar e excluir — um conteúdo usado em algum passo da trilha precisa ser desvinculado antes de sair.",
    },
    {
      seletor: '[data-tour="biblioteca-novo"]',
      posicao: "baixo",
      titulo: "Criar conteúdo",
      texto:
        "Escolha o tipo e o editor abre pela lateral. Depois é só apontar o passo da trilha para este conteúdo, no Construtor.",
      permitirInteracao: true,
    },
    fim("Crie uma vez, use em todas as trilhas."),
  ],
}

// ---------------------------------------------------------------------------
// Questionarios (/questionarios)
// ---------------------------------------------------------------------------
const TOUR_QUESTIONARIOS = {
  titulo: "Questionários",
  passos: [
    {
      titulo: "Questionários",
      texto:
        "Formulários que a incubadora aplica às startups. Eles são criados aqui e depois vinculados a um passo da trilha, no Construtor.",
    },
    {
      seletor: '[data-tour="questionarios-lista"]',
      posicao: "auto",
      titulo: "Os que já existem",
      texto:
        "Cada linha traz o título, quantas perguntas tem e se está ativo. A barra acima da tabela tem a busca, o filtro por status e a escolha das colunas.",
    },
    {
      seletor: '[data-tour="questionarios-ativo"]',
      posicao: "esquerda",
      titulo: "Ativo ou inativo",
      texto:
        "Desativar não apaga nada: o questionário some das novas aplicações, e as respostas já dadas continuam guardadas.",
    },
    {
      seletor: '[data-tour="questionarios-preview"]',
      posicao: "esquerda",
      titulo: "Ver as perguntas",
      texto: "Abre o questionário como a startup vai vê-lo.",
    },
    {
      seletor: '[data-tour="questionarios-novo"]',
      posicao: "baixo",
      titulo: "Criar um questionário",
      texto:
        "Dê um título e monte as perguntas: texto curto, parágrafo, escolha única ou caixas de seleção. Perguntas podem ser obrigatórias.",
      permitirInteracao: true,
    },
    fim("Depois é só vincular o questionário a um passo, no Construtor."),
  ],
}

// ---------------------------------------------------------------------------
// Responder questionario (/passos/:idNo/responder)
// ---------------------------------------------------------------------------
const TOUR_RESPONDER = {
  titulo: "Responder o questionário",
  passos: [
    {
      titulo: "Respondendo o questionário",
      texto:
        "Este questionário faz parte de um passo da trilha. Ao enviar, ele vira uma entrega e vai para a fila do mentor.",
    },
    {
      seletor: '[data-tour="responder-startup"]',
      posicao: "baixo",
      titulo: "Em nome de qual startup",
      texto: "A entrega é registrada para a startup escolhida aqui — confira antes de enviar.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="responder-perguntas"]',
      posicao: "auto",
      titulo: "As perguntas",
      texto:
        "Perguntas marcadas com * são obrigatórias. Os tipos variam: texto livre, escolha única ou múltiplas caixas.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="responder-enviar"]',
      posicao: "cima",
      titulo: "Enviar",
      texto:
        "Ao enviar, as respostas ficam registradas e o passo passa a aguardar avaliação.",
      permitirInteracao: true,
    },
    fim("Boa resposta."),
  ],
}

// ---------------------------------------------------------------------------
// Presenca (/eventos/presenca)
// ---------------------------------------------------------------------------
const TOUR_PRESENCA = {
  titulo: "Fazer a chamada",
  passos: [
    {
      titulo: "Presença nos eventos",
      texto:
        "Quem realmente apareceu em cada atividade. É diferente da confirmação da Agenda: lá o participante diz que pretende ir; aqui você registra quem foi.",
    },
    {
      seletor: '[data-tour="presenca-resumo"]',
      posicao: "direita",
      titulo: "O que falta chamar",
      texto:
        "O número em destaque são os eventos já realizados que ainda estão sem chamada.",
    },
    {
      seletor: '[data-tour="presenca-busca"]',
      posicao: "direita",
      titulo: "Achar um evento",
      texto: "Busque pelo nome da atividade. Só aparecem eventos que já aconteceram.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="presenca-eventos"]',
      posicao: "direita",
      titulo: "Os eventos realizados",
      texto: "Escolha um evento para abrir a lista de quem era esperado nele.",
    },
    {
      seletor: '[data-tour="presenca-chamada"]',
      posicao: "esquerda",
      titulo: "A chamada",
      texto:
        "Marque presente ou ausente pessoa a pessoa. É deste registro que sai a taxa de presença do relatório de engajamento.",
    },
    fim("A chamada alimenta o relatório de engajamento."),
  ],
}

// ---------------------------------------------------------------------------
// Startups (/startups)
// ---------------------------------------------------------------------------
const TOUR_STARTUPS = {
  titulo: "As startups da incubadora",
  passos: [
    {
      titulo: "Lista de startups",
      texto:
        "Todas as startups incubadas e o quanto cada uma já andou na trilha. Admin vê todas; mentor vê as que acompanha.",
    },
    {
      seletor: '[data-tour="startups-busca"]',
      posicao: "baixo",
      titulo: "Procurar",
      texto: "Filtra por nome, CNPJ ou e-mail conforme você digita.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="startups-filtros"]',
      posicao: "baixo",
      titulo: "Filtrar",
      texto:
        "Abre um painel com fase, tipo, status, UF, data de cadastro e um filtro para cada campo personalizado da sua incubadora. Tipo, status e os campos você define em Configurações > Cadastro de startups.",
    },
    {
      seletor: '[data-tour="startups-lista"]',
      posicao: "auto",
      titulo: "Uma linha por startup",
      texto:
        "A barra é o progresso na trilha. Clique na linha para abrir a página da startup. Clique no cabeçalho para ordenar, arraste-o para mudar a ordem das colunas, e use o botão de ajustes (à direita do cabeçalho) para escolher quais colunas aparecem — inclusive as dos campos personalizados. Marcando as caixas você altera o status de várias de uma vez.",
    },
    {
      seletor: '[data-tour="startups-nova"]',
      posicao: "esquerda",
      titulo: "Cadastrar uma startup",
      texto:
        "Abre um painel à direita com o cadastro completo: identificação, contatos, endereço (digite o CEP e o resto se preenche), observações e os campos que a sua incubadora criou.",
      permitirInteracao: true,
    },
    fim("Clique numa linha para ver o detalhe."),
  ],
}

// ---------------------------------------------------------------------------
// Membros (/startups/membros)
// ---------------------------------------------------------------------------
const TOUR_MEMBROS = {
  titulo: "As pessoas das startups",
  passos: [
    {
      titulo: "Membros",
      texto:
        "Quem está em cada startup da incubadora — e, principalmente, quem ainda não está em nenhuma.",
    },
    {
      seletor: '[data-tour="membros-sem-startup"]',
      posicao: "baixo",
      titulo: "Os que ficaram de fora",
      texto:
        "Sem vínculo, essas pessoas entram no sistema e não encontram jornada nem entrega. Clique num nome para vinculá-lo a uma startup — é a única ação urgente desta tela.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="membros-busca"]',
      posicao: "baixo",
      titulo: "Procurar alguém",
      texto: "A busca olha o nome da pessoa e o nome da startup ao mesmo tempo.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="membros-filtro-startup"]',
      posicao: "baixo",
      titulo: "Filtrar",
      texto:
        "Abre um painel para restringir a tabela a certas startups, ao papel (líder ou membro) ou ao período de entrada.",
    },
    {
      seletor: '[data-tour="membros-tabela"]',
      posicao: "auto",
      titulo: "A tabela",
      texto:
        "Cada linha é uma pessoa numa startup — quem está em duas aparece duas vezes. Clique no cabeçalho para ordenar, arraste-o para reordenar as colunas e use o botão de ajustes para escolher o que aparece.",
    },
    fim("Ninguém deve ficar sem startup."),
  ],
}

// ---------------------------------------------------------------------------
// Detalhe de uma startup (/startups/:uuid)
// ---------------------------------------------------------------------------
const TOUR_STARTUP_DETALHE = {
  titulo: "A página da startup",
  passos: [
    {
      titulo: "Detalhe da startup",
      texto:
        "A visão da incubadora sobre uma startup: situação, progresso, equipe e o que já foi concluído.",
    },
    {
      seletor: '[data-tour="startup-progresso"]',
      posicao: "baixo",
      titulo: "Onde ela está",
      texto:
        "A fase atual, o status e a barra de progresso na trilha — os três números que resumem a incubação dela.",
    },
    {
      seletor: '[data-tour="startup-editar"]',
      posicao: "baixo",
      titulo: "Editar o cadastro",
      texto: "Abre o mesmo painel do cadastro novo, já preenchido com os dados desta startup.",
    },
    {
      seletor: '[data-tour="startup-status"]',
      posicao: "baixo",
      titulo: "Mudar o status",
      texto:
        "A lista é a que a sua incubadora cadastrou em Configurações. Trocar o status não apaga nada: o histórico da startup continua aqui.",
    },
    {
      seletor:
        '[data-tour="startup-aba-cadastro"], [data-tour="startup-aba-membros"], [data-tour="startup-aba-modelos"], [data-tour="startup-aba-fases"]',
      posicao: "baixo",
      titulo: "As abas",
      texto:
        "Cadastro traz os dados da empresa — contatos, endereço, campos complementares. As outras três (Membros, Modelos e Fases concluídas) são as mesmas que a própria startup vê em Minha Startup.",
    },
    {
      seletor: '[data-tour="startup-conteudo"]',
      posicao: "auto",
      titulo: "O conteúdo da aba",
      texto: "Troque de aba acima; o conteúdo aparece aqui embaixo.",
    },
    fim("Tudo sobre a startup em um lugar."),
  ],
}

// ---------------------------------------------------------------------------
// Mentores (/mentores)
// ---------------------------------------------------------------------------
const TOUR_MENTORES = {
  titulo: "Quem mentora, e com o quê",
  passos: [
    {
      titulo: "Mentores",
      texto:
        "Duas perguntas na mesma tela: do que cada mentor dá conta (vínculo, especialidades, demandas, disponibilidade) e quais startups ele acompanha. É esse vínculo que recorta a fila de avaliação de cada um.",
    },
    {
      seletor: '[data-tour="mentores-resumo"]',
      posicao: "baixo",
      titulo: "Quantos e quem está livre",
      texto:
        "O aviso laranja mostra os mentores sem nenhuma startup — normalmente é aí que a próxima startup deve ir.",
    },
    {
      seletor: '[data-tour="mentores-busca"]',
      posicao: "baixo",
      titulo: "Procurar um mentor",
      texto: "Busca por nome, e-mail, especialidade ou tipo de demanda.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="mentores-filtros"]',
      posicao: "baixo",
      titulo: "Filtrar",
      texto:
        "Abre um painel com status, formato, carga, disponibilidade e a última mentoria — mais uma lista de especialidades, demandas, vínculos e áreas montada a partir do que a sua incubadora de fato cadastrou.",
    },
    {
      seletor: '[data-tour="mentores-periodo"]',
      posicao: "baixo",
      titulo: "O período das mentorias",
      texto:
        "A coluna \"Mentorias\" conta as atividades de Mentoria da agenda que já aconteceram e têm aquele mentor como responsável. Aqui você escolhe a janela — e o título da coluna acompanha.",
    },
    {
      seletor: '[data-tour="mentores-lista"]',
      posicao: "auto",
      titulo: "Uma linha por mentor",
      texto:
        "Clique na linha para abrir o painel dele na aba Startups, que é onde se vincula e desvincula — mover uma startup ali muda a fila de avaliação na hora. O lápis abre a mesma janela na aba Cadastro. Clique no cabeçalho para ordenar, arraste-o para reordenar as colunas, e use o botão de ajustes para escolher quais aparecem (contato e observações da coordenação vêm desligados). Marcando as caixas você altera o status de vários de uma vez.",
    },
    {
      seletor: '[data-tour="mentores-novo"]',
      posicao: "esquerda",
      titulo: "Cadastrar um mentor",
      texto:
        "Abre o mesmo painel, em branco: a pessoa (nome, e-mail, celular e uma senha provisória que ela troca no primeiro acesso) e, junto, o que ela atende. Ela entra na incubadora já com o papel de mentor. Quem já está aqui como usuário vira mentor em Usuários, trocando o papel.",
      permitirInteracao: true,
    },
    fim("A distribuição é o que define a fila de cada mentor."),
  ],
}

// ---------------------------------------------------------------------------
// Entregas (/entregas) — a fila de avaliacao
// ---------------------------------------------------------------------------
const TOUR_ENTREGAS = {
  titulo: "Avaliar entregas",
  passos: [
    {
      titulo: "A fila de avaliação",
      texto:
        "O que as startups enviaram e ainda espera resposta. A tela abre em \"pendentes\", da mais antiga para a mais nova: quem espera há mais tempo trava a startup.",
    },
    {
      seletor: '[data-tour="entregas-resumo"]',
      posicao: "direita",
      titulo: "Quanto está esperando",
      texto:
        "O aviso laranja conta as entregas paradas há uma semana ou mais — são elas que precisam de resposta hoje.",
    },
    {
      seletor: '[data-tour="entregas-busca"]',
      posicao: "direita",
      titulo: "Achar uma entrega",
      texto: "Busca por startup, passo, fase ou módulo.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="entregas-filtros"]',
      posicao: "direita",
      titulo: "Filtrar a fila",
      texto:
        "Por situação (pendente, aprovada, em ajuste...) e por startup. Volte para \"pendente\" quando quiser retomar o trabalho.",
    },
    {
      seletor: '[data-tour="entregas-fila"]',
      posicao: "direita",
      titulo: "A fila",
      texto: "Clique numa entrega para abrir o conteúdo dela à direita.",
    },
    {
      seletor: '[data-tour="entregas-painel"]',
      posicao: "esquerda",
      titulo: "Avaliar",
      texto:
        "Leia o que foi enviado e registre a devolutiva: aprovar, pedir ajuste ou reprovar, com comentário e nota opcional. Pedir ajuste devolve a entrega para a startup refazer.",
    },
    fim("O comentário é o que a startup lê — vale escrever."),
  ],
}

// ---------------------------------------------------------------------------
// Feedback (/feedback) — o historico do mentor
// ---------------------------------------------------------------------------
const TOUR_FEEDBACK = {
  titulo: "O que você já respondeu",
  passos: [
    {
      titulo: "Seu histórico de devolutivas",
      texto:
        "A fila (Entregas) mostra o que falta responder; esta tela mostra o que você já respondeu. Serve para retomar o fio antes de uma sessão de mentoria.",
    },
    {
      seletor: '[data-tour="feedback-pendentes"]',
      posicao: "baixo",
      titulo: "Ajustes ainda não atendidos",
      texto:
        "Um pedido de ajuste some daqui quando a startup reenvia. O que aparece neste aviso é cobrança que ainda não voltou.",
    },
    {
      seletor: '[data-tour="feedback-busca"]',
      posicao: "baixo",
      titulo: "Procurar uma devolutiva",
      texto: "Busca por startup, passo ou pelo texto do seu comentário.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="feedback-decisao"]',
      posicao: "baixo",
      titulo: "Filtrar pela decisão",
      texto: "Aprovado, ajuste pedido ou reprovado.",
    },
    {
      seletor: '[data-tour="feedback-lista"]',
      posicao: "auto",
      titulo: "A lista",
      texto:
        "Os ajustes pedidos vêm primeiro — são os únicos que ainda esperam algo da startup. O resto segue da devolutiva mais recente para a mais antiga.",
    },
    fim("Bom para chegar preparado na próxima conversa."),
  ],
}

// ---------------------------------------------------------------------------
// Avaliacoes (/avaliacoes) — a visao do admin sobre a mentoria
// ---------------------------------------------------------------------------
const TOUR_AVALIACOES = {
  titulo: "Como anda a mentoria",
  passos: [
    {
      titulo: "Todas as devolutivas",
      texto:
        "As avaliações de todos os mentores, não só as suas. É a visão do administrador sobre o trabalho da mentoria: quem respondeu, quando e o que disse.",
    },
    {
      seletor: '[data-tour="avaliacoes-indicadores"]',
      posicao: "baixo",
      titulo: "Os quatro números",
      texto:
        "Quantidade, tempo médio de resposta, nota média e — o mais importante — quantas devolutivas saíram sem comentário nenhum.",
    },
    {
      seletor: '[data-tour="avaliacoes-busca"]',
      posicao: "baixo",
      titulo: "Procurar",
      texto: "Busca por startup, passo, mentor ou pelo texto do comentário.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="avaliacoes-filtros"]',
      posicao: "baixo",
      titulo: "Filtrar",
      texto: "Por decisão e por avaliador — útil para olhar o trabalho de um mentor específico.",
    },
    {
      seletor: '[data-tour="avaliacoes-lista"]',
      posicao: "auto",
      titulo: "A lista",
      texto:
        "Cada linha traz a devolutiva inteira. As que saíram sem texto ficam marcadas: a startup recebeu só a decisão, sem saber o que fazer com ela.",
    },
    fim("Devolutiva sem comentário é o sinal a caçar aqui."),
  ],
}

/**
 * Monta o tour de um relatorio. Os quatro compartilham a mesma moldura
 * (KPIs -> gráficos -> tabela -> exportar); o que muda e o que cada numero
 * quer dizer, e isso vem por parametro.
 */
function tourRelatorio({ titulo, abertura, kpis, graficos, tabela, encerramento }) {
  return {
    titulo,
    passos: [
      { titulo, texto: abertura },
      {
        seletor: '[data-tour="relatorio-tenant"]',
        posicao: "baixo",
        titulo: "Escolha a incubadora",
        texto:
          "Você está logado como root, que não pertence a nenhuma incubadora — escolha aqui de qual delas é o relatório.",
      },
      {
        seletor: '[data-tour="relatorio-periodo"]',
        posicao: "esquerda",
        titulo: "A janela de tempo",
        texto: "Todo o relatório é recalculado para o período escolhido.",
      },
      {
        seletor: '[data-tour="relatorio-kpis"]',
        posicao: "baixo",
        titulo: "Os números de destaque",
        texto: kpis,
      },
      ...(graficos
        ? [
            {
              seletor: '[data-tour="relatorio-graficos"]',
              posicao: "auto",
              titulo: "A leitura visual",
              texto: graficos,
            },
          ]
        : []),
      {
        seletor: '[data-tour="relatorio-tabela"]',
        posicao: "auto",
        titulo: "O detalhe",
        texto: tabela,
      },
      {
        seletor: '[data-tour="relatorio-exportar"]',
        posicao: "esquerda",
        titulo: "Levar para fora",
        texto:
          "Baixa a tabela em CSV, com os mesmos filtros aplicados — bom para relatório de conselho ou planilha própria.",
      },
      fim(encerramento),
    ],
  }
}

const TOUR_REL_PROGRESSO = tourRelatorio({
  titulo: "Progresso das startups",
  abertura:
    "O relatório que responde à pergunta de toda semana: quem está avançando, quem travou e por quê. Uma linha por startup incubada.",
  kpis:
    "Quantas startups há, o progresso médio na trilha e — os que importam — quantas estão em risco alto, paradas ou com passo atrasado.",
  tabela:
    "Clique em qualquer cabeçalho para ordenar: o mesmo quadro serve para achar o atraso e para montar o ranking de quem vai bem. A coluna Risco resume prazo vencido + falta de atividade; passe o mouse nela para ver o motivo. Clicar na linha abre a startup.",
  encerramento: "Comece pelas linhas de risco alto.",
})

const TOUR_REL_ENTREGAS = tourRelatorio({
  titulo: "Entregas e avaliações",
  abertura:
    "Onde as entregas estão paradas, quanto tempo esperam por avaliação e como cada mentor responde.",
  kpis: "O tamanho da fila, quanto tempo ela espera em média e quantas entregas já passaram do aceitável.",
  graficos:
    "O funil mostra em que etapa cada passo da trilha está parado. O ritmo semanal compara envios das startups com avaliações dos mentores: se a linha das avaliações fica abaixo por várias semanas, a fila está crescendo.",
  tabela:
    "Duas tabelas: a fila de avaliação (o que está esperando agora) e o desempenho por mentor. Cada uma tem o próprio botão de exportar.",
  encerramento: "Fila crescendo é problema de capacidade, não de startup.",
})

const TOUR_REL_GARGALOS = tourRelatorio({
  titulo: "Gargalos do programa",
  abertura:
    "Este relatório não olha startups — olha a trilha. Quais passos seguram mais gente, quanto tempo levam para ser aprovados e onde os prazos estouram.",
  kpis: "Quantos passos há na trilha, quantos travam e o tempo médio até a aprovação.",
  graficos:
    "O ranking dos passos que mais travam: quantas startups estão paradas em cada um e quantas estão refazendo depois de um pedido de ajuste. Um passo no topo aqui costuma ser um enunciado confuso, não uma turma fraca.",
  tabela:
    "Todos os passos da trilha, ordenáveis por qualquer coluna. Use junto com o Construtor: o passo que trava é o passo a reescrever.",
  encerramento: "O gargalo quase sempre é do programa, não das startups.",
})

const TOUR_REL_ENGAJAMENTO = tourRelatorio({
  titulo: "Engajamento e eventos",
  abertura:
    "Quem aparece nas atividades da incubadora. Os números saem da chamada feita na tela de Presença.",
  kpis: "Quantos eventos aconteceram no período, a presença média e quantas startups estão sumidas.",
  tabela:
    "Duas leituras dos mesmos dados: por evento (qual atividade esvaziou) e por startup (quem parou de aparecer). Cada tabela exporta separado.",
  encerramento: "Sem chamada na tela de Presença, este relatório fica vazio.",
})

// ---------------------------------------------------------------------------
// Usuarios (/usuarios)
// ---------------------------------------------------------------------------
const TOUR_USUARIOS = {
  titulo: "Gerenciar usuários",
  passos: [
    {
      titulo: "Usuários da incubadora",
      texto:
        "As pessoas que entram no sistema e o que cada uma pode fazer. As abas do topo separam os assuntos — vamos por elas.",
    },
    {
      seletor: '[data-tour="usuarios-aba-usuarios"]',
      posicao: "baixo",
      titulo: "Usuários",
      texto: "A lista de pessoas: cadastro, papel (admin, mentor ou incubado) e dados de contato.",
    },
    {
      seletor: '[data-tour="usuarios-aba-permissoes"]',
      posicao: "baixo",
      titulo: "Permissões",
      texto:
        "O papel já é um pacote de permissões. Aqui você concede o que vai ALÉM dele — permissão só acrescenta, nunca tira o que o papel dá.",
    },
    {
      seletor: '[data-tour="usuarios-aba-grupos"]',
      posicao: "baixo",
      titulo: "Grupos",
      texto: "Conjuntos de permissões que você aplica a várias pessoas de uma vez.",
    },
    {
      seletor: '[data-tour="usuarios-aba-ativar"]',
      posicao: "baixo",
      titulo: "Ativar usuários",
      texto:
        "Usuários desativados ficam aqui. Desativar não apaga a pessoa — o histórico dela continua no sistema e pode ser reativado.",
    },
    {
      seletor: '[data-tour="usuarios-aba-startups"]',
      posicao: "baixo",
      titulo: "Startups",
      texto: "Cadastro rápido de startups e vínculo de pessoas a elas, sem sair desta tela.",
    },
    {
      seletor: '[data-tour="usuarios-novo"]',
      posicao: "baixo",
      titulo: "Novo usuário",
      texto:
        "Cria a pessoa e envia o convite por e-mail. Ela define a própria senha no primeiro acesso.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="usuarios-busca"]',
      posicao: "direita",
      titulo: "Procurar alguém",
      texto: "Filtra a lista da esquerda pelo nome.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="usuarios-lista"]',
      posicao: "direita",
      titulo: "A lista",
      texto: "O ponto verde indica quem está ativo. Clique num nome para abrir os detalhes ao lado.",
    },
    {
      seletor: '[data-tour="usuarios-detalhe"]',
      posicao: "esquerda",
      titulo: "Os detalhes",
      texto:
        "Editar dados, trocar o papel, desativar e reenviar o link de redefinição de senha — tudo do usuário selecionado.",
    },
    fim("Permissão é o que estende o papel; não é o que o substitui."),
  ],
}

// ---------------------------------------------------------------------------
// Incubadoras (/tenants) — exclusiva do root
// ---------------------------------------------------------------------------
const TOUR_TENANTS = {
  titulo: "As incubadoras da plataforma",
  passos: [
    {
      titulo: "Incubadoras",
      texto:
        "A tela do usuário root: todas as incubadoras da plataforma. Cada uma tem os próprios usuários, startups e trilhas, sem enxergar as outras.",
    },
    {
      seletor: '[data-tour="tenants-lista"]',
      posicao: "auto",
      titulo: "A lista",
      texto:
        "Use os ícones da linha para ver os usuários, editar o cadastro e os limites, ou desativar a incubadora. A busca, o filtro e o botão de ajustes (colunas) ficam na barra acima da tabela.",
    },
    {
      seletor: '[data-tour="tenants-nova"]',
      posicao: "esquerda",
      titulo: "Nova incubadora",
      texto:
        "Cadastro, limites de usuários e de startups. Depois de criar, crie também o administrador dela — é quem vai tocar a incubadora daí em diante.",
      permitirInteracao: true,
    },
    fim("Cada incubadora é um mundo separado."),
  ],
}

// ---------------------------------------------------------------------------
// Configuracoes (/configuracoes e subrotas)
// ---------------------------------------------------------------------------
const TOUR_CONFIG_DADOS = {
  titulo: "Configurações da incubadora",
  passos: [
    {
      titulo: "Configurações",
      texto:
        "O que é da incubadora inteira: cadastro, e-mail de envio, vocabulário da agenda, o formulário de cadastro das startups e o registro de auditoria.",
    },
    {
      seletor: '[data-tour="config-tenant"]',
      posicao: "baixo",
      titulo: "Qual incubadora",
      texto:
        "Como root, você escolhe aqui qual incubadora está configurando. O administrador de uma incubadora não vê este seletor: ele configura sempre a dele.",
    },
    {
      seletor: '[data-tour="config-abas"]',
      posicao: "baixo",
      titulo: "As abas",
      texto:
        "Dados cadastrais, e-mail, categorias e locais da agenda, e auditoria. Usuários, grupos e permissões não ficam aqui — têm tela própria, em Incubadora > Usuários.",
    },
    {
      seletor: '[data-tour="dados-cadastrais"]',
      posicao: "auto",
      titulo: "Dados cadastrais",
      texto:
        "Nome, contato e localização da incubadora, em somente leitura. Para alterar, é preciso falar com o suporte da plataforma.",
    },
    {
      seletor: '[data-tour="dados-cadastrais-limites"]',
      posicao: "cima",
      titulo: "Limites de uso",
      texto: "Quantos usuários e quantas startups o plano da sua incubadora comporta.",
    },
    fim("As outras abas ficam logo acima."),
  ],
}

const TOUR_CONFIG_EMAIL = {
  titulo: "E-mail da incubadora",
  passos: [
    {
      titulo: "Configuração de e-mail",
      texto:
        "Como a sua incubadora assina os e-mails que a plataforma envia: convite de usuário, redefinição de senha e avisos de evento.",
    },
    {
      seletor: '[data-tour="config-abas"]',
      posicao: "baixo",
      titulo: "Você está na aba E-mail",
      texto: "As outras configurações da incubadora ficam nas abas ao lado.",
    },
    {
      seletor: '[data-tour="email-remetente-nome"]',
      posicao: "baixo",
      titulo: "Nome do remetente",
      texto:
        "O nome que aparece na caixa de entrada de quem recebe. Use o nome da incubadora, não uma sigla interna.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="email-remetente"]',
      posicao: "baixo",
      titulo: "E-mail remetente",
      texto: "O endereço que envia as mensagens.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="email-reply-to"]',
      posicao: "baixo",
      titulo: "E-mail de resposta",
      texto:
        "Para onde vai a resposta de quem apertar \"Responder\". Vale a pena ser uma caixa que alguém realmente lê.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="email-salvar"]',
      posicao: "cima",
      titulo: "Salvar",
      texto: "A configuração passa a valer para os próximos e-mails enviados.",
      permitirInteracao: true,
    },
    fim("Pronto."),
  ],
}

const TOUR_CONFIG_AGENDA = {
  titulo: "Categorias e locais",
  passos: [
    {
      titulo: "O vocabulário da sua agenda",
      texto:
        "Categorias e locais são as opções que aparecem quando alguém cria uma atividade no calendário. Ajustá-los aqui muda o formulário de evento para toda a incubadora.",
    },
    {
      seletor: '[data-tour="config-abas"]',
      posicao: "baixo",
      titulo: "Você está na aba Categorias e locais",
      texto: "As outras configurações da incubadora ficam nas abas ao lado.",
    },
    {
      seletor: '[data-tour="agenda-categorias"]',
      posicao: "auto",
      titulo: "Categorias de evento",
      texto:
        "Cada categoria tem nome e cor — é a cor que a atividade ganha no calendário e o que o filtro da agenda usa. Desativar uma categoria a esconde dos novos eventos sem mexer nos antigos.",
    },
    {
      seletor: '[data-tour="agenda-locais"]',
      posicao: "auto",
      titulo: "Locais",
      texto:
        "As salas e espaços que se repetem. Cadastrá-los aqui evita digitar o mesmo endereço toda semana — no evento ainda dá para escrever um local avulso.",
    },
    fim("O calendário passa a falar a língua da sua incubadora."),
  ],
}

const TOUR_CONFIG_STARTUPS = {
  titulo: "O cadastro de startups",
  passos: [
    {
      titulo: "O cadastro é seu",
      texto:
        "Tipos, status e campos personalizáveis. O que você define aqui é o formulário que aparece ao cadastrar qualquer startup da incubadora.",
    },
    {
      seletor: '[data-tour="config-abas"]',
      posicao: "baixo",
      titulo: "Você está na aba Cadastro de startups",
      texto: "As outras configurações da incubadora ficam nas abas ao lado.",
    },
    {
      seletor: '[data-tour="startups-config-tipos"]',
      posicao: "auto",
      titulo: "Tipos de startup",
      texto:
        "Como você classifica as empresas — incubada, residente, associada, ou o nome que a sua incubadora usa. Vira um filtro na lista de startups.",
    },
    {
      seletor: '[data-tour="startups-config-situacoes"]',
      posicao: "auto",
      titulo: "Status",
      texto:
        "Cada status tem nome e cor seus, e diz também se a startup nele ainda está no programa. É esse último detalhe que mantém os relatórios certos: um status \"Graduada\" marcado como encerrado sai das contagens, mesmo sendo um nome que você inventou.",
    },
    {
      seletor: '[data-tour="startups-config-campos"]',
      posicao: "auto",
      titulo: "Campos personalizáveis",
      texto:
        "O que mais você precisa saber de cada startup: texto, categoria, número, documento com máscara sua, ou valor monetário. Cada campo criado aqui aparece no cadastro na hora.",
    },
    fim("Desativar nunca apaga: o que já foi preenchido continua guardado."),
  ],
}

const TOUR_CONFIG_AUDITORIA = {
  titulo: "O registro de auditoria",
  passos: [
    {
      titulo: "Auditoria",
      texto:
        "O que foi feito na incubadora e por quem. É registro de conformidade — serve para reconstruir o que aconteceu, não para tomar decisão do dia a dia (isso são os Relatórios).",
    },
    {
      seletor: '[data-tour="auditoria-busca"]',
      posicao: "baixo",
      titulo: "Procurar no registro",
      texto: "Busca por ação, entidade ou descrição do que foi feito.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="auditoria-entidade"]',
      posicao: "baixo",
      titulo: "Filtrar",
      texto:
        "Abre um painel com as entidades (usuário, startup, evento, trilha...), as ações registradas e o período. Os filtros valem juntos.",
    },
    {
      seletor: '[data-tour="auditoria-tabela"]',
      posicao: "auto",
      titulo: "Os registros",
      texto:
        "Quando, qual ação, sobre qual entidade e a descrição do que mudou. Clique no cabeçalho para ordenar e use o botão de ajustes para escolher as colunas; a lista vem paginada, do mais recente para o mais antigo.",
    },
    fim("Nada aqui é editável — é justamente esse o ponto."),
  ],
}

// ---------------------------------------------------------------------------
// Agenda / Calendario (/eventos)
// ---------------------------------------------------------------------------
const TOUR_EVENTOS = {
  titulo: "Criar um evento",
  passos: [
    {
      titulo: "Bem-vindo ao Calendário da Incubação",
      texto:
        "Aqui ficam reunidas todas as atividades do programa: reuniões, mentorias, entregas, prazos, workshops e bancas. Vamos ver como criar a sua primeira atividade.",
    },
    {
      seletor: '[data-tour="calendario-navegacao"]',
      posicao: "baixo",
      titulo: "Navegue pelas datas",
      texto:
        "Use as setas para ir ao período anterior ou seguinte. O botão Hoje traz o calendário de volta para a data atual.",
    },
    {
      seletor: '[data-tour="calendario-visoes"]',
      posicao: "baixo",
      titulo: "Escolha a visão",
      texto:
        "Dia, Semana e Mês mostram a grade do calendário. Agenda lista as próximas atividades em ordem cronológica.",
    },
    {
      seletor: '[data-tour="calendario-busca"]',
      posicao: "direita",
      titulo: "Encontre uma atividade",
      texto: "A busca filtra o calendário pelo título ou pela descrição da atividade.",
    },
    {
      seletor: '[data-tour="calendario-filtros"]',
      posicao: "direita",
      titulo: "Filtre o que aparece",
      texto:
        "Marque Meus eventos para ver só o que é seu e use as categorias para esconder tipos de atividade que não interessam agora.",
    },
    {
      seletor: '[data-tour="calendario-mini"]',
      posicao: "direita",
      titulo: "Salte para qualquer dia",
      texto:
        "O mini calendário leva o calendário principal para a data escolhida. Os pontinhos indicam os dias que já têm atividade marcada.",
    },
    {
      seletor: '[data-tour="calendario-grade"]',
      posicao: "auto",
      titulo: "A grade do calendário",
      texto:
        "Clique num dia para abrir a visão de Dia e num evento para ver os detalhes, editar ou excluir a atividade.",
    },
    {
      seletor: '[data-tour="calendario-nova-atividade"]',
      posicao: "baixo",
      titulo: "Crie uma atividade",
      texto:
        "Clique em Nova Atividade para abrir o formulário. Pode clicar agora: o tour continua junto com você.",
      permitirInteracao: true,
      avancarAoClicar: true,
    },
    {
      seletor: '[data-tour="form-evento-titulo"]',
      posicao: "esquerda",
      titulo: "1. Dê um nome à atividade",
      texto:
        "O título é o que aparece na grade do calendário. Seja direto: \"Mentoria de Marketing\" ou \"Entrega do MVP\".",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="form-evento-categoria"]',
      posicao: "esquerda",
      titulo: "2. Classifique a atividade",
      texto:
        "A categoria define a cor no calendário e permite filtrar depois. Escolha a que melhor descreve a atividade.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="form-evento-quando"]',
      posicao: "esquerda",
      titulo: "3. Marque data e horário",
      texto:
        "Data e hora de início são obrigatórias. O término é opcional: sem ele a atividade entra no calendário como um marco pontual.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="form-evento-startups"]',
      posicao: "esquerda",
      titulo: "4. Escolha o público",
      texto:
        "Selecione as startups convidadas. Deixando em branco, a atividade vale para todas as startups incubadas.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="form-evento-salvar"]',
      posicao: "cima",
      titulo: "5. Salve a atividade",
      texto:
        "Pronto: ao salvar, a atividade aparece na hora no calendário e na agenda das startups convidadas.",
      permitirInteracao: true,
    },
    fim("A atividade já está no calendário de todo mundo."),
  ],
}

// ---------------------------------------------------------------------------
// Telas de ajuda (abertas pelo UserPanel)
// ---------------------------------------------------------------------------
const TOUR_CENTRAL_AJUDA = {
  titulo: "A Central de Ajuda",
  passos: [
    {
      titulo: "Central de Ajuda",
      texto: "Respostas para as dúvidas mais comuns sobre a plataforma, organizadas por tema.",
    },
    {
      seletor: '[data-tour="ajuda-secoes"]',
      posicao: "auto",
      titulo: "As perguntas",
      texto:
        "Clique numa pergunta para abrir a resposta. Os temas vão de conta e navegação até jornada, eventos e avaliações.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="ajuda-contato"]',
      posicao: "cima",
      titulo: "Se não achar aqui",
      texto:
        "Fala Conosco leva ao contato direto; Enviar Feedback registra uma sugestão ou um problema dentro do sistema.",
    },
    fim("E o \"Fazer Tour\" funciona em qualquer tela."),
  ],
}

const TOUR_FALA_CONOSCO = {
  titulo: "Falar com a gente",
  passos: [
    {
      titulo: "Fala Conosco",
      texto: "Os canais de contato direto da FronteiraTec e da INNE.",
    },
    {
      seletor: '[data-tour="fala-conosco-canais"]',
      posicao: "auto",
      titulo: "Instagram e WhatsApp",
      texto:
        "Os botões abrem o canal numa aba nova. Para sugestão ou problema na plataforma, o caminho melhor é Enviar Feedback: ele fica registrado no sistema.",
    },
    fim("Estamos por aqui."),
  ],
}

const TOUR_ENVIAR_FEEDBACK = {
  titulo: "Mandar um feedback",
  passos: [
    {
      titulo: "Enviar Feedback",
      texto:
        "Sugestões, elogios ou problemas sobre a plataforma. Diferente da tela de Feedback do mentor, que é o histórico de devolutivas às startups.",
    },
    {
      seletor: '[data-tour="enviar-feedback-mensagem"]',
      posicao: "baixo",
      titulo: "Sua mensagem",
      texto:
        "Conte o que aconteceu e em qual tela. Quanto mais concreto, mais rápido dá para resolver. Até 2000 caracteres.",
      permitirInteracao: true,
    },
    {
      seletor: '[data-tour="enviar-feedback-enviar"]',
      posicao: "cima",
      titulo: "Enviar",
      texto: "A mensagem fica registrada com o seu nome e a sua incubadora.",
      permitirInteracao: true,
    },
    fim("Obrigado — feedback é o que faz a plataforma melhorar."),
  ],
}

/**
 * O tour do Engajamento existe principalmente para explicar UMA coisa: por que
 * o trabalho empreendedor nao vira ponto. Sem essa explicacao, o primeiro
 * incubado que entregar um passo da trilha e nao vir pontuacao vai concluir
 * que o sistema esta quebrado.
 */
const TOUR_ENGAJAMENTO = {
  titulo: "Como funciona o engajamento",
  passos: [
    {
      titulo: "Engajamento",
      texto:
        "O placar de participação da incubadora, por temporada. Mentores disputam com mentores e incubados com incubados — são volumes de participação diferentes, e um placar só faria um dos grupos nunca ganhar.",
    },
    {
      seletor: '[data-tour="engajamento-temporada"]',
      posicao: "baixo",
      titulo: "A temporada",
      texto:
        "O período que está em disputa e o que está em jogo. A premiação é semestral: no fim, a coordenação encerra a temporada e o resultado congela.",
    },
    {
      seletor: '[data-tour="engajamento-meu-painel"]',
      posicao: "baixo",
      titulo: "O seu nível",
      texto:
        "Antes do placar vem o seu progresso. O ranking é relativo — só um é o primeiro; o nível é absoluto, e todo mundo pode chegar ao topo. A frase 'faltam N pontos' é o que diz o que fazer a seguir.",
    },
    {
      seletor: '[data-tour="engajamento-regras"]',
      posicao: "cima",
      titulo: "O que pontua, e o que não",
      texto:
        "Pontuam presença e relacionamento com a incubadora. NÃO pontuam experimentos, validação de hipótese, pivotagem, conclusão de momento formativo, ajudar outro empreendedor ou publicar conteúdo — e isso é de propósito: transformar esse trabalho em pontos faria você fazê-lo pelo ponto.",
    },
    {
      seletor: '[data-tour="engajamento-selos"]',
      posicao: "cima",
      titulo: "Os selos",
      texto:
        "É aqui que aquele trabalho é reconhecido. Selo não vale ponto nenhum: vale uma credencial verificável, com o critério escrito e o nome de quem concedeu, que você publica no LinkedIn pelo seu Perfil.",
    },
    fim("Participe pelo que faz sentido — os pontos são consequência, não o objetivo."),
  ],
}

export const TOURS = {
  "/": TOUR_DASHBOARD,
  "/perfil": TOUR_PERFIL,
  "/jornada": TOUR_JORNADA,
  "/minha-startup": TOUR_MINHA_STARTUP,
  "/programa": TOUR_PROGRAMA,
  "/biblioteca": TOUR_BIBLIOTECA,
  "/questionarios": TOUR_QUESTIONARIOS,
  "/passos/:idNo/responder": TOUR_RESPONDER,
  "/eventos": TOUR_EVENTOS,
  "/eventos/presenca": TOUR_PRESENCA,
  "/startups": TOUR_STARTUPS,
  "/startups/membros": TOUR_MEMBROS,
  "/startups/:uuid": TOUR_STARTUP_DETALHE,
  "/mentores": TOUR_MENTORES,
  "/entregas": TOUR_ENTREGAS,
  "/feedback": TOUR_FEEDBACK,
  "/avaliacoes": TOUR_AVALIACOES,
  "/engajamento": TOUR_ENGAJAMENTO,
  "/relatorios/progresso": TOUR_REL_PROGRESSO,
  "/relatorios/entregas": TOUR_REL_ENTREGAS,
  "/relatorios/gargalos": TOUR_REL_GARGALOS,
  "/relatorios/engajamento": TOUR_REL_ENGAJAMENTO,
  "/usuarios": TOUR_USUARIOS,
  "/tenants": TOUR_TENANTS,
  "/configuracoes": TOUR_CONFIG_DADOS,
  "/configuracoes/email": TOUR_CONFIG_EMAIL,
  "/configuracoes/agenda": TOUR_CONFIG_AGENDA,
  "/configuracoes/startups": TOUR_CONFIG_STARTUPS,
  "/configuracoes/auditoria": TOUR_CONFIG_AUDITORIA,
  "/central-ajuda": TOUR_CENTRAL_AJUDA,
  "/fala-conosco": TOUR_FALA_CONOSCO,
  "/enviar-feedback": TOUR_ENVIAR_FEEDBACK,
}

/** Regex de uma rota com parametro: "/startups/:uuid" casa "/startups/9f1c…". */
function regexDaRota(rota) {
  return new RegExp(`^${rota.replace(/:[^/]+/g, "[^/]+")}$`)
}

/**
 * Tour da rota informada, na ordem: rota exata, rota com parametro
 * ("/startups/:uuid") e, por fim, a rota-pai mais especifica (uma subrota sem
 * tour proprio cai no tour da rota de cima).
 *
 * A rota exata vem antes da rota com parametro de proposito: "/startups/membros"
 * tem tour proprio e nao pode ser lida como uma startup de id "membros".
 */
export function tourDaRota(pathname = "") {
  if (TOURS[pathname]) return TOURS[pathname]

  const rotas = Object.keys(TOURS)

  const comParametro = rotas.find((rota) => rota.includes(":") && regexDaRota(rota).test(pathname))
  if (comParametro) return TOURS[comParametro]

  const base = rotas
    .filter((rota) => !rota.includes(":") && rota !== "/" && pathname.startsWith(`${rota}/`))
    .sort((a, b) => b.length - a.length)[0]
  return base ? TOURS[base] : null
}
