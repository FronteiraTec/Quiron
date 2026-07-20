/**
 * Conteudo educativo dos 9 blocos do Business Model Canvas.
 *
 * Cada bloco carrega, alem da chave usada pela API, o material que guia o
 * empreendedor durante o preenchimento: pergunta-guia, placeholder com
 * exemplos e o conteudo do popover de ajuda (o que e, exemplos reais,
 * erros comuns e uma dica pratica).
 */
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined"
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined"
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined"
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined"
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined"
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined"
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined"
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined"
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined"

// Acentos por zona do canvas: infraestrutura (ambar), oferta (roxo),
// clientes (azul), financeiro (verde/vermelho). Sao decorativos — a
// identificacao do bloco vem sempre do titulo + icone.
export const ACENTOS = {
  infraestrutura: "#f59e0b",
  oferta: "#7c3aed",
  clientes: "#0ea5e9",
  custos: "#ef4444",
  receita: "#10b981",
}

// Legenda das 4 zonas classicas do Business Model Canvas (infraestrutura,
// oferta, clientes e financeiro), usada acima da grade para reforcar a
// leitura visual do canvas.
export const ZONAS_CANVAS = [
  { nome: "Infraestrutura", cor: ACENTOS.infraestrutura },
  { nome: "Oferta", cor: ACENTOS.oferta },
  { nome: "Clientes", cor: ACENTOS.clientes },
  { nome: "Custos", cor: ACENTOS.custos },
  { nome: "Receita", cor: ACENTOS.receita },
]

export const BLOCOS_CANVAS = [
  {
    chave: "parcerias_chave",
    titulo: "Parcerias-chave",
    curto: "Parcerias",
    area: "parcerias",
    icone: HandshakeOutlinedIcon,
    acento: ACENTOS.infraestrutura,
    pergunta: "Quem ajuda sua startup a existir? Fornecedores, universidades, investidores?",
    placeholder: "Ex.:\n• UFFS\n• Sebrae\n• AWS (infraestrutura)\n• Fornecedores de insumos\n• Aceleradoras",
    ajuda: {
      oQueE:
        "São as organizações e pessoas de fora da startup que tornam o negócio possível — quem fornece, apoia, financia ou abre portas.",
      exemplos: ["UFFS (pesquisa e talentos)", "Sebrae (mentorias)", "AWS (créditos de nuvem)", "Distribuidor regional"],
      errosComuns: [
        "Listar qualquer contato da agenda como 'parceiro'.",
        "Esquecer fornecedores críticos, sem os quais o produto para.",
      ],
      dica: "Comece pelos indispensáveis: se essa parceria acabasse amanhã, sua startup continuaria funcionando?",
    },
  },
  {
    chave: "atividades_chave",
    titulo: "Atividades-chave",
    curto: "Atividades",
    area: "atividades",
    icone: BoltOutlinedIcon,
    acento: ACENTOS.infraestrutura,
    pergunta: "O que sua startup precisa fazer, sem falta, para entregar valor?",
    placeholder: "Ex.:\n• Desenvolver o aplicativo\n• Atender clientes\n• Produzir conteúdo\n• Vender e negociar",
    ajuda: {
      oQueE:
        "As ações essenciais do dia a dia para que sua proposta de valor chegue ao cliente: produzir, desenvolver, vender, atender.",
      exemplos: ["Desenvolvimento do software", "Logística de entrega", "Marketing digital", "Suporte ao cliente"],
      errosComuns: [
        "Listar tarefas administrativas genéricas (reuniões, e-mails).",
        "Confundir atividades com recursos — atividade é o que você FAZ.",
      ],
      dica: "Pense no que não pode parar: se a equipe só pudesse fazer 3 coisas esta semana, quais seriam?",
    },
  },
  {
    chave: "recursos_chave",
    titulo: "Recursos-chave",
    curto: "Recursos",
    area: "recursos",
    icone: Inventory2OutlinedIcon,
    acento: ACENTOS.infraestrutura,
    pergunta: "O que você precisa TER para operar? Pessoas, tecnologia, capital?",
    placeholder: "Ex.:\n• Equipe de desenvolvimento\n• Servidores / nuvem\n• Marca registrada\n• Capital de giro",
    ajuda: {
      oQueE:
        "Os ativos indispensáveis para o negócio funcionar: pessoas, equipamentos, tecnologia, propriedade intelectual e dinheiro.",
      exemplos: ["Time técnico", "Plataforma / código-fonte", "Laboratório equipado", "Patente ou marca"],
      errosComuns: [
        "Listar desejos ('um escritório maior') em vez de necessidades reais.",
        "Esquecer recursos intangíveis, como a marca e o conhecimento do time.",
      ],
      dica: "Recurso é o que você usa; atividade é o que você faz com ele. 'Programadores' é recurso, 'programar' é atividade.",
    },
  },
  {
    chave: "proposta_valor",
    titulo: "Proposta de valor",
    curto: "Proposta",
    area: "proposta",
    icone: AutoAwesomeOutlinedIcon,
    acento: ACENTOS.oferta,
    pergunta: "Por que o cliente escolheria a sua startup e não outra? Qual problema você resolve?",
    placeholder: "Ex.:\n• Reduz em 50% o tempo de agendamento\n• Único com suporte em português\n• Mais barato que contratar equipe própria",
    ajuda: {
      oQueE:
        "O coração do canvas: o valor que você entrega ao cliente. Não é o produto em si, e sim o problema que ele resolve ou o ganho que gera.",
      exemplos: ["Economia de tempo", "Redução de custo", "Conveniência (tudo em um lugar)", "Status ou exclusividade"],
      errosComuns: [
        "Descrever funcionalidades ('temos um app') em vez de benefícios.",
        "Prometer valor para 'todo mundo' — proposta boa tem público claro.",
      ],
      dica: "Complete a frase: 'Ajudamos [cliente] a [resultado] sem [dor]'. Se ficou claro, sua proposta está no caminho.",
    },
  },
  {
    chave: "relacionamento_clientes",
    titulo: "Relacionamento com clientes",
    curto: "Relacionamento",
    area: "relacionamento",
    icone: VolunteerActivismOutlinedIcon,
    acento: ACENTOS.clientes,
    pergunta: "Como você conquista, mantém e encanta seus clientes?",
    placeholder: "Ex.:\n• Suporte próximo via WhatsApp\n• Comunidade de usuários\n• Onboarding guiado\n• Programa de indicação",
    ajuda: {
      oQueE:
        "O tipo de relação que sua startup estabelece com cada segmento: pessoal e próxima, automatizada, em comunidade, self-service…",
      exemplos: ["Atendimento dedicado", "Autoatendimento com FAQ", "Comunidade no Discord", "Gerente de contas para grandes clientes"],
      errosComuns: [
        "Prometer atendimento personalizado sem ter equipe para isso.",
        "Pensar só em conquistar e esquecer a retenção.",
      ],
      dica: "Pergunte-se: como o cliente prefere ser tratado — e quanto isso custa? O relacionamento precisa caber no seu modelo.",
    },
  },
  {
    chave: "canais",
    titulo: "Canais",
    curto: "Canais",
    area: "canais",
    icone: CampaignOutlinedIcon,
    acento: ACENTOS.clientes,
    pergunta: "Por onde o cliente descobre, compra e recebe seu produto?",
    placeholder: "Ex.:\n• Instagram e LinkedIn\n• Site com venda direta\n• Loja de aplicativos\n• Parceiros revendedores",
    ajuda: {
      oQueE:
        "Os caminhos entre a startup e o cliente: divulgação (como ele descobre), venda (como ele compra) e entrega (como ele recebe).",
      exemplos: ["Redes sociais", "Google / SEO", "Venda direta B2B", "Marketplace"],
      errosComuns: [
        "Querer estar em todos os canais ao mesmo tempo.",
        "Esquecer o canal de ENTREGA — o cliente compra, mas recebe como?",
      ],
      dica: "Onde seu cliente já está? Comece por 1 ou 2 canais que você consegue fazer bem, e meça o resultado.",
    },
  },
  {
    chave: "segmentos_clientes",
    titulo: "Segmentos de clientes",
    curto: "Segmentos",
    area: "segmentos",
    icone: GroupsOutlinedIcon,
    acento: ACENTOS.clientes,
    pergunta: "Para quem você cria valor? Quem é seu cliente ideal?",
    placeholder: "Ex.:\n• Clínicas de pequeno porte do Oeste de SC\n• Estudantes universitários\n• E-commerces com até 10 funcionários",
    ajuda: {
      oQueE:
        "Os grupos de pessoas ou empresas que você quer atender. Cada segmento tem dores, comportamentos e disposição de pagar diferentes.",
      exemplos: ["Pequenas clínicas", "Produtores rurais da região", "Escolas particulares", "Desenvolvedores freelancer"],
      errosComuns: [
        "Dizer que o cliente é 'todo mundo' — sem foco, nada conversa com ninguém.",
        "Confundir usuário (quem usa) com cliente (quem paga).",
      ],
      dica: "Descreva seu cliente como descreveria uma pessoa: onde trabalha, o que o incomoda, quanto pode pagar.",
    },
  },
  {
    chave: "estrutura_custos",
    titulo: "Estrutura de custos",
    curto: "Custos",
    area: "custos",
    icone: PaymentsOutlinedIcon,
    acento: ACENTOS.custos,
    pergunta: "Quais são os principais gastos para o negócio funcionar?",
    placeholder: "Ex.:\n• Salários e pró-labore\n• Servidores e ferramentas\n• Marketing\n• Impostos e contabilidade",
    ajuda: {
      oQueE:
        "Tudo o que sai do caixa para manter o modelo de negócio rodando: custos fixos, variáveis e os investimentos mais pesados.",
      exemplos: ["Folha de pagamento", "Infraestrutura de nuvem", "Aluguel / coworking", "Tráfego pago"],
      errosComuns: [
        "Esquecer custos 'invisíveis': impostos, taxas de cartão, contador.",
        "Não separar custo fixo (todo mês) de variável (por venda).",
      ],
      dica: "Olhe os blocos de atividades e recursos-chave: cada item de lá gera um custo aqui. Comece por eles.",
    },
  },
  {
    chave: "fontes_receita",
    titulo: "Fontes de receita",
    curto: "Receita",
    area: "receita",
    icone: TrendingUpOutlinedIcon,
    acento: ACENTOS.receita,
    pergunta: "Como o dinheiro entra? Quanto e de que forma o cliente paga?",
    placeholder: "Ex.:\n• Assinatura mensal (R$ 99/mês)\n• Comissão de 8% por venda\n• Licença anual para empresas",
    ajuda: {
      oQueE:
        "As formas pelas quais a startup ganha dinheiro com cada segmento: venda direta, assinatura, comissão, licenciamento, publicidade…",
      exemplos: ["Assinatura (SaaS)", "Venda unitária", "Comissão por transação", "Freemium com plano pago"],
      errosComuns: [
        "Definir preço só olhando o concorrente, sem olhar os custos.",
        "Depender de uma única fonte de receita frágil.",
      ],
      dica: "O cliente pagaria quanto pelo valor que você entrega? Teste preços cedo — receita é hipótese até alguém pagar.",
    },
  },
]
