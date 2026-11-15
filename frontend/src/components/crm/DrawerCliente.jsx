/**
 * Cadastro e edicao de cliente do CRM.
 *
 * Os campos ficam em `CamposCliente`, exportado: a oportunidade criada com um
 * cliente NOVO usa os mesmos campos, e o backend grava os dois na mesma
 * transacao.
 *
 * Pessoa juridica nao tem "empresa" nem "cargo": o proprio cliente e a
 * empresa. O backend descarta os dois para PJ; aqui eles nem aparecem.
 */
import { useEffect, useState } from "react"
import { Alert, Autocomplete, Grid, MenuItem, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material"
import { PainelCadastro, Secao } from "./FormCrm"
import { useCrm } from "./useCrm"
import { STATUS_CLIENTE, mascararDocumento } from "../../data/crmMeta"
import { mascararCelular, somenteDigitos } from "../../utils/mascaras"

export const clienteVazio = () => ({
  tipo_pessoa: "PF",
  nome: "",
  documento: "",
  email: "",
  telefone: "",
  whatsapp: "",
  empresa: "",
  cargo: "",
  origem: "",
  status: "LEAD",
  observacoes: "",
})

/** O cliente da API no formato do formulario (mascaras aplicadas). */
export function clienteParaForm(c) {
  if (!c) return clienteVazio()
  return {
    tipo_pessoa: c.tipo_pessoa || "PF",
    nome: c.nome || "",
    documento: c.documento ? mascararDocumento(c.documento, c.tipo_pessoa) : "",
    email: c.email || "",
    telefone: c.telefone ? mascararCelular(c.telefone) : "",
    whatsapp: c.whatsapp ? mascararCelular(c.whatsapp) : "",
    empresa: c.empresa || "",
    cargo: c.cargo || "",
    origem: c.origem || "",
    status: c.status || "LEAD",
    observacoes: c.observacoes || "",
  }
}

/** Erros de preenchimento que nao precisam do servidor para serem ditos. */
export function validarCliente(f) {
  const erros = {}
  if (!f.nome.trim()) erros.nome = "Informe o nome do cliente."
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) erros.email = "E-mail inválido."
  const doc = somenteDigitos(f.documento)
  if (doc && doc.length !== (f.tipo_pessoa === "PJ" ? 14 : 11)) {
    erros.documento = f.tipo_pessoa === "PJ" ? "O CNPJ tem 14 dígitos." : "O CPF tem 11 dígitos."
  }
  for (const campo of ["telefone", "whatsapp"]) {
    const d = somenteDigitos(f[campo])
    if (d && (d.length < 10 || d.length > 11)) erros[campo] = "Informe o DDD e o número."
  }
  return erros
}

/** O formulario no formato da API (so digitos nos documentos e telefones). */
export function clienteParaApi(f) {
  return {
    ...f,
    documento: somenteDigitos(f.documento) || null,
    telefone: somenteDigitos(f.telefone) || null,
    whatsapp: somenteDigitos(f.whatsapp) || null,
  }
}

export function CamposCliente({ valor, onChange, erros = {}, prefixoId = "cliente" }) {
  const alterar = (campo, v) => onChange({ ...valor, [campo]: v })
  const pj = valor.tipo_pessoa === "PJ"

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={valor.tipo_pessoa}
          onChange={(_, v) => v && onChange({ ...valor, tipo_pessoa: v, documento: mascararDocumento(valor.documento, v) })}
          aria-label="Tipo de pessoa"
          sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, px: 2, letterSpacing: 0 } }}
        >
          <ToggleButton value="PF">Pessoa física</ToggleButton>
          <ToggleButton value="PJ">Pessoa jurídica</ToggleButton>
        </ToggleButtonGroup>
      </Grid>
      <Grid item xs={12} sm={pj ? 7 : 12}>
        <TextField
          id={`${prefixoId}-nome`}
          label={pj ? "Razão social ou nome fantasia" : "Nome"}
          required
          fullWidth
          size="small"
          value={valor.nome}
          onChange={(e) => alterar("nome", e.target.value)}
          error={Boolean(erros.nome)}
          helperText={erros.nome}
          inputProps={{ maxLength: 150 }}
        />
      </Grid>
      <Grid item xs={12} sm={pj ? 5 : 6}>
        <TextField
          label={pj ? "CNPJ" : "CPF"}
          fullWidth
          size="small"
          value={valor.documento}
          onChange={(e) => alterar("documento", mascararDocumento(e.target.value, valor.tipo_pessoa))}
          error={Boolean(erros.documento)}
          helperText={erros.documento || "Opcional"}
          inputProps={{ inputMode: "numeric" }}
        />
      </Grid>
      <Grid item xs={12} sm={pj ? 12 : 6}>
        <TextField
          label="E-mail"
          type="email"
          fullWidth
          size="small"
          value={valor.email}
          onChange={(e) => alterar("email", e.target.value)}
          error={Boolean(erros.email)}
          helperText={erros.email}
          inputProps={{ maxLength: 150 }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="Telefone"
          fullWidth
          size="small"
          value={valor.telefone}
          onChange={(e) => alterar("telefone", mascararCelular(e.target.value))}
          error={Boolean(erros.telefone)}
          helperText={erros.telefone}
          inputProps={{ inputMode: "tel" }}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="WhatsApp"
          fullWidth
          size="small"
          value={valor.whatsapp}
          onChange={(e) => alterar("whatsapp", mascararCelular(e.target.value))}
          error={Boolean(erros.whatsapp)}
          helperText={erros.whatsapp}
          inputProps={{ inputMode: "tel" }}
        />
      </Grid>
      {!pj && (
        <>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Empresa"
              fullWidth
              size="small"
              value={valor.empresa}
              onChange={(e) => alterar("empresa", e.target.value)}
              helperText="Onde a pessoa trabalha, se for o caso"
              inputProps={{ maxLength: 150 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Cargo"
              fullWidth
              size="small"
              value={valor.cargo}
              onChange={(e) => alterar("cargo", e.target.value)}
              inputProps={{ maxLength: 100 }}
            />
          </Grid>
        </>
      )}

    </Grid>
  )
}

/** Origem, status e observacoes: o lado comercial do cadastro. */
export function CamposComerciaisCliente({ valor, onChange, origens = [] }) {
  const alterar = (campo, v) => onChange({ ...valor, [campo]: v })
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6}>
        <Autocomplete
          freeSolo
          size="small"
          options={origens}
          value={valor.origem}
          onInputChange={(_, v) => alterar("origem", v)}
          renderInput={(params) => (
            <TextField {...params} label="Origem" helperText="Como o cliente chegou até vocês" inputProps={{ ...params.inputProps, maxLength: 60 }} />
          )}
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField select label="Status" fullWidth size="small" value={valor.status} onChange={(e) => alterar("status", e.target.value)}>
          {Object.entries(STATUS_CLIENTE).map(([chave, meta]) => (
            <MenuItem key={chave} value={chave}>
              {meta.rotulo}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Observações"
          fullWidth
          multiline
          minRows={3}
          size="small"
          value={valor.observacoes}
          onChange={(e) => alterar("observacoes", e.target.value)}
          inputProps={{ maxLength: 5000 }}
        />
      </Grid>
    </Grid>
  )
}

export default function DrawerCliente({ aberto, onFechar, cliente = null, onSalvo }) {
  const { api, origens, falha, avisar } = useCrm()
  const [form, setForm] = useState(clienteVazio)
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const editando = Boolean(cliente)

  useEffect(() => {
    if (!aberto) return
    setForm(clienteParaForm(cliente))
    setErros({})
    setErro(null)
  }, [aberto, cliente])

  const salvar = async () => {
    const encontrados = validarCliente(form)
    setErros(encontrados)
    if (Object.keys(encontrados).length) return
    setSalvando(true)
    setErro(null)
    try {
      const corpo = clienteParaApi(form)
      const salvo = editando ? await api.atualizarCliente(cliente.id_cliente, corpo) : await api.criarCliente(corpo)
      avisar("success", editando ? "Cliente atualizado." : "Cliente cadastrado.")
      onSalvo?.(salvo)
      onFechar()
    } catch (err) {
      setErro(falha(err, "Não foi possível salvar o cliente."))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <PainelCadastro
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? "Editar cliente" : "Novo cliente"}
      subtitulo={editando ? cliente.nome : "Pessoa ou empresa com quem a startup negocia."}
      idForm="form-crm-cliente"
      onEnviar={salvar}
      salvando={salvando}
      rotuloSalvar={editando ? "Salvar alterações" : "Cadastrar cliente"}
    >
      {erro && (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}
      <Secao id="secao-cliente-principal" titulo="Informações principais" primeira>
        <CamposCliente valor={form} onChange={setForm} erros={erros} />
      </Secao>
      <Secao id="secao-cliente-comercial" titulo="Informações comerciais">
        <CamposComerciaisCliente valor={form} onChange={setForm} origens={origens} />
      </Secao>
    </PainelCadastro>
  )
}
