/**
 * Painel direito: edicao das propriedades do no selecionado, sem modal e sem
 * troca de pagina. Mostra:
 *   - cabecalho com icone/tipo, breadcrumb, status e indicador de alteracoes
 *     nao salvas
 *   - nome (obrigatorio, com validacao) e descricao
 *   - para Fase/Modulo: resumo e lista clicavel do que ja existe dentro dele,
 *     com atalho para adicionar o proximo filho sem voltar para a arvore
 *   - campos especificos da tarefa (prazo/carga/entregavel e o conteudo
 *     ensinado, puxado da Biblioteca)
 *   - botoes Salvar / Cancelar (habilitados so quando ha alteracoes validas),
 *     com atalho Ctrl/Cmd+Enter para salvar
 *
 * O formulario mantem um rascunho local; ao trocar de no ou salvar, sincroniza.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
  Tooltip,
  MenuItem,
} from "@mui/material"
import {
  Save,
  Close,
  DeleteOutline,
  Schedule,
  Timelapse,
  Inventory2,
  LibraryAdd,
  Tag,
  Add,
  ChevronRight,
} from "@mui/icons-material"
import { motion } from "framer-motion"
import { TIPO_META } from "../../data/trilhaMeta"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"
import { AREAS_EMPRESA } from "../../data/jornadaMeta"
import api from "../../services/api"
import Breadcrumb from "./Breadcrumb"
import EmptyState from "./EmptyState"
import SeletorConteudo from "./SeletorConteudo"

// Vocabulario de competencias. Lista fixa para as etiquetas ficarem
// consistentes entre passos — texto livre viraria "Pesquisa", "pesquisas",
// "Pesquisa de mercado" para a mesma coisa.
const COMPETENCIAS = [
  "Pesquisa",
  "Entrevista",
  "Analise de mercado",
  "Modelagem de negocio",
  "Financas",
  "Produto",
  "Design",
  "Vendas",
  "Comunicacao",
  "Pitch",
]

export default function InspectorPanel({ programa, no, trilha, acoes, onSalvar, onExcluir }) {
  // Rascunho local do formulario. Os Hooks precisam rodar sempre, em toda
  // renderizacao (mesmo quando `no` e null), entao ficam todos antes do
  // "return" antecipado abaixo — chama-los depois de um return condicional
  // quebra a ordem dos Hooks quando a selecao alterna entre nulo e um no.
  //
  // A troca de no e tratada ajustando o estado durante a propria renderizacao
  // (padrao recomendado pelo React para resetar estado a partir de uma prop),
  // em vez de useEffect: evita um frame com o rascunho antigo antes de
  // sincronizar.
  const [noAtualId, setNoAtualId] = useState(no?.id_no ?? null)
  const [formState, setForm] = useState(no)
  let form = formState
  if ((no?.id_no ?? null) !== noAtualId) {
    setNoAtualId(no?.id_no ?? null)
    setForm(no)
    form = no // usa o valor ja sincronizado nesta mesma renderizacao
  }

  // Dialog do seletor de conteudo da Biblioteca.
  const [seletorAberto, setSeletorAberto] = useState(false)

  // Conteudos vinculados a este passo. Vivem no servidor (trilha_conteudo),
  // nao no formulario: vincular e desvincular valem na hora, sem passar pelo
  // botao Salvar — que cuida apenas dos campos do proprio no.
  const [conteudosSel, setConteudosSel] = useState([])

  useEffect(() => {
    if (no?.tipo !== "PASSO") {
      setConteudosSel([])
      return
    }

    let cancelado = false
    api
      .get(`/trilha/${no.id_no}/conteudos`)
      .then(({ data }) => {
        if (!cancelado) setConteudosSel(data.conteudos)
      })
      .catch(() => {
        if (!cancelado) setConteudosSel([])
      })

    return () => {
      cancelado = true
    }
  }, [no?.id_no, no?.tipo])

  const alterado = useMemo(() => {
    if (!no || !form) return false
    return (
      form.nome !== no.nome ||
      form.descricao !== no.descricao ||
      form.ativo !== no.ativo ||
      (form.prazo ?? "") !== (no.prazo ?? "") ||
      (form.carga_horaria ?? "") !== (no.carga_horaria ?? "") ||
      (form.entregavel ?? "") !== (no.entregavel ?? "") ||
      (form.objetivo ?? "") !== (no.objetivo ?? "") ||
      (form.porque ?? "") !== (no.porque ?? "") ||
      (form.area ?? "") !== (no.area ?? "") ||
      JSON.stringify(form.competencias ?? []) !== JSON.stringify(no.competencias ?? [])
    )
  }, [form, no])

  if (!no) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
        <EmptyState
          variante="selecao"
          titulo="Nenhum item selecionado"
          descricao="Escolha uma fase, modulo ou tarefa na arvore a esquerda para editar suas propriedades aqui."
        />
      </Box>
    )
  }

  const meta = TIPO_META[no.tipo]
  const Icone = meta.icon

  // Filhos diretos deste no (vazio quando e um PASSO, que e folha).
  const childMeta = meta.childTipo ? TIPO_META[meta.childTipo] : null
  const filhos = no.filhos ?? []
  const filhosAtivos = filhos.filter((f) => f.ativo).length
  const femininoFilho = false // "modulo" e "passo" sao masculinos

  /** Vincula um conteudo da Biblioteca a este passo (efeito imediato). */
  const addConteudo = async (idConteudo) => {
    try {
      await api.post(`/trilha/${no.id_no}/conteudos`, { id_conteudo: idConteudo })
      const { data } = await api.get(`/trilha/${no.id_no}/conteudos`)
      setConteudosSel(data.conteudos)
    } catch {
      /* o seletor segue aberto; o usuario pode tentar de novo */
    }
  }

  /** Desvincula (o conteudo continua existindo na Biblioteca). */
  const removeConteudo = async (idConteudo) => {
    try {
      await api.delete(`/trilha/${no.id_no}/conteudos/${idConteudo}`)
      setConteudosSel((lista) => lista.filter((c) => c.id_conteudo !== idConteudo))
    } catch {
      /* mantem a lista como esta */
    }
  }

  const nomeVazio = !form.nome?.trim()
  const podeSalvar = alterado && !nomeVazio

  const setCampo = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  const alternarCompetencia = (c) =>
    setForm((f) => {
      const atuais = f.competencias || []
      return {
        ...f,
        competencias: atuais.includes(c)
          ? atuais.filter((x) => x !== c)
          : [...atuais, c],
      }
    })

  const salvar = async () => {
    if (!podeSalvar) return
    await acoes.atualizar(no.id_no, {
      nome: form.nome.trim(),
      descricao: form.descricao,
      ativo: form.ativo,
      ...(no.tipo === "PASSO" && {
        prazo: form.prazo || null,
        carga_horaria: form.carga_horaria,
        entregavel: form.entregavel,
        objetivo: form.objetivo,
        porque: form.porque,
        competencias: form.competencias || [],
        // String vazia viraria uma area invalida; o banco espera NULL.
        area: form.area || null,
      }),
    })
    onSalvar?.()
  }

  const cancelar = () => setForm(no)

  return (
    <motion.div
      key={no.id_no}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault()
          salvar()
        }
      }}
    >
      {/* Cabecalho */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ mb: 1.5 }}>
          <Breadcrumb programa={programa} trilha={trilha} onSelecionar={acoes.setSelecionadoId} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: "8px",
              bgcolor: `${meta.cor}1f`,
              color: meta.cor,
            }}
          >
            <Icone sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip
              label={meta.label}
              size="small"
              sx={{
                height: 20,
                fontSize: 11,
                fontWeight: 600,
                bgcolor: `${meta.cor}1f`,
                color: meta.cor,
                mb: 0.25,
              }}
            />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Typography noWrap sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                {form.nome || `Nova ${meta.label.toLowerCase()}`}
              </Typography>
              {alterado && (
                <Tooltip title="Alteracoes nao salvas" arrow>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: "warning.main",
                      flexShrink: 0,
                    }}
                  />
                </Tooltip>
              )}
            </Box>
          </Box>
          <Tooltip title="Excluir" arrow>
            <IconButton onClick={() => onExcluir(no)} sx={{ color: "error.main" }}>
              <DeleteOutline />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      {/* Corpo rolavel */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Nome"
            fullWidth
            value={form.nome}
            onChange={setCampo("nome")}
            autoFocus
            error={nomeVazio}
            helperText={nomeVazio ? "De um nome para continuar." : " "}
          />
          <TextField
            label="Descricao"
            fullWidth
            multiline
            minRows={3}
            value={form.descricao}
            onChange={setCampo("descricao")}
            placeholder={`Explique o objetivo desta ${meta.label.toLowerCase()}…`}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label={form.ativo ? "Ativo" : "Inativo"}
            />
            <Chip
              icon={<Tag sx={{ fontSize: 15 }} />}
              label={`Ordem ${no.ordem}`}
              size="small"
              variant="outlined"
              sx={{ height: 26 }}
            />
          </Box>

          {/* --------- Conteudo desta Fase/Modulo (lista de filhos) --------- */}
          {childMeta && (
            <>
              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {childMeta.plural.toUpperCase()}
                </Typography>
              </Divider>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {filhos.length === 0
                    ? `Esta ${meta.label.toLowerCase()} ainda nao tem ${childMeta.label.toLowerCase()}s.`
                    : `${filhos.length} ${
                        filhos.length === 1 ? childMeta.label.toLowerCase() : childMeta.plural.toLowerCase()
                      } · ${filhosAtivos} ${femininoFilho ? "ativa" : "ativo"}${filhosAtivos === 1 ? "" : "s"}.`}
                </Typography>

                {filhos.length > 0 && (
                  <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                    {filhos.map((filho) => {
                      const fmeta = TIPO_META[filho.tipo]
                      const FIcone = fmeta.icon
                      const netos = fmeta.childTipo ? filho.filhos ?? [] : null
                      return (
                        <Box
                          key={filho.id_no}
                          onClick={() => acoes.setSelecionadoId(filho.id_no)}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.25,
                            p: 1,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: "divider",
                            cursor: "pointer",
                            opacity: filho.ativo ? 1 : 0.55,
                            transition: "border-color .15s, background-color .15s",
                            "&:hover": { borderColor: `${fmeta.cor}66`, bgcolor: "action.hover" },
                          }}
                        >
                          <Box
                            sx={{
                              display: "grid",
                              placeItems: "center",
                              width: 28,
                              height: 28,
                              borderRadius: 1,
                              bgcolor: `${fmeta.cor}1f`,
                              color: fmeta.cor,
                              flexShrink: 0,
                            }}
                          >
                            <FIcone sx={{ fontSize: 16 }} />
                          </Box>
                          <Typography sx={{ flex: 1, fontSize: 13.5, fontWeight: 500 }} noWrap>
                            {filho.nome}
                          </Typography>
                          {Array.isArray(netos) && netos.length > 0 && (
                            <Chip
                              label={netos.length}
                              size="small"
                              sx={{ height: 18, fontSize: 11, bgcolor: "action.hover", color: "text.secondary" }}
                            />
                          )}
                          {!filho.ativo && (
                            <Chip
                              label="inativo"
                              size="small"
                              sx={{ height: 18, fontSize: 10, bgcolor: "action.hover" }}
                            />
                          )}
                          <ChevronRight sx={{ fontSize: 16, color: "text.disabled" }} />
                        </Box>
                      )
                    })}
                  </Stack>
                )}

                <Button
                  onClick={() => acoes.adicionar(no.id_no, meta.childTipo)}
                  startIcon={<Add />}
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  Adicionar {childMeta.label.toLowerCase()}
                </Button>
              </Box>
            </>
          )}

          {/* --------- Campos especificos do Passo --------- */}
          {no.tipo === "PASSO" && (
            <>
              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  O QUE O INCUBADO VE
                </Typography>
              </Divider>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  A moldura pedagogica do passo. E o que aparece na Jornada
                  antes da entrega — e a area define que parte da empresa este
                  passo constroi em "Minha Empresa".
                </Typography>

                <Stack spacing={2}>
                  <TextField
                    label="Objetivo"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="O que o incubado deve alcancar aqui."
                    value={form.objetivo || ""}
                    onChange={setCampo("objetivo")}
                  />
                  <TextField
                    label="Por que isto importa"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="A justificativa que motiva o incubado a fazer."
                    value={form.porque || ""}
                    onChange={setCampo("porque")}
                  />
                  <TextField
                    select
                    label="Area da empresa que constroi"
                    fullWidth
                    value={form.area || ""}
                    onChange={setCampo("area")}
                    helperText="Alimenta o blueprint e o radar de maturidade."
                  >
                    <MenuItem value="">
                      <em>Nenhuma</em>
                    </MenuItem>
                    {AREAS_EMPRESA.map((a) => (
                      <MenuItem key={a.nome} value={a.nome}>
                        {a.nome}
                      </MenuItem>
                    ))}
                  </TextField>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      COMPETENCIAS QUE TREINA
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                      {COMPETENCIAS.map((c) => {
                        const ativa = (form.competencias || []).includes(c)
                        return (
                          <Chip
                            key={c}
                            label={c}
                            size="small"
                            onClick={() => alternarCompetencia(c)}
                            color={ativa ? "primary" : "default"}
                            variant={ativa ? "filled" : "outlined"}
                            sx={{ cursor: "pointer" }}
                          />
                        )
                      })}
                    </Box>
                  </Box>
                </Stack>
              </Box>

              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  DETALHES DA ENTREGA
                </Typography>
              </Divider>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Prazo"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={form.prazo || ""}
                  onChange={setCampo("prazo")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Schedule sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Carga horaria"
                  fullWidth
                  placeholder="ex.: 2h30"
                  value={form.carga_horaria || ""}
                  onChange={setCampo("carga_horaria")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Timelapse sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              <TextField
                label="Entregavel"
                fullWidth
                placeholder="O que a startup deve entregar ao concluir?"
                value={form.entregavel || ""}
                onChange={setCampo("entregavel")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Inventory2 sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  CONTEUDO ENSINADO
                </Typography>
              </Divider>

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  O que a incubadora ensina neste passo. O incubado ve isto na
                  Jornada. Reutilize conteudos da Biblioteca.
                </Typography>

                {conteudosSel.length > 0 ? (
                  <Stack spacing={1} sx={{ mb: 1.5 }}>
                    {conteudosSel.map((c) => {
                      const cmeta = TIPO_CONTEUDO[c.tipo]
                      const CIcone = cmeta.icon
                      return (
                        <Box
                          key={c.id_conteudo}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            p: 1,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Box
                            sx={{
                              display: "grid",
                              placeItems: "center",
                              width: 30,
                              height: 30,
                              borderRadius: 1,
                              bgcolor: `${cmeta.cor}1f`,
                              color: cmeta.cor,
                              flexShrink: 0,
                            }}
                          >
                            <CIcone sx={{ fontSize: 17 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: 13.5 }} noWrap>
                              {c.titulo}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {cmeta.label}
                            </Typography>
                          </Box>
                          <Tooltip title="Remover" arrow>
                            <IconButton size="small" onClick={() => removeConteudo(c.id_conteudo)}>
                              <Close sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )
                    })}
                  </Stack>
                ) : (
                  <Box
                    sx={{
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 1.5,
                      p: 2.5,
                      textAlign: "center",
                      color: "text.secondary",
                      mb: 1.5,
                    }}
                  >
                    <LibraryAdd sx={{ fontSize: 22, opacity: 0.4, mb: 0.5 }} />
                    <Typography variant="body2">Nenhum conteudo vinculado ainda.</Typography>
                  </Box>
                )}

                <Button
                  onClick={() => setSeletorAberto(true)}
                  startIcon={<LibraryAdd />}
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  Adicionar da Biblioteca
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </Box>

      {/* Rodape de acoes */}
      <Divider />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          px: 3,
          py: 2,
        }}
      >
        <Button
          onClick={cancelar}
          disabled={!alterado}
          startIcon={<Close />}
          sx={{ textTransform: "none" }}
        >
          Cancelar
        </Button>
        <Tooltip title={podeSalvar ? "Ctrl/Cmd + Enter" : ""} arrow disableHoverListener={!podeSalvar}>
          <span>
            <Button
              onClick={salvar}
              disabled={!podeSalvar}
              variant="contained"
              startIcon={<Save />}
              sx={{ textTransform: "none" }}
            >
              Salvar
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Seletor de conteudo da Biblioteca */}
      <SeletorConteudo
        aberto={seletorAberto}
        jaSelecionados={conteudosSel.map((c) => c.id_conteudo)}
        onAdicionar={addConteudo}
        onFechar={() => setSeletorAberto(false)}
      />
    </motion.div>
  )
}
