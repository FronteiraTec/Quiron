/**
 * Coluna central: a "aula" do passo. NAO e um formulario — e uma pagina de
 * curso com objetivo, por que, o conteudo ensinado (vindo da Biblioteca) e, so
 * no fim, o espaco de entrega. Inclui o feedback do mentor quando ha ajuste.
 */
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Box,
  Typography,
  Chip,
  Button,
  Divider,
  TextField,
  Alert,
  Avatar,
  Stack,
  Link,
  IconButton,
  Tooltip,
} from "@mui/material"
import {
  Flag,
  HelpOutline,
  MenuBook,
  UploadFile,
  Send,
  SaveOutlined,
  Autorenew,
  ArrowBack,
  ArrowForward,
  OpenInNew,
  PictureAsPdf,
  Close,
} from "@mui/icons-material"
import { motion } from "framer-motion"
import StatusPasso from "./StatusPasso"
import BlocoView from "./BlocoView"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"

// Estados em que o incubado ainda pode editar a entrega.
const EDITAVEL = ["NAO_INICIADA", "RASCUNHO", "AJUSTE"]

// Formata bytes em B/KB/MB para exibir o tamanho do anexo.
function formatarTamanho(bytes) {
  if (bytes == null) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PassoConteudo({
  passo,
  conteudos,
  posicao,
  onSalvarRascunho,
  onEnviar,
  onAnterior,
  onProximo,
  temAnterior,
  temProximo,
}) {
  const [resposta, setResposta] = useState(passo.entrega.resposta || "")
  const [anexos, setAnexos] = useState(passo.entrega.anexos || [])
  const [erroAnexo, setErroAnexo] = useState("")
  const fileRef = useRef(null)

  useEffect(() => {
    setResposta(passo.entrega.resposta || "")
    setAnexos(passo.entrega.anexos || [])
    setErroAnexo("")
  }, [passo.id]) // eslint-disable-line

  const status = passo.entrega.status
  const editavel = EDITAVEL.includes(status)
  const ehAnexo = passo.entrega.tipo === "ANEXO"
  const podeEnviar = useMemo(
    () => editavel && (anexos.length > 0 || resposta.trim().length > 0),
    [editavel, anexos, resposta]
  )

  // Aceita apenas PDFs. Guarda { nome, tamanho, url } (url = blob local, para
  // visualizar na sessao; a persistencia real fica para quando houver backend).
  const adicionarArquivos = (lista) => {
    const arquivos = Array.from(lista || [])
    if (!arquivos.length) return
    const pdfs = arquivos.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    )
    setErroAnexo(pdfs.length < arquivos.length ? "Apenas arquivos PDF sao aceitos." : "")
    if (pdfs.length) {
      setAnexos((a) => [
        ...a,
        ...pdfs.map((f) => ({ nome: f.name, tamanho: f.size, url: URL.createObjectURL(f) })),
      ])
    }
  }

  const removerAnexo = (i) =>
    setAnexos((a) => {
      const alvo = a[i]
      if (alvo?.url?.startsWith("blob:")) URL.revokeObjectURL(alvo.url)
      return a.filter((_, idx) => idx !== i)
    })

  const abrirSeletor = () => editavel && fileRef.current?.click()

  return (
    <Box
      component={motion.div}
      key={passo.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      sx={{ width: "100%", px: { xs: 2, md: 5, lg: 6 }, py: 4 }}
    >
      {/* Cabecalho */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
        <Chip label={passo.frente} size="small" variant="outlined" />
        <StatusPasso status={status} variant="chip" />
        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
          Passo {posicao.atual} de {posicao.total}
        </Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3 }}>
        {passo.titulo}
      </Typography>

      {/* Objetivo */}
      <SecaoBloco icone={<Flag />} titulo="Objetivo">
        <Typography sx={{ fontSize: 15.5, lineHeight: 1.6 }}>{passo.objetivo}</Typography>
      </SecaoBloco>

      {/* Por que */}
      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          p: 2,
          borderRadius: 2,
          bgcolor: "action.hover",
          mb: 3,
        }}
      >
        <HelpOutline sx={{ color: "text.secondary", mt: 0.25 }} />
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
            POR QUE ISSO IMPORTA
          </Typography>
          <Typography sx={{ fontSize: 14.5, lineHeight: 1.6 }}>{passo.porque}</Typography>
        </Box>
      </Box>

      {/* Descricao */}
      {passo.descricao && (
        <Typography sx={{ fontSize: 15.5, lineHeight: 1.7, mb: 3 }}>{passo.descricao}</Typography>
      )}

      {/* Conteudo ensinado (da Biblioteca) */}
      {conteudos.length > 0 && (
        <SecaoBloco icone={<MenuBook />} titulo="Conteudo da incubadora">
          <Stack spacing={2}>
            {conteudos.map((c) => (
              <ConteudoEnsinado key={c.id_conteudo} conteudo={c} />
            ))}
          </Stack>
        </SecaoBloco>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Feedback do mentor (quando ha ajuste) */}
      {passo.entrega.feedback && <FeedbackMentor feedback={passo.entrega.feedback} />}

      {/* Entrega */}
      <SecaoBloco icone={<Send />} titulo="Sua entrega">
        {status === "APROVADO" && (
          <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
            Entrega aprovada pelo mentor. Este passo esta construido. ✓
          </Alert>
        )}
        {status === "AGUARDANDO" && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            Enviado — aguardando a avaliacao do mentor.
          </Alert>
        )}

        {ehAnexo ? (
          <Box
            onClick={abrirSeletor}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (editavel) adicionarArquivos(e.dataTransfer.files)
            }}
            sx={{
              border: "2px dashed",
              borderColor: "divider",
              borderRadius: 2,
              p: 4,
              textAlign: "center",
              color: "text.secondary",
              bgcolor: "background.default",
              cursor: editavel ? "pointer" : "default",
              opacity: editavel ? 1 : 0.6,
              transition: "border-color .15s",
              "&:hover": editavel ? { borderColor: "primary.main" } : {},
            }}
          >
            <UploadFile sx={{ fontSize: 32, opacity: 0.5 }} />
            <Typography sx={{ mt: 1, fontWeight: 600 }}>
              Arraste o PDF ou clique para enviar
            </Typography>
            <Typography variant="caption">Somente arquivos PDF</Typography>
          </Box>
        ) : (
          <TextField
            fullWidth
            multiline
            minRows={6}
            placeholder="Escreva sua resposta aqui…"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            disabled={!editavel}
          />
        )}

        {/* Input escondido de PDF (compartilhado por dropzone e botao) */}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            adicionarArquivos(e.target.files)
            e.target.value = ""
          }}
        />

        {/* Anexar PDF em qualquer passo (nao so nos do tipo anexo) */}
        {editavel && !ehAnexo && (
          <Button
            variant="outlined"
            startIcon={<PictureAsPdf />}
            onClick={abrirSeletor}
            sx={{ mt: 1.5, textTransform: "none" }}
          >
            Anexar PDF
          </Button>
        )}

        {erroAnexo && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
            {erroAnexo}
          </Typography>
        )}

        {/* Lista de PDFs anexados */}
        {anexos.length > 0 && (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {anexos.map((a, i) => (
              <Box
                key={i}
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
                <PictureAsPdf sx={{ color: "#ef4444" }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
                    {a.nome}
                  </Typography>
                  {a.tamanho != null && (
                    <Typography variant="caption" color="text.secondary">
                      {formatarTamanho(a.tamanho)}
                    </Typography>
                  )}
                </Box>
                {a.url && (
                  <Tooltip title="Visualizar" arrow>
                    <IconButton size="small" component="a" href={a.url} target="_blank" rel="noopener">
                      <OpenInNew sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {editavel && (
                  <Tooltip title="Remover" arrow>
                    <IconButton size="small" onClick={() => removerAnexo(i)}>
                      <Close sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Stack>
        )}

        {/* Observacoes (para entregas do tipo anexo) */}
        {ehAnexo && (
          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder="Observacoes (opcional)"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            disabled={!editavel}
            sx={{ mt: 2 }}
          />
        )}

        {/* Acoes de entrega */}
        {editavel && (
          <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<SaveOutlined />}
              onClick={() => onSalvarRascunho(resposta, anexos)}
              sx={{ textTransform: "none" }}
            >
              Salvar rascunho
            </Button>
            <Button
              variant="contained"
              startIcon={status === "AJUSTE" ? <Autorenew /> : <Send />}
              disabled={!podeEnviar}
              onClick={() => onEnviar(resposta, anexos)}
              sx={{ textTransform: "none" }}
            >
              {status === "AJUSTE" ? "Revisar e reenviar" : "Enviar para avaliacao"}
            </Button>
          </Box>
        )}
      </SecaoBloco>

      {/* Navegacao entre passos */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Button
          disabled={!temAnterior}
          startIcon={<ArrowBack />}
          onClick={onAnterior}
          sx={{ textTransform: "none" }}
        >
          Passo anterior
        </Button>
        <Button
          disabled={!temProximo}
          endIcon={<ArrowForward />}
          onClick={onProximo}
          sx={{ textTransform: "none" }}
        >
          Proximo passo
        </Button>
      </Box>
    </Box>
  )
}

// Secao com cabecalho de icone + titulo.
function SecaoBloco({ icone, titulo, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.25, color: "primary.main" }}>
        {icone}
        <Typography sx={{ fontWeight: 700, fontSize: 15 }} color="text.primary">
          {titulo}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}

// Render de um conteudo referenciado: AULA aparece inline (leitura); os demais
// como cartao de material com link.
function ConteudoEnsinado({ conteudo }) {
  const meta = TIPO_CONTEUDO[conteudo.tipo]
  const Icone = meta.icon

  if (conteudo.tipo === "AULA") {
    return (
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1.25,
            bgcolor: `${meta.cor}12`,
          }}
        >
          <Icone sx={{ fontSize: 18, color: meta.cor }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{conteudo.titulo}</Typography>
          {conteudo.duracao && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
              {conteudo.duracao}
            </Typography>
          )}
        </Box>
        <Box sx={{ px: 2.5, py: 2 }}>
          <BlocoView blocos={conteudo.blocos} />
        </Box>
      </Box>
    )
  }

  // Video / Material / Template / Link -> cartao com link.
  const card = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.75,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        transition: "border-color .15s",
        "&:hover": { borderColor: `${meta.cor}66` },
      }}
    >
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          width: 38,
          height: 38,
          borderRadius: 1.5,
          bgcolor: `${meta.cor}1f`,
          color: meta.cor,
          flexShrink: 0,
        }}
      >
        <Icone sx={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{conteudo.titulo}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {conteudo.resumo}
        </Typography>
      </Box>
      <OpenInNew sx={{ fontSize: 16, color: "text.disabled" }} />
    </Box>
  )

  return conteudo.url ? (
    <Link href={conteudo.url} target="_blank" rel="noopener" underline="none">
      {card}
    </Link>
  ) : (
    card
  )
}

// Feedback do mentor, com tom humano.
function FeedbackMentor({ feedback }) {
  return (
    <Box
      sx={{
        mb: 3,
        p: 2.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "#f9731655",
        bgcolor: "#f9731610",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: "secondary.main" }}>
          {feedback.autor.charAt(0)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{feedback.autor}</Typography>
          <Typography variant="caption" color="text.secondary">
            Mentora · {feedback.data}
          </Typography>
        </Box>
        <Chip label="Precisa de ajuste" size="small" sx={{ bgcolor: "#f973161f", color: "#f97316", fontWeight: 700 }} />
      </Box>
      <Typography sx={{ fontSize: 15, lineHeight: 1.6, fontStyle: "italic" }}>
        “{feedback.texto}”
      </Typography>
    </Box>
  )
}
