/**
 * Um cartao do quadro kanban.
 *
 * O QUE ENTRA NO CARTAO e a pergunta inteira deste arquivo. Um cartao que
 * mostra tudo vira um formulario deitado e o quadro perde a unica coisa que ele
 * faz melhor que a tabela: ser lido de relance. Entao so o que muda uma decisao
 * de quem esta olhando, em tres pesos:
 *
 *   TITULO      -> o maior peso do cartao, ate duas linhas; o resto se le abrindo.
 *   PRIORIDADE  -> icone + rotulo no alto. So Alta e Urgente ganham cor: se as
 *                  quatro chamassem atencao, nenhuma chamaria.
 *   STARTUP     -> sobre quem e a tarefa, quando ha uma.
 *   PRAZO       -> data curta em cinza; ambar quando esta perto; vermelho, com
 *                  fundo, quando venceu. E o unico vermelho do cartao.
 *   RESPONSAVEL -> foto ou iniciais. Sem ninguem, um circulo tracejado.
 *   ANEXOS      -> so o clipe e a contagem.
 *
 * Nada de descricao, campos personalizados ou datas de criacao: isso e o painel
 * de edicao, a um clique de distancia. E nada de subtarefas ou comentarios — o
 * modulo nao os tem, e um contador zerado em cada cartao seria uma promessa.
 *
 * TECLADO E TOQUE. O arrasto em HTML5 nao funciona no celular nem no teclado,
 * entao o cartao tem um menu "Mover para" (o botao de tres pontos) que faz o
 * mesmo PATCH do arrasto. O corpo do cartao e um `role="button"` focavel que
 * abre a tarefa com Enter/Espaco; o menu e IRMAO dele, e nao filho, para nao
 * aninhar um botao dentro de outro.
 */
import { useState } from "react"
import { Box, IconButton, ListSubheader, Menu, MenuItem, Typography } from "@mui/material"
import { Business, MoreHoriz } from "@mui/icons-material"
import { SeloAnexos } from "./AnexosTarefa"
import { AvatarResponsavel, PrazoTarefa, PrioridadeTarefa } from "./MarcadoresTarefa"
import { prioridade as metaPrioridade, situacaoPrazo, prazoBR } from "../../data/tarefaMeta"

/** O que o leitor de tela anuncia ao focar o cartao: o cartao inteiro, numa frase. */
function descrever(tarefa) {
  const partes = [tarefa.titulo, `prioridade ${metaPrioridade(tarefa.prioridade).rotulo}`]
  const prazo = situacaoPrazo(tarefa)
  if (prazo.tipo === "atrasada" || prazo.tipo === "hoje" || prazo.tipo === "proxima") partes.push(prazo.rotulo)
  else if (prazo.tipo !== "sem-prazo") partes.push(`prazo ${prazoBR(tarefa.prazo)}`)
  partes.push(tarefa.responsavel_nome ? `responsável ${tarefa.responsavel_nome}` : "sem responsável")
  if (tarefa.startup_nome) partes.push(`startup ${tarefa.startup_nome}`)
  if (tarefa.total_anexos) partes.push(`${tarefa.total_anexos} anexo${tarefa.total_anexos > 1 ? "s" : ""}`)
  return partes.join(", ")
}

export default function CartaoTarefa({
  tarefa,
  onClick,
  onDragStart,
  onDragEnd,
  arrastando,
  arrastavel = true,
  // Para o menu "Mover para": as colunas do quadro e o que fazer ao escolher.
  // Sem `onMoverPara` (sem direito de mover), o menu nao aparece.
  colunas = [],
  onMoverPara,
}) {
  const [ancoraMenu, setAncoraMenu] = useState(null)
  const concluida = tarefa.status_categoria === "CONCLUIDA"
  const destinos = colunas.filter((c) => c.chave !== tarefa.status)
  const comMenu = Boolean(onMoverPara) && destinos.length > 0

  return (
    <Box
      draggable={arrastavel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sx={{
        position: "relative",
        mb: 1,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        // O cartao em movimento fica esmaecido no lugar de origem: e o que diz
        // "este e o que voce esta segurando" enquanto o cursor esta longe dele.
        opacity: arrastando ? 0.4 : 1,
        transition: "border-color .15s, box-shadow .15s",
        "&:hover": {
          borderColor: "text.disabled",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
        },
        // O menu so aparece com o mouse em cima ou com o foco dentro — num
        // quadro de quarenta cartoes, quarenta botoes fixos seriam ruido. Em
        // tela de toque (sem hover) ele fica sempre visivel.
        "& .acoes-cartao": { opacity: ancoraMenu ? 1 : 0 },
        "&:hover .acoes-cartao, &:focus-within .acoes-cartao": { opacity: 1 },
        "@media (hover: none)": { "& .acoes-cartao": { opacity: 1 } },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-label={descrever(tarefa)}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick?.()
          }
        }}
        sx={{
          p: 1.5,
          borderRadius: "inherit",
          // Sem direito de mover, o cartao continua clicavel (abre a tarefa)
          // mas nao promete um arrasto que seria recusado.
          cursor: arrastavel ? "grab" : "pointer",
          "&:active": { cursor: arrastavel ? "grabbing" : "pointer" },
          outline: "none",
          "&:focus-visible": {
            boxShadow: (t) => `0 0 0 2px ${t.palette.primary.main}`,
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 22, pr: comMenu ? 3.5 : 0, mb: 0.75 }}>
          <PrioridadeTarefa chave={tarefa.prioridade} />
        </Box>

        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            fontSize: "0.9rem",
            lineHeight: 1.35,
            // Duas linhas e o limite: a terceira ja empurra o cartao seguinte
            // para fora da tela numa coluna cheia.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
            // Concluida riscada e em cinza: e o unico estado em que o cartao
            // esta ali como registro, nao como trabalho. O mesmo da tabela.
            textDecoration: concluida ? "line-through" : "none",
            color: concluida ? "text.secondary" : "text.primary",
          }}
        >
          {tarefa.titulo}
        </Typography>

        {tarefa.startup_nome && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, minWidth: 0 }}>
            <Business sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} aria-hidden />
            <Typography variant="caption" color="text.secondary" noWrap>
              {tarefa.startup_nome}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mt: 1.25,
            minHeight: 24,
          }}
        >
          <Box sx={{ minWidth: 0, display: "flex" }}>
            <PrazoTarefa tarefa={tarefa} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            <SeloAnexos total={tarefa.total_anexos} />
            <AvatarResponsavel nome={tarefa.responsavel_nome} foto={tarefa.responsavel_foto} />
          </Box>
        </Box>
      </Box>

      {comMenu && (
        <>
          <IconButton
            className="acoes-cartao"
            size="small"
            aria-label={`Mover "${tarefa.titulo}" para outra coluna`}
            aria-haspopup="menu"
            onClick={(e) => setAncoraMenu(e.currentTarget)}
            // O botao fica dentro de um elemento arrastavel: sem isto, puxar a
            // partir dele iniciaria o arrasto do cartao.
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            sx={{ position: "absolute", top: 6, right: 6, transition: "opacity .15s" }}
          >
            <MoreHoriz fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={ancoraMenu}
            open={Boolean(ancoraMenu)}
            onClose={() => setAncoraMenu(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            MenuListProps={{ dense: true }}
          >
            <ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>Mover para</ListSubheader>
            {destinos.map((coluna) => (
              <MenuItem
                key={coluna.chave}
                onClick={() => {
                  setAncoraMenu(null)
                  onMoverPara(coluna.chave)
                }}
              >
                <Box
                  aria-hidden
                  sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: coluna.cor, mr: 1.25, flexShrink: 0 }}
                />
                {coluna.rotulo}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  )
}
