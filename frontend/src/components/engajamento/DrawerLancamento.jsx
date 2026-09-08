/**
 * "Lançar participação" — o registro manual da coordenação.
 *
 * SO ACOES DE LANCAMENTO MANUAL aparecem na lista, e o backend recusa as
 * outras. Presenca em atividade da agenda vem da LISTA DE CHAMADA, e nao daqui:
 * um caminho paralelo para pontuar presenca a mao transformaria o ranking em
 * "quem a coordenacao decidiu premiar", que e exatamente o que o desenho evita.
 * O aviso no rodape diz isso, porque a pergunta vai aparecer.
 *
 * A DATA E DO FATO, nao do registro: ela escolhe a temporada e a janela do
 * teto. Lancar hoje o coworking da semana passada tem que cair na semana
 * passada.
 *
 * O RESULTADO MOSTRA OS IGNORADOS. Quem nao tem liga e pulado pelo backend, e
 * sem essa lista a coordenacao lancaria para dez, veria "lançado" e nao
 * descobriria que dois ficaram de fora.
 */
import { useEffect, useState } from "react"
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material"
import { Close } from "@mui/icons-material"

import SeletorPessoas from "./SeletorPessoas"
import { pts, rotuloTeto } from "./vocabulario"

/** Hoje em 'AAAA-MM-DD', que e o formato do input date. */
function hojeIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
}

export default function DrawerLancamento({
  aberto,
  onFechar,
  acoes = [],
  participantes = [],
  onLancar,
  onSucesso,
}) {
  const manuais = acoes.filter((a) => a.gatilho === "MANUAL" && a.ativo)

  const [pessoas, setPessoas] = useState([])
  const [chaveAcao, setChaveAcao] = useState("")
  const [data, setData] = useState(hojeIso)
  const [observacao, setObservacao] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (!aberto) return
    setPessoas([])
    setChaveAcao(manuais[0]?.chave || "")
    setData(hojeIso())
    setObservacao("")
    setErro(null)
    setResultado(null)
    // manuais e derivado de `acoes`; recalcular a cada render mudaria a
    // identidade do array e reabriria o formulario sozinho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const acao = manuais.find((a) => a.chave === chaveAcao)

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const res = await onLancar({
        idsUsuarios: pessoas.map((p) => p.id_usuario),
        chaveAcao,
        ocorridoDt: data,
        observacao: observacao.trim() || undefined,
      })
      setResultado(res)
      setPessoas([])
      onSucesso?.()
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível lançar a participação.")
    } finally {
      setSalvando(false)
    }
  }

  const podeSalvar = pessoas.length > 0 && chaveAcao && data && !salvando

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={onFechar}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, p: 3 } }}
    >
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Lançar participação
        </Typography>
        <IconButton onClick={onFechar} size="small">
          <Close />
        </IconButton>
      </Box>

      {manuais.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          Nenhuma ação de lançamento manual está ativa. Crie uma em Configurações → Engajamento.
        </Alert>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {erro && (
            <Alert severity="error" sx={{ borderRadius: 0 }}>
              {erro}
            </Alert>
          )}

          {resultado && (
            <Alert
              severity={resultado.ignorados?.length ? "warning" : "success"}
              sx={{ borderRadius: 0 }}
              onClose={() => setResultado(null)}
            >
              {resultado.lancados.length} lançamento(s) registrado(s).
              {resultado.ignorados?.length > 0 && (
                <Box component="span" sx={{ display: "block", mt: 0.5 }}>
                  {resultado.ignorados.length} pessoa(s) ficaram de fora:{" "}
                  {resultado.ignorados[0].motivo}
                </Box>
              )}
            </Alert>
          )}

          <TextField
            select
            label="O que aconteceu"
            value={chaveAcao}
            onChange={(e) => setChaveAcao(e.target.value)}
            helperText={
              acao
                ? `${pts(acao.pontos)} por lançamento · ${rotuloTeto(acao)}`
                : "Escolha a ação registrada."
            }
          >
            {manuais.map((a) => (
              <MenuItem key={a.chave} value={a.chave}>
                {a.rotulo}
              </MenuItem>
            ))}
          </TextField>

          <SeletorPessoas
            participantes={participantes}
            valor={pessoas}
            onChange={setPessoas}
            exigirLiga
            rotulo="Quem participou"
            ajuda="Quem não disputa nenhuma liga aparece desabilitado — a coordenação não pontua."
          />

          <TextField
            type="date"
            label="Quando aconteceu"
            value={data}
            onChange={(e) => setData(e.target.value)}
            InputLabelProps={{ shrink: true }}
            helperText="É esta data que escolhe a temporada e a janela do teto."
          />

          <TextField
            label="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            multiline
            minRows={2}
            inputProps={{ maxLength: 300 }}
            helperText="Aparece no extrato de quem recebeu."
          />

          <Button
            variant="contained"
            onClick={salvar}
            disabled={!podeSalvar}
            startIcon={salvando ? <CircularProgress size={16} color="inherit" /> : null}
          >
            Lançar
          </Button>

          <Alert severity="info" sx={{ borderRadius: 0 }}>
            Presença em atividades da agenda <strong>não</strong> se lança aqui: ela vem da lista
            de chamada, em Eventos → Presença. É o que mantém o ponto verificável e reversível.
          </Alert>
        </Box>
      )}
    </Drawer>
  )
}
