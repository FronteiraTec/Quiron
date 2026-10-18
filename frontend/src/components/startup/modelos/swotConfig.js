/**
 * Conteudo educativo dos 4 quadrantes da Analise SWOT.
 *
 * Cada quadrante carrega a chave usada pela API, a posicao na grade 2x2 e o
 * material que guia o empreendedor: pergunta-guia, placeholder com exemplos e
 * o conteudo do popover de ajuda (o que e, exemplos reais, erros comuns e uma
 * dica pratica) — o mesmo formato do canvasConfig.
 *
 * As cores sao as quatro do logo EMPREENDE UFFS, uma por quadrante. Entram
 * cruas aqui e sao ajustadas a aparencia na tela (paletaDaCor).
 */
import { MARCA } from "../../../theme"

// Os dois eixos da matriz, mostrados na legenda acima da grade.
export const EIXOS_SWOT = [
  { nome: "Fatores internos", detalhe: "o que a startup controla", letras: "S · W" },
  { nome: "Fatores externos", detalhe: "o que vem do mercado", letras: "O · T" },
]

export const QUADRANTES_SWOT = [
  {
    chave: "forcas",
    letra: "S",
    titulo: "Forças",
    ingles: "Strengths",
    cor: MARCA.logo.verde,
    pergunta: "O que a sua startup faz melhor que os outros? Que vantagens só vocês têm?",
    placeholder: "Ex.:\n• Equipe com experiência no setor\n• Tecnologia própria\n• Custo de operação baixo\n• Primeiros clientes satisfeitos",
    ajuda: {
      oQueE:
        "Vantagens INTERNAS: o que está sob controle da startup e a coloca à frente — competências da equipe, tecnologia, recursos, rede de contatos, reputação.",
      exemplos: [
        "Fundadores com 10 anos de experiência no setor",
        "Software próprio que reduz o tempo de entrega pela metade",
        "Primeiros clientes pagantes e satisfeitos",
      ],
      errosComuns: [
        "Listar o que o mercado oferece — isso é oportunidade, não força",
        "Forças genéricas como \"equipe dedicada\": o que vocês têm que o concorrente não tem?",
      ],
      dica: "Pergunte a um cliente por que ele escolheu vocês: a resposta costuma ser a força mais real.",
    },
  },
  {
    chave: "fraquezas",
    letra: "W",
    titulo: "Fraquezas",
    ingles: "Weaknesses",
    cor: MARCA.logo.amarelo,
    pergunta: "Onde a startup ainda é frágil? O que falta na equipe, no produto ou no caixa?",
    placeholder: "Ex.:\n• Ninguém da equipe com experiência em vendas\n• Caixa para poucos meses\n• Produto ainda sem validação\n• Marca pouco conhecida",
    ajuda: {
      oQueE:
        "Limitações INTERNAS: o que a startup ainda não faz bem ou não tem — e que está ao alcance dela corrigir.",
      exemplos: [
        "Nenhum sócio com experiência em vendas",
        "Caixa para apenas três meses de operação",
        "Atendimento ao cliente todo manual",
      ],
      errosComuns: [
        "Esconder fraquezas para a análise \"ficar bonita\" — o mentor precisa vê-las para ajudar",
        "Confundir com ameaça: se vem de fora e vocês não controlam, é ameaça",
      ],
      dica: "Cada fraqueza listada aqui é candidata a virar um problema na Matriz GUT.",
    },
  },
  {
    chave: "oportunidades",
    letra: "O",
    titulo: "Oportunidades",
    ingles: "Opportunities",
    cor: MARCA.logo.azul,
    pergunta: "O que está acontecendo no mercado que a startup pode aproveitar?",
    placeholder: "Ex.:\n• Edital de inovação aberto\n• Lei nova que cria demanda\n• Concorrente saindo do mercado\n• Setor crescendo na região",
    ajuda: {
      oQueE:
        "Fatores EXTERNOS favoráveis: tendências, mudanças e brechas do mercado que a startup pode aproveitar — mas não controla.",
      exemplos: [
        "Edital de fomento à inovação aberto este ano",
        "Nova lei que obriga as empresas do setor a se adequarem",
        "Demanda crescente por serviços digitais na região",
      ],
      errosComuns: [
        "Escrever planos da startup (\"lançar o app\") — isso é ação, não oportunidade",
        "Oportunidades vagas como \"mercado grande\", sem dizer por que agora",
      ],
      dica: "Cruze com as forças: a melhor estratégia costuma ser usar uma força para agarrar uma oportunidade.",
    },
  },
  {
    chave: "ameacas",
    letra: "T",
    titulo: "Ameaças",
    ingles: "Threats",
    cor: MARCA.logo.magenta,
    pergunta: "O que, de fora, pode atrapalhar a startup? Concorrência, leis, economia?",
    placeholder: "Ex.:\n• Concorrente grande entrando no nicho\n• Juros altos encarecendo o crédito\n• Regulação nova no setor\n• Fornecedor-chave subindo os preços",
    ajuda: {
      oQueE:
        "Fatores EXTERNOS desfavoráveis: o que, fora do controle da startup, pode prejudicar o negócio — concorrência, economia, regulação, tecnologia.",
      exemplos: [
        "Concorrente com mais capital entrando no mesmo nicho",
        "Alta dos juros encarecendo o crédito dos clientes",
        "Mudança de regra numa plataforma da qual o produto depende",
      ],
      errosComuns: [
        "Listar fraquezas internas como ameaça — \"falta de caixa\" é fraqueza",
        "Ignorar ameaças por otimismo: prever o risco é o que permite se proteger",
      ],
      dica: "Para cada ameaça, pense: qual fraqueza nossa a deixa mais perigosa? Esse par é prioridade.",
    },
  },
]
