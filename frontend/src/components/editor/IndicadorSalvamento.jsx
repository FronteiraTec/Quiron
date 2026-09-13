/**
 * O aviso de "Salvando…" / "Salvo" do editor.
 *
 * Com salvamento automatico, o botao Salvar deixa de existir — e com ele some
 * a unica pista de que o trabalho esta guardado. Este e o substituto: discreto
 * quando tudo vai bem, explicito quando nao vai.
 *
 * Erro nao e so texto: vem com o botao de tentar de novo. O hook ja repete
 * sozinho, mas quem acabou de ver "não foi possível salvar" quer agir, nao
 * esperar.
 */
import { Box, Typography, Button, CircularProgress, Tooltip } from "@mui/material"
import { CloudDone, CloudOff, CloudQueue, Refresh } from "@mui/icons-material"

/** Hora no formato curto ("14:07"), para o "Salvo às". */
const hora = (data) =>
  data?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export default function IndicadorSalvamento({ estado, erro, salvoEm, onTentarNovamente }) {
  if (estado === "erro") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title={erro || ""} arrow>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "error.main" }}>
            <CloudOff sx={{ fontSize: 18 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Não foi possível salvar
            </Typography>
          </Box>
        </Tooltip>
        <Button
          size="small"
          startIcon={<Refresh sx={{ fontSize: 16 }} />}
          onClick={onTentarNovamente}
          sx={{ textTransform: "none" }}
        >
          Tentar agora
        </Button>
      </Box>
    )
  }

  if (estado === "salvando") {
    return (
      <Estado icone={<CircularProgress size={13} />} texto="Salvando…" />
    )
  }

  if (estado === "pendente") {
    return (
      <Estado
        icone={<CloudQueue sx={{ fontSize: 18 }} />}
        texto="Alterações não salvas"
      />
    )
  }

  if (estado === "salvo") {
    return (
      <Estado
        icone={<CloudDone sx={{ fontSize: 18 }} />}
        texto={salvoEm ? `Salvo às ${hora(salvoEm)}` : "Salvo"}
      />
    )
  }

  // "ocioso": nada foi alterado ainda; um aviso aqui seria ruido.
  return null
}

function Estado({ icone, texto }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
      {icone}
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {texto}
      </Typography>
    </Box>
  )
}
