/**
 * O cadastro de uma tarefa: um painel lateral direito, do mesmo desenho do
 * DrawerCadastroStartup.
 *
 * PAINEL E NAO DIALOGO pelo mesmo motivo de la: com descricao longa, prazo,
 * responsavel, startup e os campos que cada incubadora inventa, um dialogo
 * centralizado cobriria o quadro e rolaria dentro de uma caixa flutuante. Aqui
 * a lista continua visivel a esquerda — da para conferir se a tarefa ja existe
 * enquanto se digita — e o rodape com "Salvar" fica fixo.
 *
 * QUATRO GRUPOS, na ordem em que a tarefa e pensada: o que e (identificacao),
 * quando e com quem (planejamento), sobre qual startup (vinculo) e o material
 * de apoio (complementos). Nenhum fica recolhido: anexo e campo da incubadora
 * escondidos atras de um clique sao esquecidos, e um campo personalizavel
 * OBRIGATORIO recolhido seria um erro de validacao num lugar que nao se ve.
 *
 * A VALIDACAO FICA NO CAMPO. O titulo e os campos obrigatorios da incubadora
 * sao conferidos antes do envio; o que o backend recusar volta para o campo de
 * que a mensagem fala (ver campoDoErro). So o erro que nao tem campo vai para o
 * aviso do topo.
 *
 * SERVE PARA CRIAR E PARA EDITAR. Criando, ha tambem "Salvar e criar outra",
 * que mantem o planejamento e o vinculo (quem cadastra cinco tarefas da mesma
 * startup nao quer escolhe-la cinco vezes) e limpa o resto. Editando, ha o
 * "Excluir".
 *
 * OS CAMPOS PERSONALIZAVEIS vivem num estado separado do resto do formulario
 * (`extras`), porque a chave deles e definida pela incubadora e poderia colidir
 * com "titulo" ou "prazo". Os ANEXOS tambem vivem a parte, e por outro motivo:
 * eles ja subiram para o servidor quando chegam aqui, e o que o formulario
 * carrega e so a lista de ids. Ver AnexosTarefa.
 *
 * Endpoints (via useTarefas):
 *   POST   /tarefas
 *   PUT    /tarefas/:id
 *   DELETE /tarefas/:id
 */
import { useEffect, useRef, useState } from "react"
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material"
import { Business, Close, DeleteOutline } from "@mui/icons-material"
import CampoPersonalizado, {
  valorParaEnvio,
  valorParaFormulario,
} from "../campos/CampoPersonalizado"
import AnexosTarefa from "./AnexosTarefa"
import { AvatarResponsavel, PrioridadeTarefa } from "./MarcadoresTarefa"
import { useTarefaConfigStore } from "../../store/tarefaConfigStore"
import { PRIORIDADES } from "../../data/tarefaMeta"

const FORM_VAZIO = {
  titulo: "",
  descricao: "",
  status: "",
  prioridade: "MEDIA",
  id_responsavel: "",
  id_startup: "",
  prazo: "",
}

const LIMITE_TITULO = 160

/**
 * De que campo fala uma mensagem de erro do backend.
 *
 * As mensagens de tarefaService e de campos/valores sao estaveis e citam o
 * campo pelo nome ("Informe o titulo", `Preencha o campo "Centro de custo"`).
 * Os campos personalizaveis vem PRIMEIRO: um campo chamado "Prazo interno"
 * nao pode ter o erro dele pendurado no prazo da tarefa.
 *
 * @returns {{tipo: 'extra'|'fixo', chave: string}|null}
 */
function campoDoErro(mensagem, campos) {
  const texto = String(mensagem || "")
  const extra = campos.find((c) => texto.includes(`"${c.rotulo}"`))
  if (extra) return { tipo: "extra", chave: extra.chave }

  const regras = [
    [/t[ií]tulo/i, "titulo"],
    [/coluna/i, "status"],
    [/prioridade/i, "prioridade"],
    [/prazo/i, "prazo"],
    [/respons[aá]vel/i, "id_responsavel"],
    [/startup/i, "id_startup"],
    [/anexo/i, "anexos"],
  ]
  const achada = regras.find(([padrao]) => padrao.test(texto))
  return achada ? { tipo: "fixo", chave: achada[1] } : null
}

/** Um grupo do formulario: o rotulo em caixa alta larga, como as faixas do PDF da marca. */
function Secao({ id, titulo, primeira = false, children }) {
  return (
    <Box
      role="group"
      aria-labelledby={id}
      sx={primeira ? undefined : { mt: 3, pt: 3, borderTop: 1, borderColor: "divider" }}
    >
      <Typography id={id} variant="overline" component="h3" color="text.secondary" sx={{ display: "block", lineHeight: 1.6, mb: 1.5 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

export default function DrawerTarefa({
  aberto,
  onFechar,
  idTenant,
  tarefa = null,
  // A tarefa completa ainda esta chegando (GET /tarefas/:id). O painel abre na
  // hora, com esqueleto no lugar dos campos e o salvar travado: salvar com o
  // que a linha da lista tem apagaria os anexos, que ela nao traz.
  carregando = false,
  // Coluna sugerida ao criar. Vem do "+" do cabecalho de uma coluna do kanban:
  // quem clica ali ja disse onde quer a tarefa.
  statusInicial = null,
  pessoas = [],
  startups = [],
  podeExcluir = false,
  onSalvar,
  onExcluir,
}) {
  const editando = Boolean(tarefa)

  const statusDisponiveis = useTarefaConfigStore((s) => s.status) || []
  const campos = useTarefaConfigStore((s) => s.campos) || []

  const [form, setForm] = useState(FORM_VAZIO)
  const [extras, setExtras] = useState({})
  const [anexos, setAnexos] = useState([])
  // Qual botao esta salvando: "salvar" ou "outra". Distintos para o spinner
  // aparecer no botao que foi clicado.
  const [salvando, setSalvando] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(false)
  const [aviso, setAviso] = useState(null)
  // Erros por campo: { titulo, status, ..., extras: { [chave]: msg } }.
  const [erros, setErros] = useState({})

  const refTitulo = useRef(null)
  const refCorpo = useRef(null)

  /**
   * Preenche o formulario ao abrir.
   *
   * Reprocessa a cada abertura (e nao so na montagem) porque o painel fica
   * montado entre uma edicao e outra: sem isto, abrir a segunda tarefa
   * mostraria os dados da primeira. Roda de novo quando a tarefa completa
   * chega depois do esqueleto.
   */
  useEffect(() => {
    if (!aberto) return
    setAviso(null)
    setErros({})
    setConfirmarExclusao(false)

    if (editando) {
      setForm({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        status: tarefa.status || "",
        prioridade: tarefa.prioridade || "MEDIA",
        id_responsavel: tarefa.id_responsavel ?? "",
        id_startup: tarefa.id_startup ?? "",
        // A API devolve DATE como "2026-08-19" ou ISO completo; o
        // <input type="date"> so aceita os dez primeiros caracteres.
        prazo: tarefa.prazo ? String(tarefa.prazo).slice(0, 10) : "",
      })
      const guardados = tarefa.campos_extras || {}
      setExtras(
        Object.fromEntries(
          campos.map((campo) => [campo.chave, valorParaFormulario(campo, guardados[campo.chave])])
        )
      )
      setAnexos(tarefa.anexos || [])
      return
    }

    setForm({
      ...FORM_VAZIO,
      status: statusInicial || statusDisponiveis[0]?.chave || "",
    })
    setExtras(Object.fromEntries(campos.map((campo) => [campo.chave, ""])))
    setAnexos([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, tarefa, statusInicial])

  const alterar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  const alterarExtra = (chave, valor) => {
    setExtras((e) => ({ ...e, [chave]: valor }))
    if (erros.extras?.[chave]) setErros((e) => ({ ...e, extras: { ...e.extras, [chave]: undefined } }))
  }

  /** Leva a pessoa ate o primeiro campo com erro. */
  function mostrarCampo(chave) {
    if (chave === "titulo") {
      refTitulo.current?.focus()
      return
    }
    document
      .getElementById(`campo-tarefa-${chave}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" })
  }

  /** O que da para conferir sem perguntar ao servidor. */
  function validar() {
    const novos = {}
    if (!form.titulo.trim()) novos.titulo = "Informe o título da tarefa."

    const extrasFaltando = Object.fromEntries(
      campos
        .filter((c) => c.obrigatorio && !String(extras[c.chave] ?? "").trim())
        .map((c) => [c.chave, "Campo obrigatório."])
    )
    if (Object.keys(extrasFaltando).length) novos.extras = extrasFaltando
    return novos
  }

  const enviar = async (criarOutra = false) => {
    const encontrados = validar()
    if (Object.keys(encontrados).length) {
      setErros(encontrados)
      setAviso(null)
      mostrarCampo(encontrados.titulo ? "titulo" : `extra-${Object.keys(encontrados.extras)[0]}`)
      return
    }

    setSalvando(criarOutra ? "outra" : "salvar")
    setAviso(null)
    setErros({})
    try {
      await onSalvar({
        ...form,
        titulo: form.titulo.trim(),
        // "" nao e um id: o backend recusaria, e null e o que diz "ninguem".
        id_responsavel: form.id_responsavel || null,
        id_startup: form.id_startup || null,
        prazo: form.prazo || null,
        campos_extras: Object.fromEntries(
          campos.map((campo) => [campo.chave, valorParaEnvio(campo, extras[campo.chave])])
        ),
        // So os ids: os arquivos ja subiram (ver AnexosTarefa).
        anexos: anexos.map((a) => a.id_arquivo),
      }, { criarOutra })

      if (!criarOutra) {
        onFechar()
        return
      }

      // Fica aberto para a proxima: mantem coluna, prioridade, responsavel e
      // startup; limpa o que e desta tarefa.
      setAviso({ tipo: "success", texto: `Tarefa “${form.titulo.trim()}” criada. Cadastre a próxima.` })
      setForm((f) => ({ ...FORM_VAZIO, status: f.status, prioridade: f.prioridade, id_responsavel: f.id_responsavel, id_startup: f.id_startup }))
      setExtras(Object.fromEntries(campos.map((campo) => [campo.chave, ""])))
      setAnexos([])
      refCorpo.current?.scrollTo({ top: 0 })
      refTitulo.current?.focus()
    } catch (err) {
      const mensagem = err.response?.data?.erro || "Não foi possível salvar a tarefa. Tente de novo."
      const campo = campoDoErro(err.response?.data?.erro, campos)
      if (campo?.tipo === "extra") {
        setErros({ extras: { [campo.chave]: mensagem } })
        mostrarCampo(`extra-${campo.chave}`)
      } else if (campo) {
        setErros({ [campo.chave]: mensagem })
        mostrarCampo(campo.chave)
      } else {
        setAviso({ tipo: "error", texto: mensagem })
        refCorpo.current?.scrollTo({ top: 0, behavior: "smooth" })
      }
    } finally {
      setSalvando(null)
    }
  }

  const excluir = async () => {
    setExcluindo(true)
    try {
      await onExcluir(tarefa.id_tarefa)
      setConfirmarExclusao(false)
      onFechar()
    } catch (err) {
      setConfirmarExclusao(false)
      setAviso({ tipo: "error", texto: err.response?.data?.erro || "Não foi possível excluir a tarefa." })
    } finally {
      setExcluindo(false)
    }
  }

  // O responsavel atual pode nao estar mais na equipe ativa (saiu da
  // incubadora). Ele entra como opcao marcada "inativo": esconder quem e o
  // responsavel seria mentir sobre a tarefa, e o backend explica no campo se
  // recusar a gravacao.
  const opcoesPessoas =
    editando && tarefa.id_responsavel && !pessoas.some((p) => String(p.id_usuario) === String(tarefa.id_responsavel))
      ? [...pessoas, { id_usuario: tarefa.id_responsavel, nome: `${tarefa.responsavel_nome || "Usuário"} (inativo)` }]
      : pessoas
  const pessoaSelecionada =
    opcoesPessoas.find((p) => String(p.id_usuario) === String(form.id_responsavel)) || null
  const startupSelecionada =
    startups.find((s) => String(s.id_startup) === String(form.id_startup)) || null

  const ocupado = Boolean(salvando) || excluindo
  const statusAtual = statusDisponiveis.find((s) => s.chave === form.status)

  return (
    <>
      <Drawer
        anchor="right"
        open={aberto}
        // Fechar no meio do salvar deixaria a pessoa sem saber se gravou.
        onClose={ocupado ? undefined : onFechar}
        PaperProps={{
          sx: { width: { xs: "100%", sm: 560 }, display: "flex", flexDirection: "column" },
          role: "dialog",
          "aria-labelledby": "titulo-drawer-tarefa",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            px: 3,
            py: 2,
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography id="titulo-drawer-tarefa" variant="h6" component="h2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {editando ? "Editar tarefa" : "Nova tarefa"}
            </Typography>
            {editando && !carregando && (tarefa.criado_por_nome || tarefa.criado_ts) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                Criada
                {tarefa.criado_por_nome ? ` por ${tarefa.criado_por_nome}` : ""}
                {/* criado_ts e TIMESTAMP (um instante): aqui o fuso de quem le
                    e o certo. O prazo, que e DATE, nunca passa por isto. */}
                {tarefa.criado_ts ? ` em ${new Date(tarefa.criado_ts).toLocaleDateString("pt-BR")}` : ""}
                {tarefa.concluida_ts
                  ? ` · concluída em ${new Date(tarefa.concluida_ts).toLocaleDateString("pt-BR")}`
                  : ""}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={onFechar} aria-label="Fechar" disabled={ocupado} sx={{ mt: -0.25 }}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Box
          ref={refCorpo}
          component="form"
          id="form-tarefa"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            enviar(false)
          }}
          sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}
        >
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2.5 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}

          {carregando ? (
            <Box aria-busy="true" aria-label="Carregando a tarefa">
              <Skeleton width={110} height={20} sx={{ mb: 1.5 }} />
              <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={88} sx={{ mb: 4 }} />
              <Skeleton width={120} height={20} sx={{ mb: 1.5 }} />
              <Grid container spacing={2}>
                {[0, 1, 2, 3].map((i) => (
                  <Grid item xs={12} sm={6} key={i}>
                    <Skeleton variant="rounded" height={40} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <>
              <Secao id="secao-tarefa-identificacao" titulo="Identificação" primeira>
                <Grid container spacing={2}>
                  <Grid item xs={12} id="campo-tarefa-titulo">
                    <TextField
                      label="Título"
                      fullWidth
                      required
                      autoFocus={!editando}
                      inputRef={refTitulo}
                      size="small"
                      value={form.titulo}
                      onChange={(e) => alterar("titulo", e.target.value)}
                      placeholder="Ex.: Revisar o contrato de incubação da Acme"
                      inputProps={{ maxLength: LIMITE_TITULO }}
                      error={Boolean(erros.titulo)}
                      helperText={
                        erros.titulo ||
                        (form.titulo.length > LIMITE_TITULO - 30
                          ? `${form.titulo.length}/${LIMITE_TITULO} caracteres`
                          : undefined)
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Descrição"
                      fullWidth
                      multiline
                      minRows={3}
                      maxRows={12}
                      size="small"
                      value={form.descricao}
                      onChange={(e) => alterar("descricao", e.target.value)}
                      placeholder="Contexto, links, o que conta como pronto..."
                    />
                  </Grid>
                </Grid>
              </Secao>

              <Secao id="secao-tarefa-planejamento" titulo="Planejamento">
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} id="campo-tarefa-status">
                    <TextField
                      select
                      label="Status"
                      fullWidth
                      size="small"
                      value={statusAtual ? form.status : ""}
                      onChange={(e) => alterar("status", e.target.value)}
                      error={Boolean(erros.status)}
                      helperText={erros.status}
                      SelectProps={{
                        renderValue: (chave) => {
                          const s = statusDisponiveis.find((x) => x.chave === chave)
                          return s ? <OpcaoStatus status={s} /> : ""
                        },
                      }}
                    >
                      {statusDisponiveis.map((s) => (
                        <MenuItem key={s.chave} value={s.chave}>
                          <OpcaoStatus status={s} />
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} id="campo-tarefa-prioridade">
                    <TextField
                      select
                      label="Prioridade"
                      fullWidth
                      size="small"
                      value={form.prioridade}
                      onChange={(e) => alterar("prioridade", e.target.value)}
                      error={Boolean(erros.prioridade)}
                      helperText={erros.prioridade}
                      SelectProps={{
                        // A altura da linha do seletor, para o selo ficar
                        // centrado como o texto dos outros campos.
                        renderValue: (chave) => (
                          <Box component="span" sx={{ display: "flex", alignItems: "center", height: "1.4375em" }}>
                            <PrioridadeTarefa chave={chave} />
                          </Box>
                        ),
                      }}
                    >
                      {/* Do mais urgente para o menos: e a ordem em que se procura. */}
                      {[...PRIORIDADES].reverse().map((p) => (
                        <MenuItem key={p.chave} value={p.chave}>
                          <PrioridadeTarefa chave={p.chave} />
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={6} id="campo-tarefa-prazo">
                    <TextField
                      label="Prazo"
                      type="date"
                      fullWidth
                      size="small"
                      value={form.prazo}
                      onChange={(e) => alterar("prazo", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      error={Boolean(erros.prazo)}
                      helperText={erros.prazo}
                      InputProps={{
                        // O seletor nativo nao tem "limpar" em todo navegador.
                        endAdornment: form.prazo ? (
                          <InputAdornment position="end">
                            <Tooltip title="Remover prazo">
                              <IconButton size="small" edge="end" onClick={() => alterar("prazo", "")} aria-label="Remover prazo">
                                <Close sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ) : undefined,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} id="campo-tarefa-id_responsavel">
                    <Autocomplete
                      size="small"
                      options={opcoesPessoas}
                      value={pessoaSelecionada}
                      onChange={(_, p) => alterar("id_responsavel", p ? p.id_usuario : "")}
                      getOptionLabel={(p) => p.nome || ""}
                      isOptionEqualToValue={(a, b) => String(a.id_usuario) === String(b.id_usuario)}
                      noOptionsText="Ninguém encontrado"
                      renderOption={(props, p) => {
                        const { key, ...resto } = props
                        return (
                          <li key={key} {...resto}>
                            <AvatarResponsavel nome={p.nome} comNome />
                          </li>
                        )
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Responsável"
                          placeholder="Ninguém ainda"
                          error={Boolean(erros.id_responsavel)}
                          helperText={erros.id_responsavel}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: pessoaSelecionada ? (
                              <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                <AvatarResponsavel nome={pessoaSelecionada.nome} tamanho={22} dica={false} />
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </Secao>

              {/* A startup so vira seletor se houver alguma visivel: sem
                  startups (ou sem a permissao de ve-las) o seletor seria um
                  campo vazio pedindo uma escolha impossivel. O vinculo que a
                  tarefa ja tem continua a vista, so para leitura, e volta
                  intacto no salvar. */}
              {startups.length > 0 ? (
                <Secao id="secao-tarefa-vinculo" titulo="Vínculo">
                  <Box id="campo-tarefa-id_startup">
                    <Autocomplete
                      size="small"
                      options={startups}
                      value={startupSelecionada}
                      onChange={(_, s) => alterar("id_startup", s ? s.id_startup : "")}
                      getOptionLabel={(s) => s.nome || ""}
                      isOptionEqualToValue={(a, b) => String(a.id_startup) === String(b.id_startup)}
                      noOptionsText="Nenhuma startup encontrada"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Startup (opcional)"
                          placeholder="Nenhuma, tarefa interna da incubadora"
                          error={Boolean(erros.id_startup)}
                          helperText={erros.id_startup}
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                                <Business sx={{ fontSize: 18, color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />
                  </Box>
                </Secao>
              ) : (
                editando &&
                tarefa.startup_nome && (
                  <Secao id="secao-tarefa-vinculo" titulo="Vínculo">
                    <TextField
                      label="Startup"
                      fullWidth
                      size="small"
                      value={tarefa.startup_nome}
                      disabled
                      helperText={erros.id_startup}
                      error={Boolean(erros.id_startup)}
                    />
                  </Secao>
                )
              )}

              <Secao id="secao-tarefa-complementos" titulo="Complementos">
                <Box id="campo-tarefa-anexos">
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    Anexos
                  </Typography>
                  {erros.anexos && (
                    <Alert severity="error" sx={{ mb: 1.5 }}>
                      {erros.anexos}
                    </Alert>
                  )}
                  <AnexosTarefa
                    idTenant={idTenant}
                    idTarefa={tarefa?.id_tarefa}
                    anexos={anexos}
                    onChange={(lista) => {
                      setAnexos(lista)
                      if (erros.anexos) setErros((e) => ({ ...e, anexos: undefined }))
                    }}
                  />
                </Box>

                {/* Os campos que a propria incubadora criou. O bloco some
                    quando nao ha nenhum — um titulo sobre o vazio so ocuparia
                    espaco. */}
                {campos.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
                      Informações da incubadora
                    </Typography>
                    <Grid container spacing={2}>
                      {campos.map((campo) => (
                        <Grid
                          item
                          xs={12}
                          sm={campo.tipo === "TEXTO" && campo.config?.multilinha ? 12 : 6}
                          key={campo.chave}
                          id={`campo-tarefa-extra-${campo.chave}`}
                        >
                          <CampoPersonalizado
                            campo={campo}
                            valor={extras[campo.chave]}
                            onChange={(valor) => alterarExtra(campo.chave, valor)}
                            erro={erros.extras?.[campo.chave]}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </Secao>
            </>
          )}
        </Box>

        {/* ACOES — fixas no rodape, para "Salvar" nao exigir rolar ate o fim. */}
        <Box
          sx={{
            px: 3,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            flexShrink: 0,
          }}
        >
          {editando && podeExcluir && (
            <Button
              size="small"
              color="error"
              startIcon={<DeleteOutline />}
              onClick={() => setConfirmarExclusao(true)}
              disabled={ocupado || carregando}
            >
              Excluir
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar} disabled={ocupado} color="inherit">
            Cancelar
          </Button>
          {/* No celular fica de fora: o rodape nao cabe em uma linha com ele,
              e cadastrar em serie e trabalho de mesa. */}
          {!editando && (
            <Button
              variant="outlined"
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
              onClick={() => enviar(true)}
              disabled={ocupado}
              startIcon={salvando === "outra" ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Salvar e criar outra
            </Button>
          )}
          <Button
            type="submit"
            form="form-tarefa"
            variant="contained"
            disabled={ocupado || carregando}
            startIcon={salvando === "salvar" ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {salvando === "salvar" ? (
              "Salvando..."
            ) : editando ? (
              <>
                Salvar
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  &nbsp;alterações
                </Box>
              </>
            ) : (
              "Criar tarefa"
            )}
          </Button>
        </Box>
      </Drawer>

      {/* Excluir tarefa e DEFINITIVO, ao contrario de desativar uma coluna:
          a confirmacao diz isso em vez de perguntar "tem certeza?". */}
      <Dialog open={confirmarExclusao} onClose={() => !excluindo && setConfirmarExclusao(false)}>
        <DialogTitle>Excluir "{tarefa?.titulo}"?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A tarefa sai do quadro e não há como recuperá-la. O registro de quem a criou e de quem a
            excluiu fica na auditoria.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarExclusao(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" onClick={excluir} disabled={excluindo}>
            {excluindo ? <CircularProgress size={18} color="inherit" /> : "Excluir"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

/** Uma coluna do quadro dentro do seletor: o ponto na cor dela e o nome. */
function OpcaoStatus({ status }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: status.cor, flexShrink: 0 }} />
      {status.rotulo}
    </Box>
  )
}
