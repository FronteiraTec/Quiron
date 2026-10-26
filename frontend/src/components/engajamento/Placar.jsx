/**
 * O placar de uma liga: pódio dos três primeiros + a tabela do resto.
 *
 * PODIO E TABELA JUNTOS porque respondem perguntas diferentes. O podio e o
 * unico lugar em que o placar vira comemoracao — nomes grandes, o nivel de
 * cada um, a startup. A tabela responde "e eu, onde estou?", e por isso
 * DESTACA A LINHA DA PESSOA LOGADA: sem isso ela precisa procurar o proprio
 * nome numa lista de quarenta.
 *
 * QUEM ESTA COM ZERO CONTINUA NA LISTA. Participou e o teto cortou, ou
 * participou de algo que vale pouco — sumir do placar depois de ter aparecido
 * e pior do que aparecer com zero.
 *
 * NAO HA COLUNA DE SELOS somando nada: a contagem aparece como informacao ao
 * lado do nome, nunca como criterio de ordenacao. Selo nao vale ponto (ver o
 * cabecalho da migracao 017), e ordenar por selo faria dele exatamente a moeda
 * que ele nao e.
 */
import { Avatar, Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material"
import { MilitaryTech } from "@mui/icons-material"

import { iconeDe, pts } from "./vocabulario"

const MEDALHAS = ["#f59e0b", "#94a3b8", "#b45309"]

function Podio({ linhas }) {
  if (linhas.length === 0) return null
  // Ordem visual 2º - 1º - 3º: o primeiro no meio, mais alto.
  const ordem = [linhas[1], linhas[0], linhas[2]].filter(Boolean)

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: { xs: 1, sm: 2 },
        mb: 3,
      }}
    >
      {ordem.map((linha) => {
        const primeiro = linha.posicao === 1
        const Icone = iconeDe(linha.nivel?.icone)
        return (
          <Paper
            key={linha.id_usuario}
            sx={{
              borderRadius: 0,
              p: { xs: 1.5, sm: 2 },
              textAlign: "center",
              flex: 1,
              maxWidth: 220,
              borderTop: "4px solid",
              borderTopColor: MEDALHAS[linha.posicao - 1] || "divider",
              pb: primeiro ? 3 : 2,
            }}
          >
            <Avatar
              src={linha.foto_url || undefined}
              sx={{
                width: primeiro ? 64 : 48,
                height: primeiro ? 64 : 48,
                mx: "auto",
                mb: 1,
                bgcolor: linha.nivel?.cor || "primary.main",
              }}
            >
              {(linha.nome || "?").charAt(0).toUpperCase()}
            </Avatar>

            <Typography variant="caption" color="text.secondary" display="block">
              {linha.posicao}º lugar
            </Typography>
            <Typography variant="subtitle2" fontWeight={700} noWrap title={linha.nome}>
              {linha.nome}
            </Typography>
            {linha.startup && (
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {linha.startup}
              </Typography>
            )}

            <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>
              {linha.pontos}
            </Typography>
            <Chip
              size="small"
              icon={<Icone sx={{ fontSize: 14 }} />}
              label={linha.nivel?.nome || "—"}
              variant="outlined"
              sx={{ mt: 0.5, borderColor: linha.nivel?.cor }}
            />
          </Paper>
        )
      })}
    </Box>
  )
}

export default function Placar({ linhas = [], idUsuarioLogado, vazio }) {
  if (linhas.length === 0) {
    return (
      <Paper sx={{ borderRadius: 0, p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">{vazio}</Typography>
      </Paper>
    )
  }

  return (
    <Box>
      <Podio linhas={linhas.slice(0, 3)} />

      <Paper sx={{ borderRadius: 0, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={56}>#</TableCell>
              <TableCell>Pessoa</TableCell>
              <TableCell>Nível</TableCell>
              <TableCell align="right">Participações</TableCell>
              <TableCell align="right">Selos</TableCell>
              <TableCell align="right">Pontos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.map((linha) => {
              const eu = linha.id_usuario === idUsuarioLogado
              const Icone = iconeDe(linha.nivel?.icone)
              return (
                <TableRow
                  key={linha.id_usuario}
                  sx={{ bgcolor: eu ? "action.selected" : undefined }}
                >
                  <TableCell>{linha.posicao}º</TableCell>

                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar
                        src={linha.foto_url || undefined}
                        sx={{ width: 28, height: 28, fontSize: 13 }}
                      >
                        {(linha.nome || "?").charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={eu ? 700 : 400} noWrap>
                          {linha.nome}
                          {eu && " (você)"}
                        </Typography>
                        {linha.startup && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {linha.startup}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      size="small"
                      icon={<Icone sx={{ fontSize: 14 }} />}
                      label={linha.nivel?.nome || "—"}
                      variant="outlined"
                      sx={{ borderColor: linha.nivel?.cor }}
                    />
                  </TableCell>

                  <TableCell align="right">{linha.participacoes}</TableCell>

                  <TableCell align="right">
                    {linha.selos > 0 ? (
                      <Tooltip title="Selos recebidos. Reconhecimento de evolução e protagonismo não somam pontos.">
                        <Box
                          sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            color: "secondary.main",
                          }}
                        >
                          <MilitaryTech sx={{ fontSize: 16 }} />
                          {linha.selos}
                        </Box>
                      </Tooltip>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>
                      {pts(linha.pontos)}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
