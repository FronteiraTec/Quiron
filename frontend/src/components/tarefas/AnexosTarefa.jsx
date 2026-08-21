/**
 * Os anexos de uma tarefa, dentro do painel de cadastro.
 *
 * O ARQUIVO SOBE NA HORA, e nao junto do "Salvar". Sao dois motivos:
 *
 *   1. A tarefa pode nem existir ainda. Num cadastro novo nao ha id para
 *      amarrar o upload, e segurar os bytes em memoria ate o Salvar faria um
 *      formulario aberto por meia hora carregar 40MB de anexo no navegador.
 *   2. Upload demora e pode falhar sozinho. Misturado ao Salvar, um PDF grande
 *      deixaria o botao travado sem explicacao, e uma falha de rede perderia
 *      junto o texto que a pessoa acabou de escrever.
 *
 * Entao cada arquivo vira um registro assim que e escolhido, e o que a tarefa
 * guarda ao salvar e a LISTA DE IDS. A consequencia — um arquivo enviado e
 * depois abandonado (a pessoa fecha o painel sem salvar) fica no volume sem
 * vinculo — e conhecida e barata: e um registro em `arquivo` sem linha em
 * `tarefa_anexo`, invisivel para todo mundo, que uma limpeza periodica pode
 * varrer quando alguem sentir falta.
 *
 * REMOVER AQUI E DESANEXAR, nunca apagar: o mesmo arquivo pode estar anexado
 * em outro lugar. Quem apaga bytes e o arquivoService, e ninguem o chama daqui.
 */
import { useRef, useState } from "react"
import { Alert, Box, CircularProgress, IconButton, Link, Tooltip, Typography } from "@mui/material"
import { AttachFile, DeleteOutline, InsertDriveFile } from "@mui/icons-material"
import { abrirArquivo, enviarArquivo, formatarTamanho } from "../../services/arquivos"

export default function AnexosTarefa({ idTenant, idTarefa, anexos = [], onChange, somenteLeitura = false }) {
  const inputRef = useRef(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const escolher = async (evento) => {
    const arquivos = [...(evento.target.files || [])]
    // Zera o input ANTES do await: sem isso, escolher o mesmo arquivo duas
    // vezes seguidas nao dispara `change` na segunda.
    evento.target.value = ""
    if (!arquivos.length) return

    setEnviando(true)
    setErro(null)
    try {
      // Em serie, e nao em paralelo: tres uploads simultaneos de 15MB competem
      // pela mesma banda e o primeiro a terminar e imprevisivel — a lista
      // apareceria fora da ordem em que a pessoa escolheu.
      const novos = []
      for (const arquivo of arquivos) {
        novos.push(await enviarArquivo(arquivo, { idTenant, visibilidade: "PRIVADO" }))
      }
      onChange([...anexos, ...novos])
    } catch (err) {
      setErro(
        err.response?.data?.erro ||
          "Não foi possível enviar o arquivo. Confira o tamanho e o formato."
      )
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Abre um anexo.
   *
   * PELA ROTA DA TAREFA (/tarefas/:id/anexos/:idArquivo), e nao por
   * /arquivos/:id: e a tarefa que autoriza este arquivo, e a rota generica
   * responderia 403 para quem participa da tarefa sem ser o dono do upload.
   * Ver tarefaService.abrirAnexo.
   *
   * O anexo recem-enviado ainda nao tem tarefa (o cadastro nao foi salvo):
   * nesse caso cai na rota generica, que funciona porque quem acabou de enviar
   * e o dono do arquivo.
   */
  const abrir = async (anexo) => {
    setErro(null)
    const url = idTarefa
      ? `/api/tarefas/${idTarefa}/anexos/${anexo.id_arquivo}?id_tenant=${idTenant}`
      : `/api/arquivos/${anexo.id_arquivo}`
    try {
      await abrirArquivo(url, anexo.nome_original)
    } catch (err) {
      setErro(err.message || "Não foi possível abrir o anexo.")
    }
  }

  const remover = (id) => onChange(anexos.filter((a) => a.id_arquivo !== id))

  return (
    <Box>
      {erro && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {anexos.map((anexo) => (
        <Box
          key={anexo.id_arquivo}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            py: 0.75,
            px: 1,
            mb: 0.5,
            borderRadius: 1,
            border: 1,
            borderColor: "divider",
          }}
        >
          <InsertDriveFile sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => abrir(anexo)}
              sx={{ display: "block", textAlign: "left", maxWidth: "100%" }}
              noWrap
            >
              {anexo.nome_original}
            </Link>
            <Typography variant="caption" color="text.secondary">
              {formatarTamanho(anexo.tamanho)}
              {anexo.anexado_por_nome ? ` · ${anexo.anexado_por_nome}` : ""}
            </Typography>
          </Box>
          {!somenteLeitura && (
            <Tooltip title="Remover da tarefa">
              <IconButton size="small" onClick={() => remover(anexo.id_arquivo)}>
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ))}

      {anexos.length === 0 && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Nenhum anexo.
        </Typography>
      )}

      {!somenteLeitura && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={escolher}
            // Sem `accept`: a lista de tipos aceitos mora no backend
            // (arquivoService), e repeti-la aqui daria duas listas para manter.
            // O erro do servidor explica o que foi recusado.
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              {enviando ? <CircularProgress size={14} /> : <AttachFile sx={{ fontSize: 16 }} />}
              {enviando ? "Enviando..." : "Anexar arquivo"}
            </Link>
          </Box>
        </>
      )}
    </Box>
  )
}

/** O clipe com a contagem, para o cartao e a linha da tabela. */
export function SeloAnexos({ total }) {
  if (!total) return null
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        color: "text.secondary",
      }}
    >
      <AttachFile sx={{ fontSize: 14 }} />
      <Typography variant="caption">{total}</Typography>
    </Box>
  )
}
