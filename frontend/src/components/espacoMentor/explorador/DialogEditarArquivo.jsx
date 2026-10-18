/**
 * "Editar" de um arquivo que o navegador nao reescreve — Word, Excel,
 * PowerPoint, PDF, imagem.
 *
 * Salvar um .docx ou .xlsx pelo navegador jogaria fora formatacao, formula e
 * imagem; o que funciona e o caminho de sempre, so que sem perder o lugar do
 * material: baixar, editar no programa do computador e enviar a versao nova,
 * que SUBSTITUI a atual. O material continua o mesmo — mesma pasta, mesmo
 * titulo, os mesmos compartilhamentos —, e quem o recebeu passa a ver a nova.
 */
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material"
import { Download, UploadFile } from "@mui/icons-material"
import IconeFormato from "../IconeFormato"

const PASSOS = [
  "Baixe o arquivo.",
  "Edite no programa do seu computador (Word, Excel, PowerPoint…) e salve.",
  "Envie a versão nova por aqui: ela substitui a atual.",
]

export default function DialogEditarArquivo({ material, onFechar, onBaixar, onNovaVersao }) {
  const startups = material?.startups_compartilhadas?.length ?? 0
  return (
    <Dialog open={Boolean(material)} onClose={onFechar} fullWidth maxWidth="xs">
      {material && (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, fontWeight: 800 }}>
            <IconeFormato item={material} tamanho={32} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>
                Editar “{material.titulo}”
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {material.arquivo_nome}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box component="ol" sx={{ m: 0, pl: 2.5, "& li": { mb: 0.75 } }}>
              {PASSOS.map((p) => (
                <Typography component="li" variant="body2" key={p}>
                  {p}
                </Typography>
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              O material continua o mesmo: mesma pasta, mesmo título
              {startups > 0
                ? `, e ${startups === 1 ? "a startup que o recebeu passa" : `as ${startups} startups que o receberam passam`} a ver a versão nova.`
                : "."}
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button onClick={onFechar} sx={{ textTransform: "none", mr: "auto" }}>
              Fechar
            </Button>
            <Button variant="outlined" startIcon={<Download />} onClick={() => onBaixar(material)} sx={{ textTransform: "none" }}>
              Baixar
            </Button>
            <Button
              variant="contained"
              startIcon={<UploadFile />}
              onClick={() => onNovaVersao(material)}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Enviar versão nova
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}
