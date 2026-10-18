/**
 * Abrir um material SEM BAIXAR: o visualizador da biblioteca pessoal.
 *
 * Imagem, PDF, documento do Word, planilha, CSV e texto sao desenhados aqui
 * (ver exploradorMeta.tipoDePrevia); o que o navegador nao sabe desenhar
 * (apresentacao, .doc e .xls antigos) ganha o convite para baixar. As setas
 * passam para o material vizinho da pasta, como o visualizador de fotos do
 * Windows.
 *
 * EDITAR: texto e CSV se editam aqui mesmo, e salvar envia uma VERSAO NOVA do
 * arquivo — o mesmo caminho de "Enviar nova versao", so que com o texto que a
 * pessoa acabou de digitar. As startups que receberam o material passam a ver
 * a versao nova, sem ninguem compartilhar de novo.
 *
 * Os leitores de PDF, Word e planilha sao carregados so quando um arquivo
 * daquele tipo e aberto: nenhum deles entra no pacote da pagina.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import {
  ChevronLeft,
  ChevronRight,
  Close,
  Download,
  EditOutlined,
  InfoOutlined,
  MoreVert,
  OpenInNew,
  Save,
  Share,
  UploadFile,
} from "@mui/icons-material"
import IconeFormato from "../IconeFormato"
import ConfirmDialog from "../../programa/ConfirmDialog"
import PreviaTexto, { decodificar } from "./previa/PreviaTexto"
import { buscarArquivo, formatarTamanho } from "../../../services/arquivos"
import { urlArquivoDoMaterial } from "../../../hooks/useEspacoMentor"
import { FORMATOS, dataBR, formatoDoMaterial } from "../../../data/espacoMentorMeta"
import { editavelNoNavegador, tipoDePrevia } from "../../../data/exploradorMeta"

const PreviaPdf = lazy(() => import("./previa/PreviaPdf"))
const PreviaDocx = lazy(() => import("./previa/PreviaDocx"))
const PreviaPlanilha = lazy(() => import("./previa/PreviaPlanilha"))

const URL_HTTP = /^https?:\/\//i

export default function VisualizadorMaterial({
  aberto,
  material,
  lista = [],
  podeCompartilhar,
  // "Editar" no menu do item: abre ja na edicao, assim que o texto chega.
  editarAoAbrir = false,
  onTrocar,
  onFechar,
  onBaixar,
  onAbrirLink,
  onCompartilhar,
  onPropriedades,
  onNovaVersao,
  onSalvarTexto,
}) {
  const theme = useTheme()
  const telaCheia = useMediaQuery(theme.breakpoints.down("sm"))
  const compacto = useMediaQuery(theme.breakpoints.down("md"))

  const previa = tipoDePrevia(material)
  const editavel = editavelNoNavegador(material)

  const [blob, setBlob] = useState(null)
  const [texto, setTexto] = useState(null) // { texto, bom }
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [menu, setMenu] = useState(null)
  const [descartar, setDescartar] = useState(null) // a acao que espera o "descartar"

  const precisaBytes = material?.tipo === "ARQUIVO" && previa !== null

  // Os bytes do arquivo. A chave e o ARQUIVO, nao o material: depois de uma
  // versao nova o id_arquivo muda, e o que esta na tela tem de ser o novo.
  useEffect(() => {
    setBlob(null)
    setTexto(null)
    setErro(null)
    setEditando(false)
    if (!aberto || !precisaBytes) return undefined
    let cancelado = false
    setCarregando(true)
    buscarArquivo(urlArquivoDoMaterial(material))
      .then(async (b) => {
        if (cancelado) return
        if (previa === "TEXTO" || previa === "CSV") setTexto(decodificar(await b.arrayBuffer()))
        setBlob(b)
      })
      .catch((err) => !cancelado && setErro(err.message || "Não foi possível abrir o arquivo."))
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, material?.id_material, material?.id_arquivo, precisaBytes, previa])

  // Uma vez por abertura: depois de salvar, o texto volta a carregar (o arquivo
  // e outro), e a tela nao pode reabrir a edicao sozinha.
  const edicaoPedida = useRef(null)
  useEffect(() => {
    if (!aberto) edicaoPedida.current = null
  }, [aberto])
  useEffect(() => {
    if (!editarAoAbrir || !texto || !material || edicaoPedida.current === material.id_material) return
    edicaoPedida.current = material.id_material
    setRascunho(texto.texto)
    setEditando(true)
  }, [editarAoAbrir, texto, material])

  const urlImagem = useMemo(() => (blob && previa === "IMAGEM" ? URL.createObjectURL(blob) : null), [blob, previa])
  useEffect(() => () => urlImagem && URL.revokeObjectURL(urlImagem), [urlImagem])

  const posicao = material ? lista.findIndex((m) => m.id_material === material.id_material) : -1
  const anterior = posicao > 0 ? lista[posicao - 1] : null
  const proximo = posicao >= 0 && posicao < lista.length - 1 ? lista[posicao + 1] : null

  const alterado = editando && texto && rascunho !== texto.texto

  /** Sair da edicao com texto novo pede confirmacao; sem mudanca, sai direto. */
  const protegido = (acao) => () => (alterado ? setDescartar(() => acao) : acao())

  const fechar = protegido(onFechar)
  const irPara = (m) => protegido(() => m && onTrocar(m))

  const teclas = (e) => {
    if (editando || e.target.closest?.("input, textarea")) return
    if (e.key === "ArrowLeft" && anterior) irPara(anterior)()
    if (e.key === "ArrowRight" && proximo) irPara(proximo)()
  }

  const comecarEdicao = () => {
    setRascunho(texto?.texto ?? "")
    setEditando(true)
  }

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    try {
      await onSalvarTexto(material, rascunho, { bom: texto?.bom })
      setTexto((t) => ({ ...t, texto: rascunho }))
      setEditando(false)
    } catch (err) {
      setErro(err.message || "Não foi possível salvar o arquivo.")
    } finally {
      setSalvando(false)
    }
  }

  if (!material) return null

  const formato = FORMATOS[formatoDoMaterial(material)] || FORMATOS.ARQUIVO
  const ehArquivo = material.tipo === "ARQUIVO"
  const detalhes = [
    formato.rotulo,
    material.arquivo_nome,
    material.arquivo_tamanho ? formatarTamanho(material.arquivo_tamanho) : null,
    material.atualizado_ts ? `modificado em ${dataBR(material.atualizado_ts)}` : null,
  ].filter(Boolean)

  const fecharMenu = (fn) => () => {
    setMenu(null)
    fn?.()
  }

  return (
    <Dialog
      open={aberto}
      onClose={salvando ? undefined : fechar}
      fullWidth
      maxWidth="lg"
      fullScreen={telaCheia}
      onKeyDown={teclas}
      aria-labelledby="visualizador-titulo"
      PaperProps={{ sx: { height: telaCheia ? "100%" : "90vh", display: "flex", flexDirection: "column" } }}
    >
      {/* Cabecalho: o que e, e o que da para fazer com ele. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.25, borderBottom: 1, borderColor: "divider" }}>
        <IconeFormato item={material} tamanho={36} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="visualizador-titulo" sx={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3 }} noWrap>
            {material.titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {detalhes.join(" · ")}
          </Typography>
        </Box>

        {lista.length > 1 && posicao >= 0 && !compacto && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Tooltip title="Anterior (←)">
              <span>
                <IconButton size="small" onClick={irPara(anterior)} disabled={!anterior || salvando}>
                  <ChevronLeft />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 48, textAlign: "center" }}>
              {posicao + 1} de {lista.length}
            </Typography>
            <Tooltip title="Próximo (→)">
              <span>
                <IconButton size="small" onClick={irPara(proximo)} disabled={!proximo || salvando}>
                  <ChevronRight />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}

        {editando ? (
          <>
            <Button onClick={protegido(() => setEditando(false))} disabled={salvando} sx={{ textTransform: "none" }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={salvar}
              disabled={salvando || !alterado}
              startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : <Save />}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </>
        ) : (
          <>
            {editavel && texto && (
              <Botao compacto={compacto} icone={<EditOutlined />} onClick={comecarEdicao}>
                Editar
              </Botao>
            )}
            {ehArquivo ? (
              <Botao compacto={compacto} icone={<Download />} onClick={() => onBaixar(material)}>
                Baixar
              </Botao>
            ) : (
              <Botao compacto={compacto} icone={<OpenInNew />} onClick={() => onAbrirLink(material)}>
                Abrir link
              </Botao>
            )}
            <Tooltip title="Mais ações">
              <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label="Mais ações">
                <MoreVert />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Tooltip title="Fechar (Esc)">
          <span>
            <IconButton size="small" onClick={fechar} disabled={salvando} aria-label="Fechar">
              <Close />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {erro && (
        <Alert severity="error" onClose={() => setErro(null)} sx={{ borderRadius: 0 }}>
          {erro}
        </Alert>
      )}
      {editando && material.startups_compartilhadas?.length > 0 && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {material.startups_compartilhadas.length === 1
            ? `${material.startups_compartilhadas[0].nome} recebeu este material`
            : `${material.startups_compartilhadas.length} startups receberam este material`}
          : ao salvar, elas passam a ver a versão nova.
        </Alert>
      )}

      {/* O conteudo. */}
      <Box sx={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
        <Corpo
          material={material}
          previa={previa}
          carregando={carregando}
          blob={blob}
          texto={texto}
          urlImagem={urlImagem}
          editando={editando}
          rascunho={rascunho}
          onRascunho={setRascunho}
          onBaixar={() => onBaixar(material)}
          onAbrirLink={() => onAbrirLink(material)}
          onNovaVersao={() => onNovaVersao(material)}
        />
      </Box>

      {material.descricao && !editando && (
        <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: "divider", maxHeight: 96, overflow: "auto" }}>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
            {material.descricao}
          </Typography>
        </Box>
      )}

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {ehArquivo && (
          <MenuItem onClick={fecharMenu(() => onNovaVersao(material))}>
            <ListItemIcon>
              <UploadFile fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Enviar nova versão…" secondary="Substitui o arquivo, mantém o resto" />
          </MenuItem>
        )}
        {podeCompartilhar && !material.arquivado && (
          <MenuItem onClick={fecharMenu(() => onCompartilhar(material))}>
            <ListItemIcon>
              <Share fontSize="small" />
            </ListItemIcon>
            <ListItemText>Compartilhar com uma startup</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={fecharMenu(() => onPropriedades(material))}>
          <ListItemIcon>
            <InfoOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Propriedades</ListItemText>
        </MenuItem>
      </Menu>

      <ConfirmDialog
        aberto={Boolean(descartar)}
        titulo="Descartar alterações?"
        mensagem="O texto que você editou ainda não foi salvo e será perdido."
        confirmarTexto="Descartar"
        onConfirmar={() => {
          const acao = descartar
          setDescartar(null)
          setEditando(false)
          acao()
        }}
        onCancelar={() => setDescartar(null)}
      />
    </Dialog>
  )
}

function Botao({ compacto, icone, onClick, children }) {
  if (compacto) {
    return (
      <Tooltip title={children}>
        <IconButton size="small" onClick={onClick} aria-label={children}>
          {icone}
        </IconButton>
      </Tooltip>
    )
  }
  return (
    <Button size="small" startIcon={icone} onClick={onClick} sx={{ textTransform: "none" }}>
      {children}
    </Button>
  )
}

function Carregando() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
      <CircularProgress size={28} />
    </Box>
  )
}

function Corpo({
  material,
  previa,
  carregando,
  blob,
  texto,
  urlImagem,
  editando,
  rascunho,
  onRascunho,
  onBaixar,
  onAbrirLink,
  onNovaVersao,
}) {
  if (previa === "LINK") {
    const valido = URL_HTTP.test(material.url || "")
    return (
      <Box sx={{ display: "grid", placeItems: "center", height: "100%", p: 3, textAlign: "center" }}>
        <Box sx={{ maxWidth: 520 }}>
          <IconeFormato item={material} tamanho={64} />
          <Typography sx={{ mt: 2, fontWeight: 700 }}>Este material é um link</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, wordBreak: "break-all" }}>
            {material.url}
          </Typography>
          {valido && (
            <Button variant="contained" startIcon={<OpenInNew />} onClick={onAbrirLink} sx={{ mt: 2.5, textTransform: "none", fontWeight: 700 }}>
              Abrir em nova aba
            </Button>
          )}
        </Box>
      </Box>
    )
  }

  if (previa === null) {
    const formato = FORMATOS[formatoDoMaterial(material)] || FORMATOS.ARQUIVO
    return (
      <Box sx={{ display: "grid", placeItems: "center", height: "100%", p: 3, textAlign: "center" }}>
        <Box sx={{ maxWidth: 460 }}>
          <IconeFormato item={material} tamanho={64} />
          <Typography sx={{ mt: 2, fontWeight: 700 }}>
            O navegador não consegue mostrar {formato.rotulo === "Arquivo" ? "este arquivo" : `este arquivo (${formato.rotulo.toLowerCase()})`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Baixe para abrir no seu computador. Se você alterar o arquivo, envie a versão nova por aqui: ela
            substitui a atual e as startups que receberam o material passam a ver a nova.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mt: 2.5, flexWrap: "wrap" }}>
            <Button variant="contained" startIcon={<Download />} onClick={onBaixar} sx={{ textTransform: "none", fontWeight: 700 }}>
              Baixar
            </Button>
            <Button variant="outlined" startIcon={<UploadFile />} onClick={onNovaVersao} sx={{ textTransform: "none" }}>
              Enviar nova versão
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  if (carregando || (!blob && !texto)) return <Carregando />

  if (previa === "IMAGEM") {
    return (
      <Box sx={{ display: "grid", placeItems: "center", height: "100%", p: 2, bgcolor: "action.hover" }}>
        <Box
          component="img"
          src={urlImagem}
          alt={material.titulo}
          sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", boxShadow: 1, bgcolor: "#fff" }}
        />
      </Box>
    )
  }

  if (previa === "TEXTO" || previa === "CSV") {
    return (
      <PreviaTexto
        texto={editando ? rascunho : texto?.texto ?? ""}
        csv={previa === "CSV"}
        editando={editando}
        onMudar={onRascunho}
      />
    )
  }

  return (
    <Suspense fallback={<Carregando />}>
      {previa === "PDF" && <PreviaPdf blob={blob} />}
      {previa === "DOCX" && <PreviaDocx blob={blob} />}
      {previa === "XLSX" && <PreviaPlanilha blob={blob} />}
    </Suspense>
  )
}
