/**
 * O cartão da própria pessoa: nível, pontos, posição e extrato.
 *
 * E A PRIMEIRA COISA DA TELA, antes do placar, e isso e intencional: o ranking
 * e relativo (so um e o primeiro, e quem esta em 14o para de olhar), o NIVEL e
 * absoluto — todo mundo pode chegar ao topo. Abrir pelo nivel mantem no jogo
 * quem nunca vai ganhar a viagem, que e a maioria.
 *
 * "FALTAM N PONTOS PARA <PROXIMO>" e a unica frase acionavel da tela inteira.
 * Sem ela, o numero de pontos nao diz nada: 240 e muito ou pouco?
 *
 * QUEM NAO DISPUTA (admin da incubadora, ou incubado sem startup ativa) recebe
 * uma explicacao, e nao um cartao zerado — "0 pontos, 0 posicao" pareceria
 * bug, e o admin acharia que o proprio trabalho nao esta sendo contado.
 *
 * O EXTRATO fica aqui embaixo: o ponto de ter um extrato e ninguem precisar
 * acreditar no numero. Cada linha diz de onde veio, quando, e quando o teto
 * cortou.
 *
 * Ele abre RESUMIDO, com as ultimas participacoes e um botao para o resto. Uma
 * temporada inteira sao dezenas de linhas, e deixa-las abertas empurraria o
 * placar — o resto da tela — para fora da primeira dobra.
 */
import { useState } from "react"
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material"
import { EmojiEvents, InfoOutlined } from "@mui/icons-material"

import { dataDiaBR, iconeDe, pts, rotuloLiga } from "./vocabulario"

/** A barra "onde estou entre este degrau e o proximo". */
function ProgressoNivel({ nivel, proximo, pontos, faltam }) {
  const base = nivel?.pontos_min ?? 0
  const alvo = proximo?.pontos_min ?? pontos
  const total = Math.max(1, alvo - base)
  const feito = Math.min(total, Math.max(0, pontos - base))
  const pct = proximo ? (feito / total) * 100 : 100

  return (
    <Box sx={{ mt: 2 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 0,
          bgcolor: "action.hover",
          "& .MuiLinearProgress-bar": { bgcolor: nivel?.cor || "primary.main" },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
        {proximo
          ? `Faltam ${pts(faltam)} para ${proximo.nome}`
          : "Você está no nível mais alto da temporada."}
      </Typography>
    </Box>
  )
}

/** Uma linha do extrato. */
function LinhaExtrato({ item }) {
  const Icone = iconeDe(item.icone)
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Avatar sx={{ width: 28, height: 28, bgcolor: item.cor || "primary.main" }}>
        <Icone sx={{ fontSize: 16 }} />
      </Avatar>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap>
          {item.acao}
          {item.evento && (
            <Typography component="span" variant="body2" color="text.secondary">
              {" "}
              · {item.evento}
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {dataDiaBR(item.ocorrido_dt)}
          {item.observacao ? ` · ${item.observacao}` : ""}
          {item.lancado_por_nome ? ` · lançado por ${item.lancado_por_nome}` : ""}
        </Typography>
      </Box>

      {item.limitado_por_teto ? (
        <Tooltip title="A participação foi registrada, mas o teto da ação no período já tinha sido atingido.">
          <Chip size="small" label={pts(item.pontos)} variant="outlined" />
        </Tooltip>
      ) : (
        <Typography variant="body2" fontWeight={700} sx={{ whiteSpace: "nowrap" }}>
          +{item.pontos}
        </Typography>
      )}
    </Box>
  )
}

/** Quantas linhas do extrato aparecem antes de "mostrar todas". */
const EXTRATO_RESUMIDO = 5

export default function PainelPessoal({ painel, nome }) {
  const [extratoInteiro, setExtratoInteiro] = useState(false)
  if (!painel) return null

  const { liga, pontos, participacoes, posicao, competidores, nivel, proximo_nivel, faltam } =
    painel
  const IconeNivel = iconeDe(nivel?.icone, EmojiEvents)

  if (!liga) {
    return (
      <Alert severity="info" icon={<InfoOutlined />} sx={{ borderRadius: 0, mb: 3 }}>
        <strong>Você acompanha o placar, mas não disputa.</strong> O ranking é entre incubados e
        entre mentores — a coordenação não entra, porque é ela quem registra a participação que
        vira ponto. Se você faz parte de uma startup e mesmo assim vê esta mensagem, confira se o
        seu vínculo com ela está ativo.
      </Alert>
    )
  }

  return (
    <Paper data-tour="engajamento-meu-painel" sx={{ borderRadius: 0, p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Avatar sx={{ width: 56, height: 56, bgcolor: nivel?.cor || "primary.main" }}>
          <IconeNivel />
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
            {nome} · liga {rotuloLiga(liga)}
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {nivel?.nome || "Sem nível"}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1 }}>
              {pontos}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              pontos
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1 }}>
              {posicao ? `${posicao}º` : "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              de {competidores}
            </Typography>
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1 }}>
              {participacoes}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              participações
            </Typography>
          </Box>
        </Box>
      </Box>

      <ProgressoNivel nivel={nivel} proximo={proximo_nivel} pontos={pontos} faltam={faltam} />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        De onde vieram os seus pontos
      </Typography>
      {painel.extrato.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Nenhuma participação registrada nesta temporada ainda.
        </Typography>
      ) : (
        <Box>
          {(extratoInteiro ? painel.extrato : painel.extrato.slice(0, EXTRATO_RESUMIDO)).map(
            (item) => (
              <LinhaExtrato key={item.id_ponto} item={item} />
            )
          )}
          {painel.extrato.length > EXTRATO_RESUMIDO && (
            <Button size="small" sx={{ mt: 1 }} onClick={() => setExtratoInteiro(!extratoInteiro)}>
              {extratoInteiro
                ? "Mostrar menos"
                : `Ver todas as ${painel.extrato.length} participações`}
            </Button>
          )}
        </Box>
      )}
    </Paper>
  )
}
