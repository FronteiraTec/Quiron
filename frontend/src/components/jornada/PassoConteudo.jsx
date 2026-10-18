/**
 * Coluna central: a "aula" do passo. NAO e um formulario — e uma pagina de
 * curso com objetivo, por que, o conteudo ensinado (vindo da Biblioteca) e, so
 * no fim, o espaco de entrega. Inclui o feedback do mentor quando ha ajuste.
 *
 * A cara e de PAGINA, no espirito do Notion: coluna de leitura estreita e
 * centrada, titulo grande, as propriedades do passo logo abaixo dele e secoes
 * separadas por espaco em branco — nao por cartoes empilhados. O que antes era
 * caixa (a aula vinda da biblioteca, os materiais, a area de resposta) virou
 * conteudo correndo na pagina: cada borda a mais rouba largura util, empilha
 * quinas arredondadas umas dentro das outras e quebra o ritmo vertical.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react"
import {
  Box,
  Typography,
  Chip,
  Button,
  TextField,
  Alert,
  Avatar,
  Stack,
  Link,
  IconButton,
  Tooltip,
  CircularProgress,
  useTheme,
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
  SellOutlined,
  CircleOutlined,
  FormatListNumbered,
  CoPresent,
} from "@mui/icons-material"
import { motion } from "framer-motion"
import StatusPasso from "./StatusPasso"
import BlocoView from "./BlocoView"
import { MaterialNoPasso } from "./MateriaisDoMentor"
import { documentoVazio } from "../editor/documento"
import PlayerYoutube from "../biblioteca/PlayerYoutube"
import { ehYoutube } from "../../utils/youtube"
import { TIPO_CONTEUDO } from "../../data/bibliotecaMeta"
import {
  enviarArquivo,
  abrirArquivo,
  anexoAcessivel,
  parseAnexo,
  formatarTamanho,
} from "../../services/arquivos"
import { useAuthStore } from "../../store/authStore"

// O leitor de aulas carrega o BlockNote junto, que nao e pequeno. Em pedaco
// separado ele so chega quando o incubado abre um passo que ensina uma AULA —
// passo de video, material ou link nao paga por ele.
const VisualizadorDocumento = lazy(() => import("../editor/VisualizadorDocumento"))

// Estados em que o incubado ainda pode editar a entrega.
const EDITAVEL = ["NAO_INICIADA", "RASCUNHO", "AJUSTE"]

/**
 * Largura da coluna de leitura. O Notion para em ~700px pelo mesmo motivo:
 * acima disso a linha fica longa demais e o olho perde a linha seguinte. A
 * coluna central da Jornada e `flex: 1`, ou seja, ia ate onde a tela desse —
 * em monitor largo o texto atravessava 1300px de ponta a ponta.
 */
const LARGURA_LEITURA = 740

/**
 * Raio de borda desta pagina.
 *
 * O raio e preferencia do usuario (theme.js, padrao 12px) e cai bem nos
 * paineis do resto do sistema. Numa superficie de LEITURA ele atrapalha: com
 * 12px cada bloco vira uma bolha e as quinas competem com o texto. Aqui o
 * valor e LIMITADO a 4px — quem configurou quinas retas (0) continua vendo
 * quinas retas; quem configurou 20 ve 4.
 */
const raioPlano = (theme) => `${Math.min(theme.shape.borderRadius, 4)}px`

export default function PassoConteudo({
  passo,
  conteudos,
  // Materiais que um mentor entregou a startup NESTE passo (Espaco do Mentor).
  materiaisMentor = [],
  onAbrirMaterial,
  posicao,
  onSalvarRascunho,
  onEnviar,
  onAnterior,
  onProximo,
  temAnterior,
  temProximo,
}) {
  const theme = useTheme()
  const raio = raioPlano(theme)
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
    setErroAnexo(pdfs.length < arquivos.length ? "Apenas arquivos PDF são aceitos." : "")
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
        err.response?.data?.erro || "Não foi possível enviar o arquivo. Tente novamente."
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      sx={{
        width: "100%",
        maxWidth: LARGURA_LEITURA,
        mx: "auto",
        px: { xs: 3, md: 4 },
        pt: { xs: 4, md: 7 },
        // Respiro grande no fim, como o de uma pagina de documento: a ultima
        // acao nunca encosta na beirada da area de rolagem.
        pb: 12,
      }}
    >
      {/* Cabecalho: o titulo vem PRIMEIRO e as propriedades abaixo dele — a
          ordem de uma pagina de documento. Antes os chips vinham em cima e o
          titulo aparecia como legenda de uma barra de metadados. */}
      <Typography
        component="h1"
        sx={{
          fontSize: { xs: 30, md: 40 },
          fontWeight: 800,
          letterSpacing: "-0.022em",
          lineHeight: 1.15,
          mb: 2.5,
        }}
      >
        {passo.titulo}
      </Typography>

      <Stack spacing={0.25}>
        <Propriedade icone={<SellOutlined />} rotulo="Frente">
          <Typography sx={{ fontSize: 14 }}>{passo.frente}</Typography>
        </Propriedade>
        <Propriedade icone={<CircleOutlined />} rotulo="Status">
          <StatusPasso status={status} variant="chip" />
        </Propriedade>
        <Propriedade icone={<FormatListNumbered />} rotulo="Posição">
          <Typography sx={{ fontSize: 14 }}>
            Passo {posicao.atual} de {posicao.total}
          </Typography>
        </Propriedade>
      </Stack>

      {/* Objetivo. Passo sem objetivo simplesmente nao mostra a secao: um
          cabecalho com nada embaixo so anuncia que falta preencher algo. */}
      {passo.objetivo && (
        <SecaoBloco icone={<Flag />} titulo="Objetivo">
          <Texto>{passo.objetivo}</Texto>
        </SecaoBloco>
      )}

      {/* Por que — no formato de "callout": fundo suave, sem borda e sem
          cabecalho de secao proprio. */}
      {passo.porque && (
        <Box
          sx={{
            display: "flex",
            gap: 1.75,
            p: 2,
            mt: 3,
            borderRadius: raio,
            bgcolor: "action.hover",
          }}
        >
          <HelpOutline sx={{ color: "text.disabled", fontSize: 20, mt: 0.25, flexShrink: 0 }} />
          <Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary" }}
            >
              POR QUE ISSO IMPORTA
            </Typography>
            <Texto sx={{ fontSize: 15 }}>{passo.porque}</Texto>
          </Box>
        </Box>
      )}

      {/* Descricao */}
      {passo.descricao && <Texto sx={{ mt: 3 }}>{passo.descricao}</Texto>}

      {/* Conteudo ensinado (da Biblioteca) */}
      {conteudos.length > 0 && (
        <SecaoBloco icone={<MenuBook />} titulo="Conteúdo da incubadora">
          <Stack spacing={4}>
            {conteudos.map((c) => (
              <ConteudoEnsinado key={c.id_conteudo} conteudo={c} />
            ))}
          </Stack>
        </SecaoBloco>
      )}

      {/* O que o mentor separou para a startup NESTA atividade. Vem depois do
          conteudo da incubadora (que e o mesmo para todas as startups) e antes
          da entrega: e a orientacao de quem acompanha, para fazer o passo. */}
      {materiaisMentor.length > 0 && (
        <SecaoBloco icone={<CoPresent />} titulo="Do seu mentor">
          <Stack spacing={2.5}>
            {materiaisMentor.map((m) => (
              <MaterialNoPasso key={m.id_compartilhamento} material={m} onAbrir={onAbrirMaterial} />
            ))}
          </Stack>
        </SecaoBloco>
      )}

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
          <Alert severity="success" variant="outlined" sx={{ mb: 2, borderRadius: raio }}>
            Entrega aprovada pelo mentor. Este passo está construído. ✓
          </Alert>
        )}
        {status === "AGUARDANDO" && (
          <Alert severity="warning" variant="outlined" sx={{ mb: 2, borderRadius: raio }}>
            Enviado — aguardando a avaliação do mentor.
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
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: raio,
              p: 4,
              textAlign: "center",
              color: "text.secondary",
              bgcolor: "action.hover",
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
                <Typography variant="caption">Não feche esta aba</Typography>
              </>
            ) : (
              <>
                <UploadFile sx={{ fontSize: 30, opacity: 0.45 }} />
                <Typography sx={{ mt: 1, fontWeight: 600 }}>
                  Arraste o PDF ou clique para enviar
                </Typography>
                <Typography variant="caption">Somente arquivos PDF (até 15MB)</Typography>
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
            sx={campoDeTexto(raio, editavel)}
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
            variant="text"
            disableElevation
            startIcon={enviandoAnexo ? <CircularProgress size={16} /> : <PictureAsPdf />}
            onClick={abrirSeletor}
            disabled={enviandoAnexo}
            sx={{
              mt: 1,
              ml: -1,
              textTransform: "none",
              borderRadius: raio,
              color: "text.secondary",
              fontWeight: 600,
            }}
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
          <Stack spacing={0.25} sx={{ mt: 1.5 }}>
            {anexos.map((a, i) => {
              const acessivel = anexoAcessivel(a)
              return (
                <Box
                  key={i}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.25,
                    py: 1,
                    mx: -1.25,
                    borderRadius: raio,
                    transition: "background-color .12s",
                    "&:hover": { bgcolor: "action.hover" },
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
                      indisponível
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
            placeholder="Observações (opcional)"
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            disabled={!editavel}
            sx={{ mt: 2, ...campoDeTexto(raio, editavel) }}
          />
        )}

        {/* Acoes de entrega */}
        {editavel && (
          <Box sx={{ display: "flex", gap: 1, mt: 2.5, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              disableElevation
              startIcon={<SaveOutlined />}
              onClick={() => onSalvarRascunho(resposta, anexos)}
              sx={{
                textTransform: "none",
                borderRadius: raio,
                borderColor: "divider",
                color: "text.primary",
                fontWeight: 600,
              }}
            >
              Salvar rascunho
            </Button>
            <Button
              variant="contained"
              disableElevation
              startIcon={status === "AJUSTE" ? <Autorenew /> : <Send />}
              disabled={!podeEnviar}
              onClick={() => onEnviar(resposta, anexos)}
              sx={{ textTransform: "none", borderRadius: raio, fontWeight: 600 }}
            >
              {status === "AJUSTE" ? "Revisar e reenviar" : "Enviar para avaliação"}
            </Button>
          </Box>
        )}
      </SecaoBloco>

      {/* Navegacao entre passos — rodape da pagina, separado por um fio. */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mt: 8,
          pt: 2.5,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Button
          disabled={!temAnterior}
          startIcon={<ArrowBack />}
          onClick={onAnterior}
          sx={{ textTransform: "none", borderRadius: raio, color: "text.secondary" }}
        >
          Passo anterior
        </Button>
        <Button
          disabled={!temProximo}
          endIcon={<ArrowForward />}
          onClick={onProximo}
          sx={{ textTransform: "none", borderRadius: raio, color: "text.secondary" }}
        >
          Próximo passo
        </Button>
      </Box>
    </Box>
  )
}

/**
 * A area de escrita da entrega.
 *
 * Um campo de formulario gritaria "preencha o cadastro" no meio de uma pagina
 * de leitura. Aqui ele e um bloco de texto: fio de 1px na cor do divisor —
 * inclusive com foco, onde o MUI engrossaria para 2px — e o texto no mesmo
 * corpo do resto da pagina.
 */
const campoDeTexto = (raio, editavel) => ({
  "& .MuiOutlinedInput-root": {
    borderRadius: raio,
    p: 2,
    fontSize: 15.5,
    lineHeight: 1.65,
    bgcolor: editavel ? "transparent" : "action.hover",
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 1 },
})

// Paragrafo da pagina: um so corpo de texto para objetivo, descricao e callout.
function Texto({ children, sx }) {
  return <Typography sx={{ fontSize: 15.5, lineHeight: 1.7, ...sx }}>{children}</Typography>
}

/**
 * Uma linha da lista de propriedades do topo: icone e rotulo apagados numa
 * coluna fixa, valor na outra. E o bloco que o Notion poe entre o titulo e o
 * corpo — aqui ele acomoda frente, status e posicao sem precisar da barra de
 * chips que atravessava a tela acima do titulo.
 */
function Propriedade({ icone, rotulo, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 30 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: 132,
          flexShrink: 0,
          color: "text.disabled",
          "& svg": { fontSize: 16 },
        }}
      >
        {icone}
        <Typography sx={{ fontSize: 13.5 }} color="text.secondary">
          {rotulo}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}

/**
 * Cabecalho de secao.
 *
 * Era icone colorido + 15px em negrito, do mesmo tamanho do texto que vinha
 * embaixo — dava para confundir com rotulo de campo. Agora e um titulo de
 * nivel 2 de verdade, com o icone apagado ao lado, e a separacao entre secoes
 * vem do espaco acima (mt: 5) em vez de uma linha divisoria.
 */
function SecaoBloco({ icone, titulo, children }) {
  return (
    <Box sx={{ mt: 5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 1.5,
          color: "text.disabled",
          "& svg": { fontSize: 18 },
        }}
      >
        {icone}
        <Typography
          component="h2"
          sx={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.012em" }}
          color="text.primary"
        >
          {titulo}
        </Typography>
      </Box>
      {children}
    </Box>
  )
}

// Render de um conteudo referenciado: AULA aparece inline (leitura); video do
// YouTube toca na propria pagina; os demais como linha de material com link.
function ConteudoEnsinado({ conteudo }) {
  const theme = useTheme()
  const raio = raioPlano(theme)
  const meta = TIPO_CONTEUDO[conteudo.tipo]
  const Icone = meta.icon

  if (conteudo.tipo === "AULA") {
    // Sem moldura: a aula E o corpo da pagina. A caixa com cabecalho tingido
    // punha um documento inteiro dentro de um cartao dentro da coluna, e
    // sobrava uma faixa colorida sem funcao no meio da leitura. Ficou so a
    // credencial em cima, sobre um fio, dizendo de onde o texto veio.
    return (
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            pb: 1,
            mb: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Icone sx={{ fontSize: 16, color: meta.cor, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 600, fontSize: 13.5 }} color="text.secondary" noWrap>
            {conteudo.titulo}
          </Typography>
          {conteudo.duracao && (
            <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
              {conteudo.duracao}
            </Typography>
          )}
        </Box>
        <CorpoDaAula conteudo={conteudo} />
      </Box>
    )
  }

  // Video anexado do YouTube (o caso normal: e de la que a incubadora anexa).
  // Toca dentro do sistema, com o titulo e o resumo em volta — ir ate o
  // YouTube passa a ser opcao, e nao o unico caminho para assistir. Vale para
  // qualquer tipo cujo link seja do YouTube, inclusive o que foi cadastrado
  // como LINK em vez de VIDEO.
  if (ehYoutube(conteudo.url)) {
    return (
      <Box>
        <PlayerYoutube url={conteudo.url} duracao={conteudo.duracao} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1.25 }}>
          <Icone sx={{ fontSize: 18, color: meta.cor, flexShrink: 0 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{conteudo.titulo}</Typography>
          {conteudo.duracao && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
              {conteudo.duracao}
            </Typography>
          )}
        </Box>
        {conteudo.resumo && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {conteudo.resumo}
          </Typography>
        )}
      </Box>
    )
  }

  // Material / Template / Link (e video que nao seja do YouTube) -> linha
  // clicavel, no lugar do cartao com borda. O realce e o fundo que acende no
  // hover, e ele avanca alem da coluna de texto (mx negativo) para o item
  // parecer parte da pagina, e nao um objeto apoiado sobre ela.
  const linha = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.25,
        py: 1.25,
        mx: -1.25,
        borderRadius: raio,
        transition: "background-color .12s",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box
        sx={{
          display: "grid",
          placeItems: "center",
          width: 32,
          height: 32,
          borderRadius: raio,
          bgcolor: `${meta.cor}1f`,
          color: meta.cor,
          flexShrink: 0,
        }}
      >
        <Icone sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14.5 }} color="text.primary">
          {conteudo.titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {conteudo.resumo}
        </Typography>
      </Box>
      <OpenInNew sx={{ fontSize: 16, color: "text.disabled" }} />
    </Box>
  )

  return conteudo.url ? (
    <Link href={conteudo.url} target="_blank" rel="noopener" underline="none">
      {linha}
    </Link>
  ) : (
    linha
  )
}

/**
 * O corpo de uma aula.
 *
 * A API entrega toda aula como `documento` — inclusive as escritas no editor
 * antigo, que ela converte na leitura (documentoAula.js, no backend). O
 * caminho pelos `blocos` continua aqui como rede de seguranca: se por algum
 * motivo o documento chegar vazio e os blocos nao, o incubado le a aula como
 * lia antes, em vez de encontrar uma pagina em branco.
 */
function CorpoDaAula({ conteudo }) {
  if (documentoVazio(conteudo.documento) && conteudo.blocos?.length) {
    return <BlocoView blocos={conteudo.blocos} />
  }

  return (
    <Suspense
      fallback={
        <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
          <CircularProgress size={22} />
        </Box>
      }
    >
      <VisualizadorDocumento documento={conteudo.documento} />
    </Suspense>
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
  const theme = useTheme()
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
        mt: 5,
        p: 2.25,
        borderRadius: raioPlano(theme),
        // Sem borda em volta: o que marca o bloco e a faixa colorida a
        // esquerda, do jeito que uma citacao se destaca numa pagina de texto.
        borderLeft: `3px solid ${cor}`,
        bgcolor: `${cor}10`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: "secondary.main", fontSize: 14 }}>
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
      <Typography sx={{ fontSize: 15, lineHeight: 1.65 }}>{texto}</Typography>
    </Box>
  )
}
