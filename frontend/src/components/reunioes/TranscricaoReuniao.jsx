/**
 * A transcricao no detalhe da reuniao (Etapa 4): onde ela esta (na fila da
 * noite, transcrevendo, pronta, com lacunas, falhou), o texto para quem pode
 * ler, o historico de processamento e o "transcrever de novo".
 *
 * QUEM VE O QUE vem do servidor, em `reuniao.permissoes`:
 *   ler            anfitriao ou `reunioes.transcricoes.visualizar`
 *   processamentos anfitriao, quem edita reunioes ou quem reprocessa
 *   reprocessar    `reunioes.relatorios.reprocessar`, com a reuniao encerrada
 *
 * O TEXTO so e pedido no clique: cada leitura vai para a auditoria do
 * servidor, e abrir o detalhe para ver a hora nao e ler a conversa.
 */
import { useState } from "react"
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material"
import { ContentCopy, Download, ExpandLess, ExpandMore, History, Replay, Subject } from "@mui/icons-material"
import { mensagemErro, reunioesApi } from "../../services/reunioesApi"
import {
  agruparTrechos,
  duracao,
  horaComSegundos,
  iniciais,
  instanteBR,
  situacaoTranscricao,
  transcricaoEmTexto,
} from "../../data/reuniaoMeta"

const STATUS_PROC = {
  PENDENTE: "Na fila",
  PROCESSANDO: "Processando",
  CONCLUIDO: "Concluído",
  FALHOU: "Falhou",
  CANCELADO: "Cancelado",
}

function Historico({ idReuniao }) {
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState(null)
  const [aberto, setAberto] = useState(false)

  const alternar = async () => {
    const abrir = !aberto
    setAberto(abrir)
    if (abrir) {
      try {
        setLista(await reunioesApi.processamentos(idReuniao))
      } catch (err) {
        setErro(mensagemErro(err, "Não foi possível carregar o histórico."))
      }
    }
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      <Button size="small" startIcon={<History />} endIcon={aberto ? <ExpandLess /> : <ExpandMore />} onClick={alternar}>
        Histórico de processamento
      </Button>
      <Collapse in={aberto} unmountOnExit>
        {erro && <Alert severity="error">{erro}</Alert>}
        {!lista && !erro && <CircularProgress size={20} sx={{ display: "block", my: 1 }} />}
        {lista && lista.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Nenhum processamento ainda.
          </Typography>
        )}
        {lista && lista.length > 0 && (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Pedido</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Tentativas</TableCell>
                  <TableCell>Provedor</TableCell>
                  <TableCell align="right">Áudio</TableCell>
                  <TableCell>Detalhe</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lista.map((p) => (
                  <TableRow key={p.id_processamento}>
                    <TableCell>
                      {instanteBR(p.criado_ts)}
                      <Typography variant="caption" color="text.secondary" component="div">
                        {p.solicitado_por_nome ? `pedido por ${p.solicitado_por_nome}` : "automático"}
                      </Typography>
                    </TableCell>
                    <TableCell>{STATUS_PROC[p.status] || p.status}</TableCell>
                    <TableCell align="right">{p.tentativas}</TableCell>
                    <TableCell>{p.provedor ? `${p.provedor} · ${p.modelo}` : "—"}</TableCell>
                    <TableCell align="right">{p.segundos_audio ? duracao(p.segundos_audio) : "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography variant="caption" sx={{ wordBreak: "break-word" }}>
                        {p.erro_mensagem || (p.concluido_ts ? `terminou ${instanteBR(p.concluido_ts)}` : "—")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Collapse>
    </Box>
  )
}

function TextoDaTranscricao({ reuniao, dados }) {
  const [copiado, setCopiado] = useState(false)
  const blocos = agruparTrechos(dados.trechos)
  const texto = () => transcricaoEmTexto(reuniao, dados.trechos)

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto())
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setCopiado(false)
    }
  }
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([texto()], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `transcricao-reuniao-${reuniao.id_reuniao}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (blocos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        A gravação não tinha fala para transcrever.
      </Typography>
    )
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
        <Button size="small" variant="outlined" startIcon={<ContentCopy />} onClick={copiar}>
          {copiado ? "Copiado" : "Copiar o texto"}
        </Button>
        <Button size="small" variant="outlined" startIcon={<Download />} onClick={baixar}>
          Baixar .txt
        </Button>
      </Box>
      <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5, maxHeight: 560, overflowY: "auto" }}>
        {blocos.map((b) => (
          <Box component="li" key={b.chave} sx={{ display: "flex", gap: 1.25 }}>
            <Avatar sx={{ width: 30, height: 30, fontSize: 12, mt: 0.25 }}>{iniciais(b.nome)}</Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
                  {b.nome}
                </Box>{" "}
                · {horaComSegundos(b.inicio_ts)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {b.textos.join(" ")}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

export default function TranscricaoReuniao({ reuniao, onAtualizar }) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const [pedindo, setPedindo] = useState(false)

  const s = situacaoTranscricao(reuniao)
  if (!s) return null
  const { permissoes } = reuniao
  const pronta = ["COMPLETA", "INCOMPLETA"].includes(reuniao.transcricao)

  const ler = async () => {
    setCarregando(true)
    setErro(null)
    try {
      setDados(await reunioesApi.transcricao(reuniao.id_reuniao))
    } catch (err) {
      setErro(mensagemErro(err, "Não foi possível carregar a transcrição."))
    } finally {
      setCarregando(false)
    }
  }

  const reprocessar = async () => {
    setPedindo(true)
    try {
      await reunioesApi.reprocessar(reuniao.id_reuniao)
      setConfirmar(false)
      setDados(null)
      await onAtualizar?.()
    } catch (err) {
      setConfirmar(false)
      setErro(mensagemErro(err, "Não foi possível pedir a transcrição de novo."))
    } finally {
      setPedindo(false)
    }
  }

  return (
    <Paper variant="outlined" sx={{ mt: 2.5, p: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mr: 0.5 }}>
          Transcrição
        </Typography>
        <Chip size="small" label={s.rotulo} color={s.cor} variant={s.cor === "default" ? "outlined" : "filled"} />
      </Box>
      {s.detalhe && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {s.detalhe}
        </Typography>
      )}
      {erro && (
        <Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
        {permissoes.ler && pronta && !dados && (
          <Button variant="contained" size="small" startIcon={carregando ? <CircularProgress size={16} color="inherit" /> : <Subject />} disabled={carregando} onClick={ler}>
            Ler a transcrição
          </Button>
        )}
        {permissoes.reprocessar && (
          <Button variant="outlined" size="small" startIcon={<Replay />} onClick={() => setConfirmar(true)}>
            Transcrever de novo
          </Button>
        )}
      </Box>
      {pronta && !permissoes.ler && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          A transcrição é lida pelo anfitrião e pela coordenação.
        </Typography>
      )}

      {dados && <TextoDaTranscricao reuniao={reuniao} dados={dados} />}
      {permissoes.processamentos && <Historico idReuniao={reuniao.id_reuniao} />}

      <Dialog open={confirmar} onClose={pedindo ? undefined : () => setConfirmar(false)}>
        <DialogTitle>Transcrever de novo?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A transcrição atual é substituída pela nova, que roda na próxima janela da noite. Só funciona enquanto o áudio
            ainda está guardado — pela retenção da incubadora, ele pode já ter sido apagado.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmar(false)} disabled={pedindo}>
            Voltar
          </Button>
          <Button variant="contained" onClick={reprocessar} disabled={pedindo} startIcon={pedindo ? <CircularProgress size={16} /> : null}>
            Pedir nova transcrição
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
