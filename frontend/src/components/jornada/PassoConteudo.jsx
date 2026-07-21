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
  CircularProgress,
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
import {
  enviarArquivo,
  abrirArquivo,
  anexoAcessivel,
  parseAnexo,
  formatarTamanho,
} from "../../services/arquivos"
import { useAuthStore } from "../../store/authStore"

// Estados em que o incubado ainda pode editar a entrega.
const EDITAVEL = ["NAO_INICIADA", "RASCUNHO", "AJUSTE"]

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
  // `entrega.anexos` e TEXT[]: cada item pode chegar como objeto, como JSON em
  // string ou como nome solto. Normaliza na entrada para o resto da tela (e o
  // que volta ao servidor no save) lidar sempre com {nome, url, tamanho}.
  const [anexos, setAnexos] = useState(() => (passo.entrega.anexos || []).map(parseAnexo))
  const [erroAnexo, setErroAnexo] = useState("")
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)
  const fileRef = useRef(null)
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant)

  useEffect(() => {
    setResposta(passo.entrega.resposta || "")
    setAnexos((passo.entrega.anexos || []).map(parseAnexo))
    setErroAnexo("")
  }, [passo.id]) // eslint-disable-line

  const status = passo.entrega.status
  const editavel = EDITAVEL.includes(status)
  const ehAnexo = passo.entrega.tipo === "ANEXO"
  const podeEnviar = useMemo(
    () => editavel && (anexos.length > 0 || resposta.trim().length > 0),
    [editavel, anexos, resposta]
  )

  /**
   * Sobe os PDFs para o servidor e guarda a referencia devolvida.
   *
   * Ate 20/07/2026 isto gravava `URL.createObjectURL(f)` — um endereco que so
   * valia na aba de quem enviou, e que deixava o MENTOR sem conseguir abrir o
   * anexo que precisava avaliar. Agora o arquivo sobe de fato e o que fica na
   * entrega e o `id_arquivo` + a url servida pela API.
   */
  const adicionarArquivos = async (lista) => {
    const arquivos = Array.from(lista || [])
    if (!arquivos.length) return

    const pdfs = arquivos.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    )
    setErroAnexo(pdfs.length < arquivos.length ? "Apenas arquivos PDF sao aceitos." : "")
    if (!pdfs.length) return

    setEnviandoAnexo(true)
    try {
      for (const file of pdfs) {
        const arquivo = await enviarArquivo(file, { idTenant, visibilidade: "PRIVADO" })
        setAnexos((a) => [
          ...a,
          {
            id_arquivo: arquivo.id_arquivo,
            nome: arquivo.nome_original,
            tamanho: arquivo.tamanho,
            url: arquivo.url,
          },
        ])
      }
    } catch (err) {
      setErroAnexo(
        err.response?.data?.erro || "Nao foi possivel enviar o arquivo. Tente novamente."
      )
    } finally {
      setEnviandoAnexo(false)
    }
  }

  // Remove so da entrega. O arquivo fica no servidor de proposito: a entrega
  // ainda pode ser um rascunho que o incubado desfaz e refaz, e apagar o byte
  // a cada clique perderia o anexo de quem so queria reordenar a lista.
  const removerAnexo = (i) => setAnexos((a) => a.filter((_, idx) => idx !== i))

  const abrirAnexo = async (anexo) => {
    setErroAnexo("")
    try {
      await abrirArquivo(anexo.url, anexo.nome)
    } catch (err) {
      setErroAnexo(err.message)
    }
  }

  const abrirSeletor = () => editavel && !enviandoAnexo && fileRef.current?.click()

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

      {/* Devolutiva do mentor (quando ja houve avaliacao) */}
      {passo.entrega.feedback && (
        <FeedbackMentor
          texto={passo.entrega.feedback}
          autor={passo.entrega.avaliador}
          data={passo.entrega.historico?.[0]?.data}
          ajuste={status === "AJUSTE"}
        />
      )}

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
              if (editavel && !enviandoAnexo) adicionarArquivos(e.dataTransfer.files)
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
            {enviandoAnexo ? (
              <>
                <CircularProgress size={28} />
                <Typography sx={{ mt: 1, fontWeight: 600 }}>Enviando…</Typography>
                <Typography variant="caption">Nao feche esta aba</Typography>
              </>
            ) : (
              <>
                <UploadFile sx={{ fontSize: 32, opacity: 0.5 }} />
                <Typography sx={{ mt: 1, fontWeight: 600 }}>
                  Arraste o PDF ou clique para enviar
                </Typography>
                <Typography variant="caption">Somente arquivos PDF (ate 15MB)</Typography>
              </>
            )}
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
            startIcon={enviandoAnexo ? <CircularProgress size={16} /> : <PictureAsPdf />}
            onClick={abrirSeletor}
            disabled={enviandoAnexo}
            sx={{ mt: 1.5, textTransform: "none" }}
          >
            {enviandoAnexo ? "Enviando…" : "Anexar PDF"}
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
            {anexos.map((a, i) => {
              const acessivel = anexoAcessivel(a)
              return (
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
                  <PictureAsPdf sx={{ color: acessivel ? "#ef4444" : "text.disabled" }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>
                      {a.nome || `Anexo ${i + 1}`}
                    </Typography>
                    {a.tamanho != null && (
                      <Typography variant="caption" color="text.secondary">
                        {formatarTamanho(a.tamanho)}
                      </Typography>
                    )}
                  </Box>
                  {/* Nao e <a href>: anexo e privado e exige token, que a tag nao
                      envia. `abrirArquivo` busca com o cabecalho e abre o blob.
                      Anexos antigos, que guardaram so o nome, nunca subiram ao
                      servidor — nao ha o que abrir. */}
                  {acessivel ? (
                    <Tooltip title="Visualizar" arrow>
                      <IconButton size="small" onClick={() => abrirAnexo(a)}>
                        <OpenInNew sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      indisponivel
                    </Typography>
                  )}
                  {editavel && (
                    <Tooltip title="Remover" arrow>
                      <IconButton size="small" onClick={() => removerAnexo(i)}>
                        <Close sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )
            })}
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

/**
 * Devolutiva do mentor, com tom humano.
 *
 * A API manda a devolutiva em campos SEPARADOS e planos: `entrega.feedback` e o
 * comentario (texto puro), `entrega.avaliador` e o nome e a data esta no
 * historico. Este componente ja recebeu um objeto {autor, data, texto} — forma
 * que so existia no mock — e lia `feedback.autor.charAt(0)`; com a string real
 * da API isso era TypeError no render, e a Jornada inteira ficava em branco ao
 * abrir qualquer atividade ja avaliada.
 */
function FeedbackMentor({ texto, autor, data, ajuste }) {
  const cor = ajuste ? "#f97316" : "#22c55e"
  const nome = autor || "Mentoria"
  // A data vem como "AAAA-MM-DD"; sem hora, entao formata sem passar por Date
  // (que interpretaria a string como UTC e poderia recuar um dia).
  const dataBr = /^\d{4}-\d{2}-\d{2}$/.test(data || "")
    ? data.split("-").reverse().join("/")
    : data

  return (
    <Box
      sx={{
        mb: 3,
        p: 2.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: `${cor}55`,
        bgcolor: `${cor}10`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, bgcolor: "secondary.main" }}>
          {nome.charAt(0)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{nome}</Typography>
          <Typography variant="caption" color="text.secondary">
            Devolutiva do mentor{dataBr ? ` · ${dataBr}` : ""}
          </Typography>
        </Box>
        <Chip
          label={ajuste ? "Precisa de ajuste" : "Avaliado"}
          size="small"
          sx={{ bgcolor: `${cor}1f`, color: cor, fontWeight: 700 }}
        />
      </Box>
      <Typography sx={{ fontSize: 15, lineHeight: 1.6, fontStyle: "italic" }}>
        “{texto}”
      </Typography>
    </Box>
  )
}
