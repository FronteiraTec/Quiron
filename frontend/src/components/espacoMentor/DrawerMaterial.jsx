/**
 * Um material do Espaco do Mentor: um drawer a direita, para criar e para
 * editar — o mesmo desenho do DrawerMentor e do cadastro de startup.
 *
 * SERVE AS DUAS BIBLIOTECAS (`escopo`): a PESSOAL do mentor e a que a
 * INCUBADORA publica para os mentores (migracao 021). O formulario e o mesmo —
 * arquivo ou link, titulo, descricao, categoria —; o que muda e para onde ele
 * grava e o que se mostra na edicao: na pessoal, para onde o material ja foi;
 * na da incubadora, quem publicou e quem mexeu por ultimo.
 *
 * O ARQUIVO SOBE NO SALVAR, nao ao escolher: escolher e voltar atras nao pode
 * deixar um arquivo orfao no servidor. Ele vai pelo caminho de upload de todo o
 * sistema (POST /arquivos, PRIVADO), com os mesmos tipos e o mesmo teto — o
 * seletor ja filtra os tipos, e o tamanho e conferido aqui antes de enviar,
 * para a pessoa saber na hora, e nao depois de esperar o upload.
 *
 * NA EDICAO, o drawer mostra para onde o material ja foi ("Compartilhado com")
 * e oferece arquivar/reativar. Trocar o arquivo de um material compartilhado e
 * o caso feliz: as startups passam a abrir a versao nova sem ninguem
 * compartilhar de novo.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material"
import {
  Close,
  UploadFile,
  Link as LinkIcon,
  InsertDriveFile,
  Inventory2Outlined,
  Unarchive,
  Share,
  Download,
} from "@mui/icons-material"
import { enviarArquivo, abrirArquivo, formatarTamanho } from "../../services/arquivos"
import {
  bibliotecaPessoal,
  erroDe,
  materiaisIncubadora,
  urlArquivoDoMaterial,
  urlArquivoDoMaterialIncubadora,
} from "../../hooks/useEspacoMentor"
import {
  ACEITOS,
  LIMITE_ARQUIVO,
  LIMITE_ARQUIVO_MB,
  dataBR,
  sugestoesDeCategoria,
} from "../../data/espacoMentorMeta"

const VAZIO = { tipo: "ARQUIVO", titulo: "", descricao: "", categoria: "", url: "" }

/** O que muda entre as duas bibliotecas. */
const ESCOPOS = {
  PESSOAL: {
    servico: bibliotecaPessoal,
    urlArquivo: urlArquivoDoMaterial,
    tituloNovo: "Novo material",
    tituloEditar: "Editar material",
    placeholderDescricao: "Para que serve, quando você costuma usar.",
  },
  INCUBADORA: {
    servico: materiaisIncubadora,
    urlArquivo: urlArquivoDoMaterialIncubadora,
    tituloNovo: "Publicar para os mentores",
    tituloEditar: "Editar material dos mentores",
    placeholderDescricao: "Para que os mentores devem usar este material.",
  },
}

export default function DrawerMaterial({
  aberto,
  material,
  idTenant,
  categorias = [],
  escopo = "PESSOAL",
  podeCompartilhar,
  // Na biblioteca pessoal: a pasta aberta no explorador, onde o material novo
  // nasce (migracao 025), e o tipo ja escolhido no menu "Novo".
  idPasta = null,
  tipoInicial = "ARQUIVO",
  onFechar,
  onSalvo,
  onCompartilhar,
}) {
  const cfg = ESCOPOS[escopo]
  const pessoal = escopo === "PESSOAL"
  const editando = Boolean(material)
  const [form, setForm] = useState(VAZIO)
  const [arquivo, setArquivo] = useState(null) // File escolhido agora
  const [detalhe, setDetalhe] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [tocado, setTocado] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!aberto) return
    setErro(null)
    setTocado(false)
    setArquivo(null)
    setDetalhe(null)
    setForm(
      material
        ? {
            tipo: material.tipo,
            titulo: material.titulo || "",
            descricao: material.descricao || "",
            categoria: material.categoria || "",
            url: material.url || "",
          }
        : { ...VAZIO, tipo: tipoInicial }
    )
    // "Compartilhado com" so existe na biblioteca pessoal: o material da
    // incubadora nao vai para startup nenhuma.
    if (material && pessoal) {
      bibliotecaPessoal
        .detalhar(material.id_material)
        .then(setDetalhe)
        .catch(() => setDetalhe(null))
    }
  }, [aberto, material, pessoal, tipoInicial])

  const sugestoes = useMemo(() => sugestoesDeCategoria(categorias), [categorias])
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  // Validacao do formulario — a mesma regra do backend, dita antes do envio.
  const erros = {
    titulo: !form.titulo.trim() ? "Dê um título ao material." : null,
    url:
      form.tipo === "LINK" && !/^https?:\/\/\S+$/i.test(form.url.trim())
        ? "Informe um endereço começando com http:// ou https://."
        : null,
    arquivo:
      form.tipo === "ARQUIVO" && !arquivo && !(editando && material.tipo === "ARQUIVO" && material.id_arquivo)
        ? "Escolha o arquivo do material."
        : null,
  }
  const valido = !erros.titulo && !erros.url && !erros.arquivo

  const escolherArquivo = (e) => {
    const f = e.target.files?.[0]
    e.target.value = "" // permite escolher o mesmo arquivo de novo depois de um erro
    if (!f) return
    if (f.size > LIMITE_ARQUIVO) {
      setErro(`"${f.name}" tem ${formatarTamanho(f.size)}. O limite é ${LIMITE_ARQUIVO_MB} MB.`)
      return
    }
    if (f.type && !ACEITOS.split(",").includes(f.type)) {
      setErro(`O tipo de "${f.name}" não é aceito. Envie PDF, documento, planilha, apresentação, texto ou imagem.`)
      return
    }
    setErro(null)
    setArquivo(f)
    // O nome do arquivo e um bom titulo provisorio — so quando ainda nao ha um.
    if (!form.titulo.trim()) {
      setForm((atual) => ({ ...atual, titulo: f.name.replace(/\.[^.]+$/, "").slice(0, 200) }))
    }
  }

  const salvar = async () => {
    setTocado(true)
    if (!valido) return
    setSalvando(true)
    setErro(null)
    try {
      let idArquivo
      if (form.tipo === "ARQUIVO" && arquivo) {
        try {
          const enviado = await enviarArquivo(arquivo, {
            idTenant: material?.id_tenant ?? idTenant,
            visibilidade: "PRIVADO",
          })
          idArquivo = enviado.id_arquivo
        } catch (err) {
          throw new Error(`Não foi possível enviar o arquivo: ${erroDe(err, "falha no envio.")}`)
        }
      }

      const corpo = {
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        categoria: form.categoria.trim(),
        ...(form.tipo === "LINK" ? { url: form.url.trim() } : {}),
        ...(idArquivo ? { id_arquivo: idArquivo } : {}),
        ...(!editando && pessoal && idPasta ? { id_pasta: idPasta } : {}),
      }

      const salvo = editando
        ? await cfg.servico.atualizar(material.id_material, corpo)
        : await cfg.servico.criar(idTenant, corpo)
      onSalvo(salvo, { novo: !editando })
    } catch (err) {
      setErro(erroDe(err, "Não foi possível salvar o material."))
    } finally {
      setSalvando(false)
    }
  }

  const alternarArquivado = async () => {
    setSalvando(true)
    setErro(null)
    try {
      const salvo = await cfg.servico.atualizar(material.id_material, {
        arquivado: !material.arquivado,
      })
      onSalvo(salvo, { arquivado: salvo.arquivado })
    } catch (err) {
      setErro(erroDe(err, "Não foi possível alterar o material."))
    } finally {
      setSalvando(false)
    }
  }

  const baixarAtual = async () => {
    try {
      await abrirArquivo(cfg.urlArquivo(material), material.arquivo_nome)
    } catch (err) {
      setErro(err.message)
    }
  }

  const compartilhamentos = detalhe?.compartilhamentos ?? []

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={salvando ? undefined : onFechar}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography sx={{ flex: 1, fontWeight: 800, fontSize: 18 }}>
            {editando ? cfg.tituloEditar : cfg.tituloNovo}
          </Typography>
          {editando && material.arquivado && <Chip size="small" label="Arquivado" />}
          <IconButton onClick={onFechar} size="small" disabled={salvando} aria-label="Fechar">
            <Close fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
          {erro && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
              {erro}
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
            O QUE É
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={form.tipo}
            onChange={(_, v) => v && setForm((f) => ({ ...f, tipo: v }))}
            sx={{ mb: 2 }}
          >
            <ToggleButton value="ARQUIVO" sx={{ textTransform: "none", gap: 1 }}>
              <InsertDriveFile fontSize="small" /> Arquivo
            </ToggleButton>
            <ToggleButton value="LINK" sx={{ textTransform: "none", gap: 1 }}>
              <LinkIcon fontSize="small" /> Link
            </ToggleButton>
          </ToggleButtonGroup>

          {form.tipo === "ARQUIVO" ? (
            <Box sx={{ mb: 2.5 }}>
              <input ref={inputRef} type="file" hidden accept={ACEITOS} onChange={escolherArquivo} />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1.5,
                  border: "1px dashed",
                  borderColor: tocado && erros.arquivo ? "error.main" : "divider",
                  borderRadius: "6px",
                }}
              >
                <UploadFile sx={{ color: "text.disabled" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {arquivo ? (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {arquivo.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatarTamanho(arquivo.size)} · será enviado ao salvar
                      </Typography>
                    </>
                  ) : editando && material.arquivo_nome ? (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {material.arquivo_nome}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatarTamanho(material.arquivo_tamanho)} · arquivo atual
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      PDF, documento, planilha, apresentação, texto ou imagem, até {LIMITE_ARQUIVO_MB} MB.
                    </Typography>
                  )}
                </Box>
                {editando && material.arquivo_nome && !arquivo && (
                  <IconButton size="small" onClick={baixarAtual} aria-label="Baixar arquivo atual">
                    <Download fontSize="small" />
                  </IconButton>
                )}
                <Button size="small" variant="outlined" onClick={() => inputRef.current?.click()} sx={{ textTransform: "none", flexShrink: 0 }}>
                  {arquivo || (editando && material.arquivo_nome) ? "Trocar" : "Escolher"}
                </Button>
              </Box>
              {tocado && erros.arquivo && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                  {erros.arquivo}
                </Typography>
              )}
              {editando && arquivo && (pessoal ? compartilhamentos.length > 0 : true) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  {pessoal
                    ? "As startups que receberam este material passam a abrir a versão nova."
                    : "Os mentores passam a baixar a versão nova."}
                </Typography>
              )}
            </Box>
          ) : (
            <TextField
              label="Endereço do link"
              placeholder="https://"
              fullWidth
              size="small"
              value={form.url}
              onChange={set("url")}
              error={tocado && Boolean(erros.url)}
              helperText={tocado && erros.url ? erros.url : "Um documento compartilhado, um vídeo, uma página."}
              sx={{ mb: 2.5 }}
            />
          )}

          <Stack spacing={2}>
            <TextField
              label="Título"
              required
              fullWidth
              size="small"
              value={form.titulo}
              onChange={set("titulo")}
              inputProps={{ maxLength: 200 }}
              error={tocado && Boolean(erros.titulo)}
              helperText={tocado && erros.titulo}
            />
            <TextField
              label="Descrição"
              fullWidth
              multiline
              minRows={3}
              size="small"
              value={form.descricao}
              onChange={set("descricao")}
              inputProps={{ maxLength: 4000 }}
              placeholder={cfg.placeholderDescricao}
            />
            <Autocomplete
              freeSolo
              options={sugestoes}
              value={form.categoria}
              onInputChange={(_, v) => setForm((f) => ({ ...f, categoria: v }))}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Categoria"
                  size="small"
                  inputProps={{ ...params.inputProps, maxLength: 60 }}
                  helperText="Escolha uma sugestão ou escreva a sua."
                />
              )}
            />
          </Stack>

          {editando && !pessoal && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Publicado por {material.criado_por_nome || "—"} em {dataBR(material.criado_ts)}
              </Typography>
              {material.atualizado_por_nome && material.atualizado_ts !== material.criado_ts && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Última alteração por {material.atualizado_por_nome} em {dataBR(material.atualizado_ts)}
                </Typography>
              )}
              {material.arquivado && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Arquivado: os mentores não veem este material até ele ser reativado.
                </Typography>
              )}
            </>
          )}

          {editando && pessoal && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 1 }}>
                COMPARTILHADO COM
              </Typography>
              {detalhe === null ? (
                <CircularProgress size={18} />
              ) : compartilhamentos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Ainda não foi compartilhado com nenhuma startup.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {compartilhamentos.map((c) => (
                    <Box key={c.id_compartilhamento}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {c.startup_nome}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.programa_nome}
                        {c.etapa_nome ? ` › ${c.etapa_nome}` : " › Trilha inteira"} · {dataBR(c.criado_ts)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 3, py: 2, borderTop: 1, borderColor: "divider", flexWrap: "wrap" }}>
          {editando && (
            <Button
              onClick={alternarArquivado}
              disabled={salvando}
              startIcon={material.arquivado ? <Unarchive /> : <Inventory2Outlined />}
              sx={{ textTransform: "none" }}
            >
              {material.arquivado ? "Reativar" : "Arquivar"}
            </Button>
          )}
          {editando && pessoal && podeCompartilhar && !material.arquivado && (
            <Button
              onClick={() => onCompartilhar(material)}
              disabled={salvando}
              startIcon={<Share />}
              sx={{ textTransform: "none" }}
            >
              Compartilhar
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar} disabled={salvando} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={salvar}
            disabled={salvando}
            startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
