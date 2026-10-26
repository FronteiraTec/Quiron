/**
 * Tela "Engajamento" — o placar de participação da incubadora e o mural de
 * selos.
 *
 * A ORDEM DA TELA E UMA DECISAO: primeiro o SEU painel (nivel, pontos, quanto
 * falta para o proximo degrau), depois o placar dos outros. O ranking e
 * relativo — so um e o primeiro, e quem esta em 14o para de olhar; o nivel e
 * absoluto, e e ele que mantem no jogo quem nunca vai ganhar a premiacao.
 *
 * DUAS LIGAS EM ABAS SEPARADAS: mentor disputa com mentor, incubado com
 * incubado. Volumes e naturezas de participacao diferentes num placar so
 * fariam um dos dois grupos nunca ganhar.
 *
 * DUAS MOEDAS QUE NAO SE SOMAM, e a tela precisa deixar isso obvio:
 *   PONTOS  medem PARTICIPACAO (presenca, mentoria, coworking, indicacao).
 *   SELOS   medem EVOLUCAO e PROTAGONISMO — e valem ZERO ponto.
 * Por isso o mural e uma aba propria e o bloco "o que pontua / o que nao
 * pontua" fica no fim da tela, sempre visivel: sem a regra escrita, quem
 * entregar um passo da trilha e nao vir ponto vai achar que e bug.
 *
 * O PAINEL PROPRIO NAO EXIGE PERMISSAO (e dado do usuario, como a Jornada); o
 * placar dos outros exige `engajamento.ranking.visualizar`. Por isso os dois
 * carregam em hooks separados — juntar faria a tela inteira dar 403 para quem
 * so pode ver o proprio progresso.
 *
 * Endpoints: ver hooks/useEngajamento e hooks/useSelos.
 */
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material"
import { AddCircleOutline, EmojiEvents } from "@mui/icons-material"

import AppLayout from "../components/AppLayout"
import PainelPessoal from "../components/engajamento/PainelPessoal"
import Placar from "../components/engajamento/Placar"
import PlacarStartups from "../components/engajamento/PlacarStartups"
import MuralSelos from "../components/engajamento/MuralSelos"
import RegrasDoJogo from "../components/engajamento/RegrasDoJogo"
import DrawerLancamento from "../components/engajamento/DrawerLancamento"
import DrawerConcederSelo from "../components/engajamento/DrawerConcederSelo"
import { dataDiaBR, diasRestantes } from "../components/engajamento/vocabulario"
import { useMeuPainel, useRanking, useLancamentos } from "../hooks/useEngajamento"
import { useSelos, useGestaoSelos } from "../hooks/useSelos"
import api from "../services/api"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"

/** Faixa da temporada: o que esta em jogo e quanto tempo falta. */
function FaixaTemporada({ temporada, temporadas, idSelecionada, onSelecionar }) {
  const dias = diasRestantes(temporada)

  return (
    <Paper
      data-tour="engajamento-temporada"
      sx={{
        borderRadius: 0,
        p: { xs: 2, sm: 3 },
        mb: 3,
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        alignItems: "center",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 240 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" fontWeight={700}>
            Temporada {temporada?.nome || "—"}
          </Typography>
          {temporada?.encerrada && <Chip size="small" label="Encerrada" />}
          {!temporada?.encerrada && dias !== null && (
            <Chip
              size="small"
              variant="outlined"
              label={dias >= 0 ? `${dias} dia(s) restante(s)` : "período terminado"}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {temporada
            ? `${dataDiaBR(temporada.inicio_dt)} a ${dataDiaBR(temporada.fim_dt)}`
            : "Nenhuma temporada cadastrada."}
        </Typography>
        {temporada?.premiacao && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Em jogo:</strong> {temporada.premiacao}
          </Typography>
        )}
      </Box>

      {temporadas.length > 1 && (
        <TextField
          select
          size="small"
          label="Temporada"
          value={idSelecionada || temporada?.id_temporada || ""}
          onChange={(e) => onSelecionar(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {temporadas.map((t) => (
            <MenuItem key={t.id_temporada} value={t.id_temporada}>
              {t.nome}
            </MenuItem>
          ))}
        </TextField>
      )}
    </Paper>
  )
}

export default function Engajamento() {
  const usuario = useAuthStore((s) => s.usuario)
  const pode = usePermissaoStore((s) => s.pode)
  const idTenant = usuario?.id_tenant

  // O id do usuario logado tem DOIS nomes conforme o caminho: o login devolve
  // `id`, e o /auth/me (usado ao recarregar a pagina) devolve `id_usuario`.
  // Ler os dois e o que faz o destaque "voce" no placar sobreviver a um F5.
  const idUsuarioLogado = usuario?.id_usuario ?? usuario?.id

  const [idTemporada, setIdTemporada] = useState(null)
  // A aba vive na URL: "veja o mural de selos" e um link que alguem manda, e
  // sem isso o destinatario cai no placar e tem de procurar a aba.
  const [params, setParams] = useSearchParams()
  const aba = params.get("aba") || "incubados"
  const setAba = (valor) => setParams({ aba: valor }, { replace: true })
  const [lancamentoAberto, setLancamentoAberto] = useState(false)
  const [seloParaConceder, setSeloParaConceder] = useState(null)
  const [participantes, setParticipantes] = useState([])

  const podeVerRanking = pode("engajamento.ranking.visualizar")
  const podeLancar = pode("engajamento.pontos.lancar")
  const podeVerSelos = pode("engajamento.selos.visualizar")
  const podeConceder = pode("engajamento.selos.conceder")

  const { painel, carregando: carregandoPainel, recarregar: recarregarPainel } = useMeuPainel(
    idTenant,
    idTemporada
  )
  const { dados, carregando, erro, recarregar } = useRanking(
    podeVerRanking ? idTenant : null,
    idTemporada
  )
  const {
    selos,
    concessoes,
    recarregar: recarregarSelos,
  } = useSelos(podeVerSelos ? idTenant : null, { comMural: true })

  const { lancar } = useLancamentos(idTenant)
  const { conceder } = useGestaoSelos(idTenant)

  // A lista de pessoas so e buscada por quem tem alguma acao para fazer com
  // ela: e a lista nominal da incubadora, e o endpoint exige uma das duas
  // chaves de acao.
  useEffect(() => {
    if (!idTenant || (!podeLancar && !podeConceder)) return
    api
      .get("/engajamento/participantes", { params: { id_tenant: idTenant } })
      .then(({ data }) => setParticipantes(data.participantes))
      .catch(() => setParticipantes([]))
  }, [idTenant, podeLancar, podeConceder])

  const temporada = dados?.temporada || painel?.temporada
  const temporadas = dados?.temporadas || painel?.temporadas || []

  const abas = useMemo(() => {
    const lista = []
    if (podeVerRanking) {
      lista.push({ valor: "incubados", rotulo: "Incubados" })
      lista.push({ valor: "mentores", rotulo: "Mentores" })
      lista.push({ valor: "startups", rotulo: "Startups" })
    }
    if (podeVerSelos) lista.push({ valor: "selos", rotulo: "Selos" })
    return lista
  }, [podeVerRanking, podeVerSelos])

  // Sem a chave do ranking, a primeira aba disponivel e a de selos.
  useEffect(() => {
    if (abas.length && !abas.some((a) => a.valor === aba)) setAba(abas[0].valor)
  }, [abas, aba])

  function recarregarTudo() {
    recarregarPainel()
    recarregar()
  }

  return (
    <AppLayout>
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            mb: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EmojiEvents sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Engajamento
            </Typography>
          </Box>

          {podeLancar && (
            <Button
              data-tour="engajamento-lancar"
              variant="contained"
              startIcon={<AddCircleOutline />}
              onClick={() => setLancamentoAberto(true)}
            >
              Lançar participação
            </Button>
          )}
        </Box>

        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Participação e relacionamento com a incubadora, por temporada. Mentores disputam com
          mentores e incubados com incubados, e os selos reconhecem o que não vira ponto.
        </Typography>

        <FaixaTemporada
          temporada={temporada}
          temporadas={temporadas}
          idSelecionada={idTemporada}
          onSelecionar={setIdTemporada}
        />

        {carregandoPainel ? (
          <Skeleton variant="rectangular" height={180} sx={{ mb: 3 }} />
        ) : (
          <PainelPessoal painel={painel} nome={usuario?.nome} />
        )}

        {erro && (
          <Alert severity="error" sx={{ borderRadius: 0, mb: 3 }}>
            {erro}
          </Alert>
        )}

        {abas.length > 0 && (
          <>
            <Paper sx={{ borderRadius: 0, mb: 3 }}>
              <Tabs
                value={aba}
                onChange={(_, v) => setAba(v)}
                variant="scrollable"
                scrollButtons="auto"
              >
                {abas.map((a) => (
                  <Tab key={a.valor} value={a.valor} label={a.rotulo} />
                ))}
              </Tabs>
            </Paper>

            <Box sx={{ mb: 3 }}>
              {carregando && podeVerRanking && aba !== "selos" ? (
                <Skeleton variant="rectangular" height={320} />
              ) : (
                <>
                  {aba === "incubados" && (
                    <Placar
                      linhas={dados?.incubados || []}
                      idUsuarioLogado={idUsuarioLogado}
                      vazio="Nenhum incubado pontuou nesta temporada ainda. Os pontos aparecem quando a coordenação marca presença nas atividades."
                    />
                  )}
                  {aba === "mentores" && (
                    <Placar
                      linhas={dados?.mentores || []}
                      idUsuarioLogado={idUsuarioLogado}
                      vazio="Nenhum mentor pontuou nesta temporada ainda. A mentoria conta quando a atividade tem um responsável e ao menos um presente."
                    />
                  )}
                  {aba === "startups" && <PlacarStartups linhas={dados?.startups || []} />}
                  {aba === "selos" && (
                    <MuralSelos
                      selos={selos}
                      concessoes={concessoes}
                      podeConceder={podeConceder}
                      onConceder={setSeloParaConceder}
                    />
                  )}
                </>
              )}
            </Box>
          </>
        )}

        <RegrasDoJogo
          acoes={painel?.acoes || []}
          naoPontuam={painel?.nao_pontuam || []}
          motivo={painel?.motivo_nao_pontuam}
        />
      </Box>

      <DrawerLancamento
        aberto={lancamentoAberto}
        onFechar={() => setLancamentoAberto(false)}
        acoes={painel?.acoes || []}
        participantes={participantes}
        onLancar={lancar}
        onSucesso={recarregarTudo}
      />

      <DrawerConcederSelo
        aberto={Boolean(seloParaConceder)}
        selo={seloParaConceder}
        participantes={participantes}
        onFechar={() => setSeloParaConceder(null)}
        onConceder={conceder}
        onSucesso={recarregarSelos}
      />
    </AppLayout>
  )
}
