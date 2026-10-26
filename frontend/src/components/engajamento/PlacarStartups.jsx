/**
 * O placar por startup — pela MÉDIA dos membros ativos.
 *
 * MEDIA, E NAO SOMA, e esta e a decisao que faz o placar significar algo: pela
 * soma, uma startup de seis pessoas venceria uma de duas sem que ninguem la
 * participasse mais. O placar mediria tamanho de time.
 *
 * A SOMA APARECE DO LADO porque responde outra pergunta legitima — "quanta
 * gente daqui apareceu" — e porque esconder o total faria a media parecer
 * numero inventado.
 *
 * "N de M pontuaram" e a coluna que a coordenacao usa de verdade: media alta
 * com uma pessoa pontuando e uma startup carregada por uma pessoa so, e isso e
 * um sinal para conversar, nao para premiar.
 */
import {
  Avatar,
  Box,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material"

export default function PlacarStartups({ linhas = [] }) {
  if (linhas.length === 0) {
    return (
      <Paper sx={{ borderRadius: 0, p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          Nenhuma startup ativa com membros nesta incubadora.
        </Typography>
      </Paper>
    )
  }

  const maiorMedia = Math.max(...linhas.map((l) => l.pontos_media || 0), 1)

  return (
    <Paper sx={{ borderRadius: 0, overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell width={56}>#</TableCell>
            <TableCell>Startup</TableCell>
            <TableCell align="right">
              <Tooltip title="Pontos da startup divididos pelos membros ativos. É por aqui que o placar ordena, pela soma, o time maior venceria sem participar mais.">
                <span>Média por membro</span>
              </Tooltip>
            </TableCell>
            <TableCell align="right">Total</TableCell>
            <TableCell align="right">
              <Tooltip title="Quantos membros ativos pontuaram, de quantos existem. Média alta com uma pessoa só é uma startup carregada por uma pessoa só.">
                <span>Participaram</span>
              </Tooltip>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {linhas.map((linha, i) => (
            <TableRow key={linha.id_startup}>
              <TableCell>{i + 1}º</TableCell>

              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Avatar
                    src={linha.logo || undefined}
                    variant="rounded"
                    sx={{ width: 28, height: 28, fontSize: 13 }}
                  >
                    {(linha.nome || "?").charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" noWrap>
                    {linha.nome}
                  </Typography>
                </Box>
              </TableCell>

              <TableCell align="right" sx={{ minWidth: 140 }}>
                <Typography variant="body2" fontWeight={700}>
                  {linha.pontos_media ?? 0}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={((linha.pontos_media || 0) / maiorMedia) * 100}
                  sx={{ height: 4, borderRadius: 0, mt: 0.5, bgcolor: "action.hover" }}
                />
              </TableCell>

              <TableCell align="right">{linha.pontos_total}</TableCell>

              <TableCell align="right">
                {linha.membros_pontuaram} de {linha.membros}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  )
}
