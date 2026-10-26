/**
 * "Conceder selo" — o reconhecimento, em lote.
 *
 * EM LOTE porque o ato real é em lote: "os cinco que apresentaram no Demoday".
 *
 * A JUSTIFICATIVA É OBRIGATÓRIA, e o campo diz por quê: ela aparece na
 * credencial pública, ao lado do critério do selo. Sem ela a página diz apenas
 * que alguém ganhou algo — o que não prova nada para quem lê de fora, e é
 * justamente para provar que a credencial existe.
 *
 * QUALQUER PESSOA DA INCUBADORA pode receber (`exigirLiga` desligado): selo não
 * mexe em placar nenhum, então reconhecer alguém da coordenação ou um incubado
 * recém-chegado é legítimo.
 *
 * A concessão nasce PRIVADA. Quem decide expor o próprio nome numa página
 * aberta é a pessoa, no perfil dela — o aviso no rodapé evita que a
 * coordenação conceda esperando que o selo apareça no LinkedIn sozinho.
 */
import { useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  TextField,
  Typography,
} from "@mui/material"
import { Close } from "@mui/icons-material"

import SeletorPessoas from "./SeletorPessoas"
import SeloAvatar from "./SeloAvatar"

export default function DrawerConcederSelo({
  aberto,
  selo,
  participantes = [],
  onFechar,
  onConceder,
  onSucesso,
}) {
  const [pessoas, setPessoas] = useState([])
  const [justificativa, setJustificativa] = useState("")
  const [evidencia, setEvidencia] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (!aberto) return
    setPessoas([])
    setJustificativa("")
    setEvidencia("")
    setErro(null)
    setResultado(null)
  }, [aberto, selo?.id_selo])

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const res = await onConceder(selo.id_selo, {
        idsUsuarios: pessoas.map((p) => p.id_usuario),
        justificativa: justificativa.trim(),
        evidenciaUrl: evidencia.trim() || undefined,
      })
      setResultado(res)
      setPessoas([])
      onSucesso?.()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível conceder o selo.")
    } finally {
      setSalvando(false)
    }
  }

  const podeSalvar = pessoas.length > 0 && justificativa.trim().length > 0 && !salvando

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={onFechar}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, p: 3 } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Conceder selo
        </Typography>
        <IconButton onClick={onFechar} size="small">
          <Close />
        </IconButton>
      </Box>

      {selo && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <SeloAvatar selo={selo} tamanho={48} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                {selo.nome}
              </Typography>
              {selo.criterio && (
                <Typography variant="caption" color="text.secondary">
                  {selo.criterio}
                </Typography>
              )}
            </Box>
          </Box>

          {erro && (
            <Alert severity="error" sx={{ borderRadius: 0 }}>
              {erro}
            </Alert>
          )}

          {resultado && (
            <Alert
              severity={resultado.ignorados?.length ? "warning" : "success"}
              sx={{ borderRadius: 0 }}
              onClose={() => setResultado(null)}
            >
              Selo concedido a {resultado.concedidas.length} pessoa(s).
              {resultado.ignorados?.length > 0 &&
                ` ${resultado.ignorados.length} já possuíam este selo.`}
            </Alert>
          )}

          <SeletorPessoas
            participantes={participantes}
            valor={pessoas}
            onChange={setPessoas}
            rotulo="Quem recebe"
            ajuda="Qualquer pessoa da incubadora pode receber, selo não entra no placar."
          />

          <TextField
            label="Por que esta pessoa merece"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            multiline
            minRows={3}
            required
            inputProps={{ maxLength: 500 }}
            helperText="Aparece na credencial pública, junto do critério do selo. É o que faz a credencial provar alguma coisa."
          />

          <TextField
            label="Link de evidência (opcional)"
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
            placeholder="https://..."
            helperText="Um post, um relatório, um vídeo do pitch."
          />

          <Button
            variant="contained"
            onClick={salvar}
            disabled={!podeSalvar}
            startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Conceder
          </Button>

          <Alert severity="info" sx={{ borderRadius: 0 }}>
            A conquista nasce <strong>privada</strong>. Quem decide gerar a credencial pública
            (para publicar no LinkedIn) é a própria pessoa, no perfil dela.
          </Alert>
        </Box>
      )}
    </Drawer>
  )
}
