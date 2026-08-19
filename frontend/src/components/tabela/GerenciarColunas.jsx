/**
 * GerenciarColunas — o popover que decide o que a tabela mostra.
 *
 * Sai do cabecalho da TabelaDados (o icone de ajustes, no canto direito) e
 * responde a duas perguntas: quais colunas aparecem e quantas linhas cabem por
 * pagina. A REORDENACAO nao esta aqui — ela e feita arrastando o cabecalho da
 * propria tabela, onde da para ver o resultado enquanto se arrasta; a nota no
 * rodape existe para quem nunca descobriria isso sozinho.
 *
 * Trabalha sobre uma COPIA: marcar e desmarcar so tem efeito no "Salvar". Sem
 * isso a tabela reorganizaria as colunas atras do popover a cada clique, e
 * "Cancelar" nao teria como voltar atras.
 *
 * Props:
 *   ancora             Element|null   elemento ancora (null = fechado)
 *   onFechar           fn             () => void
 *   colunas            Array          a definicao completa (ver TabelaDados)
 *   colunasVisiveis    string[]       chaves exibidas, na ordem da tela
 *   registrosPorPagina number
 *   opcoesRpp          number[]       padrao: [10, 25, 50, 100]
 *   onSalvar           fn             (chavesVisiveis, rpp) => void
 */
import { useEffect, useState } from "react"
import {
  Box,
  Button,
  Checkbox,
  Divider,
  InputAdornment,
  MenuItem,
  Popover,
  TextField,
  Typography,
} from "@mui/material"
import { Search } from "@mui/icons-material"
import { posicaoNatural } from "./ordemColunas"

const RPP_PADRAO = [10, 25, 50, 100]

export default function GerenciarColunas({
  ancora,
  onFechar,
  colunas = [],
  colunasVisiveis = [],
  registrosPorPagina = 25,
  opcoesRpp,
  onSalvar,
}) {
  const opcoes = opcoesRpp || RPP_PADRAO

  const [busca, setBusca] = useState("")
  const [selecionadas, setSelecionadas] = useState(colunasVisiveis)
  const [rpp, setRpp] = useState(registrosPorPagina)

  // Sincroniza ao abrir: entre uma abertura e outra a tabela pode ter mudado
  // (arrasto de cabecalho, campo personalizavel novo).
  useEffect(() => {
    if (!ancora) return
    setSelecionadas([...colunasVisiveis])
    setRpp(registrosPorPagina)
    setBusca("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancora])

  /**
   * Marcar mantem a ordem ja escolhida e encaixa a coluna onde a definicao a
   * declarou — nao no fim. Uma coluna escondida e remarcada volta para o lugar
   * dela, que e onde quem a remarcou vai procura-la.
   */
  function alternar(chave) {
    setSelecionadas((prev) => {
      if (prev.includes(chave)) return prev.filter((c) => c !== chave)
      const nova = [...prev]
      nova.splice(posicaoNatural(nova, colunas, chave), 0, chave)
      return nova
    })
  }

  function selecionarTudo() {
    setSelecionadas((prev) => {
      const nova = [...prev]
      colunas
        .filter((c) => !nova.includes(c.chave))
        .forEach((c) => nova.splice(posicaoNatural(nova, colunas, c.chave), 0, c.chave))
      return nova
    })
  }

  function limparTudo() {
    const obrigatorias = colunas.filter((c) => c.obrigatoria).map((c) => c.chave)
    setSelecionadas((prev) => prev.filter((chave) => obrigatorias.includes(chave)))
  }

  function salvar() {
    // Coluna obrigatoria entra mesmo que nunca tenha sido marcada: e o que
    // impede a tabela de ficar sem a coluna que identifica a linha.
    const obrigatoriasFaltando = colunas
      .filter((c) => c.obrigatoria && !selecionadas.includes(c.chave))
      .map((c) => c.chave)
    onSalvar?.([...selecionadas, ...obrigatoriasFaltando], rpp)
    onFechar()
  }

  function cancelar() {
    setSelecionadas([...colunasVisiveis])
    setRpp(registrosPorPagina)
    onFechar()
  }

  const termo = busca.trim().toLowerCase()
  const filtradas = termo
    ? colunas.filter((c) => c.rotulo.toLowerCase().includes(termo))
    : colunas

  return (
    <Popover
      open={Boolean(ancora)}
      anchorEl={ancora}
      onClose={cancelar}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      slotProps={{ paper: { sx: { width: 320 } } }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Gerenciar colunas
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Button size="small" onClick={selecionarTudo} sx={{ minWidth: 0, px: 0.5 }}>
              Tudo
            </Button>
            <Typography variant="caption" color="text.disabled">
              ·
            </Typography>
            <Button size="small" onClick={limparTudo} sx={{ minWidth: 0, px: 0.5 }}>
              Limpar
            </Button>
          </Box>
        </Box>

        <TextField
          placeholder="Pesquisar coluna"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          size="small"
          fullWidth
          sx={{ mt: 1.5 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ maxHeight: 280, overflowY: "auto", px: 1 }}>
        {filtradas.map((coluna) => {
          const marcada = coluna.obrigatoria || selecionadas.includes(coluna.chave)
          return (
            <Box
              key={coluna.chave}
              component="label"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                borderRadius: 1,
                cursor: coluna.obrigatoria ? "default" : "pointer",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Checkbox
                size="small"
                checked={marcada}
                disabled={coluna.obrigatoria}
                onChange={() => alternar(coluna.chave)}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {coluna.rotulo}
                {coluna.obrigatoria && (
                  <Typography component="span" variant="caption" color="text.disabled">
                    {" *"}
                  </Typography>
                )}
              </Typography>
            </Box>
          )
        })}

        {filtradas.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            Nenhuma coluna encontrada.
          </Typography>
        )}
      </Box>

      <Divider sx={{ mt: 1 }} />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Registros por pagina
        </Typography>
        <TextField
          select
          size="small"
          value={rpp}
          onChange={(e) => setRpp(Number(e.target.value))}
          sx={{ width: 90 }}
        >
          {opcoes.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, pb: 1 }}>
        Para mudar a ordem, arraste o cabecalho da coluna na tabela.
      </Typography>

      <Divider />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, p: 1.5 }}>
        <Button size="small" onClick={cancelar}>
          Cancelar
        </Button>
        <Button size="small" variant="contained" onClick={salvar}>
          Salvar
        </Button>
      </Box>
    </Popover>
  )
}
