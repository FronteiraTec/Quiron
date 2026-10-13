/**
 * Tela "Central de Ajuda".
 *
 * Perguntas frequentes organizadas por tema, num accordion. Aberta pelo item
 * "Central de Ajuda" do UserPanel (avatar da Navbar). Nao busca nada do
 * backend: e conteudo estatico sobre como usar a plataforma.
 *
 * Quem nao encontra a resposta aqui e direcionado para "Fala Conosco" (contato
 * direto) ou "Enviar Feedback" (sugestao/problema registrado no sistema).
 */
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Stack,
} from "@mui/material"
import { ExpandMore, ChatBubbleOutline, Feedback } from "@mui/icons-material"
import { useNavigate } from "react-router-dom"
import AppLayout from "../components/AppLayout"

const SECOES = [
  {
    titulo: "Conta e perfil",
    perguntas: [
      {
        pergunta: "Como mudo o tema (claro/escuro) ou a cor principal do sistema?",
        resposta:
          "Abra o avatar no canto superior direito: as opções de tema e cor ficam logo no topo do painel, na seção \"Aparência\". A mudança é salva automaticamente.",
      },
      {
        pergunta: "Esqueci minha senha, e agora?",
        resposta:
          "Na tela de login, clique em \"Esqueci minha senha\" e siga as instruções enviadas por email.",
      },
    ],
  },
  {
    titulo: "Navegação e menu lateral",
    perguntas: [
      {
        pergunta: "Como fixo um item do menu nos Favoritos?",
        resposta:
          "Passe o mouse sobre o item no menu lateral e clique no icone de alfinete que aparece à direita. Itens fixados ficam sempre visíveis no topo do menu, na seção \"Favoritos\".",
      },
      {
        pergunta: "Como recolho o menu lateral para ganhar espaço na tela?",
        resposta:
          "Clique no ícone com três linhas horizontais paralelas (≡) no topo do menu lateral (StartupSwitcher) para alternar entre o menu expandido e o recolhido (só ícones).",
      },
      {
        pergunta: "Existe busca rápida no menu?",
        resposta:
          "Sim, logo abaixo do cabeçalho do menu lateral. Digite parte do nome da página que você procura.",
      },
    ],
  },
  {
    titulo: "Jornada e entregas",
    perguntas: [
      {
        pergunta: "Onde acompanho o andamento da minha startup na trilha?",
        resposta:
          "Em \"Minha Jornada\", no menu lateral. Lá você vê os passos da trilha, o conteúdo de cada um e envia as entregas.",
      },
      {
        pergunta: "O que significa \"ajuste pedido\" numa entrega?",
        resposta:
          "O mentor avaliou sua entrega e pediu uma correção antes de aprovar. Reenviando a entrega, o pedido de ajuste é substituído pela nova avaliação.",
      },
      {
        pergunta: "Como vejo os comentários que o mentor deixou nas minhas entregas?",
        resposta:
          "O comentário aparece junto com o resultado da entrega em \"Minha Jornada\", no passo correspondente.",
      },
    ],
  },
  {
    titulo: "Eventos",
    perguntas: [
      {
        pergunta: "Qual a diferença entre \"Agenda\" e \"Presença\"?",
        resposta:
          "\"Agenda\" é onde você vê os eventos futuros e confirma se vai participar. \"Presença\" é a chamada dos eventos já realizados, feita pelo admin, é o que alimenta o relatório de engajamento.",
      },
      {
        pergunta: "Como confirmo presença num evento?",
        resposta:
          "Abra \"Eventos\" > \"Agenda\", clique no evento desejado e confirme sua participação. Eventos marcados como obrigatórios não podem ser recusados.",
      },
    ],
  },
  {
    titulo: "Avaliações (mentores)",
    perguntas: [
      {
        pergunta: "Onde fica a fila de entregas para avaliar?",
        resposta:
          "Em \"Avaliações\" > \"Entregas\", no menu lateral. Lá ficam as entregas ainda não respondidas, por startup.",
      },
      {
        pergunta: "Onde vejo o histórico do que já avaliei?",
        resposta:
          "Em \"Avaliações\" > \"Feedback\". Pedidos de ajuste ainda não atendidos aparecem em destaque no topo.",
      },
    ],
  },
]

function PerguntaItem({ pergunta, resposta }) {
  return (
    <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography fontWeight={600}>{pergunta}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography color="text.secondary">{resposta}</Typography>
      </AccordionDetails>
    </Accordion>
  )
}

export default function CentralAjuda() {
  const navigate = useNavigate()

  return (
    <AppLayout>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Central de Ajuda
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Respostas rápidas para as dúvidas mais comuns sobre a plataforma.
        </Typography>

        <Stack data-tour="ajuda-secoes" spacing={3}>
          {SECOES.map((secao) => (
            <Paper key={secao.titulo} sx={{ borderRadius: 0 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", px: 3, pt: 2.5, pb: 0.5, letterSpacing: 0.6 }}
              >
                {secao.titulo}
              </Typography>
              <Box sx={{ px: 1, pb: 1 }}>
                {secao.perguntas.map((item) => (
                  <PerguntaItem key={item.pergunta} {...item} />
                ))}
              </Box>
            </Paper>
          ))}
        </Stack>

        <Paper data-tour="ajuda-contato" sx={{ p: 3, mt: 3, borderRadius: 0, textAlign: "center" }}>
          <Typography fontWeight={600} gutterBottom>
            Não encontrou o que precisava?
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Fale direto com a gente ou registre uma sugestão/problema.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<ChatBubbleOutline />}
              onClick={() => navigate("/fala-conosco")}
            >
              Fala Conosco
            </Button>
            <Button
              variant="outlined"
              startIcon={<Feedback />}
              onClick={() => navigate("/enviar-feedback")}
            >
              Enviar Feedback
            </Button>
          </Stack>
        </Paper>
      </Box>
    </AppLayout>
  )
}
