/**
 * O quadro kanban: uma coluna por status, cartoes arrastaveis entre elas.
 *
 * POR QUE ELE EXISTE, se ja ha a tabela: sao duas perguntas diferentes sobre o
 * mesmo conjunto. A tabela responde "o que existe" — ordena, filtra, compara,
 * exporta. O quadro responde "como esta indo" — onde o trabalho empilhou, o que
 * ninguem puxou, o que atravessou a semana parado. Nenhuma das duas substitui a
 * outra, e por isso a tela alterna entre elas sem recarregar nada.
 *
 * AS COLUNAS DIVIDEM A LARGURA. Cada uma tem 280px no minimo e cresce ate
 * ocupar a tela: com as quatro colunas padrao num notebook, o quadro cabe
 * inteiro sem rolagem lateral; com oito colunas (a incubadora configura as
 * suas), ele rola. No celular cada coluna ocupa quase a tela toda e a rolagem
 * encaixa coluna por coluna.
 *
 * ARRASTO EM HTML5 PURO (draggable + dataTransfer), sem biblioteca. E o mesmo
 * mecanismo que a TabelaDados ja usa para reordenar colunas, e adicionar uma
 * dependencia de drag-and-drop ao projeto para um quadro de quatro colunas
 * custaria mais do que resolve. Para quem nao arrasta (teclado, toque), o
 * cartao tem o menu "Mover para" — ver CartaoTarefa.
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
import { Box, Button, IconButton, Skeleton, Tooltip, Typography } from "@mui/material"
import { alpha } from "@mui/material/styles"
import { Add, EventBusy } from "@mui/icons-material"
import CartaoTarefa from "./CartaoTarefa"
import { estaAtrasada } from "../../data/tarefaMeta"

/** Quantos cartoes-esqueleto cada coluna mostra enquanto a lista carrega. */
const ESQUELETOS = [3, 2, 2, 1]

/** O que dizer numa coluna vazia, pelo papel dela no fluxo. */
const VAZIO_POR_CATEGORIA = {
  PENDENTE: "Nenhuma tarefa esperando para começar.",
  EM_ANDAMENTO: "Nada nesta etapa agora.",
  CONCLUIDA: "As tarefas concluídas aparecem aqui.",
}

export default function QuadroKanban({
  colunas = [],
  tarefas = [],
  carregando = false,
  // Ha busca, filtro ou indicador ativo? Muda o que a coluna vazia diz: "nada
  // aqui" e "nada aqui COM ESTE FILTRO" pedem gestos diferentes.
  filtrando = false,
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

  if (!carregando && colunas.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography fontWeight={600}>Nenhuma coluna configurada</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Crie as colunas do quadro em Configurações › Quadro de tarefas.
        </Typography>
      </Box>
    )
  }

  // Enquanto as colunas nem chegaram, desenha quatro colunas-esqueleto: o
  // quadro ja tem o formato certo quando os dados chegam, e nada pula.
  const colunasDesenho = colunas.length
    ? colunas
    : ESQUELETOS.map((_, i) => ({ chave: `esqueleto-${i}`, rotulo: "", cor: "transparent" }))
  const mostrarEsqueleto = carregando && tarefas.length === 0

  return (
    <Box
      role="region"
      aria-label="Quadro de tarefas"
      sx={{
        display: "flex",
        gap: 1.5,
        // Colunas da mesma altura: o quadro le como quadro, e a coluna curta
        // continua sendo um alvo de soltura do tamanho da mais cheia.
        alignItems: "stretch",
        overflowX: "auto",
        p: { xs: 1.5, sm: 2 },
        minHeight: 420,
        // No celular a rolagem encaixa coluna por coluna.
        scrollSnapType: { xs: "x mandatory", sm: "none" },
        scrollPaddingInline: 12,
      }}
    >
      {colunasDesenho.map((coluna, posicao) => {
        const cartoes = daColuna(coluna.chave)
        const recebendo = alvo?.status === coluna.chave && arrastando
        const atrasadas =
          coluna.categoria === "CONCLUIDA" ? 0 : cartoes.filter((t) => estaAtrasada(t)).length
        const idTitulo = `coluna-kanban-${coluna.chave}`

        return (
          <Box
            key={coluna.chave}
            component="section"
            aria-labelledby={idTitulo}
            sx={{
              flex: { xs: "0 0 86%", sm: "1 0 280px" },
              maxWidth: { sm: 420 },
              minWidth: 0,
              scrollSnapAlign: "start",
              display: "flex",
              flexDirection: "column",
              // As colunas rolam por dentro; a pagina nao cresce sem fim.
              maxHeight: "max(420px, calc(100vh - 260px))",
              borderRadius: 1,
              bgcolor: (t) => (t.palette.mode === "dark" ? alpha("#fff", 0.03) : alpha("#000", 0.025)),
              border: 1,
              borderColor: recebendo ? "primary.main" : "divider",
              // A cor da coluna numa faixa no alto: identifica o status antes
              // de ler o nome, e repete a cor do ponto na tabela.
              borderTop: "3px solid",
              borderTopColor: coluna.cor || "divider",
              // A coluna que vai receber o cartao se destaca inteira: com quatro
              // colunas iguais lado a lado, so o risquinho da fenda seria facil
              // de perder de vista.
              boxShadow: (t) => (recebendo ? `0 0 0 1px ${t.palette.primary.main}` : "none"),
              transition: "border-color .15s, box-shadow .15s",
            }}
          >
            {/* Cabecalho: o nome, a contagem e, quando ha, quantas ali estao
                atrasadas — e o que faz o gargalo aparecer sem abrir cartao
                nenhum. */}
            <Box sx={{ flexShrink: 0, px: 1.5, pt: 1, pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 30 }}>
                {coluna.rotulo ? (
                  <>
                    <Typography
                      id={idTitulo}
                      component="h3"
                      variant="subtitle2"
                      fontWeight={700}
                      noWrap
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      {coluna.rotulo}
                    </Typography>
                    <Box
                      component="span"
                      aria-label={`${cartoes.length} tarefa${cartoes.length === 1 ? "" : "s"}`}
                      sx={{
                        minWidth: 24,
                        height: 22,
                        px: 0.75,
                        borderRadius: 11,
                        bgcolor: "action.selected",
                        fontSize: 12,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {mostrarEsqueleto ? "–" : cartoes.length}
                    </Box>
                    {podeCriar && (
                      <Tooltip title={`Nova tarefa em "${coluna.rotulo}"`}>
                        <IconButton
                          size="small"
                          onClick={() => onCriarEm?.(coluna.chave)}
                          aria-label={`Nova tarefa em ${coluna.rotulo}`}
                        >
                          <Add sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                ) : (
                  <Skeleton width={posicao % 2 ? 90 : 120} height={22} />
                )}
              </Box>

              {atrasadas > 0 && (
                <Typography
                  variant="caption"
                  fontWeight={600}
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, color: "error.main" }}
                >
                  <EventBusy sx={{ fontSize: 13 }} aria-hidden />
                  {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
                </Typography>
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
              sx={{ flex: 1, overflowY: "auto", px: 1, pb: 1, minHeight: 120 }}
            >
              {mostrarEsqueleto &&
                Array.from({ length: ESQUELETOS[posicao % ESQUELETOS.length] }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={92} sx={{ mb: 1, borderRadius: 1 }} />
                ))}

              {cartoes.map((tarefa, i) => (
                <Box key={tarefa.id_tarefa} data-cartao>
                  {recebendo && alvo.indice === i && <Fenda />}
                  <CartaoTarefa
                    tarefa={tarefa}
                    arrastavel={podeMover(tarefa)}
                    arrastando={arrastando === tarefa.id_tarefa}
                    onClick={() => onAbrirTarefa?.(tarefa)}
                    colunas={colunas}
                    // `ordem: 9999` poe a tarefa no FIM da coluna de destino (o
                    // backend limita o indice ao tamanho da lista) — o mesmo da
                    // acao em massa da tabela.
                    onMoverPara={podeMover(tarefa) ? (status) => onMover?.(tarefa.id_tarefa, status, 9999) : undefined}
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

              {cartoes.length === 0 && !recebendo && !mostrarEsqueleto && (
                <Box
                  sx={{
                    textAlign: "center",
                    px: 1.5,
                    py: 3,
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {filtrando
                      ? "Nenhuma tarefa desta coluna com os filtros atuais."
                      : VAZIO_POR_CATEGORIA[coluna.categoria] || "Nenhuma tarefa nesta coluna."}
                  </Typography>
                  {podeCriar && !filtrando && coluna.categoria !== "CONCLUIDA" && (
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={() => onCriarEm?.(coluna.chave)}
                      sx={{ mt: 1, letterSpacing: 0 }}
                    >
                      Adicionar tarefa
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

/** O risco que mostra onde o cartao vai cair. */
function Fenda() {
  return <Box sx={{ height: 3, borderRadius: 3, bgcolor: "primary.main", mb: 1 }} />
}
