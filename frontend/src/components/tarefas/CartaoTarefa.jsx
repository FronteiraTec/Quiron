/**
 * Um cartao do quadro kanban.
 *
 * O QUE ENTRA NO CARTAO e a pergunta inteira deste arquivo. Um cartao que
 * mostra tudo vira um formulario deitado e o quadro perde a unica coisa que ele
 * faz melhor que a tabela: ser lido de relance, a dois metros da tela. Entao so
 * o que muda uma decisao de quem esta olhando:
 *
 *   PRIORIDADE  -> uma faixa colorida na borda esquerda, sem texto. E o que se
 *                  ve antes de ler qualquer palavra.
 *   TITULO      -> ate duas linhas; o resto se le abrindo.
 *   STARTUP     -> sobre quem e a tarefa, quando ha uma.
 *   PRAZO       -> so quando ele DIZ algo (atrasado, hoje, esta semana). Um
 *                  "12/03/2027" em cada cartao seria ruido em 90% deles.
 *   RESPONSAVEL -> as iniciais, num circulo. O nome inteiro ocuparia meia
 *                  largura do cartao para repetir o que a foto ja diz.
 *   ANEXOS      -> so o clipe e a contagem. Que documentos sao, e assunto de
 *                  quem abriu a tarefa; o que o quadro precisa dizer e "tem
 *                  material aqui dentro".
 *
 * Nada de descricao, campos personalizados ou datas de criacao: isso e o painel
 * de edicao, a um clique de distancia.
 */
import { Avatar, Box, Chip, Tooltip, Typography } from "@mui/material"
import { AccessTime, Business } from "@mui/icons-material"
import { SeloAnexos } from "./AnexosTarefa"
import { prioridade as metaPrioridade, situacaoPrazo } from "../../data/tarefaMeta"

/** "Ana Paula Souza" -> "AS". Duas letras: tres viram borrão no circulo. */
function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return "?"
  const primeira = partes[0][0]
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ""
  return (primeira + ultima).toUpperCase()
}

export default function CartaoTarefa({
  tarefa,
  onClick,
  onDragStart,
  onDragEnd,
  arrastando,
  arrastavel = true,
}) {
  const prio = metaPrioridade(tarefa.prioridade)
  const prazo = situacaoPrazo(tarefa)
  const concluida = tarefa.status_categoria === "CONCLUIDA"

  return (
    <Box
      draggable={arrastavel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      sx={{
        position: "relative",
        p: 1.25,
        pl: 1.75,
        mb: 1,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        // Sem direito de mover, o cartao continua clicavel (abre a tarefa) mas
        // nao promete um arrasto que seria recusado.
        cursor: arrastavel ? "grab" : "pointer",
        // O cartao em movimento fica esmaecido no lugar de origem: e o que diz
        // "este e o que voce esta segurando" enquanto o cursor esta longe dele.
        opacity: arrastando ? 0.4 : 1,
        transition: "box-shadow .15s, border-color .15s",
        "&:hover": { boxShadow: 2, borderColor: "primary.light" },
        "&:active": { cursor: arrastavel ? "grabbing" : "pointer" },
      }}
    >
      {/* A faixa de prioridade. Sem texto: a cor e a posicao ja a identificam,
          e o rotulo esta no painel de edicao para quem precisar confirmar. */}
      <Tooltip title={`Prioridade: ${prio.rotulo}`} placement="left">
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: 6,
            bottom: 6,
            width: 4,
            borderRadius: 4,
            bgcolor: prio.cor,
          }}
        />
      </Tooltip>

      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          // Duas linhas e o limite: a terceira ja empurra o cartao seguinte
          // para fora da tela numa coluna cheia.
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          // Concluida com o titulo riscado: e o unico estado em que o cartao
          // esta ali como registro, nao como trabalho.
          textDecoration: concluida ? "line-through" : "none",
          color: concluida ? "text.secondary" : "text.primary",
        }}
      >
        {tarefa.titulo}
      </Typography>

      {tarefa.startup_nome && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.75, minWidth: 0 }}>
          <Business sx={{ fontSize: 13, color: "text.secondary", flexShrink: 0 }} />
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
          mt: 1,
          minHeight: 24,
        }}
      >
        {/* O prazo so aparece quando diz alguma coisa. Ver situacaoPrazo. */}
        {prazo.tipo !== "sem-prazo" && prazo.tipo !== "futura" && prazo.tipo !== "concluida" ? (
          <Chip
            size="small"
            icon={<AccessTime sx={{ fontSize: 14 }} />}
            label={prazo.rotulo}
            sx={{
              height: 22,
              fontSize: 11,
              color: prazo.cor,
              borderColor: prazo.cor,
              "& .MuiChip-icon": { color: prazo.cor },
            }}
            variant="outlined"
          />
        ) : (
          <Box />
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
          <SeloAnexos total={tarefa.total_anexos} />

          {tarefa.responsavel_nome ? (
            <Tooltip title={tarefa.responsavel_nome}>
              <Avatar sx={{ width: 24, height: 24, fontSize: 10, fontWeight: 700 }}>
                {iniciais(tarefa.responsavel_nome)}
              </Avatar>
            </Tooltip>
          ) : (
            // O vazio e informacao: "esta tarefa nao tem dono". Um circulo
            // tracejado pergunta sem gritar.
            <Tooltip title="Sem responsável">
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "1px dashed",
                  borderColor: "divider",
                }}
              />
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  )
}
