/**
 * Vocabulario visual dos destinos de uma mensagem.
 *
 * O backend grava o destino como {tipo, id_referencia, rotulo} e congela o
 * rotulo no envio (a startup pode ser renomeada depois — ver migracao 012).
 * Aqui so damos icone, cor e uma forma curta de dizer "para quem foi", usada
 * pelo sino, pela pagina de Mensagens e pelo formulario de envio.
 */
import { Chip } from "@mui/material"
import { Apartment, RocketLaunch, SupervisorAccount, Badge as BadgeIcon, Person } from "@mui/icons-material"

/** Icone e rotulo generico de cada tipo de destino (enum mensagemDestinoTipo). */
export const TIPOS_DESTINO = {
  TENANT: { rotulo: "Toda a incubadora", Icone: Apartment, cor: "primary" },
  STARTUP: { rotulo: "Startup", Icone: RocketLaunch, cor: "secondary" },
  MENTORES: { rotulo: "Mentores", Icone: SupervisorAccount, cor: "info" },
  ROLE: { rotulo: "Role", Icone: BadgeIcon, cor: "warning" },
  USUARIO: { rotulo: "Pessoa", Icone: Person, cor: "default" },
}

/**
 * O texto de "para quem foi", curto o bastante para caber numa linha do sino.
 * @param {Array<{tipo:string, rotulo?:string}>} destinos
 * @param {number} [max] - quantos aparecem antes do "+N".
 */
export function resumirDestinos(destinos, max = 2) {
  if (!destinos?.length) return ""
  const nomes = destinos.map((d) => d.rotulo || TIPOS_DESTINO[d.tipo]?.rotulo || d.tipo)
  if (nomes.length <= max) return nomes.join(", ")
  return `${nomes.slice(0, max).join(", ")} +${nomes.length - max}`
}

/** Um chip por destino, com o icone do tipo. Usado nas listas de mensagem. */
export default function ChipsDestino({ destinos, max = 3, size = "small" }) {
  if (!destinos?.length) return null

  const visiveis = destinos.slice(0, max)
  const restantes = destinos.length - visiveis.length

  return (
    <>
      {visiveis.map((d, i) => {
        const info = TIPOS_DESTINO[d.tipo] || TIPOS_DESTINO.USUARIO
        const Icone = info.Icone
        return (
          <Chip
            key={`${d.tipo}-${d.id_referencia ?? "geral"}-${i}`}
            size={size}
            variant="outlined"
            color={info.cor}
            icon={<Icone sx={{ fontSize: 16 }} />}
            label={d.rotulo || info.rotulo}
            sx={{ maxWidth: 240 }}
          />
        )
      })}
      {restantes > 0 && <Chip size={size} variant="outlined" label={`+${restantes}`} />}
    </>
  )
}
