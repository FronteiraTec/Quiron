/**
 * Tabela ordenavel dos relatorios.
 *
 * Um relatorio so vira decisao quando da para reordena-lo: a mesma tabela
 * responde "quem esta mais atrasado?" e "quem avancou mais?" dependendo da
 * coluna clicada. Por isso a ordenacao e do componente e nao do backend — os
 * dados ja estao todos em memoria e uma ida ao servidor por clique so
 * atrasaria a leitura.
 *
 * A tabela tambem e a "view em tabela" que os graficos exigem por
 * acessibilidade: nenhum numero existe apenas dentro de um grafico.
 */
import { useMemo, useState } from "react"
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from "@mui/material"

/** Comparador estavel: numeros por valor, texto por locale, nulos por ultimo. */
function comparar(a, b, chave) {
  const va = a[chave]
  const vb = b[chave]

  if (va == null && vb == null) return 0
  if (va == null) return 1
  if (vb == null) return -1

  if (typeof va === "number" && typeof vb === "number") return va - vb
  return String(va).localeCompare(String(vb), "pt-BR")
}

/**
 * @param {object} props
 * @param {Array<{
 *   chave: string, rotulo: string, alinhamento?: "left"|"right"|"center",
 *   render?: (linha: object) => React.ReactNode, ordenavel?: boolean,
 *   ajuda?: string
 * }>} props.colunas
 * @param {Array<object>} props.linhas
 * @param {string} props.chaveId - campo unico de cada linha
 * @param {string} [props.ordemInicial] - coluna ordenada ao abrir
 * @param {"asc"|"desc"} [props.direcaoInicial]
 * @param {(linha: object) => void} [props.onClickLinha]
 * @param {string} [props.mensagemVazio]
 */
export default function TabelaRelatorio({
  colunas,
  linhas,
  chaveId,
  ordemInicial,
  direcaoInicial = "desc",
  onClickLinha,
  mensagemVazio = "Nada a exibir no período.",
}) {
  const [ordem, setOrdem] = useState(ordemInicial ?? colunas[0]?.chave)
  const [direcao, setDirecao] = useState(direcaoInicial)

  const ordenadas = useMemo(() => {
    if (!ordem) return linhas
    const fator = direcao === "asc" ? 1 : -1
    return [...linhas].sort((a, b) => comparar(a, b, ordem) * fator)
  }, [linhas, ordem, direcao])

  const alternarOrdem = (chave) => {
    if (chave === ordem) {
      setDirecao((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setOrdem(chave)
      // Coluna nova comeca no "pior primeiro": e o que se quer ver.
      setDirecao("desc")
    }
  }

  if (linhas.length === 0) {
    return (
      <Paper sx={{ borderRadius: 0, p: 6, textAlign: "center", color: "text.secondary" }}>
        <Typography>{mensagemVazio}</Typography>
      </Paper>
    )
  }

  return (
    <Paper sx={{ borderRadius: 0 }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {colunas.map((c) => (
                <TableCell
                  key={c.chave}
                  align={c.alinhamento || "left"}
                  sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
                >
                  {/* Colunas com criterio nao obvio ("Aprovacao" sobre quem?)
                      explicam a conta no proprio cabecalho. */}
                  <Tooltip title={c.ajuda || ""} disableHoverListener={!c.ajuda}>
                    <Box component="span">
                      {c.ordenavel === false ? (
                        c.rotulo
                      ) : (
                        <TableSortLabel
                          active={ordem === c.chave}
                          direction={ordem === c.chave ? direcao : "desc"}
                          onClick={() => alternarOrdem(c.chave)}
                        >
                          {c.rotulo}
                        </TableSortLabel>
                      )}
                    </Box>
                  </Tooltip>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {ordenadas.map((linha) => (
              <TableRow
                key={linha[chaveId]}
                hover={Boolean(onClickLinha)}
                onClick={onClickLinha ? () => onClickLinha(linha) : undefined}
                sx={onClickLinha ? { cursor: "pointer" } : undefined}
              >
                {colunas.map((c) => (
                  <TableCell
                    key={c.chave}
                    align={c.alinhamento || "left"}
                    // Numeros alinhados a direita usam figuras tabulares para
                    // as casas baterem coluna a coluna.
                    sx={
                      c.alinhamento === "right"
                        ? { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }
                        : undefined
                    }
                  >
                    {c.render ? c.render(linha) : formatar(linha[c.chave])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {ordenadas.length} {ordenadas.length === 1 ? "registro" : "registros"}
        </Typography>
      </Box>
    </Paper>
  )
}

/** Celula sem render proprio: nulo vira travessao, array vira lista. */
function formatar(valor) {
  if (valor == null || valor === "") return "—"
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "—"
  return valor
}
