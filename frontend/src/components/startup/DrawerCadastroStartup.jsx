/**
 * O cadastro de startup: um painel lateral direito que ocupa a altura inteira
 * da tela.
 *
 * ERA UM DIALOG de tres campos (nome, CNPJ, trilha). Com identificacao,
 * contatos, endereco, observacoes e os campos personalizaveis da incubadora, o
 * dialogo centralizado passaria a cobrir a lista e a rolar dentro de uma caixa
 * flutuante. O painel lateral resolve as duas coisas: a lista continua visivel
 * a esquerda (da para conferir se a startup ja existe enquanto se digita) e a
 * rolagem e a da propria coluna, com o cabecalho e as acoes fixos nas pontas.
 *
 * SERVE PARA CRIAR E PARA EDITAR. A unica diferenca e a TRILHA, que so aparece
 * no cadastro novo: matricular uma startup ja existente em outra trilha e
 * assunto do Construtor de Programa, nao de um campo escondido no meio do
 * endereco.
 *
 * Endpoints:
 *   POST /startups     -> cria
 *   PUT  /startups/:id -> atualiza
 *   ViaCEP (servico externo) -> preenche o endereco a partir do CEP
 */
import { useCallback, useEffect, useState } from "react"
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  TextField,
  MenuItem,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Chip,
} from "@mui/material"
import { Close, Add, DeleteOutline, Search, RocketLaunch } from "@mui/icons-material"
import api from "../../services/api"
import { buscarCep } from "../../services/viacep"
import { useStartupConfigStore } from "../../store/startupConfigStore"
import CampoPersonalizado, {
  valorParaFormulario,
  valorParaEnvio,
} from "../campos/CampoPersonalizado"
import {
  MAX_CNPJ,
  MAX_CEP,
  MAX_CELULAR,
  cnpjValido,
  cepValido,
  mascararCnpj,
  mascararCep,
  mascararCelular,
  somenteDigitos,
} from "../../utils/mascaras"

const FORM_VAZIO = {
  nome: "",
  cnpj: "",
  inscricao_estadual: "",
  email: "",
  tipo: "",
  situacao: "",
  observacoes: "",
  cep: "",
  uf: "",
  cidade: "",
  bairro: "",
  rua: "",
  numero: "",
  complemento: "",
  id_trilha: "",
}

const CONTATO_VAZIO = { nome: "", cargo: "", email: "", telefone: "", principal: false }

/** Cabecalho de secao — separa os blocos sem transformar o painel numa lista de abas. */
function Secao({ titulo, descricao, acao, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
            {titulo}
          </Typography>
          {descricao && (
            <Typography variant="caption" color="text.secondary">
              {descricao}
            </Typography>
          )}
        </Box>
        {acao}
      </Box>
      {children}
    </Box>
  )
}

export default function DrawerCadastroStartup({
  aberto,
  onFechar,
  idTenant,
  startup = null,
  trilhas = [],
  onSalvo,
}) {
  const editando = Boolean(startup)

  const tipos = useStartupConfigStore((s) => s.tipos) || []
  const situacoes = useStartupConfigStore((s) => s.situacoes) || []
  const campos = useStartupConfigStore((s) => s.campos) || []

  const [form, setForm] = useState(FORM_VAZIO)
  const [contatos, setContatos] = useState([])
  // Os campos personalizaveis vivem separados do resto do formulario: a chave
  // deles e definida pela incubadora e poderia colidir com "nome" ou "cep".
  const [extras, setExtras] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [aviso, setAviso] = useState(null)

  /**
   * Preenche o formulario ao abrir.
   *
   * Reprocessa a cada abertura (e nao so na montagem) porque o painel fica
   * montado entre uma edicao e outra: sem isto, abrir a segunda startup
   * mostraria os dados da primeira.
   */
  useEffect(() => {
    if (!aberto) return
    setAviso(null)

    if (editando) {
      setForm({
        ...FORM_VAZIO,
        nome: startup.nome || "",
        cnpj: mascararCnpj(startup.cnpj || ""),
        inscricao_estadual: startup.inscricao_estadual || "",
        email: startup.email || "",
        tipo: startup.tipo || "",
        situacao: startup.situacao || "",
        observacoes: startup.observacoes || "",
        cep: mascararCep(startup.cep || ""),
        uf: startup.uf || "",
        cidade: startup.cidade || "",
        bairro: startup.bairro || "",
        rua: startup.rua || "",
        numero: startup.numero || "",
        complemento: startup.complemento || "",
      })
      setContatos(
        (startup.contatos || []).map((c) => ({
          nome: c.nome || "",
          cargo: c.cargo || "",
          email: c.email || "",
          telefone: mascararCelular(c.telefone || ""),
          principal: Boolean(c.principal),
        }))
      )
      const guardados = startup.campos_extras || {}
      setExtras(
        Object.fromEntries(
          campos.map((campo) => [campo.chave, valorParaFormulario(campo, guardados[campo.chave])])
        )
      )
      return
    }

    // Cadastro novo: a situacao e a trilha ja vem sugeridas. Sao sugestoes —
    // os dois campos continuam editaveis.
    const trilhaPadrao = trilhas.find((t) => t.padrao) ?? trilhas[0]
    setForm({
      ...FORM_VAZIO,
      situacao: situacoes[0]?.chave || "",
      id_trilha: trilhaPadrao?.id_no ?? "",
    })
    setContatos([])
    setExtras(Object.fromEntries(campos.map((campo) => [campo.chave, ""])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, startup])

  const alterar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  // ------------------------------------------------------------------ CEP
  /**
   * Preenche cidade/UF/bairro/rua a partir do CEP.
   *
   * Dispara sozinho quando o oitavo digito entra — perguntar "quer buscar?"
   * seria um clique a mais para a unica coisa que se faz com um CEP completo.
   * O botao de lupa fica para reconsultar depois de uma correcao manual.
   *
   * NAO sobrescreve o numero nem o complemento: o ViaCEP nao os conhece, e
   * limpa-los apagaria o que a pessoa acabou de digitar.
   */
  const consultarCep = useCallback(async (cepDigitado) => {
    if (!cepValido(cepDigitado)) return
    setBuscandoCep(true)
    setAviso(null)
    try {
      const endereco = await buscarCep(cepDigitado)
      if (!endereco) {
        setAviso({ tipo: "warning", texto: "CEP não encontrado. Confira os números ou preencha o endereço à mão." })
        return
      }
      setForm((f) => ({
        ...f,
        uf: endereco.uf || f.uf,
        cidade: endereco.cidade || f.cidade,
        bairro: endereco.bairro || f.bairro,
        rua: endereco.rua || f.rua,
      }))
    } catch {
      // Rede fora e coisa diferente de CEP inexistente: aqui o endereco pode
      // estar certo, so nao deu para conferir.
      setAviso({ tipo: "warning", texto: "Não foi possível consultar o CEP agora. Você pode preencher o endereço à mão." })
    } finally {
      setBuscandoCep(false)
    }
  }, [])

  const alterarCep = (valor) => {
    const mascarado = mascararCep(valor)
    alterar("cep", mascarado)
    if (cepValido(mascarado)) consultarCep(mascarado)
  }

  // ------------------------------------------------------------- contatos
  const adicionarContato = () =>
    setContatos((lista) => [...lista, { ...CONTATO_VAZIO, principal: lista.length === 0 }])

  const alterarContato = (indice, campo, valor) =>
    setContatos((lista) => lista.map((c, i) => (i === indice ? { ...c, [campo]: valor } : c)))

  /** Principal e exclusivo: marcar um desmarca o anterior, sem precisar explicar. */
  const definirPrincipal = (indice) =>
    setContatos((lista) => lista.map((c, i) => ({ ...c, principal: i === indice })))

  const removerContato = (indice) =>
    setContatos((lista) => {
      const restante = lista.filter((_, i) => i !== indice)
      // Removeu justamente o principal: o primeiro assume, para o card da
      // startup nao ficar sem ninguem para mostrar.
      if (restante.length > 0 && !restante.some((c) => c.principal)) restante[0].principal = true
      return restante
    })

  // --------------------------------------------------------------- salvar
  const salvar = async (e) => {
    e.preventDefault()

    if (form.cnpj && !cnpjValido(form.cnpj)) {
      setAviso({ tipo: "error", texto: "CNPJ inválido — confira os números digitados." })
      return
    }
    if (form.cep && !cepValido(form.cep)) {
      setAviso({ tipo: "error", texto: "CEP incompleto — informe os 8 dígitos ou deixe em branco." })
      return
    }

    setSalvando(true)
    setAviso(null)
    try {
      const corpo = {
        ...form,
        // Sem mascara: as colunas guardam so os digitos.
        cnpj: somenteDigitos(form.cnpj) || null,
        cep: somenteDigitos(form.cep) || null,
        inscricao_estadual: somenteDigitos(form.inscricao_estadual) || null,
        contatos: contatos.map((c) => ({ ...c, telefone: somenteDigitos(c.telefone) || null })),
        campos_extras: Object.fromEntries(
          campos.map((campo) => [campo.chave, valorParaEnvio(campo, extras[campo.chave])])
        ),
      }
      delete corpo.id_trilha

      if (editando) {
        await api.put(`/startups/${startup.id_startup}`, corpo)
      } else {
        await api.post("/startups", { ...corpo, id_tenant: idTenant, id_trilha: form.id_trilha || null })
      }

      onSalvo?.()
      onFechar()
    } catch (err) {
      setAviso({
        tipo: "error",
        texto: err.response?.data?.erro || "Erro ao salvar a startup.",
      })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={onFechar}
      PaperProps={{
        sx: {
          // Ocupa a altura inteira (padrao do Drawer) e uma coluna confortavel
          // na largura. No celular vira tela cheia: 520px nao cabem la.
          width: { xs: "100%", sm: 520 },
          borderRadius: 0,
        },
      }}
    >
      <Box
        component="form"
        onSubmit={salvar}
        sx={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        {/* CABECALHO — fixo: com o formulario longo, o titulo sairia da tela
            na primeira rolagem e o painel ficaria sem contexto. */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            <RocketLaunch sx={{ color: "primary.main" }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={700} noWrap>
                {editando ? "Editar startup" : "Nova startup"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {editando ? startup.nome : "Cadastro completo da empresa incubada."}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onFechar} size="small">
            <Close />
          </IconButton>
        </Box>

        {/* CORPO — a unica parte que rola. */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
          {aviso && (
            <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
              {aviso.texto}
            </Alert>
          )}

          <Secao titulo="Identificação" descricao="Quem é a empresa, do ponto de vista formal.">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Nome"
                  fullWidth
                  required
                  autoFocus
                  size="small"
                  value={form.nome}
                  onChange={(e) => alterar("nome", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={7}>
                <TextField
                  label="CNPJ"
                  fullWidth
                  size="small"
                  value={form.cnpj}
                  onChange={(e) => alterar("cnpj", mascararCnpj(e.target.value))}
                  placeholder="12.345.678/0001-95"
                  inputProps={{ maxLength: MAX_CNPJ, inputMode: "numeric" }}
                  error={Boolean(form.cnpj) && !cnpjValido(form.cnpj)}
                  helperText={form.cnpj && !cnpjValido(form.cnpj) ? "CNPJ inválido." : "Opcional."}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Inscrição estadual"
                  fullWidth
                  size="small"
                  value={form.inscricao_estadual}
                  onChange={(e) =>
                    alterar("inscricao_estadual", somenteDigitos(e.target.value).slice(0, 20))
                  }
                  inputProps={{ inputMode: "numeric" }}
                  // Cada UF tem o proprio formato e o proprio digito
                  // verificador: mascara fixa aqui recusaria IE valida de
                  // metade do pais.
                  helperText="Somente números."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="E-mail da startup"
                  type="email"
                  fullWidth
                  size="small"
                  value={form.email}
                  onChange={(e) => alterar("email", e.target.value)}
                  placeholder="contato@startup.com.br"
                  helperText="O e-mail institucional, não o pessoal de quem responde."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Tipo"
                  fullWidth
                  size="small"
                  value={form.tipo}
                  onChange={(e) => alterar("tipo", e.target.value)}
                  disabled={tipos.length === 0}
                  helperText={
                    tipos.length === 0
                      ? "Cadastre os tipos em Configurações."
                      : "Definido pela sua incubadora."
                  }
                >
                  <MenuItem value="">
                    <em>Não informado</em>
                  </MenuItem>
                  {tipos.map((t) => (
                    <MenuItem key={t.chave} value={t.chave}>
                      {t.rotulo}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Status"
                  fullWidth
                  required
                  size="small"
                  value={form.situacao}
                  onChange={(e) => alterar("situacao", e.target.value)}
                  disabled={situacoes.length === 0}
                  helperText="Definido pela sua incubadora."
                >
                  {situacoes.map((s) => (
                    <MenuItem key={s.chave} value={s.chave}>
                      {s.rotulo}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Trilha so no cadastro novo — ver o comentario do topo. */}
              {!editando && (
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Trilha"
                    fullWidth
                    size="small"
                    value={form.id_trilha}
                    onChange={(e) => alterar("id_trilha", e.target.value)}
                    disabled={trilhas.length === 0}
                    helperText={
                      trilhas.length === 0
                        ? "Sua incubadora ainda não tem trilhas. A startup será criada sem trilha."
                        : "A trilha padrão já vem escolhida — troque se esta startup começa em outra."
                    }
                  >
                    <MenuItem value="">
                      <em>Sem trilha por enquanto</em>
                    </MenuItem>
                    {trilhas.map((t) => (
                      <MenuItem key={t.id_no} value={t.id_no}>
                        {t.nome}
                        {t.padrao ? " (padrão)" : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
            </Grid>
          </Secao>

          <Divider sx={{ mb: 3 }} />

          <Secao
            titulo="Contatos"
            descricao="Quem falar dentro da startup."
            acao={
              <Button size="small" startIcon={<Add />} onClick={adicionarContato}>
                Adicionar
              </Button>
            }
          >
            {contatos.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                Nenhum contato ainda.
              </Typography>
            ) : (
              contatos.map((contato, indice) => (
                <Box
                  key={indice}
                  sx={{
                    border: 1,
                    borderColor: contato.principal ? "primary.main" : "divider",
                    p: 2,
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                    <Chip
                      size="small"
                      label={contato.principal ? "Principal" : `Contato ${indice + 1}`}
                      color={contato.principal ? "primary" : "default"}
                      variant={contato.principal ? "filled" : "outlined"}
                      onClick={contato.principal ? undefined : () => definirPrincipal(indice)}
                    />
                    <Tooltip title="Remover contato">
                      <IconButton size="small" onClick={() => removerContato(indice)}>
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        label="Nome"
                        fullWidth
                        size="small"
                        value={contato.nome}
                        onChange={(e) => alterarContato(indice, "nome", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        label="Cargo"
                        fullWidth
                        size="small"
                        value={contato.cargo}
                        onChange={(e) => alterarContato(indice, "cargo", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      <TextField
                        label="E-mail"
                        type="email"
                        fullWidth
                        size="small"
                        value={contato.email}
                        onChange={(e) => alterarContato(indice, "email", e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={5}>
                      <TextField
                        label="Telefone"
                        fullWidth
                        size="small"
                        value={contato.telefone}
                        onChange={(e) =>
                          alterarContato(indice, "telefone", mascararCelular(e.target.value))
                        }
                        inputProps={{ maxLength: MAX_CELULAR, inputMode: "numeric" }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              ))
            )}
          </Secao>

          <Divider sx={{ mb: 3 }} />

          <Secao titulo="Endereço" descricao="Digite o CEP e o resto se preenche sozinho.">
            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="CEP"
                  fullWidth
                  size="small"
                  value={form.cep}
                  onChange={(e) => alterarCep(e.target.value)}
                  placeholder="01310-100"
                  inputProps={{ maxLength: MAX_CEP, inputMode: "numeric" }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {buscandoCep ? (
                          <CircularProgress size={16} />
                        ) : (
                          <Tooltip title="Buscar endereço pelo CEP">
                            {/* span: o Tooltip precisa de um filho que aceite
                                ref mesmo com o botao desabilitado. */}
                            <span>
                              <IconButton
                                size="small"
                                edge="end"
                                disabled={!cepValido(form.cep)}
                                onClick={() => consultarCep(form.cep)}
                              >
                                <Search fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={8} sm={5}>
                <TextField
                  label="Cidade"
                  fullWidth
                  size="small"
                  value={form.cidade}
                  onChange={(e) => alterar("cidade", e.target.value)}
                />
              </Grid>
              <Grid item xs={4} sm={2}>
                <TextField
                  label="UF"
                  fullWidth
                  size="small"
                  value={form.uf}
                  onChange={(e) => alterar("uf", e.target.value.toUpperCase().slice(0, 2))}
                  inputProps={{ maxLength: 2 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bairro"
                  fullWidth
                  size="small"
                  value={form.bairro}
                  onChange={(e) => alterar("bairro", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Rua"
                  fullWidth
                  size="small"
                  value={form.rua}
                  onChange={(e) => alterar("rua", e.target.value)}
                />
              </Grid>
              <Grid item xs={5} sm={4}>
                <TextField
                  label="Número"
                  fullWidth
                  size="small"
                  value={form.numero}
                  onChange={(e) => alterar("numero", e.target.value)}
                />
              </Grid>
              <Grid item xs={7} sm={8}>
                <TextField
                  label="Complemento"
                  fullWidth
                  size="small"
                  value={form.complemento}
                  onChange={(e) => alterar("complemento", e.target.value)}
                  placeholder="Sala, andar, bloco..."
                />
              </Grid>
            </Grid>
          </Secao>

          {/* Os campos que a propria incubadora criou. A secao inteira some
              quando nao ha nenhum — um titulo sobre o vazio so ocuparia
              espaco. */}
          {campos.length > 0 && (
            <>
              <Divider sx={{ mb: 3 }} />
              <Secao
                titulo="Informações complementares"
                descricao="Campos definidos pela sua incubadora."
              >
                <Grid container spacing={2}>
                  {campos.map((campo) => (
                    <Grid item xs={12} sm={campo.tipo === "TEXTO" && campo.config?.multilinha ? 12 : 6} key={campo.chave}>
                      <CampoPersonalizado
                        campo={campo}
                        valor={extras[campo.chave]}
                        onChange={(valor) => setExtras((e) => ({ ...e, [campo.chave]: valor }))}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Secao>
            </>
          )}

          <Divider sx={{ mb: 3 }} />

          <Secao titulo="Observações" descricao="Contexto que não cabe em nenhum campo acima.">
            <TextField
              fullWidth
              multiline
              minRows={4}
              size="small"
              value={form.observacoes}
              onChange={(e) => alterar("observacoes", e.target.value)}
              placeholder="Histórico, acordos, pontos de atenção..."
            />
          </Secao>
        </Box>

        {/* ACOES — fixas no rodape, para "Salvar" nao exigir rolar ate o fim. */}
        <Box
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            justifyContent: "flex-end",
            gap: 1,
            borderTop: 1,
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Button onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={salvando}>
            {salvando ? <CircularProgress size={22} color="inherit" /> : "Salvar"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
