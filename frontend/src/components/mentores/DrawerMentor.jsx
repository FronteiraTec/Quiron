/**
 * O painel de um mentor: um drawer a direita.
 *
 * SERVE PARA CADASTRAR E PARA EDITAR, como o DrawerCadastroStartup. A diferenca
 * e a secao "Quem e" — nome, e-mail, celular e senha provisoria —, que so
 * aparece no cadastro novo: trocar o e-mail ou o telefone de alguem que ja
 * existe e cadastro de PESSOA, e mora em /usuarios. Dois lugares gravando a
 * mesma coluna e uma divergencia esperando acontecer.
 *
 * NA EDICAO ELE TEM DUAS ABAS:
 *
 *   CADASTRO — o que a coordenacao sabe sobre ele (mentor_perfil, migracao
 *   016): vinculo institucional, area, especialidades, demandas,
 *   disponibilidade, formato, status e observacoes.
 *
 *   STARTUPS — quais ele acompanha, e o vinculo que da a ele acesso a fila de
 *   avaliacao (MentorPainel).
 *
 * Duas abas, e nao dois drawers, porque sao duas leituras da MESMA decisao:
 * quem escolhe a startup do mentor quer olhar a disponibilidade e as
 * especialidades dele no mesmo lugar em que faz o vinculo. A tabela abre direto
 * na aba que a acao pediu — clicar na linha abre em Startups (o caminho de
 * sempre desta tela), o lapis abre em Cadastro.
 *
 * No cadastro novo NAO HA aba de startups: nao existe mentor ainda para
 * vincular. Ele nasce, entra na listagem, e o vinculo se faz clicando na linha
 * dele — o mesmo caminho de sempre.
 *
 * O historico ("ultima mentoria", "mentorias no periodo") nao se edita em lugar
 * nenhum: sai da agenda, e quem o preenche e quem marca as atividades no
 * calendario.
 */
import { useEffect, useState } from "react"
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material"
import { Close, SupervisorAccount } from "@mui/icons-material"

import MentorPainel from "./MentorPainel"
import ChipSituacaoMentor from "./ChipSituacaoMentor"
import { FORMATOS, FORMATO_PADRAO, SITUACOES, SITUACAO_ATIVO } from "./vocabulario"
import {
  MAX_CELULAR,
  celularValido,
  formatarCelular,
  mascararCelular,
  somenteDigitos,
} from "../../utils/mascaras"

const FORM_VAZIO = {
  // So no cadastro novo (ver o cabecalho).
  nome: "",
  email: "",
  celular: "",
  senha: "",
  // O cadastro de mentor, nos dois modos.
  vinculo: "",
  area: "",
  especialidades: [],
  demandas: [],
  horas_mes: "",
  formato: FORMATO_PADRAO,
  situacao: SITUACAO_ATIVO,
  observacoes: "",
}

function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

/**
 * Cabecalho de secao — separa os blocos sem transformar o painel em abas.
 *
 * Sem titulo ele vira so o espacamento: na EDICAO ha um bloco de campos so, e
 * um cabecalho "O que ele atende" sozinho, sem nada para se contrapor, seria
 * ruido.
 */
function Secao({ titulo, descricao, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      {titulo && (
        <Typography variant="subtitle2" fontWeight={700}>
          {titulo}
        </Typography>
      )}
      {descricao && (
        <Typography variant="caption" color="text.secondary">
          {descricao}
        </Typography>
      )}
      <Box sx={{ mt: titulo || descricao ? 1.5 : 0 }}>{children}</Box>
    </Box>
  )
}

/**
 * Campo de tags com sugestao.
 *
 * `freeSolo` + `options` vindas do que JA EXISTE na incubadora: a lista nao e
 * um cadastro fechado (ver mentores/perfil.js no backend), mas oferecer o que
 * os outros mentores ja usam e o que faz "Growth" nao virar tambem "growth
 * hacking" e "Growth Mkt" em tres cadastros seguidos.
 */
function CampoTags({ rotulo, ajuda, valor, opcoes, onChange, desabilitado }) {
  return (
    <Autocomplete
      multiple
      freeSolo
      disabled={desabilitado}
      options={opcoes}
      value={valor}
      // Mesma higiene do backend (mentores/perfil.js): apara, joga fora o
      // vazio e nao aceita repetido ignorando maiuscula. Aqui e o que impede
      // duas chips iguais na tela — o backend so consertaria depois de gravar.
      onChange={(_, novo) => {
        const vistas = new Set()
        onChange(
          novo
            .map((t) => String(t).trim().replace(/\s+/g, " "))
            .filter((t) => {
              if (!t || vistas.has(t.toLowerCase())) return false
              vistas.add(t.toLowerCase())
              return true
            })
        )
      }}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, i) => (
          <Chip size="small" label={tag} {...getTagProps({ index: i })} key={tag} />
        ))
      }
      renderInput={(params) => (
        <TextField {...params} label={rotulo} helperText={ajuda} placeholder="Digite e tecle Enter" />
      )}
    />
  )
}

export default function DrawerMentor({
  aberto,
  onFechar,
  // null = cadastro novo. Preenchido = edicao.
  mentor = null,
  detalhe,
  carregandoDetalhe,
  abaInicial = "startups",
  sugestoes = { especialidades: [], demandas: [] },
  podeEditar = false,
  onCriar,
  onSalvar,
  onVincular,
  onDesvincular,
}) {
  const criando = !mentor

  const [aba, setAba] = useState(abaInicial)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  /**
   * Preenche o formulario a cada abertura, e nao so na montagem: o drawer fica
   * montado entre um mentor e outro, e sem isto o segundo abriria com o
   * cadastro do primeiro — ou o cadastro novo abriria com o que sobrou da
   * ultima edicao.
   */
  useEffect(() => {
    if (!aberto) return
    setAviso(null)

    if (criando) {
      setAba("cadastro")
      setForm(FORM_VAZIO)
      return
    }

    setAba(abaInicial)
    setForm({
      ...FORM_VAZIO,
      vinculo: mentor.vinculo || "",
      area: mentor.area || "",
      especialidades: mentor.especialidades || [],
      demandas: mentor.demandas || [],
      // O numero vira texto porque o campo e um <input>: com null ele ficaria
      // "descontrolado" e o React reclamaria na primeira digitacao.
      horas_mes: mentor.horas_mes ?? "",
      formato: mentor.formato || FORMATO_PADRAO,
      situacao: mentor.situacao || SITUACAO_ATIVO,
      observacoes: mentor.observacoes || "",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, mentor?.id_usuario])

  const alterar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  /** O cadastro de mentor, no formato que a API espera. Comum aos dois modos. */
  const dadosDoPerfil = () => ({
    vinculo: form.vinculo,
    area: form.area,
    especialidades: form.especialidades,
    demandas: form.demandas,
    // "" e o campo vazio do formulario; o backend guarda ausencia como null, e
    // mandar "" gravaria zero horas de disponibilidade.
    horas_mes: form.horas_mes === "" ? null : Number(form.horas_mes),
    formato: form.formato,
    situacao: form.situacao,
    observacoes: form.observacoes,
  })

  const enviar = async (e) => {
    e.preventDefault()
    // O celular e validado aqui porque o <input> nao tem como saber o que e um
    // numero brasileiro completo; o resto (obrigatorios, e-mail) o proprio
    // formulario barra, e o backend confere tudo de novo.
    if (criando && !celularValido(form.celular)) {
      setAviso({ tipo: "error", texto: "Informe um celular válido, com DDD." })
      return
    }

    setSalvando(true)
    setAviso(null)
    try {
      if (criando) {
        await onCriar({
          nome: form.nome,
          email: form.email,
          // O banco guarda o celular sem mascara (VARCHAR(15)).
          celular: somenteDigitos(form.celular),
          senha: form.senha,
          ...dadosDoPerfil(),
        })
        // Quem fecha e a tela: ela precisa avisar que o mentor foi criado e
        // recarregar a listagem antes que o drawer suma.
        return
      }
      await onSalvar(mentor.id_usuario, dadosDoPerfil())
      setAviso({ tipo: "success", texto: "Cadastro salvo." })
    } catch (err) {
      setAviso({
        tipo: "error",
        texto:
          err.response?.data?.erro ||
          (criando ? "Não foi possível cadastrar o mentor." : "Não foi possível salvar o cadastro."),
      })
    } finally {
      setSalvando(false)
    }
  }

  const startups = detalhe?.startups?.length ?? mentor?.startups ?? 0
  // No cadastro novo os campos sao sempre editaveis: quem nao pode criar nao
  // chega a abrir este drawer (a tela nem oferece o botao).
  const editavel = criando || podeEditar

  return (
    <Drawer anchor="right" open={aberto} onClose={onFechar}>
      <Box
        component="form"
        onSubmit={enviar}
        sx={{ width: 520, maxWidth: "100vw", height: "100%", display: "flex", flexDirection: "column" }}
      >
        {/* ---- Quem e o mentor (leitura; o cadastro da pessoa e /usuarios) ---- */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, p: 3, pb: 2 }}>
          <Avatar
            src={mentor?.foto_url || undefined}
            sx={{ width: 52, height: 52, fontSize: 20, bgcolor: "primary.main" }}
          >
            {criando ? <SupervisorAccount /> : inicial(mentor?.nome)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" fontWeight={700} noWrap>
              {criando ? "Novo mentor" : mentor.nome}
            </Typography>
            {criando ? (
              <Typography variant="body2" color="text.secondary">
                Ele entra na incubadora já com o papel de mentor.
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {mentor.email}
                  {mentor.celular ? ` · ${formatarCelular(mentor.celular)}` : ""}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75 }}>
                  <ChipSituacaoMentor situacao={mentor.situacao} />
                  {mentor.desde && (
                    <Typography variant="caption" color="text.secondary">
                      Mentor desde {new Date(mentor.desde).toLocaleDateString("pt-BR")}
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>
          <IconButton size="small" onClick={onFechar}>
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Sem mentor ainda nao ha startup para vincular: no cadastro novo o
            painel e uma coisa so. */}
        {!criando && (
          <Tabs value={aba} onChange={(_, novo) => setAba(novo)} sx={{ px: 2 }}>
            <Tab value="cadastro" label="Cadastro" />
            <Tab value="startups" label={`Startups (${startups})`} />
          </Tabs>
        )}
        <Divider />

        {aba === "cadastro" ? (
          <>
            <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
              {aviso && (
                <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
                  {aviso.texto}
                </Alert>
              )}

              {!criando && !podeEditar && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Você pode ver o cadastro, mas não editá-lo.
                </Alert>
              )}

              {criando && (
                <Secao
                  titulo="Quem é"
                  descricao="Estes campos passam a ser editados em Usuários depois do cadastro."
                >
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        fullWidth
                        required
                        label="Nome"
                        value={form.nome}
                        onChange={(e) => alterar("nome", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth
                        required
                        label="Celular"
                        value={form.celular}
                        onChange={(e) => alterar("celular", mascararCelular(e.target.value))}
                        placeholder="(11) 98765-4321"
                        inputProps={{ maxLength: MAX_CELULAR, inputMode: "numeric" }}
                        error={Boolean(form.celular) && !celularValido(form.celular)}
                        helperText={
                          form.celular && !celularValido(form.celular)
                            ? "Informe o DDD e o número completo."
                            : undefined
                        }
                      />
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        fullWidth
                        required
                        type="email"
                        label="E-mail"
                        value={form.email}
                        onChange={(e) => alterar("email", e.target.value)}
                        helperText="É por ele que o mentor entra no sistema."
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        fullWidth
                        required
                        type="password"
                        label="Senha provisória"
                        value={form.senha}
                        onChange={(e) => alterar("senha", e.target.value)}
                        helperText="Ele será obrigado a trocá-la no primeiro login."
                      />
                    </Grid>
                  </Grid>
                </Secao>
              )}

              <Secao
                titulo={criando ? "O que ele atende" : undefined}
                descricao={
                  criando
                    ? "Tudo aqui é opcional e pode ser preenchido depois — mas é o que faz o mentor aparecer nos filtros de quem procura por especialidade."
                    : undefined
                }
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Status"
                      value={form.situacao}
                      disabled={!editavel}
                      onChange={(e) => alterar("situacao", e.target.value)}
                      helperText="Não afeta o acesso dele ao sistema."
                    >
                      {SITUACOES.map((s) => (
                        <MenuItem key={s.chave} value={s.chave}>
                          {s.rotulo}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      select
                      fullWidth
                      label="Formato"
                      value={form.formato}
                      disabled={!editavel}
                      onChange={(e) => alterar("formato", e.target.value)}
                      helperText="Como ele atende."
                    >
                      {FORMATOS.map((f) => (
                        <MenuItem key={f.chave} value={f.chave}>
                          {f.rotulo}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={7}>
                    <TextField
                      fullWidth
                      label="Vínculo institucional"
                      value={form.vinculo}
                      disabled={!editavel}
                      onChange={(e) => alterar("vinculo", e.target.value)}
                      placeholder="Professor UFPE, consultor externo, voluntário..."
                    />
                  </Grid>

                  <Grid item xs={12} sm={5}>
                    <TextField
                      fullWidth
                      label="Área / departamento"
                      value={form.area}
                      disabled={!editavel}
                      onChange={(e) => alterar("area", e.target.value)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <CampoTags
                      rotulo="Especialidades"
                      ajuda="Do que ele entende. As sugestões vêm do que já é usado na incubadora."
                      valor={form.especialidades}
                      opcoes={sugestoes.especialidades}
                      desabilitado={!editavel}
                      onChange={(v) => alterar("especialidades", v)}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <CampoTags
                      rotulo="Tipos de demanda que pode atender"
                      ajuda="O que a startup precisa e ele resolve: modelo de negócio, jurídico, captação..."
                      valor={form.demandas}
                      opcoes={sugestoes.demandas}
                      desabilitado={!editavel}
                      onChange={(v) => alterar("demandas", v)}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Disponibilidade estimada"
                      value={form.horas_mes}
                      disabled={!editavel}
                      onChange={(e) => alterar("horas_mes", e.target.value)}
                      inputProps={{ min: 0, max: 500 }}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">h/mês</InputAdornment>,
                      }}
                      helperText="O que ele declarou ter."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      label="Observações da coordenação"
                      value={form.observacoes}
                      disabled={!editavel}
                      onChange={(e) => alterar("observacoes", e.target.value)}
                      placeholder="O que não cabe nos campos acima: preferências, restrições, combinados."
                    />
                  </Grid>
                </Grid>
              </Secao>
            </Box>

            {editavel && (
              <>
                <Divider />
                <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
                  <Button onClick={onFechar} disabled={salvando}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained" disabled={salvando}>
                    {salvando ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : criando ? (
                      "Cadastrar mentor"
                    ) : (
                      "Salvar cadastro"
                    )}
                  </Button>
                </Box>
              </>
            )}
          </>
        ) : (
          <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
            <MentorPainel
              mentor={mentor}
              detalhe={detalhe}
              carregando={carregandoDetalhe}
              onVincular={onVincular}
              onDesvincular={onDesvincular}
            />
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
