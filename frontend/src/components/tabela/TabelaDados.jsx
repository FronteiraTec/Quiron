/**
 * TabelaDados — a tabela padrao das listagens.
 *
 * Uma listagem so serve para trabalhar quando quem usa consegue molda-la: uma
 * incubadora acompanha por fase, outra por tipo, outra pelos campos que ela
 * mesma criou. Em vez de uma tabela por tela, com as colunas decididas no
 * codigo, este componente recebe a definicao das colunas e resolve o resto —
 * ordenacao, paginacao, quais colunas aparecem, em que ordem, e a selecao de
 * linhas para acoes em massa.
 *
 * O QUE FICA GUARDADO NO NAVEGADOR
 * Colunas exibidas, a ordem delas e os registros por pagina, sob `chaveStorage`
 * (localStorage). Sem essa chave nada e persistido — a tabela e generica, e
 * duas telas dividindo a mesma entrada trocariam de configuracao entre si.
 *
 * TUDO EM MEMORIA: ordena e pagina sobre o array recebido. E o mesmo desenho de
 * TabelaRelatorio e vale pelo mesmo motivo — as listagens do sistema ja vem
 * inteiras do backend, e uma ida ao servidor por clique de cabecalho so
 * atrasaria a leitura. Passe TODOS os registros, nao uma pagina.
 *
 * A SELECAO E CONTROLADA pelo pai (`selecionados` + `onSelecionadosChange`):
 * quem faz a acao em massa e a tela, e ela precisa dos ids de qualquer forma.
 *
 * Definicao de uma coluna:
 *   {
 *     chave           string   id da coluna; sem `render`, e o campo lido da linha
 *     rotulo          string   texto do cabecalho
 *     render          fn       (linha) => ReactNode
 *     valorOrdenacao  fn       (linha) => string|number usado na ordenacao
 *     valorTexto      fn       (linha) => string usado na exportacao (ver exportarTabela.js)
 *     ajuda           string   explicacao do criterio, num tooltip no cabecalho
 *     alinhamento     string   "left" (padrao) | "right" | "center"
 *     largura         number   largura sugerida, em px
 *     ordenavel       bool     false desliga a ordenacao nesta coluna
 *     obrigatoria     bool     nao pode ser escondida em "Gerenciar colunas"
 *     visivelPadrao   bool     false esconde a coluna ate que a pecam
 *   }
 *
 * `acoes` e a coluna fixa da esquerda: ou uma funcao (linha) => ReactNode, ou
 * uma lista de
 *   { icone, rotulo, onClick, cor?, desabilitada?(linha), atributos? }
 * (`atributos` vai direto no botao — e por onde passam os `data-tour`).
 *
 * `chaveId` e o campo que identifica a linha, ou uma funcao (linha) => id
 * quando a identidade e composta.
 */
import { useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material"
import {
  ArrowDownward,
  ArrowUpward,
  ChevronLeft,
  ChevronRight,
  Tune,
  UnfoldMore,
} from "@mui/icons-material"
import GerenciarColunas from "./GerenciarColunas"
import { posicaoNatural } from "./ordemColunas"

const PREFIXO_STORAGE = "quiron.tabela."

function lerConfig(chaveStorage) {
  if (!chaveStorage) return null
  try {
    const cfg = JSON.parse(window.localStorage.getItem(PREFIXO_STORAGE + chaveStorage))
    return cfg && Array.isArray(cfg.colunas) ? cfg : null
  } catch {
    // Entrada corrompida ou storage bloqueado nao pode derrubar a tela.
    return null
  }
}

function gravarConfig(chaveStorage, cfg) {
  if (!chaveStorage) return
  try {
    window.localStorage.setItem(PREFIXO_STORAGE + chaveStorage, JSON.stringify(cfg))
  } catch {
    // Modo privado ou quota estourada: segue sem persistir.
  }
}

/** Nulos por ultimo, numeros por valor, texto por locale. */
function comparar(a, b, coluna) {
  const va = coluna.valorOrdenacao ? coluna.valorOrdenacao(a) : a[coluna.chave]
  const vb = coluna.valorOrdenacao ? coluna.valorOrdenacao(b) : b[coluna.chave]

  if (va == null && vb == null) return 0
  if (va == null) return 1
  if (vb == null) return -1
  if (typeof va === "number" && typeof vb === "number") return va - vb
  return String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" })
}

export default function TabelaDados({
  dados = [],
  colunas = [],
  chaveId = "id",
  acoes,
  larguraAcoes = 88,
  selecionavel = false,
  selecionados = [],
  onSelecionadosChange,
  onClickLinha,
  onColunasVisiveisChange,
  chaveStorage,
  registrosPorPaginaInicial = 25,
  opcoesRpp,
  ordemInicial = null,
  direcaoInicial = "asc",
  // Direcao em que uma coluna RECEM-clicada abre. "asc" para listagens (o
  // alfabetico e o que se espera de uma lista de nomes); os relatorios pedem
  // "desc", onde a primeira pergunta e sempre "quem esta pior".
  direcaoPadraoColuna = "asc",
  larguraMinima = 900,
  carregando = false,
  mensagemVazio = "Nenhum registro encontrado.",
  agrupamentoValor,
  agrupamentoRotulo,
}) {
  // O id da linha vem de um campo ou de uma funcao: nem toda listagem tem uma
  // coluna unica (membros e a combinacao de startup + pessoa).
  const idDaLinha = typeof chaveId === "function" ? chaveId : (linha) => linha[chaveId]

  // Lida uma unica vez, na montagem: depois disto quem manda e o estado.
  const [configSalva] = useState(() => lerConfig(chaveStorage))

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    if (!configSalva?.colunas) {
      return colunas.filter((c) => c.obrigatoria || c.visivelPadrao !== false).map((c) => c.chave)
    }
    // A configuracao guardada e de uma versao anterior da tela: uma coluna que
    // virou obrigatoria depois nao esta la, e sem ela a tabela abriria sem a
    // coluna que identifica a linha.
    const faltando = colunas
      .filter((c) => c.obrigatoria && !configSalva.colunas.includes(c.chave))
      .map((c) => c.chave)
    return faltando.length ? [...faltando, ...configSalva.colunas] : configSalva.colunas
  })
  const [pagina, setPagina] = useState(1)
  const [registrosPorPagina, setRegistrosPorPagina] = useState(
    configSalva?.rpp || registrosPorPaginaInicial
  )
  const [ordem, setOrdem] = useState(ordemInicial)
  const [direcao, setDirecao] = useState(direcaoInicial)
  const [ancoraColunas, setAncoraColunas] = useState(null)

  // Arrasto de cabecalho: a coluna em movimento, a coluna sob o cursor, e a
  // marca que impede o clique do drop de ordenar a tabela sem querer.
  const [colArrastada, setColArrastada] = useState(null)
  const [colAlvo, setColAlvo] = useState(null)
  const arrastouRef = useRef(false)

  // Colunas que chegam depois do primeiro render (as dos campos personalizaveis)
  // entram com a visibilidade padrao, sem desfazer o que a pessoa escolheu em
  // "Gerenciar colunas" nem a ordem que ela arrastou.
  const assinaturaColunas = colunas.map((c) => c.chave).join("|")
  const assinaturaAnterior = useRef(assinaturaColunas)
  useEffect(() => {
    if (assinaturaAnterior.current === assinaturaColunas) return
    const anteriores = assinaturaAnterior.current.split("|")
    assinaturaAnterior.current = assinaturaColunas

    setColunasVisiveis((prev) => {
      const novas = colunas.filter(
        (c) =>
          !anteriores.includes(c.chave) &&
          // Coluna ja escolhida nao entra de novo (evitaria chave repetida).
          !prev.includes(c.chave) &&
          // Coluna que ja existia quando a configuracao foi gravada e nao esta
          // na lista foi escondida de proposito — so entra sozinha o que e
          // realmente novo para esta pessoa.
          !(configSalva?.conhecidas || []).includes(c.chave) &&
          (c.obrigatoria || c.visivelPadrao !== false)
      )
      if (!novas.length) return prev
      const nova = [...prev]
      novas.forEach((c) => nova.splice(posicaoNatural(nova, colunas, c.chave), 0, c.chave))
      return nova
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinaturaColunas])

  // Grava a cada mudanca. `conhecidas` so cresce: e a memoria de quais colunas
  // a tela ja ofereceu, e e o que faz a regra acima distinguir "coluna nova" de
  // "coluna que a pessoa desmarcou".
  useEffect(() => {
    gravarConfig(chaveStorage, {
      colunas: colunasVisiveis,
      conhecidas: [
        ...new Set([...(configSalva?.conhecidas || []), ...colunas.map((c) => c.chave)]),
      ],
      rpp: registrosPorPagina,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveStorage, colunasVisiveis, registrosPorPagina, assinaturaColunas])

  // Quem monta a tela precisa saber o que esta exibido para exportar exatamente
  // isso — a exportacao segue as colunas da tela, nao a definicao.
  useEffect(() => {
    if (onColunasVisiveisChange) onColunasVisiveisChange(colunasVisiveis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunasVisiveis])

  // A ordem na tela e a de `colunasVisiveis` (e ela que o arrasto reordena), e
  // nao a da definicao. O filtro descarta chave sem coluna correspondente: a
  // configuracao guardada pode citar um campo personalizavel que a incubadora
  // desativou depois.
  const colsExibidas = colunasVisiveis
    .map((chave) => colunas.find((c) => c.chave === chave))
    .filter(Boolean)

  // -------- Arrasto de colunas --------
  function moverColuna(origem, destino) {
    if (!origem || !destino || origem === destino) return
    setColunasVisiveis((prev) => {
      const de = prev.indexOf(origem)
      const para = prev.indexOf(destino)
      if (de === -1 || para === -1) return prev
      const nova = prev.filter((c) => c !== origem)
      // Vindo da esquerda a coluna entra depois do alvo; vindo da direita,
      // antes — e o que da a sensacao de empurrar o alvo para o lado.
      nova.splice(de < para ? nova.indexOf(destino) + 1 : nova.indexOf(destino), 0, origem)
      return nova
    })
  }

  function encerrarArrasto() {
    setColArrastada(null)
    setColAlvo(null)
    // Em alguns navegadores o clique do cabecalho chega logo depois do drop e
    // ordenaria a tabela; a marca some no tick seguinte, antes de qualquer
    // clique de verdade.
    arrastouRef.current = true
    setTimeout(() => {
      arrastouRef.current = false
    }, 0)
  }

  /** De que lado desenhar a marca de destino, conforme a direcao do arrasto. */
  function bordaAlvo(chave) {
    if (colAlvo !== chave || !colArrastada) return undefined
    const de = colunasVisiveis.indexOf(colArrastada)
    const para = colunasVisiveis.indexOf(chave)
    return {
      boxShadow: (t) =>
        de < para
          ? `inset -2px 0 0 0 ${t.palette.primary.main}`
          : `inset 2px 0 0 0 ${t.palette.primary.main}`,
    }
  }

  // -------- Ordenacao --------
  function alternarOrdem(coluna) {
    if (arrastouRef.current) return
    setDirecao(
      ordem === coluna.chave
        ? direcao === "asc"
          ? "desc"
          : "asc"
        : direcaoPadraoColuna
    )
    setOrdem(coluna.chave)
    setPagina(1)
  }

  const colunaOrdenada = colunas.find((c) => c.chave === ordem)
  const ordenados = colunaOrdenada
    ? [...dados].sort((a, b) => comparar(a, b, colunaOrdenada) * (direcao === "asc" ? 1 : -1))
    : dados

  // -------- Paginacao --------
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / registrosPorPagina))
  // Limita em vez de zerar: filtrar a lista encolhe as paginas, e a pagina 7 de
  // uma lista que agora tem 2 mostraria "nenhum registro" com dados na tela.
  const paginaAtual = Math.min(pagina, totalPaginas)
  const inicio = (paginaAtual - 1) * registrosPorPagina
  const dadosPagina = ordenados.slice(inicio, inicio + registrosPorPagina)

  function paginasVisiveis() {
    const ini = Math.max(1, paginaAtual - 1)
    const fim = Math.min(totalPaginas, paginaAtual + 1)
    const paginas = []
    for (let p = ini; p <= fim; p++) paginas.push(p)
    return paginas
  }

  // -------- Selecao --------
  const idsPagina = dadosPagina.map(idDaLinha)
  const todosMarcados = idsPagina.length > 0 && idsPagina.every((id) => selecionados.includes(id))
  const algumMarcado = !todosMarcados && idsPagina.some((id) => selecionados.includes(id))

  function alternarTodos() {
    if (!onSelecionadosChange) return
    onSelecionadosChange(
      todosMarcados
        ? selecionados.filter((id) => !idsPagina.includes(id))
        : [...new Set([...selecionados, ...idsPagina])]
    )
  }

  function alternarLinha(id) {
    if (!onSelecionadosChange) return
    onSelecionadosChange(
      selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]
    )
  }

  function salvarColunas(novasVisiveis, novoRpp) {
    setColunasVisiveis(novasVisiveis)
    setRegistrosPorPagina(novoRpp)
    setPagina(1)
  }

  function renderAcoes(linha) {
    if (typeof acoes === "function") return acoes(linha)
    return (acoes || []).map((acao, i) => (
      <Tooltip key={i} title={acao.rotulo || ""}>
        <span>
          <IconButton
            size="small"
            disabled={acao.desabilitada ? acao.desabilitada(linha) : false}
            onClick={(e) => {
              // A linha inteira e clicavel: sem isto, agir sobre um registro
              // tambem navegaria para ele.
              e.stopPropagation()
              acao.onClick?.(linha)
            }}
            sx={{ color: acao.cor }}
            {...acao.atributos}
          >
            {acao.icone}
          </IconButton>
        </span>
      </Tooltip>
    ))
  }

  const totalColunas = colsExibidas.length + (acoes ? 1 : 0) + (selecionavel ? 1 : 0) + 1

  // As colunas fixas precisam de fundo proprio: sem ele o conteudo rolado por
  // baixo apareceria atraves delas.
  const fundoCabecalho = (t) =>
    t.palette.mode === "dark" ? t.palette.background.paper : t.palette.grey[50]
  const stickyCabecalho = { position: "sticky", zIndex: 3, bgcolor: fundoCabecalho }
  // Largura travada (e nao so sugerida): e dela que sai o `left` da coluna de
  // selecao, e uma diferenca de alguns pixels descolaria as duas colunas fixas.
  const medidaAcoes = {
    width: larguraAcoes,
    minWidth: larguraAcoes,
    maxWidth: larguraAcoes,
    px: 1,
  }
  const stickyCorpo = { position: "sticky", zIndex: 1, bgcolor: "background.paper" }

  return (
    <>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: larguraMinima }}>
          <TableHead>
            <TableRow
              sx={{
                "& th": {
                  bgcolor: fundoCabecalho,
                  color: "text.secondary",
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                },
              }}
            >
              {acoes && (
                <TableCell sx={{ ...stickyCabecalho, left: 0, ...medidaAcoes }} />
              )}

              {selecionavel && (
                <TableCell
                  padding="checkbox"
                  sx={{ ...stickyCabecalho, left: acoes ? larguraAcoes : 0 }}
                >
                  <Checkbox
                    size="small"
                    checked={todosMarcados}
                    indeterminate={algumMarcado}
                    onChange={alternarTodos}
                    inputProps={{ "aria-label": "Selecionar as linhas desta pagina" }}
                  />
                </TableCell>
              )}

              {colsExibidas.map((coluna) => {
                const ordenavel = coluna.ordenavel !== false
                const ativa = ordem === coluna.chave
                return (
                  <TableCell
                    key={coluna.chave}
                    align={coluna.alinhamento || "left"}
                    draggable
                    onDragStart={(e) => {
                      setColArrastada(coluna.chave)
                      e.dataTransfer.effectAllowed = "move"
                      // O Firefox so inicia o arrasto se algo for escrito aqui.
                      e.dataTransfer.setData("text/plain", coluna.chave)
                    }}
                    onDragOver={(e) => {
                      if (!colArrastada || colArrastada === coluna.chave) return
                      // Sem o preventDefault o navegador recusa o drop.
                      e.preventDefault()
                      e.dataTransfer.dropEffect = "move"
                      setColAlvo(coluna.chave)
                    }}
                    onDragLeave={() => setColAlvo((alvo) => (alvo === coluna.chave ? null : alvo))}
                    onDrop={(e) => {
                      e.preventDefault()
                      moverColuna(colArrastada, coluna.chave)
                      encerrarArrasto()
                    }}
                    onDragEnd={encerrarArrasto}
                    onClick={ordenavel ? () => alternarOrdem(coluna) : undefined}
                    title={coluna.ajuda || "Arraste para reordenar"}
                    sx={{
                      userSelect: "none",
                      cursor: ordenavel ? "pointer" : "grab",
                      width: coluna.largura,
                      opacity: colArrastada === coluna.chave ? 0.4 : 1,
                      ...(ativa ? { "&&": { color: "primary.main" } } : null),
                      "&:hover .icone-ordenacao": { opacity: 1 },
                      ...bordaAlvo(coluna.chave),
                    }}
                  >
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                    >
                      {coluna.rotulo}
                      {ordenavel && (
                        <Box
                          component="span"
                          className="icone-ordenacao"
                          sx={{
                            display: "inline-flex",
                            // A seta inativa so aparece no hover: uma dezena de
                            // setinhas cinzas competiria com o texto do cabecalho.
                            opacity: ativa ? 1 : 0,
                            transition: "opacity .15s",
                          }}
                        >
                          {!ativa ? (
                            <UnfoldMore sx={{ fontSize: 14 }} />
                          ) : direcao === "asc" ? (
                            <ArrowUpward sx={{ fontSize: 14 }} />
                          ) : (
                            <ArrowDownward sx={{ fontSize: 14 }} />
                          )}
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                )
              })}

              <TableCell padding="checkbox" align="right" sx={{ width: 44 }}>
                <Tooltip title="Gerenciar colunas">
                  <IconButton size="small" onClick={(e) => setAncoraColunas(e.currentTarget)}>
                    <Tune sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {carregando && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center" sx={{ py: 6, border: 0 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            )}

            {!carregando && dadosPagina.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={totalColunas}
                  align="center"
                  sx={{ py: 6, color: "text.secondary", border: 0 }}
                >
                  {mensagemVazio}
                </TableCell>
              </TableRow>
            )}

            {!carregando &&
              (() => {
                // Quebra visual por grupo: a marca inicial nunca bate com um
                // valor real (nem com `undefined`), entao a primeira linha da
                // pagina sempre abre com o proprio separador.
                let grupoAnterior = Symbol("inicial")
                return dadosPagina.flatMap((linha) => {
                  const id = idDaLinha(linha)
                  const linhas = []

                  if (agrupamentoValor) {
                    const grupo = agrupamentoValor(linha)
                    if (grupo !== grupoAnterior) {
                      grupoAnterior = grupo
                      linhas.push(
                        <TableRow key={`grupo-${id}`} sx={{ bgcolor: "action.hover" }}>
                          <TableCell colSpan={totalColunas} sx={{ py: 0.75 }}>
                            <Typography variant="caption" fontWeight={700}>
                              {agrupamentoRotulo ? `${agrupamentoRotulo}: ` : ""}
                              {grupo || "Nao definido"}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )
                    }
                  }

                  linhas.push(
                    <TableRow
                      key={id}
                      hover
                      selected={selecionados.includes(id)}
                      onClick={onClickLinha ? () => onClickLinha(linha) : undefined}
                      sx={{
                        cursor: onClickLinha ? "pointer" : "default",
                        // As celulas fixas tem fundo proprio (senao o conteudo
                        // rolado apareceria por baixo), entao elas nao herdam o
                        // realce de hover nem o da linha marcada: vao aqui.
                        "&:hover .celula-fixa": { bgcolor: "action.hover" },
                        "&.Mui-selected .celula-fixa": { bgcolor: "action.selected" },
                      }}
                    >
                      {acoes && (
                        <TableCell
                          className="celula-fixa"
                          sx={{ ...stickyCorpo, left: 0, ...medidaAcoes }}
                        >
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                            {renderAcoes(linha)}
                          </Box>
                        </TableCell>
                      )}

                      {selecionavel && (
                        <TableCell
                          padding="checkbox"
                          className="celula-fixa"
                          sx={{ ...stickyCorpo, left: acoes ? larguraAcoes : 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            size="small"
                            checked={selecionados.includes(id)}
                            onChange={() => alternarLinha(id)}
                            inputProps={{ "aria-label": "Selecionar esta linha" }}
                          />
                        </TableCell>
                      )}

                      {colsExibidas.map((coluna) => (
                        <TableCell
                          key={coluna.chave}
                          align={coluna.alinhamento || "left"}
                          sx={
                            coluna.alinhamento === "right"
                              ? { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }
                              : undefined
                          }
                        >
                          {coluna.render
                            ? coluna.render(linha)
                            : linha[coluna.chave] != null && linha[coluna.chave] !== ""
                              ? String(linha[coluna.chave])
                              : "—"}
                        </TableCell>
                      ))}

                      <TableCell padding="checkbox" />
                    </TableRow>
                  )
                  return linhas
                })
              })()}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Total de registros: <strong>{dados.length}</strong>
        </Typography>

        {/* Com uma pagina so, os controles nao decidem nada — e as tabelas
            pequenas embutidas em abas ficariam com um rodape maior que a
            propria lista. A contagem acima fica sempre. */}
        {totalPaginas > 1 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            size="small"
            disabled={paginaAtual === 1}
            onClick={() => setPagina(paginaAtual - 1)}
            aria-label="Pagina anterior"
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          {paginasVisiveis().map((p) => (
            <Button
              key={p}
              size="small"
              variant={p === paginaAtual ? "contained" : "text"}
              onClick={() => setPagina(p)}
              sx={{ minWidth: 32, px: 0 }}
            >
              {p}
            </Button>
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
            de {totalPaginas}
          </Typography>
          <IconButton
            size="small"
            disabled={paginaAtual === totalPaginas}
            onClick={() => setPagina(paginaAtual + 1)}
            aria-label="Proxima pagina"
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Box>
        )}
      </Box>

      <GerenciarColunas
        ancora={ancoraColunas}
        onFechar={() => setAncoraColunas(null)}
        colunas={colunas}
        colunasVisiveis={colunasVisiveis}
        registrosPorPagina={registrosPorPagina}
        opcoesRpp={opcoesRpp}
        onSalvar={salvarColunas}
      />
    </>
  )
}
