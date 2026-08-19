/**
 * PainelFiltros — o painel lateral de filtros das listagens.
 *
 * POR QUE UM PAINEL, e nao a fileira de seletores que ficava acima da tabela:
 * a fileira cresce com o cadastro. Fase, tipo e status ja eram tres; com os
 * campos personalizaveis, cada incubadora acrescenta os seus, e uma linha de
 * dez seletores empurra a lista para fora da tela em qualquer notebook. O
 * painel abre sobre a tela, mostra tudo em acordeoes e some ao aplicar.
 *
 * TRABALHA SOBRE UMA COPIA e so devolve no "Aplicar": filtrar a lista a cada
 * clique de checkbox faria a tabela se reorganizar por baixo do painel, e o
 * "Limpar" nao teria como voltar ao estado anterior.
 *
 * Um grupo:
 *   { id, rotulo, tipo, itens?, prefixo?, sufixo? }
 *
 * Tipos e o formato do valor de cada um:
 *   'checkbox'  (padrao)  string[]           ids marcados
 *   'radio'               string             o id escolhido (reclicar limpa)
 *   'texto'               string             busca livre
 *   'intervalo'           { min, max }       numeros; `prefixo`/`sufixo` (R$, %) entram nos campos
 *   'data'                { de, ate }        YYYY-MM-DD, o formato do <input type="date">
 *
 * O objeto inteiro e { [idDoGrupo]: valor } — e o que sai em `onAplicar` e o
 * que a tela guarda como "os filtros ativos".
 */
import { useEffect, useState } from "react"
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  Radio,
  TextField,
  Typography,
} from "@mui/material"
import { Close, ExpandMore, Search } from "@mui/icons-material"

/** O <input type="date"> devolve YYYY-MM-DD; o resumo mostra no formato BR. */
const paraDataBR = (valor) => (valor ? valor.split("-").reverse().join("/") : "")

/**
 * Prefixo e sufixo do grupo de intervalo (R$ de um campo monetario, % de um
 * numerico): sem eles os dois campos numericos nao dizem de que unidade sao.
 */
function adornosIntervalo(grupo) {
  const adornos = {}
  if (grupo.prefixo) {
    adornos.startAdornment = <InputAdornment position="start">{grupo.prefixo}</InputAdornment>
  }
  if (grupo.sufixo) {
    adornos.endAdornment = <InputAdornment position="end">{grupo.sufixo}</InputAdornment>
  }
  return Object.keys(adornos).length ? adornos : undefined
}

const ehLista = (grupo) => !grupo.tipo || grupo.tipo === "checkbox" || grupo.tipo === "radio"

/**
 * Quantos filtros um estado de selecao representa.
 *
 * Exportada porque o botao que abre o painel mostra esse numero no badge, e as
 * duas contagens precisam bater: grupo de lista conta por item marcado;
 * intervalo, data e texto contam como um filtro cada, por mais campos que
 * tenham por dentro.
 */
export function contarFiltros(selecao = {}) {
  return Object.values(selecao).reduce((total, valor) => {
    if (!valor) return total
    if (Array.isArray(valor)) return total + valor.length
    if (typeof valor === "object") return total + (Object.values(valor).some((v) => v) ? 1 : 0)
    return total + 1
  }, 0)
}

export default function PainelFiltros({
  aberto,
  onFechar,
  titulo = "Filtrar por",
  grupos = [],
  selecionados,
  onAplicar,
  onLimpar,
  ancora = "left",
}) {
  const [selecao, setSelecao] = useState({})
  const [busca, setBusca] = useState("")
  const [expandidos, setExpandidos] = useState({})
  // Busca dentro de um grupo com muitos itens (uma incubadora com 30 situacoes).
  const [buscasLocais, setBuscasLocais] = useState({})

  useEffect(() => {
    if (!aberto) return
    setSelecao(selecionados ? { ...selecionados } : {})
    setBusca("")
    setBuscasLocais({})
    // Abre o primeiro grupo: um painel de acordeoes todos fechados parece vazio.
    setExpandidos(grupos.length ? { [grupos[0].id]: true } : {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  function definir(idGrupo, valor) {
    setSelecao((prev) => ({ ...prev, [idGrupo]: valor }))
  }

  function limparGrupo(idGrupo) {
    setSelecao((prev) => {
      const nova = { ...prev }
      delete nova[idGrupo]
      return nova
    })
  }

  function alternarItem(idGrupo, idItem) {
    const atual = selecao[idGrupo] || []
    definir(
      idGrupo,
      atual.includes(idItem) ? atual.filter((x) => x !== idItem) : [...atual, idItem]
    )
  }

  /** Radio: reclicar no item marcado limpa o grupo (nao ha "nenhum" na lista). */
  function escolherUnico(idGrupo, idItem) {
    if (selecao[idGrupo] === idItem) limparGrupo(idGrupo)
    else definir(idGrupo, idItem)
  }

  // Opera sobre os itens VISIVEIS: com a busca local ativa, "selecionar todos"
  // marca so o resultado da busca, nao a lista inteira escondida atras dela.
  function marcarTodos(idGrupo, itens, marcar) {
    const ids = itens.map((it) => it.id)
    const atual = selecao[idGrupo] || []
    definir(
      idGrupo,
      marcar
        ? [...new Set([...atual, ...ids])]
        : atual.filter((id) => !ids.includes(id))
    )
  }

  function definirParte(idGrupo, parte, valor) {
    definir(idGrupo, { ...(selecao[idGrupo] || {}), [parte]: valor })
  }

  /**
   * O que esta marcado em um grupo, ja pronto para virar chip: cada entrada
   * sabe se remover, entao o chip do resumo e um "desmarcar" de um clique.
   */
  function marcadosDoGrupo(grupo) {
    const valor = selecao[grupo.id]
    if (!valor) return []

    if (grupo.tipo === "radio") {
      const item = (grupo.itens || []).find((it) => it.id === valor)
      return item
        ? [{ chave: item.id, rotulo: item.rotulo, remover: () => limparGrupo(grupo.id) }]
        : []
    }

    if (grupo.tipo === "texto") {
      return [{ chave: grupo.id, rotulo: valor, remover: () => limparGrupo(grupo.id) }]
    }

    if (grupo.tipo === "data" || grupo.tipo === "intervalo") {
      const [de, ate] =
        grupo.tipo === "data"
          ? [paraDataBR(valor.de), paraDataBR(valor.ate)]
          : [valor.min, valor.max].map((v) =>
              v === "" || v == null ? "" : `${grupo.prefixo || ""}${v}${grupo.sufixo ? ` ${grupo.sufixo}` : ""}`
            )
      const rotulo = de && ate ? `${de} – ${ate}` : de ? `a partir de ${de}` : ate ? `ate ${ate}` : ""
      return rotulo ? [{ chave: grupo.id, rotulo, remover: () => limparGrupo(grupo.id) }] : []
    }

    return (Array.isArray(valor) ? valor : []).map((id) => {
      const item = (grupo.itens || []).find((it) => it.id === id)
      return {
        chave: id,
        rotulo: item ? item.rotulo : id,
        remover: () => alternarItem(grupo.id, id),
      }
    })
  }

  const total = contarFiltros(selecao)

  // A busca global recorta os itens dos grupos de lista; os demais tipos ficam
  // como estao (nao ha o que recortar num intervalo de datas).
  const termo = busca.trim().toLowerCase()
  const gruposFiltrados = termo
    ? grupos
        .map((g) =>
          ehLista(g)
            ? { ...g, itens: (g.itens || []).filter((it) => it.rotulo.toLowerCase().includes(termo)) }
            : g
        )
        .filter((g) => (ehLista(g) ? (g.itens || []).length > 0 : true))
    : grupos

  // O resumo sai de `grupos`, e nao dos filtrados: os chips do que ja esta
  // marcado nao devem sumir enquanto se digita na busca.
  const resumo = grupos
    .map((grupo) => ({ grupo, marcados: marcadosDoGrupo(grupo) }))
    .filter((linha) => linha.marcados.length > 0)

  return (
    <Drawer
      anchor={ancora}
      open={aberto}
      onClose={onFechar}
      PaperProps={{
        sx: { width: { xs: "100%", sm: 380 }, display: "flex", flexDirection: "column" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {titulo}
        </Typography>
        <IconButton size="small" onClick={onFechar} aria-label="Fechar">
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, pb: 1.5 }}>
        <TextField
          placeholder="Pesquisar filtro"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          size="small"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {resumo.length > 0 && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Selecionados ({total})
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
            {resumo.flatMap(({ grupo, marcados }) =>
              marcados.map((item) => (
                <Chip
                  key={`${grupo.id}-${item.chave}`}
                  size="small"
                  variant="outlined"
                  label={`${grupo.rotulo}: ${item.rotulo}`}
                  onDelete={item.remover}
                  sx={{ maxWidth: "100%" }}
                />
              ))
            )}
          </Box>
        </Box>
      )}

      <Divider />

      <Box sx={{ flex: 1, overflowY: "auto" }}>
        {gruposFiltrados.map((grupo) => {
          const marcados = marcadosDoGrupo(grupo)
          // Com a busca global ativa todo grupo abre: o resultado esta dentro.
          const expandido = termo ? true : Boolean(expandidos[grupo.id])
          const previa = marcados
            .slice(0, 3)
            .map((m) => m.rotulo)
            .join(", ")

          return (
            <Accordion
              key={grupo.id}
              disableGutters
              square
              elevation={0}
              expanded={expandido}
              onChange={() =>
                !termo && setExpandidos((prev) => ({ ...prev, [grupo.id]: !prev[grupo.id] }))
              }
              sx={{ "&:before": { display: "none" }, borderBottom: 1, borderColor: "divider" }}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {grupo.rotulo}
                    </Typography>
                    {marcados.length > 0 && (
                      <Chip size="small" color="primary" label={marcados.length} />
                    )}
                  </Box>
                  {/* Com o grupo fechado o numero sozinho nao diz o que foi
                      marcado — a previa mostra os primeiros rotulos. */}
                  {!expandido && previa && (
                    <Typography variant="caption" color="text.secondary" noWrap display="block">
                      {previa}
                      {marcados.length > 3 ? ` +${marcados.length - 3}` : ""}
                    </Typography>
                  )}
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ pt: 0 }}>
                {ehLista(grupo) && grupo.tipo !== "radio" && (() => {
                  const itens = grupo.itens || []
                  const usaBuscaLocal = itens.length > 5
                  const termoLocal = (buscasLocais[grupo.id] || "").toLowerCase()
                  const visiveis = usaBuscaLocal
                    ? itens.filter((it) => it.rotulo.toLowerCase().includes(termoLocal))
                    : itens
                  const marcadosGrupo = Array.isArray(selecao[grupo.id]) ? selecao[grupo.id] : []
                  const todos =
                    visiveis.length > 0 && visiveis.every((it) => marcadosGrupo.includes(it.id))
                  const algum = visiveis.some((it) => marcadosGrupo.includes(it.id))

                  return (
                    <>
                      {usaBuscaLocal && (
                        <TextField
                          placeholder="Pesquisar..."
                          value={buscasLocais[grupo.id] || ""}
                          onChange={(e) =>
                            setBuscasLocais((prev) => ({ ...prev, [grupo.id]: e.target.value }))
                          }
                          size="small"
                          fullWidth
                          sx={{ mb: 1 }}
                        />
                      )}

                      {visiveis.length > 1 && (
                        <Box
                          onClick={() => marcarTodos(grupo.id, visiveis, !todos)}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                            borderRadius: 1,
                            "&:hover": { bgcolor: "action.hover" },
                          }}
                        >
                          <Checkbox size="small" checked={todos} indeterminate={!todos && algum} />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {todos ? "Limpar selecao" : "Selecionar todos"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ pr: 1 }}>
                            {visiveis.length}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ maxHeight: 260, overflowY: "auto" }}>
                        {visiveis.map((item) => (
                          <Box
                            key={item.id}
                            onClick={() => alternarItem(grupo.id, item.id)}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              cursor: "pointer",
                              borderRadius: 1,
                              "&:hover": { bgcolor: "action.hover" },
                            }}
                          >
                            <Checkbox size="small" checked={marcadosGrupo.includes(item.id)} />
                            <Typography variant="body2">{item.rotulo}</Typography>
                          </Box>
                        ))}
                        {visiveis.length === 0 && (
                          <Typography variant="body2" color="text.secondary">
                            Nenhum item encontrado.
                          </Typography>
                        )}
                      </Box>
                    </>
                  )
                })()}

                {grupo.tipo === "radio" && (
                  <Box sx={{ maxHeight: 260, overflowY: "auto" }}>
                    {(grupo.itens || []).map((item) => (
                      <Box
                        key={item.id}
                        onClick={() => escolherUnico(grupo.id, item.id)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          cursor: "pointer",
                          borderRadius: 1,
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <Radio size="small" checked={selecao[grupo.id] === item.id} />
                        <Typography variant="body2">{item.rotulo}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}

                {grupo.tipo === "texto" && (
                  <TextField
                    placeholder="Contem..."
                    value={selecao[grupo.id] || ""}
                    onChange={(e) => definir(grupo.id, e.target.value)}
                    size="small"
                    fullWidth
                  />
                )}

                {grupo.tipo === "intervalo" && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      label="De"
                      type="number"
                      size="small"
                      value={selecao[grupo.id]?.min ?? ""}
                      onChange={(e) => definirParte(grupo.id, "min", e.target.value)}
                      InputProps={adornosIntervalo(grupo)}
                    />
                    <Typography color="text.secondary">–</Typography>
                    <TextField
                      label="Ate"
                      type="number"
                      size="small"
                      value={selecao[grupo.id]?.max ?? ""}
                      onChange={(e) => definirParte(grupo.id, "max", e.target.value)}
                      InputProps={adornosIntervalo(grupo)}
                    />
                  </Box>
                )}

                {grupo.tipo === "data" && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <TextField
                      label="De"
                      type="date"
                      size="small"
                      value={selecao[grupo.id]?.de || ""}
                      onChange={(e) => definirParte(grupo.id, "de", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                    <Typography color="text.secondary">–</Typography>
                    <TextField
                      label="Ate"
                      type="date"
                      size="small"
                      value={selecao[grupo.id]?.ate || ""}
                      onChange={(e) => definirParte(grupo.id, "ate", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          )
        })}

        {termo && gruposFiltrados.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            Nenhum filtro encontrado para “{busca}”.
          </Typography>
        )}
      </Box>

      <Divider />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {total > 0
            ? `${total} filtro${total > 1 ? "s" : ""} ativo${total > 1 ? "s" : ""}`
            : "Nenhum filtro ativo"}
        </Typography>
        <Button
          size="small"
          disabled={total === 0}
          onClick={() => {
            setSelecao({})
            onLimpar?.()
          }}
        >
          Limpar
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            onAplicar?.(selecao)
            onFechar()
          }}
        >
          Aplicar
        </Button>
      </Box>
    </Drawer>
  )
}
