/**
 * O material compartilhado, aberto: o que e, quem mandou, quando, para que
 * lugar da trilha — e, antes de tudo, POR QUE. A orientacao do mentor vem em
 * destaque, acima do botao de abrir: e ela que transforma um anexo solto num
 * encaminhamento de mentoria, e a startup precisa le-la antes de abrir o
 * arquivo, nao depois.
 *
 * Serve aos dois lados: a startup abre daqui na Jornada, e o mentor confere
 * daqui o que entregou. A AULA da Biblioteca e lida aqui mesmo (o corpo vem de
 * GET /jornada/materiais/:id); arquivo e link abrem fora.
 */
import { Suspense, lazy, useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { Close, OpenInNew, Download, FormatQuote, Place, Person } from "@mui/icons-material"
import IconeFormato from "./IconeFormato"
import { abrirMaterial, temAbertura } from "./abrirMaterial"
import { detalharRecebido, erroDe } from "../../hooks/useEspacoMentor"
import {
  FINALIDADES,
  FORMATOS,
  dataBR,
  formatoDoMaterial,
  rotuloEtapa,
} from "../../data/espacoMentorMeta"
import { formatarTamanho } from "../../services/arquivos"

// O leitor de aulas carrega o BlockNote: so vem quando uma AULA e aberta.
const VisualizadorDocumento = lazy(() => import("../editor/VisualizadorDocumento"))

export default function DialogMaterial({ aberto, item, onFechar }) {
  const theme = useTheme()
  const telaCheia = useMediaQuery(theme.breakpoints.down("sm"))
  const ehAula = item?.origem === "INSTITUCIONAL" && item?.tipo === "AULA"

  const [documento, setDocumento] = useState(null)
  const [carregandoAula, setCarregandoAula] = useState(false)
  const [abrindo, setAbrindo] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    setErro(null)
    setDocumento(null)
    if (!aberto || !ehAula) return
    let cancelado = false
    setCarregandoAula(true)
    detalharRecebido(item.id_compartilhamento)
      .then((m) => !cancelado && setDocumento(m.documento ?? []))
      .catch((err) => !cancelado && setErro(erroDe(err, "Não foi possível carregar a aula.")))
      .finally(() => !cancelado && setCarregandoAula(false))
    return () => {
      cancelado = true
    }
  }, [aberto, ehAula, item?.id_compartilhamento])

  if (!item) return null

  const formato = FORMATOS[formatoDoMaterial(item)] || FORMATOS.ARQUIVO
  const finalidade = FINALIDADES[item.finalidade] || FINALIDADES.REFERENCIA
  const ehArquivo = Boolean(item.arquivo_url)

  const abrir = async () => {
    setErro(null)
    setAbrindo(true)
    try {
      await abrirMaterial(item)
    } catch (err) {
      setErro(err.message || "Não foi possível abrir o material.")
    } finally {
      setAbrindo(false)
    }
  }

  return (
    <Dialog
      open={aberto}
      onClose={onFechar}
      fullWidth
      maxWidth={ehAula ? "md" : "sm"}
      fullScreen={telaCheia}
      aria-labelledby="dialog-material-titulo"
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 3, pt: 2.5, pb: 1 }}>
        <IconeFormato item={item} tamanho={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography id="dialog-material-titulo" sx={{ fontWeight: 800, fontSize: 19, lineHeight: 1.3 }}>
            {item.titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formato.rotulo}
            {item.arquivo_nome ? ` · ${item.arquivo_nome}` : ""}
            {item.arquivo_tamanho ? ` · ${formatarTamanho(item.arquivo_tamanho)}` : ""}
            {item.origem === "INSTITUCIONAL" ? " · Biblioteca da incubadora" : ""}
          </Typography>
        </Box>
        <IconButton onClick={onFechar} size="small" aria-label="Fechar">
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={0.75} sx={{ mb: 2 }}>
          <Linha icone={<Person />}>
            {item.compartilhado_por_nome ? `Compartilhado por ${item.compartilhado_por_nome}` : "Compartilhado por um mentor"}
            {item.criado_ts ? ` em ${dataBR(item.criado_ts)}` : ""}
          </Linha>
          <Linha icone={<Place />}>
            {item.programa_nome} › {rotuloEtapa(item)}
          </Linha>
          <Box>
            <Chip
              size="small"
              label={finalidade.rotulo}
              sx={{ fontWeight: 700, bgcolor: `${finalidade.cor}1f`, color: finalidade.cor }}
            />
          </Box>
        </Stack>

        {item.orientacao && (
          <Box
            sx={{
              p: 2,
              mb: 2,
              borderRadius: "4px",
              borderLeft: "3px solid",
              borderColor: "primary.main",
              bgcolor: "action.hover",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5, color: "text.secondary" }}>
              <FormatQuote sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em" }}>
                ORIENTAÇÃO DO MENTOR
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
              {item.orientacao}
            </Typography>
          </Box>
        )}

        {item.descricao && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: "pre-wrap" }}>
            {item.descricao}
          </Typography>
        )}

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        {ehAula && (
          <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
            {carregandoAula || documento === null ? (
              !erro && (
                <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              )
            ) : (
              <Suspense
                fallback={
                  <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                }
              >
                <VisualizadorDocumento documento={documento} />
              </Suspense>
            )}
          </Box>
        )}

        {!ehAula && !temAbertura(item) && (
          <Alert severity="info" variant="outlined">
            Este material não tem arquivo nem link — o conteúdo é a descrição acima.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onFechar} sx={{ textTransform: "none" }}>
          Fechar
        </Button>
        {!ehAula && temAbertura(item) && (
          <Button
            variant="contained"
            onClick={abrir}
            disabled={abrindo}
            startIcon={abrindo ? <CircularProgress size={16} color="inherit" /> : ehArquivo ? <Download /> : <OpenInNew />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {ehArquivo ? "Abrir arquivo" : "Abrir link"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

function Linha({ icone, children }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", "& svg": { fontSize: 17 } }}>
      {icone}
      <Typography variant="body2">{children}</Typography>
    </Box>
  )
}
