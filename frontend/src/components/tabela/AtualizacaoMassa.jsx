/**
 * AtualizacaoMassa — o popover que edita o mesmo campo em varios registros.
 *
 * Abre a partir da ToolbarTabela quando ha linhas marcadas. Os campos vem da
 * tela (`campos`), porque o que da para mudar em lote muda de listagem para
 * listagem — e a tela e quem sabe chamar a API certa.
 *
 * CAMPO EM BRANCO NAO ALTERA NADA: e a regra que torna a operacao segura de
 * usar. Sem ela, abrir o popover para mudar a situacao de 20 startups apagaria
 * de tabela todos os outros campos que ficaram vazios.
 *
 * Props:
 *   ancora            Element|null
 *   onFechar          fn        () => void
 *   totalSelecionados number
 *   campos            Array     [{ chave, rotulo, tipo, opcoes?, sufixo? }]
 *                               tipo: 'select' (padrao com `opcoes`) | 'texto' | 'numero'
 *   onAplicar         fn        (valoresPreenchidos) => void
 *   aplicando         bool      trava o botao enquanto a tela grava
 */
import { useEffect, useState } from "react"
import { Box, Button, MenuItem, Popover, TextField, Typography } from "@mui/material"
import { InfoOutlined } from "@mui/icons-material"

export default function AtualizacaoMassa({
  ancora,
  onFechar,
  totalSelecionados = 0,
  campos = [],
  onAplicar,
  aplicando = false,
}) {
  const [valores, setValores] = useState({})

  // Zera ao abrir: o popover fica montado entre uma operacao e outra, e o valor
  // da anterior reapareceria preenchido na proxima.
  useEffect(() => {
    if (ancora) setValores({})
  }, [ancora])

  const preenchidos = Object.fromEntries(
    Object.entries(valores).filter(([, v]) => v !== "" && v != null)
  )
  const algumPreenchido = Object.keys(preenchidos).length > 0

  return (
    <Popover
      open={Boolean(ancora)}
      anchorEl={ancora}
      onClose={onFechar}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { width: 320, p: 2 } } }}
    >
      <Typography variant="subtitle2" fontWeight={700}>
        Atualizacao em massa
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {totalSelecionados} registro{totalSelecionados === 1 ? "" : "s"} selecionado
        {totalSelecionados === 1 ? "" : "s"}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, my: 1.5 }}>
        <InfoOutlined sx={{ fontSize: 16, color: "text.secondary" }} />
        <Typography variant="caption" color="text.secondary">
          Campos em branco nao serao alterados.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {campos.map((campo) => (
          <TextField
            key={campo.chave}
            label={campo.rotulo}
            select={campo.tipo !== "texto" && campo.tipo !== "numero"}
            type={campo.tipo === "numero" ? "number" : "text"}
            size="small"
            fullWidth
            value={valores[campo.chave] ?? ""}
            onChange={(e) =>
              setValores((prev) => ({ ...prev, [campo.chave]: e.target.value }))
            }
          >
            {campo.tipo !== "texto" && campo.tipo !== "numero" && (
              <MenuItem value="">
                <em>Manter atual</em>
              </MenuItem>
            )}
            {(campo.opcoes || []).map((opcao) => (
              <MenuItem key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </MenuItem>
            ))}
          </TextField>
        ))}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 2 }}>
        <Button size="small" onClick={onFechar} disabled={aplicando}>
          Cancelar
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!algumPreenchido || aplicando}
          onClick={() => onAplicar?.(preenchidos)}
        >
          {aplicando ? "Aplicando..." : "Aplicar"}
        </Button>
      </Box>
    </Popover>
  )
}
