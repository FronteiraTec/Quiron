/**
 * Aba "Meus incubados": as startups que o mentor acompanha, e a trilha de cada
 * uma.
 *
 * QUEM APARECE AQUI e decidido pela coordenacao, nao pelo mentor: e o vinculo
 * em `mentor_startup` (tela Mentores), o mesmo que recorta a fila de
 * avaliacao. Nao ha como escolher uma startup fora dele — o backend devolve so
 * as acompanhadas e recusa compartilhar com qualquer outra.
 *
 * Mestre-detalhe, como Mensagens: a lista curta a esquerda (nome, status, onde
 * esta na trilha) e, ao escolher uma, a trilha dela a direita. No celular as
 * duas se revezam.
 */
import { useMemo, useState } from "react"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { Search } from "@mui/icons-material"
import ChipSituacao from "../startup/ChipSituacao"
import EmptyState from "../programa/EmptyState"
import PainelIncubado from "./PainelIncubado"
import { useMeusIncubados } from "../../hooks/useEspacoMentor"
import { contarMateriais, normalizarBusca } from "../../data/espacoMentorMeta"

const trilhaPrincipal = (s) =>
  s.trilhas.find((t) => t.status === "EM_ANDAMENTO") ?? s.trilhas[0] ?? null

export default function AbaMeusIncubados({ idTenant, versao, onCompartilhar, onAbrir, onEditar, onRemover }) {
  const theme = useTheme()
  const mdUp = useMediaQuery(theme.breakpoints.up("md"))
  const { startups, carregando, erro, recarregar } = useMeusIncubados({ idTenant, versao })

  const [busca, setBusca] = useState("")
  const [idAberta, setIdAberta] = useState(null)

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca)
    return startups.filter((s) => !termo || normalizarBusca(s.nome).includes(termo))
  }, [startups, busca])

  // No desktop, a primeira ja abre: um painel vazio ao lado da lista so pede
  // um clique a mais para chegar ao mesmo lugar.
  const aberta =
    startups.find((s) => s.id_startup === idAberta) ?? (mdUp ? filtradas[0] ?? null : null)

  if (carregando && startups.length === 0) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (erro) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={recarregar}>
            Tentar de novo
          </Button>
        }
      >
        {erro}
      </Alert>
    )
  }

  if (startups.length === 0) {
    return (
      <Paper variant="outlined" sx={{ py: 2 }}>
        <EmptyState
          variante="selecao"
          titulo="Você ainda não acompanha nenhuma startup"
          descricao="Quem distribui as startups entre os mentores é a coordenação, na tela Mentores. Assim que uma startup for vinculada a você, ela aparece aqui."
        />
      </Paper>
    )
  }

  const lista = (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Buscar startup…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      {filtradas.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
          Nenhuma startup com esse nome.
        </Typography>
      ) : (
        <List disablePadding sx={{ maxHeight: { md: "calc(100vh - 340px)" }, overflowY: "auto" }}>
          {filtradas.map((s) => {
            const trilha = trilhaPrincipal(s)
            const pct = trilha?.passos ? Math.round((trilha.passos_concluidos / trilha.passos) * 100) : 0
            return (
              <ListItemButton
                key={s.id_startup}
                selected={aberta?.id_startup === s.id_startup}
                onClick={() => setIdAberta(s.id_startup)}
                sx={{ display: "block", py: 1.5, borderBottom: 1, borderColor: "divider" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                    {s.nome}
                  </Typography>
                  <ChipSituacao startup={s} sx={{ height: 22 }} />
                </Box>
                {trilha ? (
                  <>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {trilha.fase_atual ? `Fase atual: ${trilha.fase_atual.nome}` : trilha.nome}
                      {s.trilhas.length > 1 ? ` · ${s.trilhas.length} trilhas` : ""}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ height: 4, borderRadius: 2, mt: 0.5, bgcolor: "action.hover" }}
                      aria-label={`Progresso de ${s.nome}`}
                    />
                  </>
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    Sem trilha
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {s.materiais.total === 0
                    ? "Nenhum material compartilhado"
                    : `${contarMateriais(s.materiais.total)} · ${s.materiais.meus} seu${s.materiais.meus === 1 ? "" : "s"}`}
                </Typography>
              </ListItemButton>
            )
          })}
        </List>
      )}
    </Paper>
  )

  const painel = aberta ? (
    <PainelIncubado
      key={aberta.id_startup}
      startup={aberta}
      versao={versao}
      onCompartilhar={onCompartilhar}
      onAbrir={onAbrir}
      onEditar={onEditar}
      onRemover={onRemover}
      onVoltar={mdUp ? undefined : () => setIdAberta(null)}
    />
  ) : null

  if (!mdUp) return painel || lista

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 2, alignItems: "start" }}>
      {lista}
      {painel}
    </Box>
  )
}
