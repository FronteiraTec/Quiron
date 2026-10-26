/**
 * Uma startup acompanhada, aberta: a trilha dela e o que ja foi entregue em
 * cada ponto.
 *
 * A TRILHA E O MAPA DO COMPARTILHAMENTO. Cada fase e cada passo tem o seu
 * "Adicionar material", e o que ja foi compartilhado aparece pendurado no lugar
 * em que a startup vai encontra-lo — o mentor ve a trilha como a startup a ve,
 * com o estado de cada atividade, e decide onde o material ajuda.
 *
 * Fases fechadas por padrao, com a fase atual aberta: e la que a startup esta,
 * e e la que o material costuma ser util. Uma arvore inteira aberta viraria a
 * tela carregada que este painel existe para evitar.
 */
import { useMemo, useState } from "react"
import { Link as RouterLink } from "react-router-dom"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import { Add, ExpandMore, ArrowBack, OpenInNew, AddCircleOutline } from "@mui/icons-material"
import ChipSituacao from "../startup/ChipSituacao"
import StatusPasso from "../jornada/StatusPasso"
import LinhaCompartilhamento from "./LinhaCompartilhamento"
import { useTrilhaDoIncubado } from "../../hooks/useEspacoMentor"
import { contarMateriais } from "../../data/espacoMentorMeta"

const trilhaPadrao = (startup) =>
  startup?.trilhas?.find((t) => t.status === "EM_ANDAMENTO") ?? startup?.trilhas?.[0] ?? null

export default function PainelIncubado({
  startup,
  versao,
  onCompartilhar,
  onAbrir,
  onEditar,
  onRemover,
  onVoltar,
}) {
  const [idTrilha, setIdTrilha] = useState(() => trilhaPadrao(startup)?.id_no ?? null)
  const resumoTrilha = startup.trilhas.find((t) => t.id_no === idTrilha) ?? null
  const { trilha, compartilhamentos, carregando, erro, recarregar } = useTrilhaDoIncubado({
    idStartup: startup.id_startup,
    idTrilha,
    versao,
  })

  // O que foi entregue em cada lugar da trilha.
  const porLugar = useMemo(() => {
    const mapa = new Map()
    for (const c of compartilhamentos) {
      const chave = c.etapa_visivel ? c.id_no ?? "trilha" : "trilha"
      if (!mapa.has(chave)) mapa.set(chave, [])
      mapa.get(chave).push(c)
    }
    return mapa
  }, [compartilhamentos])
  const daFase = (fase) =>
    compartilhamentos.filter((c) => c.etapa_visivel && Number(c.id_fase) === Number(fase.id_no)).length

  const trilhaRef = resumoTrilha ? { id_no: resumoTrilha.id_no, nome: resumoTrilha.nome } : null
  const compartilharEm = (etapa) => onCompartilhar({ startup, trilha: trilhaRef, etapa })
  const faseAtual = resumoTrilha?.fase_atual?.id_no ?? null
  const pct = resumoTrilha?.passos ? Math.round((resumoTrilha.passos_concluidos / resumoTrilha.passos) * 100) : 0

  const acoes = { onAbrir, onEditar, onRemover }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
      {/* Cabecalho */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        {onVoltar && (
          <IconButton size="small" onClick={onVoltar} aria-label="Voltar à lista">
            <ArrowBack fontSize="small" />
          </IconButton>
        )}
        <Typography variant="h6" sx={{ fontWeight: 800, mr: 0.5 }}>
          {startup.nome}
        </Typography>
        <ChipSituacao startup={startup} />
        <Box sx={{ flex: 1 }} />
        <Button
          component={RouterLink}
          to={`/startups/${startup.uuid}`}
          size="small"
          endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
          sx={{ textTransform: "none" }}
        >
          Ver cadastro
        </Button>
      </Box>

      {startup.trilhas.length === 0 ? (
        <Alert severity="info" variant="outlined">
          {startup.nome} ainda não está matriculada em nenhuma trilha. Os materiais são entregues
          dentro da trilha, peça à coordenação para matricular a startup.
        </Alert>
      ) : (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", mb: 2 }}>
            {startup.trilhas.length > 1 ? (
              <TextField
                select
                size="small"
                label="Trilha"
                value={idTrilha ?? ""}
                onChange={(e) => setIdTrilha(Number(e.target.value))}
                sx={{ minWidth: 240 }}
              >
                {startup.trilhas.map((t) => (
                  <MenuItem key={t.id_no} value={t.id_no}>
                    {t.nome}
                    {t.status === "CONCLUIDA" ? " (concluída)" : ""}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <Typography sx={{ fontWeight: 700 }}>{resumoTrilha?.nome}</Typography>
            )}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: "action.hover" }}
                  aria-label="Progresso na trilha"
                />
                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                  {pct}%
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {resumoTrilha?.passos_concluidos ?? 0} de {resumoTrilha?.passos ?? 0} atividades concluídas
                {resumoTrilha?.fase_atual
                  ? ` · Fase atual: ${resumoTrilha.fase_atual.nome}`
                  : resumoTrilha?.passos
                    ? " · Todas as fases concluídas"
                    : ""}
              </Typography>
            </Box>
          </Box>

          {erro ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={recarregar}>
                  Tentar de novo
                </Button>
              }
            >
              {erro}
            </Alert>
          ) : carregando && !trilha ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
              <CircularProgress size={26} />
            </Box>
          ) : trilha && !trilha.ativa ? (
            <Alert severity="info" variant="outlined">
              Esta trilha está desativada no Construtor, a startup não a vê na Jornada.
            </Alert>
          ) : trilha ? (
            <Box>
              {/* A trilha inteira */}
              <Lugar
                titulo="Trilha inteira"
                subtitulo="Material de referência para todo o programa."
                itens={porLugar.get("trilha") ?? []}
                onAdicionar={() => compartilharEm(null)}
                acoes={acoes}
              />

              {trilha.fases.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Esta trilha ainda não tem fases publicadas.
                </Typography>
              )}

              {trilha.fases.map((fase) => {
                const total = daFase(fase)
                const etapaFase = { id_no: fase.id_no, tipo: "FASE", nome: fase.nome, fase_nome: fase.nome }
                return (
                  <Accordion
                    key={fase.id_no}
                    defaultExpanded={fase.id_no === faseAtual}
                    disableGutters
                    elevation={0}
                    sx={{ border: 1, borderColor: "divider", mt: 1.5, "&:before": { display: "none" } }}
                  >
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", width: "100%", pr: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{fase.nome}</Typography>
                        {fase.id_no === faseAtual && (
                          <Chip size="small" color="primary" variant="outlined" label="Fase atual" sx={{ height: 22 }} />
                        )}
                        <Box sx={{ flex: 1 }} />
                        {total > 0 && <Chip size="small" label={contarMateriais(total)} sx={{ height: 22 }} />}
                        <Typography variant="caption" color="text.secondary">
                          {fase.passos_concluidos}/{fase.passos_total} atividades
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <Lugar
                        titulo="Nesta fase"
                        itens={porLugar.get(fase.id_no) ?? []}
                        onAdicionar={() => compartilharEm(etapaFase)}
                        acoes={acoes}
                        compacto
                      />
                      {fase.modulos.map((modulo) => (
                        <Box key={modulo.id_no} sx={{ mt: 1.5 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}
                          >
                            {modulo.nome}
                          </Typography>
                          {modulo.passos.length === 0 && (
                            <Typography variant="body2" color="text.disabled" sx={{ py: 0.5 }}>
                              Sem atividades.
                            </Typography>
                          )}
                          {modulo.passos.map((passo) => {
                            const itens = porLugar.get(passo.id_no) ?? []
                            return (
                              <Box key={passo.id_no}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                                  <StatusPasso status={passo.status} size={18} />
                                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                                    {passo.nome}
                                  </Typography>
                                  {itens.length > 0 && (
                                    <Chip size="small" variant="outlined" label={itens.length} sx={{ height: 20 }} />
                                  )}
                                  <Tooltip title="Adicionar material a esta atividade">
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        compartilharEm({
                                          id_no: passo.id_no,
                                          tipo: "PASSO",
                                          nome: passo.nome,
                                          fase_nome: fase.nome,
                                        })
                                      }
                                      aria-label={`Adicionar material a ${passo.nome}`}
                                    >
                                      <AddCircleOutline fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                                {itens.length > 0 && (
                                  <Box sx={{ pl: 3.5 }}>
                                    {itens.map((c) => (
                                      <LinhaCompartilhamento key={c.id_compartilhamento} item={c} {...acoes} />
                                    ))}
                                  </Box>
                                )}
                              </Box>
                            )
                          })}
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                )
              })}
            </Box>
          ) : null}
        </>
      )}
    </Paper>
  )
}

/** Um lugar da trilha (a trilha inteira ou uma fase): o que ja foi entregue la e o botao de adicionar. */
function Lugar({ titulo, subtitulo, itens, onAdicionar, acoes, compacto = false }) {
  return (
    <Box sx={{ ...(compacto ? {} : { p: 1.5, border: 1, borderColor: "divider", borderRadius: "4px" }) }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant={compacto ? "caption" : "body1"} sx={{ fontWeight: 700, ...(compacto ? { color: "text.secondary", letterSpacing: "0.05em", textTransform: "uppercase" } : {}) }}>
            {titulo}
          </Typography>
          {subtitulo && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {subtitulo}
            </Typography>
          )}
        </Box>
        <Button size="small" startIcon={<Add />} onClick={onAdicionar} sx={{ textTransform: "none" }}>
          Adicionar material
        </Button>
      </Box>
      {itens.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          {itens.map((c) => (
            <LinhaCompartilhamento key={c.id_compartilhamento} item={c} {...acoes} />
          ))}
        </Box>
      )}
    </Box>
  )
}
