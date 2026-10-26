/**
 * Formulario de AVISO: a mensagem com destino escolhido, que abre conversa com
 * cada pessoa alcancada.
 *
 * E o unico caminho que passa pelas chaves `enviar_*`. A resposta dentro de uma
 * conversa nao vem por aqui — ela nao escolhe publico, so devolve a palavra a
 * quem ja falou (ver Conversa.jsx e mensagemService.responder).
 *
 * O seletor de destinatarios e UM campo so, com as opcoes agrupadas: startups,
 * mentores, roles e pessoas na mesma busca. A alternativa — escolher primeiro o
 * "tipo" e depois o item — obriga quem escreve a saber, antes de digitar, se
 * "Acme" e uma startup ou uma role. Aqui ele digita "Acme" e a lista responde.
 *
 * O QUE APARECE NA LISTA vem do backend ja recortado pelas permissoes da pessoa
 * (GET /mensagens/opcoes). Quem nao tem `comunicacao.mensagens.enviar_tenant`
 * nao ve "Toda a incubadora" — e, se mandar assim mesmo, o envio recusa: a tela
 * so evita oferecer o que responderia 403.
 */
import { useMemo, useState } from "react"
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material"
import { Send } from "@mui/icons-material"
import { TIPOS_DESTINO } from "./destinos"
import { useOpcoesDestino, enviarMensagem } from "../../hooks/useMensagens"

const ASSUNTO_MAX = 150
const CORPO_MAX = 5000

/**
 * Achata as opcoes do backend numa lista unica de destinos escolhiveis.
 *
 * Uma startup gera ate DUAS opcoes — "os membros" e "os mentores dela" —, que
 * sao publicos diferentes sobre o mesmo nome. Por isso o grupo entra no rotulo
 * do agrupamento, e nao no do item.
 */
function montarOpcoes(opcoes) {
  if (!opcoes) return []
  const lista = []

  if (opcoes.pode?.tenant) {
    lista.push({ chave: "TENANT", tipo: "TENANT", idReferencia: null, rotulo: "Toda a incubadora", grupo: "Geral" })
  }

  if (opcoes.pode?.mentores) {
    lista.push({
      chave: "MENTORES",
      tipo: "MENTORES",
      idReferencia: null,
      rotulo: "Todos os mentores",
      grupo: "Geral",
    })
  }

  for (const s of opcoes.startups || []) {
    if (opcoes.pode?.startup) {
      lista.push({
        chave: `STARTUP:${s.id_startup}`,
        tipo: "STARTUP",
        idReferencia: s.id_startup,
        rotulo: s.nome,
        sub: "Todos os membros",
        grupo: "Startups",
      })
    }
    if (opcoes.pode?.mentores) {
      lista.push({
        chave: `MENTORES:${s.id_startup}`,
        tipo: "MENTORES",
        idReferencia: s.id_startup,
        rotulo: `Mentores de ${s.nome}`,
        grupo: "Mentores por startup",
      })
    }
  }

  for (const r of opcoes.roles || []) {
    lista.push({
      chave: `ROLE:${r.id_role}`,
      tipo: "ROLE",
      idReferencia: r.id_role,
      rotulo: r.nome,
      sub: `${r.total_usuarios} pessoa(s)`,
      grupo: "Roles",
    })
  }

  for (const p of opcoes.pessoas || []) {
    lista.push({
      chave: `USUARIO:${p.id_usuario}`,
      tipo: "USUARIO",
      idReferencia: p.id_usuario,
      rotulo: p.nome,
      sub: p.email,
      grupo: "Pessoas",
    })
  }

  return lista
}

export default function NovaMensagemDialog({ aberto, idTenant, onFechar, onEnviada }) {
  const { opcoes, carregando, erro: erroOpcoes } = useOpcoesDestino({ idTenant, ativo: aberto })

  const [destinos, setDestinos] = useState([])
  const [assunto, setAssunto] = useState("")
  const [corpo, setCorpo] = useState("")
  const [importante, setImportante] = useState(false)
  const [porEmail, setPorEmail] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  const lista = useMemo(() => montarOpcoes(opcoes), [opcoes])

  const limpar = () => {
    setDestinos([])
    setAssunto("")
    setCorpo("")
    setImportante(false)
    setPorEmail(false)
    setErro(null)
  }

  const fechar = () => {
    if (enviando) return
    limpar()
    onFechar()
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (destinos.length === 0 || !assunto.trim() || !corpo.trim()) return

    setEnviando(true)
    setErro(null)
    try {
      const mensagem = await enviarMensagem({
        idTenant,
        assunto,
        corpo,
        destinos,
        importante,
        enviarEmail: porEmail,
      })
      limpar()
      onEnviada?.(mensagem)
      onFechar()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível enviar a mensagem.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onClose={fechar} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={enviar}>
        <DialogTitle sx={{ fontWeight: 700 }}>Novo aviso</DialogTitle>

        <DialogContent dividers>
          {(erro || erroOpcoes) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erro || erroOpcoes}
            </Alert>
          )}

          <Autocomplete
            multiple
            options={lista}
            loading={carregando}
            value={destinos}
            onChange={(_e, valor) => setDestinos(valor)}
            groupBy={(o) => o.grupo}
            getOptionLabel={(o) => o.rotulo}
            isOptionEqualToValue={(a, b) => a.chave === b.chave}
            renderOption={(props, o) => {
              const Icone = (TIPOS_DESTINO[o.tipo] || TIPOS_DESTINO.USUARIO).Icone
              return (
                <Box component="li" {...props} key={o.chave} sx={{ gap: 1.5 }}>
                  <Icone fontSize="small" color="action" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap>
                      {o.rotulo}
                    </Typography>
                    {o.sub && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {o.sub}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )
            }}
            renderTags={(valor, getTagProps) =>
              valor.map((o, i) => {
                const info = TIPOS_DESTINO[o.tipo] || TIPOS_DESTINO.USUARIO
                const Icone = info.Icone
                return (
                  <Chip
                    {...getTagProps({ index: i })}
                    key={o.chave}
                    size="small"
                    color={info.cor}
                    variant="outlined"
                    icon={<Icone sx={{ fontSize: 16 }} />}
                    label={o.rotulo}
                  />
                )
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Para"
                required={destinos.length === 0}
                placeholder={destinos.length === 0 ? "Startup, mentores, role ou pessoa..." : ""}
                helperText="Você pode combinar destinatários; quem estiver em mais de um recebe uma vez só."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {carregando ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <TextField
            label="Assunto"
            fullWidth
            required
            value={assunto}
            onChange={(e) => setAssunto(e.target.value.slice(0, ASSUNTO_MAX))}
            sx={{ mt: 2 }}
          />

          <TextField
            label="Mensagem"
            fullWidth
            required
            multiline
            minRows={5}
            value={corpo}
            onChange={(e) => setCorpo(e.target.value.slice(0, CORPO_MAX))}
            helperText={`${corpo.length}/${CORPO_MAX}`}
            sx={{ mt: 2 }}
          />

          <Box sx={{ mt: 1, display: "flex", flexDirection: "column" }}>
            <FormControlLabel
              control={<Switch checked={importante} onChange={(e) => setImportante(e.target.checked)} />}
              label="Marcar como importante"
            />
            <FormControlLabel
              control={<Switch checked={porEmail} onChange={(e) => setPorEmail(e.target.checked)} />}
              label="Também enviar por e-mail"
            />
            <Typography variant="caption" color="text.secondary">
              A mensagem sempre aparece nas notificações de quem recebe. O e-mail é um reforço, use
              quando o aviso não puder esperar o próximo acesso.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={fechar} disabled={enviando} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={enviando ? null : <Send />}
            disabled={enviando || destinos.length === 0 || !assunto.trim() || !corpo.trim()}
            sx={{ textTransform: "none", boxShadow: "none" }}
          >
            {enviando ? <CircularProgress size={22} color="inherit" /> : "Enviar"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
