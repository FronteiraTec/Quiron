/**
 * "Minhas conquistas" no Perfil: os selos recebidos e o interruptor da
 * credencial pública.
 *
 * O INTERRUPTOR E DO DONO, e mora aqui e nao na tela da coordenacao: a
 * credencial e uma pagina ABERTA com o nome da pessoa, e quem decide expor o
 * proprio nome e ela. O backend amarra isso na propria query — nenhum caminho
 * de chamada torna publica a conquista de outra pessoa.
 *
 * LIGADO, aparecem os dois botoes que levam ao LinkedIn:
 *   ADICIONAR AO PERFIL usa o deep link oficial de Licencas e Certificados. O
 *   selo entra na secao de certificacoes com nome, data e o link desta pagina
 *   como comprovante — e fica la, ao contrario de um post que some do feed.
 *   COMPARTILHAR publica o link no feed.
 * Nenhum dos dois exige conectar conta nem autorizar aplicativo.
 *
 * AS REVOGADAS CONTINUAM NA LISTA, em cinza e com o motivo: a pessoa precisa
 * entender por que a credencial que ela publicou parou de valer. Esconder a
 * linha so geraria a duvida.
 */
import { useState } from "react"
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Link,
  Paper,
  Skeleton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material"
import { ContentCopy, Launch, MilitaryTech, OpenInNew } from "@mui/icons-material"

import SeloAvatar from "../engajamento/SeloAvatar"
import { dataBR } from "../engajamento/vocabulario"
import { useMeusSelos } from "../../hooks/useSelos"

/** A URL publica da credencial, na origem em que a pessoa esta navegando. */
const urlCredencial = (codigo) => `${window.location.origin}/credencial/${codigo}`

/**
 * O deep link de "Adicionar ao perfil" do LinkedIn.
 *
 * Montado no front porque depende da URL de origem (o mesmo sistema pode
 * responder em localhost e num dominio real). Os parametros sao os
 * documentados pela LinkedIn para certificacoes.
 */
function linkAdicionarAoPerfil(selo, incubadora) {
  const emissao = new Date(selo.concedido_ts)
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: selo.selo,
    organizationName: incubadora || "",
    issueYear: String(emissao.getFullYear()),
    issueMonth: String(emissao.getMonth() + 1),
    certUrl: urlCredencial(selo.codigo),
    certId: selo.codigo,
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

function Conquista({ selo, incubadora, onAlterarPublico }) {
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const revogada = Boolean(selo.revogado_ts)

  async function alternar(publico) {
    setSalvando(true)
    try {
      await onAlterarPublico(selo.id_concessao, publico)
    } finally {
      setSalvando(false)
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(urlCredencial(selo.codigo))
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sem permissao de area de transferencia: o link continua visivel no
      // botao "Abrir credencial", entao nao ha nada a avisar.
    }
  }

  return (
    <Paper
      sx={{
        borderRadius: 0,
        p: 2,
        display: "flex",
        gap: 2,
        alignItems: "flex-start",
        borderLeft: "3px solid",
        borderLeftColor: revogada ? "divider" : selo.cor,
      }}
    >
      <SeloAvatar selo={{ ...selo, nome: selo.selo }} tamanho={48} apagado={revogada} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {selo.selo}
          </Typography>
          {selo.categoria && <Chip size="small" label={selo.categoria} variant="outlined" />}
          {revogada && <Chip size="small" color="default" label="Revogada" />}
        </Box>

        <Typography variant="caption" color="text.secondary" display="block">
          {dataBR(selo.concedido_ts)}
          {selo.startup ? ` · ${selo.startup}` : ""}
          {selo.concedido_por_nome ? ` · por ${selo.concedido_por_nome}` : ""}
        </Typography>

        {selo.justificativa && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {selo.justificativa}
          </Typography>
        )}

        {revogada ? (
          <Alert severity="warning" sx={{ borderRadius: 0, mt: 1.5 }}>
            Revogada em {dataBR(selo.revogado_ts)}
            {selo.motivo_revogacao ? `: ${selo.motivo_revogacao}` : "."}
          </Alert>
        ) : (
          <Box sx={{ mt: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={selo.publico}
                  disabled={salvando}
                  onChange={(e) => alternar(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  {selo.publico
                    ? "Credencial pública ativa"
                    : "Gerar credencial pública para compartilhar"}
                </Typography>
              }
            />

            {selo.publico && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<Launch />}
                  href={linkAdicionarAoPerfil(selo, incubadora)}
                  target="_blank"
                  rel="noopener"
                >
                  Adicionar ao LinkedIn
                </Button>
                <Button
                  size="small"
                  startIcon={<OpenInNew />}
                  href={urlCredencial(selo.codigo)}
                  target="_blank"
                  rel="noopener"
                >
                  Ver credencial
                </Button>
                <Tooltip title={copiado ? "Link copiado!" : "Copiar o link da credencial"}>
                  <Button size="small" startIcon={<ContentCopy />} onClick={copiarLink}>
                    {copiado ? "Copiado" : "Copiar link"}
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  )
}

export default function MeusSelos({ idTenant, incubadora }) {
  const { selos, carregando, erro, alterarPublico } = useMeusSelos(idTenant)

  if (carregando) return <Skeleton variant="rectangular" height={140} />
  if (erro) {
    return (
      <Alert severity="error" sx={{ borderRadius: 0 }}>
        {erro}
      </Alert>
    )
  }

  if (selos.length === 0) {
    return (
      <Paper sx={{ borderRadius: 0, p: 3, textAlign: "center" }}>
        <MilitaryTech sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
        <Typography color="text.secondary">
          Você ainda não recebeu selos. Eles reconhecem evolução e protagonismo, e não dependem
          de acumular pontos.
        </Typography>
        <Link href="/engajamento" variant="body2" sx={{ mt: 1, display: "inline-block" }}>
          Ver o que esta incubadora reconhece
        </Link>
      </Paper>
    )
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {selos.map((selo) => (
        <Conquista
          key={selo.id_concessao}
          selo={selo}
          incubadora={incubadora}
          onAlterarPublico={alterarPublico}
        />
      ))}
    </Box>
  )
}
