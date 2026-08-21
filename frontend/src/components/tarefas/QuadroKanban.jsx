/**
 * O quadro kanban: uma coluna por status, cartoes arrastaveis entre elas.
 *
 * POR QUE ELE EXISTE, se ja ha a tabela: sao duas perguntas diferentes sobre o
 * mesmo conjunto. A tabela responde "o que existe" — ordena, filtra, compara,
 * exporta. O quadro responde "como esta indo" — onde o trabalho empilhou, o que
 * ninguem puxou, o que atravessou a semana parado. Nenhuma das duas substitui a
 * outra, e por isso a tela alterna entre elas sem recarregar nada.
 *
 * ARRASTO EM HTML5 PURO (draggable + dataTransfer), sem biblioteca. E o mesmo
 * mecanismo que a TabelaDados ja usa para reordenar colunas, e adicionar uma
 * dependencia de drag-and-drop ao projeto para um quadro de quatro colunas
 * custaria mais do que resolve.
 *
 * A POSICAO DE SOLTURA e calculada pelo ponto medio de cada cartao: solto na
 * metade de cima, entra antes dele; na de baixo, depois. E o que faz o indicador
 * aparecer onde a pessoa esta mirando, em vez de sempre no fim da coluna.
 *
 * O indice que sai daqui conta a lista SEM a tarefa arrastada — e o que o
 * backend espera (ver tarefaRepository.mover), e o unico jeito de "soltei entre
 * o terceiro e o quarto" significar a mesma coisa dos dois lados.
 */
import { useState } from "react"
import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material"
import { Add } from "@mui/icons-material"
import CartaoTarefa from "./CartaoTarefa"

export default function QuadroKanban({
  colunas = [],
  tarefas = [],
  onAbrirTarefa,
  onCriarEm,
  onMover,
  podeCriar = false,
  // FUNCAO, e nao booleano: quem tem a chave `editar` mexe em tudo, e quem nao
  // tem ainda arrasta as tarefas de que e responsavel. Uma resposta unica para o
  // quadro inteiro obrigaria a escolher entre travar o arrasto de quem tem
  // direito ou oferece-lo a quem levaria 403 ao soltar o cartao.
  podeMover = () => true,
}) {
  // O id em movimento e o alvo do momento: { status, indice } — a fenda onde o
  // cartao cairia se fosse solto agora.
  const [arrastando, setArrastando] = useState(null)
  const [alvo, setAlvo] = useState(null)

  const daColuna = (chave) => tarefas.filter((t) => t.status === chave)

  function encerrarArrasto() {
    setArrastando(null)
    setAlvo(null)
  }

  /**
   * Em que fenda da coluna o cursor esta.
   *
   * Percorre os cartoes ja renderizados e compara o Y do cursor com o meio de
   * cada um. Le do DOM em vez de guardar as alturas no estado porque os cartoes
   * tem altura variavel (titulo de uma ou duas linhas, com prazo ou sem) e
   * qualquer estimativa erraria justamente nos cartoes altos.
   */
  function fendaSobOCursor(evento, chave) {
    const lista = evento.currentTarget
    const cartoes = [...lista.querySelectorAll("[data-cartao]")]
    const y = evento.clientY

    for (let i = 0; i < cartoes.length; i++) {
      const caixa = cartoes[i].getBoundingClientRect()
      if (y < caixa.top + caixa.height / 2) return { status: chave, indice: i }
    }
    return { status: chave, indice: cartoes.length }
  }

  /**
   * O indice que vai para a API: a posicao na lista SEM a tarefa arrastada.
   *
   * Quando ela ja esta na coluna de destino e vai para baixo da propria posicao
   * atual, o indice visual conta um item que vai sumir dali — sem este desconto,
   * cada arrasto para baixo pararia uma casa antes de onde foi solto.
   */
  function indiceParaApi(status, indiceVisual) {
    const lista = daColuna(status)
    const atual = lista.findIndex((t) => t.id_tarefa === arrastando)
    if (atual === -1) return indiceVisual
    return indiceVisual > atual ? indiceVisual - 1 : indiceVisual
  }

  function soltar(evento, chave) {
    evento.preventDefault()
    const fenda = alvo?.status === chave ? alvo : fendaSobOCursor(evento, chave)
    const id = arrastando
    encerrarArrasto()
    if (!id) return
    onMover?.(id, chave, indiceParaApi(chave, fenda.indice))
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        alignItems: "flex-start",
        overflowX: "auto",
        p: 2,
        // As colunas rolam por dentro; a pagina nao cresce sem fim.
        minHeight: 420,
      }}
    >
      {colunas.map((coluna) => {
        const cartoes = daColuna(coluna.chave)
        const recebendo = alvo?.status === coluna.chave && arrastando

        return (
          <Box
            key={coluna.chave}
            sx={{
              width: 300,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100vh - 300px)",
              borderRadius: 1,
              bgcolor: "action.hover",
              // A coluna que vai receber o cartao se destaca inteira: com quatro
              // colunas iguais lado a lado, so o risquinho da fenda seria facil
              // de perder de vista.
              outline: recebendo ? "2px solid" : "none",
              outlineColor: "primary.main",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1.25,
                borderBottom: 1,
                borderColor: "divider",
                flexShrink: 0,
              }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: coluna.cor }} />
              <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ flex: 1 }}>
                {coluna.rotulo}
              </Typography>
              <Chip size="small" label={cartoes.length} sx={{ height: 20, fontSize: 11 }} />
              {podeCriar && (
                <Tooltip title={`Nova tarefa em "${coluna.rotulo}"`}>
                  <IconButton size="small" onClick={() => onCriarEm?.(coluna.chave)}>
                    <Add sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            <Box
              onDragOver={(e) => {
                if (!arrastando) return
                // Sem o preventDefault o navegador recusa o drop.
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
                setAlvo(fendaSobOCursor(e, coluna.chave))
              }}
              onDragLeave={(e) => {
                // So limpa quando o cursor sai da coluna DE VERDADE: passar por
                // cima de um cartao filho dispara dragleave na coluna e faria o
                // indicador piscar a cada pixel.
                if (e.currentTarget.contains(e.relatedTarget)) return
                setAlvo((atual) => (atual?.status === coluna.chave ? null : atual))
              }}
              onDrop={(e) => soltar(e, coluna.chave)}
              sx={{ flex: 1, overflowY: "auto", p: 1, minHeight: 120 }}
            >
              {cartoes.map((tarefa, i) => (
                <Box key={tarefa.id_tarefa} data-cartao>
                  {recebendo && alvo.indice === i && <Fenda />}
                  <CartaoTarefa
                    tarefa={tarefa}
                    arrastavel={podeMover(tarefa)}
                    arrastando={arrastando === tarefa.id_tarefa}
                    onClick={() => onAbrirTarefa?.(tarefa)}
                    onDragStart={(e) => {
                      // Cartao que esta pessoa nao pode mover simplesmente nao
                      // inicia arrasto: e mais honesto que deixar arrastar e
                      // recusar no fim, com o cartao ja fora do lugar.
                      if (!podeMover(tarefa)) {
                        e.preventDefault()
                        return
                      }
                      setArrastando(tarefa.id_tarefa)
                      e.dataTransfer.effectAllowed = "move"
                      // O Firefox so inicia o arrasto se algo for escrito aqui.
                      e.dataTransfer.setData("text/plain", String(tarefa.id_tarefa))
                    }}
                    onDragEnd={encerrarArrasto}
                  />
                </Box>
              ))}

              {recebendo && alvo.indice >= cartoes.length && <Fenda />}

              {cartoes.length === 0 && !recebendo && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", textAlign: "center", py: 3 }}
                >
                  Nada aqui.
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}

      {colunas.length === 0 && (
        <Typography color="text.secondary" sx={{ p: 4 }}>
          Nenhuma coluna configurada. Crie as colunas do quadro em Configurações › Quadro de
          tarefas.
        </Typography>
      )}
    </Box>
  )
}

/** O risco que mostra onde o cartao vai cair. */
function Fenda() {
  return <Box sx={{ height: 3, borderRadius: 3, bgcolor: "primary.main", mb: 1 }} />
}
