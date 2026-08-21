/**
 * Uma linha das listas das telas de Configuracoes — o item com nome, subtitulo,
 * um adorno a esquerda e os dois botoes (editar / ativar-desativar).
 *
 * Compartilhada porque e o mesmo item em toda parte: tipo de startup, status de
 * startup, coluna do quadro, campo personalizavel dos dois. O que muda entre
 * elas e o `adorno` e o `subtitulo`, e e por isso que os dois entram por prop.
 *
 * O SEGUNDO BOTAO E UM INTERRUPTOR, e nao uma lixeira, porque a operacao e
 * desativar e nao excluir: os registros que usam o item continuam apontando
 * para ele, e reativar traz tudo de volta. Ver os repositorios de configuracao.
 */
import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material"
import { Edit, ToggleOff, ToggleOn } from "@mui/icons-material"

export default function LinhaConfig({ titulo, subtitulo, adorno, ativo, onEditar, onAlternar }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1.25,
        opacity: ativo ? 1 : 0.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      {adorno}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {titulo}
        </Typography>
        {subtitulo && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitulo}
          </Typography>
        )}
      </Box>
      {!ativo && <Chip size="small" label="Desativado" />}
      <Tooltip title="Editar">
        <IconButton size="small" onClick={onEditar}>
          <Edit fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={ativo ? "Desativar" : "Reativar"}>
        <IconButton size="small" onClick={onAlternar}>
          {ativo ? <ToggleOn fontSize="small" color="primary" /> : <ToggleOff fontSize="small" />}
        </IconButton>
      </Tooltip>
    </Box>
  )
}

/** O quadradinho de cor a esquerda de cada linha. */
export function Bolinha({ cor }) {
  return <Box sx={{ width: 28, height: 28, borderRadius: "8px", bgcolor: cor, flexShrink: 0 }} />
}
