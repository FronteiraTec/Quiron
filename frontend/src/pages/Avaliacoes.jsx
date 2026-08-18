/**
 * Tela "Avaliacoes" — todas as devolutivas da incubadora.
 *
 * Tres telas olham para a avaliacao e vale nao confundi-las:
 *   /entregas   -> o que FALTA responder (fila do mentor)
 *   /feedback   -> o que EU respondi (historico do mentor)
 *   /avaliacoes -> o que TODOS responderam (esta, do admin)
 *
 * A pergunta que ela responde nao e "o que foi decidido" — isso a jornada da
 * startup ja mostra. E "como a mentoria esta sendo feita": quem responde, em
 * quanto tempo, e com que qualidade. Por isso o destaque fica na devolutiva SEM
 * COMENTARIO: um "aprovado" seco nao ensina nada a quem recebeu, e e o unico
 * problema aqui que ninguem mais no sistema aponta.
 *
 * Endpoint:
 *   GET /avaliacoes?id_tenant=
 */
import { useMemo, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Avatar,
  Chip,
  Alert,
  Tooltip,
  CircularProgress,
} from "@mui/material"
import { Search, Grading, CommentsDisabled } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import { useAvaliacoes } from "../hooks/useAvaliacoes"
import { useAuthStore } from "../store/authStore"
import { SITUACAO } from "../data/avaliacaoMeta"

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

/** Cartao de numero do topo. */
function Indicador({ valor, rotulo, cor, ajuda }) {
  const conteudo = (
    <Box sx={{ px: 2.5, py: 1.5, borderRight: "1px solid", borderColor: "divider", flex: 1 }}>
      <Typography variant="h5" fontWeight={700} sx={{ color: cor || "text.primary" }}>
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
    </Box>
  )
  return ajuda ? (
    <Tooltip title={ajuda} arrow>
      {conteudo}
    </Tooltip>
  ) : (
    conteudo
  )
}

export default function Avaliacoes() {
  const usuario = useAuthStore((s) => s.usuario)
  const idTenant = usuario?.id_tenant ?? null

  const { avaliacoes, carregando, erro } = useAvaliacoes(idTenant)

  const [busca, setBusca] = useState("")
  const [filtroDecisao, setFiltroDecisao] = useState("todas")
  const [filtroAvaliador, setFiltroAvaliador] = useState("todos")

  const avaliadores = useMemo(() => {
    const mapa = new Map()
    for (const a of avaliacoes) mapa.set(a.id_avaliador, a.avaliador)
    return [...mapa.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((x, y) => x.nome.localeCompare(y.nome))
  }, [avaliacoes])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return avaliacoes.filter((a) => {
      if (filtroDecisao !== "todas" && a.status !== filtroDecisao) return false
      if (filtroAvaliador !== "todos" && String(a.id_avaliador) !== String(filtroAvaliador)) {
        return false
      }
      if (termo) {
        const alvo = `${a.startup} ${a.passo} ${a.avaliador} ${a.comentario || ""}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [avaliacoes, busca, filtroDecisao, filtroAvaliador])

  // Indicadores sobre o conjunto FILTRADO: se o admin filtrou por um mentor,
  // os numeros passam a ser sobre aquele mentor — que e o que ele quer ver.
  const semComentario = useMemo(
    () => visiveis.filter((a) => !a.comentario || !a.comentario.trim()).length,
    [visiveis]
  )
  const tempoMedio = useMemo(() => {
    const comTempo = visiveis.filter((a) => a.dias_resposta != null)
    if (comTempo.length === 0) return null
    return comTempo.reduce((s, a) => s + a.dias_resposta, 0) / comTempo.length
  }, [visiveis])
  const notaMedia = useMemo(() => {
    const comNota = visiveis.filter((a) => a.nota != null)
    if (comNota.length === 0) return null
    return comNota.reduce((s, a) => s + a.nota, 0) / comNota.length
  }, [visiveis])

  return (
    <AppLayout>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Grading sx={{ color: "primary.main" }} />
          <Typography variant="h4" fontWeight={700}>
            Avaliações
          </Typography>
        </Box>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Todas as devolutivas dadas às startups — quem respondeu, quando e o
          que disse.
        </Typography>

        {erro && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {erro}
          </Alert>
        )}

        {carregando ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* ---- Indicadores ---- */}
            <Paper data-tour="avaliacoes-indicadores" sx={{ borderRadius: 0, display: "flex", flexWrap: "wrap", mb: 2 }}>
              <Indicador valor={visiveis.length} rotulo="devolutivas" />
              <Indicador
                valor={tempoMedio == null ? "—" : `${tempoMedio.toFixed(1)}d`}
                rotulo="tempo médio de resposta"
                ajuda="Do envio da entrega ate a devolutiva. Reenvio reinicia a contagem."
              />
              <Indicador
                valor={notaMedia == null ? "—" : notaMedia.toFixed(1)}
                rotulo="nota média"
                ajuda="Só entram as devolutivas que atribuíram nota - ela é opcional."
              />
              <Indicador
                valor={semComentario}
                rotulo="sem comentário"
                cor={semComentario > 0 ? "#f97316" : undefined}
                ajuda="Devolutiva sem texto não diz à startup o que fazer com a decisão."
              />
            </Paper>

            {/* ---- Filtros ---- */}
            <Box data-tour="avaliacoes-filtros" sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
              <TextField
                data-tour="avaliacoes-busca"
                placeholder="Buscar startup, passo, mentor ou comentário..."
                size="small"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                sx={{ flex: 1, minWidth: 260 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                select
                size="small"
                value={filtroDecisao}
                onChange={(e) => setFiltroDecisao(e.target.value)}
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="todas">Todas as decisões</MenuItem>
                {["APROVADO", "AJUSTE", "REPROVADO"].map((s) => (
                  <MenuItem key={s} value={s}>
                    {SITUACAO[s]?.label || s}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                value={filtroAvaliador}
                onChange={(e) => setFiltroAvaliador(e.target.value)}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="todos">Todos os avaliadores</MenuItem>
                {avaliadores.map((a) => (
                  <MenuItem key={a.id} value={String(a.id)}>
                    {a.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* ---- A lista ---- */}
            <Paper data-tour="avaliacoes-lista" sx={{ borderRadius: 0, overflow: "hidden" }}>
              {visiveis.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
                  <Grading sx={{ fontSize: 48, opacity: 0.4 }} />
                  <Typography sx={{ mt: 1 }}>
                    {avaliacoes.length === 0
                      ? "Nenhuma devolutiva registrada ainda."
                      : "Nada corresponde ao filtro."}
                  </Typography>
                  {avaliacoes.length === 0 && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      Elas aparecem aqui conforme os mentores respondem às
                      entregas da fila.
                    </Typography>
                  )}
                </Box>
              ) : (
                visiveis.map((a, i) => {
                  const meta = SITUACAO[a.status]
                  const vazio = !a.comentario || !a.comentario.trim()

                  return (
                    <Box
                      key={a.id_avaliacao}
                      sx={{
                        px: 3,
                        py: 2,
                        borderTop: i === 0 ? "none" : "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.75 }}>
                        <Tooltip title={`Avaliado por ${a.avaliador}`} arrow>
                          <Avatar
                            src={a.avaliador_foto || undefined}
                            sx={{ width: 30, height: 30, fontSize: 13, bgcolor: "primary.main" }}
                          >
                            {inicial(a.avaliador)}
                          </Avatar>
                        </Tooltip>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} noWrap>
                            {a.startup}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {a.passo}
                            {a.fase ? ` · ${a.fase}` : ""}
                            {a.modulo ? ` · ${a.modulo}` : ""}
                          </Typography>
                        </Box>

                        {a.nota != null && (
                          <Chip size="small" variant="outlined" label={`nota ${a.nota}`} />
                        )}

                        {meta && (
                          <Chip
                            size="small"
                            label={meta.label}
                            sx={{ bgcolor: meta.cor, color: "#fff", fontWeight: 700 }}
                          />
                        )}
                      </Box>

                      {vazio ? (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            color: "#f97316",
                            ml: 5.5,
                          }}
                        >
                          <CommentsDisabled sx={{ fontSize: 15 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Sem comentário — a startup recebeu só a decisão.
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" sx={{ ml: 5.5, whiteSpace: "pre-wrap" }}>
                          {a.comentario}
                        </Typography>
                      )}

                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 5.5, mt: 0.5, display: "block" }}
                      >
                        {a.avaliador} · {new Date(a.criado_ts).toLocaleDateString("pt-BR")}
                        {a.dias_resposta != null &&
                          ` · respondeu em ${
                            a.dias_resposta < 1 ? "menos de um dia" : `${a.dias_resposta} dias`
                          }`}
                      </Typography>
                    </Box>
                  )
                })
              )}
            </Paper>
          </>
        )}
      </Box>
    </AppLayout>
  )
}
