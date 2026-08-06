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
 */

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
    {
      titulo: "É só isso!",
      texto:
        "Você pode refazer este tour quando quiser pelo menu da sua conta, em Ajuda > Fazer Tour.",
    },
  ],
}

export const TOURS = {
  "/eventos": TOUR_EVENTOS,
}

/**
 * Tour da rota informada. Aceita subrotas (ex.: /configuracoes/email cai no
 * tour de /configuracoes se so ele estiver registrado).
 */
export function tourDaRota(pathname = "") {
  if (TOURS[pathname]) return TOURS[pathname]
  const base = Object.keys(TOURS)
    .filter((rota) => rota !== "/" && pathname.startsWith(`${rota}/`))
    .sort((a, b) => b.length - a.length)[0]
  return base ? TOURS[base] : null
}
