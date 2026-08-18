/**
 * Botao de exportar CSV de uma tabela de relatorio.
 *
 * Fica ao lado da tabela, e nao no cabecalho da pagina: numa tela com duas
 * tabelas (fila de avaliacao e desempenho dos mentores, por exemplo) um botao
 * unico no topo nao diria qual das duas ele baixa.
 */
import { Button } from "@mui/material"
import { FileDownload } from "@mui/icons-material"

/**
 * @param {object} props
 * @param {() => void} props.onClick
 * @param {string} [props.rotulo]
 * @param {boolean} [props.desabilitado]
 */
export default function BotaoExportar({ onClick, rotulo = "Exportar CSV", desabilitado }) {
  return (
    <Button
      data-tour="relatorio-exportar"
      size="small"
      variant="text"
      startIcon={<FileDownload fontSize="small" />}
      onClick={onClick}
      disabled={desabilitado}
    >
      {rotulo}
    </Button>
  )
}
