/**
 * Cadastro e edicao de oportunidade.
 *
 * O CLIENTE e um que ja existe ou um NOVO, cadastrado aqui mesmo: o backend
 * cria os dois na mesma transacao (POST /oportunidades com `novo_cliente`), e
 * se o cliente falhar a oportunidade nao nasce orfa.
 *
 * Na EDICAO o formulario manda o cadastro inteiro, e o backend compara campo a
 * campo: so o que mudou vira evento no historico. A etapa so aparece com a
 * oportunidade aberta — encerrada, ela nao anda no funil.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Alert,
  Autocomplete,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import { CampoDinheiro, PainelCadastro, Secao } from "./FormCrm"
import { CamposCliente, clienteParaApi, clienteVazio, validarCliente } from "./DrawerCliente"
import { useCrm } from "./useCrm"
import { AvatarResponsavel } from "../tarefas/MarcadoresTarefa"

function vazio(idUsuario, etapaInicial) {
  return {
    titulo: "",
    id_cliente: null,
    descricao: "",
    valor_estimado: null,
    probabilidade: "",
    previsao_fechamento: "",
    id_etapa: etapaInicial || "",
    origem: "",
    id_responsavel: idUsuario || null,
    observacoes: "",
  }
}

function paraForm(op) {
  return {
    titulo: op.titulo || "",
    id_cliente: op.id_cliente,
    descricao: op.descricao || "",
    valor_estimado: op.valor_estimado,
    probabilidade: op.probabilidade ?? "",
    previsao_fechamento: op.previsao_fechamento || "",
    id_etapa: op.id_etapa,
    origem: op.origem || "",
    id_responsavel: op.id_responsavel,
    observacoes: op.observacoes || "",
  }
}

export default function DrawerOportunidade({
  aberto,
  onFechar,
  oportunidade = null,
  // Ao criar a partir de um cliente (tela dele) ou de uma coluna do kanban.
  idClienteInicial = null,
  idEtapaInicial = null,
  onSalvo,
}) {
  const { api, membros, etapasAtivas, origens, idUsuario, falha, avisar } = useCrm()
  const editando = Boolean(oportunidade)

  const [form, setForm] = useState(() => vazio(idUsuario))
  const [modoCliente, setModoCliente] = useState("existente")
  const [novoCliente, setNovoCliente] = useState(clienteVazio)
  const [clientes, setClientes] = useState([])
  const [erros, setErros] = useState({})
  const [errosCliente, setErrosCliente] = useState({})
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setForm(editando ? paraForm(oportunidade) : { ...vazio(idUsuario, idEtapaInicial || etapasAtivas[0]?.id_etapa), id_cliente: idClienteInicial })
    setModoCliente("existente")
    setNovoCliente(clienteVazio())
    setErros({})
    setErrosCliente({})
    setErro(null)
    api
      .clientes()
      .then(setClientes)
      .catch((err) => setErro(falha(err, "Não foi possível carregar os clientes.")))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, oportunidade])

  const alterar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }))
  }

  // O responsavel atual pode ter saido da startup: continua na lista para nao
  // sumir do campo (o backend so recusa quem e escolhido de novo).
  const opcoesResponsavel = useMemo(() => {
    const lista = [...membros]
    if (oportunidade?.id_responsavel && !lista.some((m) => m.id_usuario === oportunidade.id_responsavel)) {
      lista.push({ id_usuario: oportunidade.id_responsavel, nome: oportunidade.responsavel_nome || "Ex-membro" })
    }
    return lista
  }, [membros, oportunidade])

  const clienteSelecionado = clientes.find((c) => c.id_cliente === form.id_cliente) || null
  const responsavelSelecionado = opcoesResponsavel.find((m) => m.id_usuario === form.id_responsavel) || null
  const mostrarEtapa = !editando || oportunidade?.situacao === "ABERTA"

  const salvar = async () => {
    const encontrados = {}
    if (!form.titulo.trim()) encontrados.titulo = "Dê um nome à oportunidade."
    if (form.probabilidade !== "" && (Number(form.probabilidade) < 0 || Number(form.probabilidade) > 100)) {
      encontrados.probabilidade = "Entre 0 e 100."
    }
    let errosNovo = {}
    if (!editando && modoCliente === "novo") errosNovo = validarCliente(novoCliente)
    else if (!form.id_cliente) encontrados.id_cliente = "Escolha o cliente ou cadastre um novo."
    setErros(encontrados)
    setErrosCliente(errosNovo)
    if (Object.keys(encontrados).length || Object.keys(errosNovo).length) return

    const corpo = {
      titulo: form.titulo,
      descricao: form.descricao,
      valor_estimado: form.valor_estimado,
      probabilidade: form.probabilidade === "" ? null : Number(form.probabilidade),
      previsao_fechamento: form.previsao_fechamento || null,
      origem: form.origem,
      id_responsavel: form.id_responsavel,
      observacoes: form.observacoes,
      ...(mostrarEtapa && form.id_etapa ? { id_etapa: form.id_etapa } : {}),
    }
    if (!editando && modoCliente === "novo") corpo.novo_cliente = clienteParaApi(novoCliente)
    else corpo.id_cliente = form.id_cliente

    setSalvando(true)
    setErro(null)
    try {
      const salva = editando
        ? await api.atualizarOportunidade(oportunidade.id_oportunidade, corpo)
        : await api.criarOportunidade(corpo)
      avisar("success", editando ? "Oportunidade atualizada." : "Oportunidade criada.")
      onSalvo?.(salva)
      onFechar()
    } catch (err) {
      setErro(falha(err, "Não foi possível salvar a oportunidade."))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <PainelCadastro
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? "Editar oportunidade" : "Nova oportunidade"}
      subtitulo={editando ? oportunidade.titulo : "Uma negociação que a startup quer fechar."}
      idForm="form-crm-oportunidade"
      onEnviar={salvar}
      salvando={salvando}
      rotuloSalvar={editando ? "Salvar alterações" : "Criar oportunidade"}
      largura={600}
    >
      {erro && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Secao id="secao-op-negocio" titulo="A negociação" primeira>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Nome da oportunidade"
              required
              fullWidth
              size="small"
              autoFocus={!editando}
              placeholder="Ex.: Desenvolvimento de website"
              value={form.titulo}
              onChange={(e) => alterar("titulo", e.target.value)}
              error={Boolean(erros.titulo)}
              helperText={erros.titulo}
              inputProps={{ maxLength: 150 }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Descrição"
              fullWidth
              multiline
              minRows={2}
              size="small"
              value={form.descricao}
              onChange={(e) => alterar("descricao", e.target.value)}
              inputProps={{ maxLength: 5000 }}
            />
          </Grid>
        </Grid>
      </Secao>

      <Secao id="secao-op-cliente" titulo="Cliente">
        {!editando && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={modoCliente}
            onChange={(_, v) => v && setModoCliente(v)}
            aria-label="Cliente existente ou novo"
            sx={{ mb: 2, "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 2, letterSpacing: 0 } }}
          >
            <ToggleButton value="existente">Cliente já cadastrado</ToggleButton>
            <ToggleButton value="novo">Cadastrar novo cliente</ToggleButton>
          </ToggleButtonGroup>
        )}

        {!editando && modoCliente === "novo" ? (
          <CamposCliente valor={novoCliente} onChange={setNovoCliente} erros={errosCliente} prefixoId="op-novo-cliente" />
        ) : (
          <Autocomplete
            size="small"
            options={clientes}
            value={clienteSelecionado}
            onChange={(_, c) => alterar("id_cliente", c ? c.id_cliente : null)}
            getOptionLabel={(c) => c.nome || ""}
            isOptionEqualToValue={(a, b) => a.id_cliente === b.id_cliente}
            noOptionsText="Nenhum cliente encontrado"
            renderOption={(props, c) => {
              const { key, ...resto } = props
              return (
                <li key={key} {...resto}>
                  <span>
                    {c.nome}
                    {(c.empresa || c.email) && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {[c.empresa, c.email].filter(Boolean).join(" · ")}
                      </Typography>
                    )}
                  </span>
                </li>
              )
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Cliente"
                required
                error={Boolean(erros.id_cliente)}
                helperText={erros.id_cliente || (editando ? "Trocar o cliente fica registrado no histórico." : undefined)}
              />
            )}
          />
        )}
      </Secao>

      <Secao id="secao-op-comercial" titulo="Informações comerciais">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <CampoDinheiro label="Valor estimado" valor={form.valor_estimado} onChange={(v) => alterar("valor_estimado", v)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Probabilidade de conversão"
              type="number"
              fullWidth
              size="small"
              value={form.probabilidade}
              onChange={(e) => alterar("probabilidade", e.target.value)}
              error={Boolean(erros.probabilidade)}
              helperText={erros.probabilidade}
              inputProps={{ min: 0, max: 100, step: 5 }}
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Previsão de fechamento"
              type="date"
              fullWidth
              size="small"
              value={form.previsao_fechamento}
              onChange={(e) => alterar("previsao_fechamento", e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          {mostrarEtapa && (
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label={editando ? "Etapa" : "Etapa inicial"}
                fullWidth
                size="small"
                value={form.id_etapa || ""}
                onChange={(e) => alterar("id_etapa", e.target.value)}
              >
                {etapasAtivas.map((e) => (
                  <MenuItem key={e.id_etapa} value={e.id_etapa}>
                    {e.nome}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              size="small"
              options={origens}
              value={form.origem}
              onInputChange={(_, v) => alterar("origem", v)}
              renderInput={(params) => <TextField {...params} label="Origem" inputProps={{ ...params.inputProps, maxLength: 60 }} />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              size="small"
              options={opcoesResponsavel}
              value={responsavelSelecionado}
              onChange={(_, m) => alterar("id_responsavel", m ? m.id_usuario : null)}
              getOptionLabel={(m) => m.nome || ""}
              isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
              renderOption={(props, m) => {
                const { key, ...resto } = props
                return (
                  <li key={key} {...resto}>
                    <AvatarResponsavel nome={m.nome} foto={m.foto_url} comNome />
                  </li>
                )
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Responsável"
                  placeholder="Ninguém"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: responsavelSelecionado ? (
                      <InputAdornment position="start" sx={{ ml: 0.5, mr: 0 }}>
                        <AvatarResponsavel nome={responsavelSelecionado.nome} foto={responsavelSelecionado.foto_url} tamanho={22} dica={false} />
                      </InputAdornment>
                    ) : null,
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Observações"
              fullWidth
              multiline
              minRows={2}
              size="small"
              value={form.observacoes}
              onChange={(e) => alterar("observacoes", e.target.value)}
              inputProps={{ maxLength: 5000 }}
            />
          </Grid>
        </Grid>
      </Secao>
    </PainelCadastro>
  )
}
