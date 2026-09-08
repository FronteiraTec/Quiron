/**
 * O disco do selo: imagem enviada pela incubadora ou, na falta dela, o icone
 * sobre a cor escolhida.
 *
 * A IMAGEM E OPCIONAL de proposito. Exigir arte para cadastrar um selo faria a
 * incubadora parar no primeiro — e um selo com icone e cor ja e reconhecivel
 * na tela e na credencial. Quem tiver identidade visual sobe a arte depois,
 * sem recadastrar nada.
 *
 * Usado no mural, no catalogo, no perfil e no drawer de concessao, sempre com
 * o mesmo desenho: o selo precisa ser a MESMA coisa nos quatro lugares, senao
 * a pessoa nao reconhece no perfil o que viu no mural.
 */
import { Avatar, Box } from "@mui/material"
import { iconeDe } from "./vocabulario"

/**
 * @param {object} props
 * @param {{nome:string, cor:string, icone:string, imagem_url?:string}} props.selo
 * @param {number} [props.tamanho]
 * @param {boolean} [props.apagado] - revogado/inativo: perde a cor, mantem a forma.
 */
export default function SeloAvatar({ selo, tamanho = 48, apagado = false }) {
  const Icone = iconeDe(selo?.icone)
  const cor = selo?.cor || "#7c3aed"

  if (selo?.imagem_url) {
    return (
      <Avatar
        src={selo.imagem_url}
        alt={selo.nome || selo.selo || ""}
        sx={{
          width: tamanho,
          height: tamanho,
          // O revogado nao some da tela: fica cinza. Ver o cabecalho da
          // migracao 017 — a credencial revogada precisa continuar legivel.
          filter: apagado ? "grayscale(1)" : "none",
          opacity: apagado ? 0.5 : 1,
        }}
      />
    )
  }

  return (
    <Box
      sx={{
        width: tamanho,
        height: tamanho,
        borderRadius: "50%",
        flex: `0 0 ${tamanho}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: apagado ? "action.disabledBackground" : cor,
        color: apagado ? "text.disabled" : "#fff",
      }}
    >
      <Icone sx={{ fontSize: tamanho * 0.5 }} />
    </Box>
  )
}
