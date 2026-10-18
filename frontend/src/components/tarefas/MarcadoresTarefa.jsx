/**
 * Os marcadores de uma tarefa — status, prioridade, prazo e responsavel —
 * desenhados UMA vez e usados pela tabela, pelo cartao do kanban e pelo painel
 * de cadastro. Se cada visualizacao desenhasse os seus, "Urgente" teria uma
 * cara no quadro e outra na lista, e a troca de aba pareceria trocar de
 * sistema.
 *
 * NENHUM DELES DEPENDE SO DA COR. O status leva o rotulo; a prioridade, um
 * icone de forma diferente por degrau (duas setas, uma seta, um traco, uma seta
 * para baixo) alem do rotulo; o prazo vencido diz "Atrasada 3 dias". A cor
 * reforça, nao carrega.
 *
 * AS CORES DE TEXTO SAO DO TEMA, e nao o hex de `tarefaMeta`: o ambar de
 * PRIORIDADES (#f59e0b) tem 2:1 sobre branco — serve de faixa, nao de letra.
 * Aqui cada estado escolhe a versao legivel na aparencia atual.
 */
import { Avatar, Box, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import {
  DragHandle,
  Event,
  EventBusy,
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardDoubleArrowUp,
  PersonOutline,
  Schedule,
} from "@mui/icons-material"
import { prioridade as metaPrioridade, prazoBR, prazoCurto, situacaoPrazo } from "../../data/tarefaMeta"

/** "Ana Paula Souza" -> "AS". Duas letras: tres viram borrao no circulo. */
export function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

/**
 * Ambar legivel como texto: o amber-700 no claro (5:1 sobre branco) e o
 * amber-400 no escuro. E a cor de "atencao" — prazo perto, prioridade alta.
 */
const corAtencao = (t) => (t.palette.mode === "dark" ? "#fbbf24" : "#b45309")

const VISUAL_PRIORIDADE = {
  URGENTE: { Icone: KeyboardDoubleArrowUp, cor: "error.main", destaque: true },
  ALTA: { Icone: KeyboardArrowUp, cor: corAtencao, destaque: true },
  MEDIA: { Icone: DragHandle, cor: "text.secondary", destaque: false },
  BAIXA: { Icone: KeyboardArrowDown, cor: "text.secondary", destaque: false },
}

/**
 * A prioridade: icone + rotulo. So Alta e Urgente ganham cor e fundo — se as
 * quatro chamassem atencao, nenhuma chamaria, e o quadro inteiro viraria um
 * painel de alarme.
 */
export function PrioridadeTarefa({ chave, sx }) {
  const p = metaPrioridade(chave)
  const visual = VISUAL_PRIORIDADE[chave] || VISUAL_PRIORIDADE.MEDIA
  const { Icone } = visual

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        color: visual.cor,
        whiteSpace: "nowrap",
        ...(visual.destaque && {
          px: 0.75,
          py: 0.125,
          borderRadius: 0.5,
          bgcolor: (t) =>
            alpha(chave === "URGENTE" ? t.palette.error.main : "#f59e0b", t.palette.mode === "dark" ? 0.18 : 0.12),
        }),
        ...sx,
      }}
    >
      <Icone sx={{ fontSize: 16 }} aria-hidden />
      <Typography component="span" variant="caption" fontWeight={visual.destaque ? 700 : 600} sx={{ lineHeight: 1.4 }}>
        {p.rotulo}
      </Typography>
    </Box>
  )
}

/**
 * O status: o ponto na cor da coluna, sobre um veu da mesma cor, e o rotulo em
 * cor de TEXTO. O chip antigo pintava o fundo com a cor cheia e escrevia em
 * branco — com o ambar de "Em revisao" isso dava 2:1.
 */
export function StatusTarefa({ rotulo, cor, sx }) {
  if (!rotulo) return <Typography variant="body2" color="text.secondary">—</Typography>
  const base = /^#[0-9a-f]{6}$/i.test(cor || "") ? cor : "#94a3b8"

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        maxWidth: "100%",
        px: 1,
        py: 0.25,
        borderRadius: 0.5,
        border: 1,
        borderColor: alpha(base, 0.35),
        bgcolor: (t) => alpha(base, t.palette.mode === "dark" ? 0.2 : 0.1),
        ...sx,
      }}
    >
      <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: base, flexShrink: 0 }} />
      <Typography component="span" variant="caption" fontWeight={600} noWrap sx={{ lineHeight: 1.5 }}>
        {rotulo}
      </Typography>
    </Box>
  )
}

/**
 * O prazo, com o peso que ele merece no momento:
 *
 *   atrasada       vermelho, com fundo — o unico estado que pede acao agora;
 *   hoje / 3 dias  ambar, sem fundo;
 *   futura         cinza, so a data curta;
 *   concluida      cinza: a tarefa foi entregue, o prazo virou registro.
 *
 * `variante="tabela"` escreve a data inteira e poe o aviso embaixo — na lista
 * ha largura, e a data exata e o que se compara linha a linha.
 */
export function PrazoTarefa({ tarefa, variante = "cartao" }) {
  const p = situacaoPrazo(tarefa)
  if (p.tipo === "sem-prazo") {
    return variante === "tabela" ? (
      <Typography variant="body2" color="text.secondary">—</Typography>
    ) : null
  }

  const atrasada = p.tipo === "atrasada"
  const atencao = p.tipo === "hoje" || p.tipo === "proxima"
  const cor = atrasada ? "error.main" : atencao ? corAtencao : "text.secondary"
  const Icone = atrasada ? EventBusy : atencao ? Schedule : Event

  if (variante === "tabela") {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
          {prazoBR(tarefa.prazo)}
        </Typography>
        {(atrasada || atencao) && (
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: cor, display: "inline-flex", alignItems: "center", gap: 0.25, whiteSpace: "nowrap" }}
          >
            <Icone sx={{ fontSize: 13 }} aria-hidden />
            {p.rotulo}
          </Typography>
        )}
      </Box>
    )
  }

  return (
    <Tooltip title={`Prazo: ${prazoBR(tarefa.prazo)}`}>
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          color: cor,
          whiteSpace: "nowrap",
          ...(atrasada && {
            px: 0.75,
            py: 0.125,
            borderRadius: 0.5,
            bgcolor: (t) => alpha(t.palette.error.main, t.palette.mode === "dark" ? 0.2 : 0.1),
          }),
        }}
      >
        <Icone sx={{ fontSize: 14 }} aria-hidden />
        <Typography component="span" variant="caption" fontWeight={atrasada || atencao ? 700 : 500} sx={{ lineHeight: 1.4 }}>
          {atrasada || atencao ? p.rotulo : prazoCurto(tarefa.prazo)}
        </Typography>
      </Box>
    </Tooltip>
  )
}

/**
 * O responsavel: foto quando ha, iniciais quando nao. Sem responsavel, um
 * circulo tracejado — o vazio e informacao ("ninguem puxou esta tarefa"), e
 * um circulo tracejado pergunta sem gritar.
 *
 * O fundo das iniciais e neutro de proposito: uma cor por pessoa faria o
 * quadro competir com as cores de status e prioridade.
 */
export function AvatarResponsavel({ nome, foto, tamanho = 24, comNome = false, dica = true }) {
  const fonte = Math.max(10, Math.round(tamanho * 0.42))

  const circulo = nome ? (
    <Avatar
      src={foto || undefined}
      alt={nome}
      sx={{
        width: tamanho,
        height: tamanho,
        fontSize: fonte,
        fontWeight: 700,
        bgcolor: (t) => (t.palette.mode === "dark" ? "grey.800" : "grey.200"),
        color: "text.primary",
        flexShrink: 0,
      }}
    >
      {iniciais(nome)}
    </Avatar>
  ) : (
    <Box
      role="img"
      aria-label="Sem responsável"
      sx={{
        width: tamanho,
        height: tamanho,
        borderRadius: "50%",
        border: "1px dashed",
        borderColor: "text.disabled",
        color: "text.disabled",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <PersonOutline sx={{ fontSize: Math.round(tamanho * 0.6) }} />
    </Box>
  )

  if (comNome) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        {circulo}
        <Typography variant="body2" noWrap color={nome ? "text.primary" : "text.secondary"}>
          {nome || "Sem responsável"}
        </Typography>
      </Box>
    )
  }

  return dica ? (
    <Tooltip title={nome ? `Responsável: ${nome}` : "Sem responsável"}>
      <Box component="span" sx={{ display: "inline-flex" }}>
        {circulo}
      </Box>
    </Tooltip>
  ) : (
    circulo
  )
}
