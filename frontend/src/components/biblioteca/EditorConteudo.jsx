/**
 * Editor lateral (Drawer) de um conteudo da Biblioteca.
 *
 * Cabecalho com o logo (a marca do conteudo no acervo) + tipo + acoes, campos
 * comuns (titulo, resumo, tags) e o corpo especifico do tipo:
 *   - AULA     -> editor de blocos (BlockEditor), estilo Notion
 *   - VIDEO    -> link + duracao
 *   - ARQUIVO  -> nome do arquivo + url (upload fica p/ quando houver API)
 *   - TEMPLATE -> igual ao arquivo, mas sinaliza que vira entregavel
 *   - LINK     -> url
 *
 * Mantem um rascunho local; salva ao clicar em Salvar (ou fecha sem gravar).
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Drawer,
  Typography,
  TextField,
  Chip,
  IconButton,
  Button,
  Divider,
  Stack,
  InputAdornment,
  Tooltip,
  Alert,
} from "@mui/material"
import {
  Close,
  Save,
  Schedule,
  Link as LinkIcon,
  UploadFile,
  AccountTree,
  Inventory2,
} from "@mui/icons-material"
import BlockEditor from "./BlockEditor"
import { SeletorLogo } from "./LogoConteudo"
import PlayerYoutube from "./PlayerYoutube"
import { ehYoutube } from "../../utils/youtube"
import { TIPO_CONTEUDO, TAGS } from "../../data/bibliotecaMeta"
import { useAuthStore } from "../../store/authStore"

export default function EditorConteudo({ conteudo, onSalvar, onFechar }) {
  const aberto = Boolean(conteudo)

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={onFechar}
      PaperProps={{ sx: { width: { xs: "100%", sm: 640, md: 720 }, maxWidth: "100%" } }}
    >
      {conteudo && (
        <EditorConteudoInterno
          key={conteudo.id_conteudo}
          conteudo={conteudo}
          onSalvar={onSalvar}
          onFechar={onFechar}
        />
      )}
    </Drawer>
  )
}

function EditorConteudoInterno({ conteudo, onSalvar, onFechar }) {
  const meta = TIPO_CONTEUDO[conteudo.tipo]

  // A API pode devolver resumo/tags nulos; o formulario espera string e array.
  // logo_url vira null explicito para o diff de `alterado` nao acusar mudanca
  // entre "ausente" e "nulo".
  const normalizar = (c) => ({
    ...c,
    resumo: c.resumo ?? "",
    tags: c.tags ?? [],
    logo_url: c.logo_url ?? null,
  })

  const [form, setForm] = useState(() => normalizar(conteudo))
  useEffect(() => setForm(normalizar(conteudo)), [conteudo])

  // Dono do arquivo de logo enviado (o upload exige o tenant).
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant)

  // Erro ao escolher a imagem do logo (tipo/tamanho invalido).
  const [erroLogo, setErroLogo] = useState(null)

  const setCampo = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  const alternarTag = (tag) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))

  const alterado = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(normalizar(conteudo)),
    [form, conteudo]
  )

  const trocarLogo = (logo) => {
    setErroLogo(null)
    setForm((f) => ({ ...f, logo_url: logo }))
  }

  // A API fala snake_case (nome_arquivo); so os campos do tipo sao enviados.
  const salvar = () => {
    onSalvar(conteudo.id_conteudo, {
      titulo: form.titulo.trim(),
      resumo: form.resumo,
      tags: form.tags,
      logo_url: form.logo_url,
      ...(form.tipo === "AULA" && { duracao: form.duracao, blocos: form.blocos }),
      ...(form.tipo === "VIDEO" && { url: form.url, duracao: form.duracao }),
      ...(form.tipo === "ARQUIVO" && { url: form.url, nome_arquivo: form.nome_arquivo }),
      ...(form.tipo === "TEMPLATE" && { url: form.url, nome_arquivo: form.nome_arquivo }),
      ...(form.tipo === "LINK" && { url: form.url }),
    })
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Cabecalho */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <SeletorLogo
          conteudo={form}
          idTenant={idTenant}
          onChange={trocarLogo}
          onErro={setErroLogo}
          tamanho={44}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: meta.cor }}>
            {meta.label.toUpperCase()}
          </Typography>
          <Typography noWrap sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
            {form.titulo || `Nova ${meta.label.toLowerCase()}`}
          </Typography>
        </Box>
        <Tooltip title="Fechar" arrow>
          <IconButton onClick={onFechar}>
            <Close />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />

      {/* Corpo rolavel */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
        <Stack spacing={2.5}>
          {erroLogo && (
            <Alert severity="error" onClose={() => setErroLogo(null)} sx={{ borderRadius: 2 }}>
              {erroLogo}
            </Alert>
          )}
          <TextField
            label="Título"
            fullWidth
            value={form.titulo}
            onChange={setCampo("titulo")}
            autoFocus
            placeholder={`ex.: ${meta.label} sobre validação de mercado`}
          />
          <TextField
            label="Resumo"
            fullWidth
            multiline
            minRows={2}
            value={form.resumo}
            onChange={setCampo("resumo")}
            placeholder="Uma frase que descreve o que o incubado aprende aqui."
          />

          {/* Tags */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              TAGS
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
              {TAGS.map((tag) => {
                const ativa = form.tags.includes(tag)
                return (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onClick={() => alternarTag(tag)}
                    color={ativa ? "primary" : "default"}
                    variant={ativa ? "filled" : "outlined"}
                    sx={{ cursor: "pointer" }}
                  />
                )
              })}
            </Box>
          </Box>

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              CONTEÚDO
            </Typography>
          </Divider>

          {/* Corpo por tipo */}
          {form.tipo === "AULA" && (
            <>
              <TextField
                label="Duração estimada"
                size="small"
                value={form.duracao || ""}
                onChange={setCampo("duracao")}
                placeholder="ex.: 8 min"
                sx={{ maxWidth: 200 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Schedule sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 2,
                  minHeight: 240,
                  bgcolor: "background.default",
                }}
              >
                <BlockEditor
                  blocos={form.blocos || []}
                  onChange={(blocos) => setForm((f) => ({ ...f, blocos }))}
                />
              </Box>
            </>
          )}

          {form.tipo === "VIDEO" && (
            <>
              <TextField
                label="Link do vídeo"
                fullWidth
                value={form.url || ""}
                onChange={setCampo("url")}
                placeholder="https://youtube.com/..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Duração"
                size="small"
                value={form.duracao || ""}
                onChange={setCampo("duracao")}
                placeholder="ex.: 12 min"
                sx={{ maxWidth: 200 }}
              />
              {/* Confere o link antes de salvar: e exatamente este player que a
                  startup vera dentro do passo da trilha. Link errado ou video
                  privado aparece aqui, e nao so quando o incubado abrir. */}
              {ehYoutube(form.url) && (
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 700, display: "block", mb: 0.75 }}
                  >
                    COMO A STARTUP VAI VER
                  </Typography>
                  <PlayerYoutube url={form.url} titulo={form.titulo} duracao={form.duracao} />
                </Box>
              )}
            </>
          )}

          {(form.tipo === "ARQUIVO" || form.tipo === "TEMPLATE") && (
            <>
              {form.tipo === "TEMPLATE" && (
                <Alert icon={<Inventory2 fontSize="inherit" />} severity="info" sx={{ borderRadius: 2 }}>
                  Templates viram o modelo do <b>entregável</b> que a startup preenche e devolve.
                </Alert>
              )}
              <TextField
                label="Nome do arquivo"
                fullWidth
                value={form.nome_arquivo || ""}
                onChange={setCampo("nome_arquivo")}
                placeholder="ex.: canvas-startup.pdf"
              />
              <Button
                variant="outlined"
                startIcon={<UploadFile />}
                sx={{ alignSelf: "flex-start", textTransform: "none" }}
                disabled
              >
                Enviar arquivo (em breve)
              </Button>
              <TextField
                label="ou URL do arquivo"
                fullWidth
                value={form.url || ""}
                onChange={setCampo("url")}
                placeholder="https://..."
              />
            </>
          )}

          {form.tipo === "LINK" && (
            <TextField
              label="URL"
              fullWidth
              value={form.url || ""}
              onChange={setCampo("url")}
              placeholder="https://..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />
          )}

          {/* Onde e usado (reutilizacao) */}
          {conteudo.usos?.length > 0 && (
            <>
              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  USADO NA TRILHA
                </Typography>
              </Divider>
              <Stack spacing={0.5}>
                {conteudo.usos.map((u, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AccountTree sx={{ fontSize: 16, color: "primary.main" }} />
                    <Typography variant="body2">
                      {u.fase} <span style={{ opacity: 0.5 }}>›</span> {u.passo}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </Box>

      {/* Rodape */}
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, px: 3, py: 2 }}>
        <Button onClick={onFechar} startIcon={<Close />} sx={{ textTransform: "none" }}>
          Fechar
        </Button>
        <Button
          onClick={salvar}
          disabled={!alterado}
          variant="contained"
          startIcon={<Save />}
          sx={{ textTransform: "none" }}
        >
          Salvar
        </Button>
      </Box>
    </Box>
  )
}
