/**
 * "O que pontua e o que não pontua" — a regra da coordenação, na tela.
 *
 * ESTE BLOCO NAO E DECORACAO, e nao pode ser removido por economia de espaco.
 * O sistema tem uma lista explicita de coisas que NAO geram ponto — validar
 * hipotese, concluir momento formativo, ajudar outro empreendedor, publicar
 * conteudo. Sem esta explicacao visivel, a primeira pessoa que entregar um
 * passo da trilha e nao vir ponto nenhum vai concluir que o sistema quebrou, e
 * a segunda vai concluir que a incubadora nao valoriza o trabalho dela.
 *
 * A lista vem da API (backend/src/engajamento/padroes.js), e nao de uma
 * constante daqui: e politica, nao texto de interface — mudar a regra nao pode
 * exigir rebuild do front.
 *
 * A resposta para "entao isso nao vale nada?" e o SELO, e por isso os dois
 * lados aparecem lado a lado.
 */
import {
  Box,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material"
import { CheckCircleOutline, MilitaryTech, RemoveCircleOutline } from "@mui/icons-material"

import { iconeDe, pts, rotuloTeto } from "./vocabulario"

export default function RegrasDoJogo({ acoes = [], naoPontuam = [], motivo }) {
  return (
    <Grid container spacing={2} data-tour="engajamento-regras">
      <Grid item xs={12} md={6}>
        <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, height: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <CheckCircleOutline fontSize="small" color="success" />
            <Typography variant="subtitle1" fontWeight={700}>
              O que gera pontos
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Participação e relacionamento com a incubadora. O ponto vem sempre de um registro
            feito por outra pessoa, presença marcada na lista de chamada ou lançamento da
            coordenação.
          </Typography>

          {acoes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma ação configurada ainda.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {acoes.map((acao) => {
                const Icone = iconeDe(acao.icone)
                return (
                  <Tooltip
                    key={acao.chave}
                    title={
                      acao.descricao
                        ? `${acao.descricao} (${rotuloTeto(acao)})`
                        : rotuloTeto(acao)
                    }
                  >
                    <Chip
                      icon={<Icone sx={{ fontSize: 16 }} />}
                      label={`${acao.rotulo} · ${pts(acao.pontos)}`}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: acao.cor, "& .MuiChip-icon": { color: acao.cor } }}
                    />
                  </Tooltip>
                )
              })}
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, height: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <RemoveCircleOutline fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="subtitle1" fontWeight={700}>
              O que não gera pontos
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {motivo}
          </Typography>

          <List dense disablePadding>
            {naoPontuam.map((item) => (
              <ListItem key={item} disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <MilitaryTech sx={{ fontSize: 18, color: "secondary.main" }} />
                </ListItemIcon>
                <ListItemText
                  primary={item}
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Grid>
    </Grid>
  )
}
