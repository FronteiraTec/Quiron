/**
 * A planilha na tela: o .xlsx lido pelo read-excel-file, ou as linhas de um
 * .csv (lidas por exploradorMeta.lerCsv). Uma aba por planilha, letras nas
 * colunas e numero nas linhas, como no Excel.
 *
 * E so leitura e so os valores: formula, formatacao e grafico ficam no
 * arquivo. Mostrar MUITAS linhas travaria a tela sem ajudar ninguem a
 * reconhecer o arquivo — acima do teto, a tela diz quantas ficaram de fora.
 *
 * O read-excel-file entra pelo `/universal`: o `/browser` cria Web Worker a
 * partir de `blob:`, que o CSP da borda recusa.
 */
import { useEffect, useMemo, useState } from "react"
import { Alert, Box, CircularProgress, Tab, Tabs, Typography } from "@mui/material"
import lerXlsx from "read-excel-file/universal"
import { lerCsv, letraDaColuna } from "../../../../data/exploradorMeta"

const MAX_LINHAS = 500
const MAX_COLUNAS = 60

/** O valor da celula como o Excel em portugues mostraria. */
function formatar(valor) {
  if (valor === null || valor === undefined) return ""
  // A data vem a meia-noite UTC: formatar no fuso local a jogaria para o dia
  // anterior (o mesmo problema das colunas DATE — ver espacoMentorMeta.dataBR).
  if (valor instanceof Date) return valor.toLocaleDateString("pt-BR", { timeZone: "UTC" })
  if (typeof valor === "number") return valor.toLocaleString("pt-BR", { maximumFractionDigits: 10 })
  if (typeof valor === "boolean") return valor ? "VERDADEIRO" : "FALSO"
  return String(valor)
}

export default function PreviaPlanilha({ blob, texto }) {
  const [planilhas, setPlanilhas] = useState(null)
  const [erro, setErro] = useState(null)
  const [aba, setAba] = useState(0)

  useEffect(() => {
    let cancelado = false
    setErro(null)
    setAba(0)
    if (texto !== undefined) {
      setPlanilhas([{ sheet: "CSV", data: lerCsv(texto) }])
      return undefined
    }
    setPlanilhas(null)
    lerXlsx(blob)
      .then((lidas) => !cancelado && setPlanilhas(lidas))
      .catch(() => !cancelado && setErro("Não foi possível ler esta planilha. Baixe o arquivo para abri-la no Excel."))
    return () => {
      cancelado = true
    }
  }, [blob, texto])

  const atual = planilhas?.[aba]
  const linhas = atual?.data ?? []
  const colunas = useMemo(
    () => Math.min(MAX_COLUNAS, linhas.slice(0, MAX_LINHAS).reduce((n, l) => Math.max(n, l.length), 0)),
    [linhas]
  )

  if (erro) {
    return (
      <Alert severity="warning" sx={{ m: 2 }}>
        {erro}
      </Alert>
    )
  }
  if (!planilhas) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  const celula = {
    border: 1,
    borderColor: "divider",
    px: 1,
    py: 0.25,
    fontSize: 13,
    whiteSpace: "nowrap",
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
  }
  const cabecalho = { ...celula, bgcolor: "action.hover", color: "text.secondary", fontWeight: 600, textAlign: "center" }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {linhas.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 3 }}>
            Esta planilha está vazia.
          </Typography>
        ) : (
          <Box component="table" sx={{ borderCollapse: "collapse", bgcolor: "background.paper" }}>
            <thead>
              <tr>
                <Box component="th" sx={{ ...cabecalho, position: "sticky", top: 0, left: 0, zIndex: 2 }} />
                {Array.from({ length: colunas }, (_, i) => (
                  <Box component="th" key={i} sx={{ ...cabecalho, position: "sticky", top: 0, zIndex: 1 }}>
                    {letraDaColuna(i)}
                  </Box>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, MAX_LINHAS).map((linha, i) => (
                <tr key={i}>
                  <Box component="th" sx={{ ...cabecalho, position: "sticky", left: 0, zIndex: 1 }}>
                    {i + 1}
                  </Box>
                  {Array.from({ length: colunas }, (_, j) => {
                    const valor = linha[j]
                    return (
                      <Box
                        component="td"
                        key={j}
                        title={formatar(valor)}
                        sx={{ ...celula, textAlign: typeof valor === "number" ? "right" : "left" }}
                      >
                        {formatar(valor)}
                      </Box>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        )}
        {linhas.length > MAX_LINHAS && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1.5 }}>
            Mostrando as primeiras {MAX_LINHAS} de {linhas.length.toLocaleString("pt-BR")} linhas. Baixe o arquivo
            para ver tudo.
          </Typography>
        )}
      </Box>
      {planilhas.length > 1 && (
        <Tabs
          value={aba}
          onChange={(_, v) => setAba(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderTop: 1, borderColor: "divider", minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none" } }}
        >
          {planilhas.map((p, i) => (
            <Tab key={i} value={i} label={p.sheet} />
          ))}
        </Tabs>
      )}
    </Box>
  )
}
