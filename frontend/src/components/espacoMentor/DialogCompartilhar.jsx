/**
 * Compartilhar um material com uma startup — o gesto principal do Espaco do
 * Mentor.
 *
 * Tres perguntas, nesta ordem, numa tela so:
 *
 *   1. PARA QUEM E ONDE: a startup, a trilha em que ela esta e a etapa (a
 *      trilha inteira, uma fase ou um passo).
 *   2. QUAL MATERIAL: da biblioteca pessoal ou da biblioteca da incubadora.
 *   3. COMO A STARTUP DEVE USAR: referencia ou apoio a uma atividade, e a
 *      orientacao do mentor.
 *
 * Abre de dois lugares com o que ja se sabe preenchido (`presets`): de "Meus
 * incubados", com startup, trilha e etapa escolhidas na arvore; da biblioteca,
 * com o material escolhido na linha. O que ja veio decidido aparece como
 * resumo, nao como campo — o dialogo so pergunta o que falta.
 *
 * Quem decide se pode e o servidor: as listas aqui ja vem recortadas (so as
 * startups que a pessoa acompanha, so o material dela), e o POST confere tudo
 * de novo.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  MenuItem,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { Close, Search, CheckCircle } from "@mui/icons-material"
import api from "../../services/api"
import IconeFormato from "./IconeFormato"
import { compartilhamentos as apiCompartilhamentos, erroDe } from "../../hooks/useEspacoMentor"
import {
  FINALIDADES,
  FORMATOS,
  MAX_ORIENTACAO,
  formatoDoMaterial,
  normalizarBusca,
} from "../../data/espacoMentorMeta"

const EXEMPLO_ORIENTACAO =
  "Ex.: Utilize este modelo para organizar as hipóteses de mercado levantadas nas entrevistas e traga os resultados para nossa próxima mentoria."

/** A trilha que abre por padrao: a primeira em andamento. */
const trilhaPadrao = (startup) =>
  startup?.trilhas?.find((t) => t.status === "EM_ANDAMENTO") ?? startup?.trilhas?.[0] ?? null

export default function DialogCompartilhar({
  aberto,
  presets = {},
  idTenant,
  podeVerBiblioteca = true,
  onFechar,
  onConcluido,
}) {
  const theme = useTheme()
  const telaCheia = useMediaQuery(theme.breakpoints.down("sm"))

  const etapaPreset = presets.etapa !== undefined // null = trilha inteira, decidido
  const materialPreset = Boolean(presets.material)

  const [startups, setStartups] = useState(null)
  const [idStartup, setIdStartup] = useState(null)
  const [idTrilha, setIdTrilha] = useState(null)
  const [arvore, setArvore] = useState(null)
  const [etapa, setEtapa] = useState("trilha") // "trilha" | id_no
  const [origem, setOrigem] = useState("PESSOAL")
  const [pessoais, setPessoais] = useState(null)
  const [institucionais, setInstitucionais] = useState(null)
  const [erroInstitucional, setErroInstitucional] = useState(null)
  const [busca, setBusca] = useState("")
  const [selecionado, setSelecionado] = useState(null) // { origem, id }
  const [finalidade, setFinalidade] = useState("REFERENCIA")
  const [orientacao, setOrientacao] = useState("")
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  // Ao abrir: zera tudo e assume o que veio decidido.
  useEffect(() => {
    if (!aberto) return
    setErro(null)
    setEnviando(false)
    setBusca("")
    setOrientacao("")
    setFinalidade("REFERENCIA")
    setArvore(null)
    setOrigem("PESSOAL")
    setInstitucionais(null)
    setErroInstitucional(null)
    setSelecionado(
      presets.material ? { origem: "PESSOAL", id: presets.material.id_material } : null
    )
    setIdStartup(presets.startup?.id_startup ?? null)
    setIdTrilha(presets.trilha?.id_no ?? trilhaPadrao(presets.startup)?.id_no ?? null)
    setEtapa(presets.etapa ? presets.etapa.id_no : "trilha")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  // As startups que a pessoa acompanha, quando a startup nao veio decidida.
  useEffect(() => {
    if (!aberto || presets.startup) return
    setStartups(null)
    api
      .get("/espaco-mentor/incubados", { params: { id_tenant: idTenant } })
      .then(({ data }) => setStartups(data.startups))
      .catch((err) => {
        setStartups([])
        setErro(erroDe(err, "Não foi possível carregar as startups que você acompanha."))
      })
  }, [aberto, presets.startup, idTenant])

  // A arvore da trilha, quando a etapa nao veio decidida.
  useEffect(() => {
    if (!aberto || etapaPreset || !idStartup || !idTrilha) return
    let cancelado = false
    setArvore(null)
    api
      .get(`/espaco-mentor/incubados/${idStartup}/trilhas/${idTrilha}`)
      .then(({ data }) => !cancelado && setArvore(data.trilha))
      .catch((err) => {
        if (cancelado) return
        setArvore({ fases: [] })
        setErro(erroDe(err, "Não foi possível carregar a trilha."))
      })
    return () => {
      cancelado = true
    }
  }, [aberto, etapaPreset, idStartup, idTrilha])

  // A biblioteca pessoal, quando o material nao veio decidido.
  useEffect(() => {
    if (!aberto || materialPreset) return
    setPessoais(null)
    api
      .get("/espaco-mentor/materiais", { params: { id_tenant: idTenant } })
      .then(({ data }) => setPessoais(data.materiais.filter((m) => !m.arquivado)))
      .catch(() => setPessoais([]))
  }, [aberto, materialPreset, idTenant])

  // A Biblioteca da incubadora: a busca vai ao servidor, que ja sabe filtrar.
  useEffect(() => {
    if (!aberto || materialPreset || origem !== "INSTITUCIONAL") return
    let cancelado = false
    const t = setTimeout(() => {
      api
        .get("/conteudos", {
          params: { id_tenant: idTenant, ...(busca.trim() ? { termo: busca.trim() } : {}) },
        })
        .then(({ data }) => {
          if (cancelado) return
          setInstitucionais(data.conteudos)
          setErroInstitucional(null)
        })
        .catch((err) => {
          if (cancelado) return
          setInstitucionais([])
          setErroInstitucional(
            err.response?.status === 403
              ? "Seu perfil não tem acesso à biblioteca da incubadora."
              : erroDe(err, "Não foi possível carregar a biblioteca da incubadora.")
          )
        })
    }, busca.trim() ? 300 : 0)
    return () => {
      cancelado = true
      clearTimeout(t)
    }
  }, [aberto, materialPreset, origem, busca, idTenant])

  const startup = presets.startup ?? startups?.find((s) => s.id_startup === idStartup) ?? null
  const trilhas = startup?.trilhas ?? (presets.trilha ? [presets.trilha] : [])
  const trilha = presets.trilha ?? trilhas.find((t) => t.id_no === idTrilha) ?? null

  // As opcoes de etapa: a trilha inteira, cada fase e, dentro dela, os passos.
  const opcoesEtapa = useMemo(() => {
    const opcoes = []
    for (const fase of arvore?.fases ?? []) {
      opcoes.push({ id_no: fase.id_no, tipo: "FASE", nome: fase.nome, fase_nome: fase.nome })
      for (const modulo of fase.modulos) {
        for (const passo of modulo.passos) {
          opcoes.push({ id_no: passo.id_no, tipo: "PASSO", nome: passo.nome, fase_nome: fase.nome, modulo: modulo.nome })
        }
      }
    }
    return opcoes
  }, [arvore])

  const etapaEscolhida = etapaPreset
    ? presets.etapa
    : etapa === "trilha"
      ? null
      : opcoesEtapa.find((o) => o.id_no === etapa) ?? null
  const ehPasso = etapaEscolhida?.tipo === "PASSO"

  // Atividade so existe num passo: trocar a etapa para outra coisa desfaz a escolha.
  useEffect(() => {
    if (!ehPasso && finalidade === "ATIVIDADE") setFinalidade("REFERENCIA")
  }, [ehPasso, finalidade])

  const listaPessoal = useMemo(() => {
    const termo = normalizarBusca(busca)
    return (pessoais ?? []).filter(
      (m) => !termo || normalizarBusca(`${m.titulo} ${m.descricao || ""} ${m.categoria || ""}`).includes(termo)
    )
  }, [pessoais, busca])

  const materialEscolhido = materialPreset
    ? presets.material
    : selecionado?.origem === "PESSOAL"
      ? pessoais?.find((m) => m.id_material === selecionado.id)
      : institucionais?.find((c) => c.id_conteudo === selecionado?.id)

  const semTrilha = startup && trilhas.length === 0
  const podeEnviar =
    Boolean(startup && trilha && selecionado) &&
    !semTrilha &&
    orientacao.length <= MAX_ORIENTACAO &&
    !enviando

  const enviar = async () => {
    if (!podeEnviar) return
    setEnviando(true)
    setErro(null)
    try {
      const criado = await apiCompartilhamentos.criar({
        id_startup: startup.id_startup,
        id_programa: trilha.id_no,
        id_no: etapaEscolhida?.id_no ?? null,
        ...(selecionado.origem === "PESSOAL"
          ? { id_material: selecionado.id }
          : { id_conteudo: selecionado.id }),
        finalidade,
        orientacao: orientacao.trim(),
      })
      onConcluido(criado)
    } catch (err) {
      setErro(erroDe(err, "Não foi possível compartilhar o material."))
    } finally {
      setEnviando(false)
    }
  }

  const resumoLugar = [
    startup?.nome,
    trilha?.nome,
    etapaEscolhida
      ? etapaEscolhida.tipo === "PASSO"
        ? `${etapaEscolhida.fase_nome} › ${etapaEscolhida.nome}`
        : etapaEscolhida.nome
      : "Trilha inteira",
  ]
    .filter(Boolean)
    .join(" › ")

  return (
    <Dialog open={aberto} onClose={enviando ? undefined : onFechar} fullWidth maxWidth="md" fullScreen={telaCheia}>
      <DialogTitle component="div" sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography component="h2" sx={{ fontWeight: 800, fontSize: 19 }}>
            Compartilhar material
          </Typography>
          {startup && trilha && (
            <Typography variant="body2" color="text.secondary">
              {resumoLugar}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onFechar} size="small" disabled={enviando} aria-label="Fechar">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {erro && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        {/* 1. Para quem e onde */}
        {!(presets.startup && presets.trilha && etapaPreset) && (
          <Secao numero={1} titulo="Para quem e em que ponto da trilha">
            <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              {!presets.startup && (
                <TextField
                  select
                  size="small"
                  label="Startup"
                  value={idStartup ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value)
                    const s = startups?.find((x) => x.id_startup === id)
                    setIdStartup(id)
                    setIdTrilha(trilhaPadrao(s)?.id_no ?? null)
                    setEtapa("trilha")
                  }}
                  disabled={startups === null}
                  helperText={
                    startups === null
                      ? "Carregando…"
                      : startups.length === 0
                        ? "Você ainda não acompanha nenhuma startup."
                        : " "
                  }
                >
                  {(startups ?? []).map((s) => (
                    <MenuItem key={s.id_startup} value={s.id_startup}>
                      {s.nome}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {!presets.trilha && (
                <TextField
                  select
                  size="small"
                  label="Trilha"
                  value={idTrilha ?? ""}
                  onChange={(e) => {
                    setIdTrilha(Number(e.target.value))
                    setEtapa("trilha")
                  }}
                  disabled={!startup || trilhas.length === 0}
                  helperText=" "
                >
                  {trilhas.map((t) => (
                    <MenuItem key={t.id_no} value={t.id_no}>
                      {t.nome}
                      {t.status === "CONCLUIDA" ? " (concluída)" : ""}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {!etapaPreset && (
                <TextField
                  select
                  size="small"
                  label="Etapa"
                  value={etapa}
                  onChange={(e) => setEtapa(e.target.value === "trilha" ? "trilha" : Number(e.target.value))}
                  disabled={!trilha || arvore === null}
                  helperText={arvore === null && trilha ? "Carregando a trilha…" : "Uma fase, um passo ou a trilha inteira."}
                  sx={{ gridColumn: { md: "1 / -1" } }}
                >
                  <MenuItem value="trilha">Trilha inteira</MenuItem>
                  {opcoesEtapa.map((o) => (
                    <MenuItem key={o.id_no} value={o.id_no} sx={o.tipo === "PASSO" ? { pl: 4 } : { fontWeight: 700 }}>
                      {o.tipo === "PASSO" ? `${o.modulo} › ${o.nome}` : o.nome}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
            {semTrilha && (
              <Alert severity="info" variant="outlined">
                {startup.nome} ainda não está matriculada em nenhuma trilha. O material é entregue dentro
                da trilha — peça à coordenação para matricular a startup.
              </Alert>
            )}
          </Secao>
        )}

        {/* 2. Qual material */}
        <Secao numero={presets.startup && presets.trilha && etapaPreset ? 1 : 2} titulo="Qual material">
          {materialPreset ? (
            <ItemEscolhido item={presets.material} />
          ) : (
            <>
              <Tabs
                value={origem}
                onChange={(_, v) => {
                  setOrigem(v)
                  setBusca("")
                }}
                sx={{ mb: 1.5, minHeight: 40, "& .MuiTab-root": { minHeight: 40, textTransform: "none" } }}
              >
                <Tab value="PESSOAL" label="Minha biblioteca" />
                {podeVerBiblioteca && <Tab value="INSTITUCIONAL" label="Biblioteca da incubadora" />}
              </Tabs>
              <TextField
                size="small"
                fullWidth
                placeholder={origem === "PESSOAL" ? "Buscar na sua biblioteca…" : "Buscar na biblioteca da incubadora…"}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                sx={{ mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: "6px", maxHeight: 260, overflowY: "auto" }}>
                {origem === "PESSOAL" ? (
                  <ListaEscolha
                    carregando={pessoais === null}
                    vazio={
                      (pessoais ?? []).length === 0
                        ? "Sua biblioteca está vazia (ou só tem materiais arquivados). Adicione materiais em “Minha biblioteca”."
                        : "Nenhum material encontrado."
                    }
                    itens={listaPessoal.map((m) => ({
                      chave: m.id_material,
                      item: m,
                      titulo: m.titulo,
                      detalhe: [FORMATOS[formatoDoMaterial(m)]?.rotulo, m.categoria].filter(Boolean).join(" · "),
                      aviso: startup && m.startups_compartilhadas?.some((s) => s.id_startup === startup.id_startup)
                        ? `Já compartilhado com ${startup.nome}`
                        : null,
                      selecionado: selecionado?.origem === "PESSOAL" && selecionado.id === m.id_material,
                      onClick: () => setSelecionado({ origem: "PESSOAL", id: m.id_material }),
                    }))}
                  />
                ) : erroInstitucional ? (
                  <Alert severity="warning" sx={{ m: 1 }}>
                    {erroInstitucional}
                  </Alert>
                ) : (
                  <ListaEscolha
                    carregando={institucionais === null}
                    vazio="Nenhum conteúdo encontrado na biblioteca da incubadora."
                    itens={(institucionais ?? []).map((cnt) => {
                      const item = { ...cnt, origem: "INSTITUCIONAL" }
                      return {
                        chave: cnt.id_conteudo,
                        item,
                        titulo: cnt.titulo,
                        detalhe: [FORMATOS[formatoDoMaterial(item)]?.rotulo, cnt.resumo].filter(Boolean).join(" · "),
                        selecionado: selecionado?.origem === "INSTITUCIONAL" && selecionado.id === cnt.id_conteudo,
                        onClick: () => setSelecionado({ origem: "INSTITUCIONAL", id: cnt.id_conteudo }),
                      }
                    })}
                  />
                )}
              </Box>
              {origem === "INSTITUCIONAL" && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  O material continua na biblioteca da incubadora: a startup recebe um vínculo para ele, não uma cópia.
                </Typography>
              )}
            </>
          )}
        </Secao>

        {/* 3. Como usar */}
        <Secao
          numero={(presets.startup && presets.trilha && etapaPreset ? 1 : 2) + 1}
          titulo="Como a startup deve usar"
        >
          <RadioGroup value={finalidade} onChange={(e) => setFinalidade(e.target.value)} sx={{ mb: 1.5 }}>
            {Object.entries(FINALIDADES).map(([chave, meta]) => {
              const desabilitada = chave === "ATIVIDADE" && !ehPasso
              return (
                <FormControlLabel
                  key={chave}
                  value={chave}
                  disabled={desabilitada}
                  control={<Radio size="small" />}
                  sx={{ alignItems: "flex-start", mb: 0.5, "& .MuiRadio-root": { pt: 0.5 } }}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {chave === "REFERENCIA" ? "Material de referência" : "Material de apoio a uma atividade"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {desabilitada ? "Escolha um passo da trilha como etapa para associar a uma atividade." : meta.descricao}
                      </Typography>
                    </Box>
                  }
                />
              )
            })}
          </RadioGroup>
          <TextField
            label="Orientação para a startup (opcional)"
            placeholder={EXEMPLO_ORIENTACAO}
            fullWidth
            multiline
            minRows={3}
            value={orientacao}
            onChange={(e) => setOrientacao(e.target.value)}
            error={orientacao.length > MAX_ORIENTACAO}
            helperText={`Diga por que a startup está recebendo isto e o que fazer com ele. ${orientacao.length}/${MAX_ORIENTACAO}`}
          />
        </Secao>

        {materialEscolhido && !materialPreset && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Selecionado: <b>{materialEscolhido.titulo}</b>
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onFechar} disabled={enviando} sx={{ textTransform: "none" }}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={enviar}
          disabled={!podeEnviar}
          startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {enviando ? "Compartilhando…" : "Compartilhar"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function Secao({ numero, titulo, children }) {
  return (
    <Box sx={{ mb: 3, "&:last-of-type": { mb: 0 } }}>
      <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.25 }}>
        <Box component="span" sx={{ color: "primary.main", mr: 1 }}>
          {numero}.
        </Box>
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

function ItemEscolhido({ item }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: "6px" }}>
      <IconeFormato item={item} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
          {item.titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {[FORMATOS[formatoDoMaterial(item)]?.rotulo, item.categoria].filter(Boolean).join(" · ")}
        </Typography>
      </Box>
    </Box>
  )
}

function ListaEscolha({ carregando, itens, vazio }) {
  if (carregando) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }
  if (itens.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
        {vazio}
      </Typography>
    )
  }
  return (
    <List dense disablePadding>
      {itens.map((it) => (
        <ListItemButton
          key={it.chave}
          selected={it.selecionado}
          onClick={it.onClick}
          sx={{ gap: 1.5, py: 1 }}
          aria-pressed={it.selecionado}
        >
          <IconeFormato item={it.item} tamanho={28} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {it.titulo}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {it.detalhe}
            </Typography>
          </Box>
          {it.aviso && <Chip size="small" label={it.aviso} variant="outlined" sx={{ maxWidth: 220 }} />}
          {it.selecionado && <CheckCircle color="primary" fontSize="small" />}
        </ListItemButton>
      ))}
    </List>
  )
}
