/**
 * A parte do formulario de campo personalizavel que muda conforme o TIPO
 * escolhido — as opcoes de uma categoria, a mascara de um documento, o minimo e
 * o maximo de um numerico, a moeda de um monetario.
 *
 * SEPARADA num componente porque e a unica parte condicional de um formulario
 * que ja e longo: misturada, quem salva o campo teria cinco ramos de
 * renderizacao no meio do JSX.
 *
 * COMPARTILHADA pelas duas telas de configuracao — o cadastro de startup e o
 * quadro de tarefas —, porque as duas definem campos com a mesma estrutura e o
 * mesmo conjunto de tipos. E o espelho de campos/tipos.js no backend: se um
 * tipo novo aparecer la, e aqui que ele ganha formulario, uma vez so.
 */
import {
  Box,
  Button,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material"
import { Add, DeleteOutline } from "@mui/icons-material"
import { aplicarMascara, posicoesDaMascara } from "../../utils/mascaras"

/** Os cinco tipos de campo, com o que cada um resolve. */
export const TIPOS_CAMPO = [
  { valor: "TEXTO", rotulo: "Texto", ajuda: "Resposta livre, de uma ou várias linhas." },
  { valor: "CATEGORIA", rotulo: "Categoria", ajuda: "Escolha entre opções que você define." },
  { valor: "NUMERICO", rotulo: "Numérico", ajuda: "Número, com mínimo, máximo e casas decimais." },
  { valor: "DOCUMENTO", rotulo: "Documento", ajuda: "Texto com máscara sua. Ex.: ###.###.###-##" },
  { valor: "MONETARIO", rotulo: "Monetário", ajuda: "Valor em dinheiro, somável e ordenável." },
]

export const rotuloDoTipoCampo = (valor) =>
  TIPOS_CAMPO.find((t) => t.valor === valor)?.rotulo || valor

export default function ConfigDoTipo({ tipo, config, onChange }) {
  const alterar = (chave, valor) => onChange({ ...config, [chave]: valor })

  if (tipo === "CATEGORIA") {
    const opcoes = config.opcoes || []
    const alterarOpcao = (indice, rotulo) =>
      onChange({
        opcoes: opcoes.map((o, i) =>
          // O VALOR acompanha o rotulo enquanto se digita. E ele que fica
          // gravado nos registros, entao editar o rotulo de uma opcao ja em uso
          // trocaria o valor e orfanaria as respostas — por isso so as opcoes
          // NOVAS (sem valor fixado) seguem o rotulo.
          i === indice ? { valor: o.fixado ? o.valor : rotulo, rotulo, fixado: o.fixado } : o
        ),
      })

    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          As opções que aparecem no formulário.
        </Typography>
        {opcoes.map((o, i) => (
          <Box key={i} sx={{ display: "flex", gap: 1, mb: 1 }}>
            <TextField
              size="small"
              fullWidth
              value={o.rotulo}
              onChange={(e) => alterarOpcao(i, e.target.value)}
              placeholder={`Opção ${i + 1}`}
            />
            <IconButton
              size="small"
              onClick={() => onChange({ opcoes: opcoes.filter((_, j) => j !== i) })}
            >
              <DeleteOutline fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => onChange({ opcoes: [...opcoes, { valor: "", rotulo: "" }] })}
        >
          Adicionar opção
        </Button>
      </Box>
    )
  }

  if (tipo === "DOCUMENTO") {
    const mascara = config.mascara || ""
    return (
      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Máscara"
            fullWidth
            size="small"
            required
            value={mascara}
            onChange={(e) => alterar("mascara", e.target.value)}
            placeholder="###.###.###-##"
            helperText="# = dígito, A = letra ou dígito. O resto é separador."
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Prévia"
            fullWidth
            size="small"
            disabled
            // Preencher com uma sequencia mostra o formato final sem exigir que
            // quem cadastra imagine o resultado.
            value={aplicarMascara("12345678901234567890", mascara)}
            helperText={
              mascara ? `${posicoesDaMascara(mascara)} caracteres.` : "Digite a máscara ao lado."
            }
          />
        </Grid>
      </Grid>
    )
  }

  if (tipo === "NUMERICO") {
    return (
      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Mínimo"
            type="number"
            fullWidth
            size="small"
            value={config.min ?? ""}
            onChange={(e) => alterar("min", e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Máximo"
            type="number"
            fullWidth
            size="small"
            value={config.max ?? ""}
            onChange={(e) => alterar("max", e.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Casas decimais"
            type="number"
            fullWidth
            size="small"
            value={config.casas ?? 0}
            onChange={(e) => alterar("casas", e.target.value)}
            inputProps={{ min: 0, max: 6 }}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            label="Sufixo"
            fullWidth
            size="small"
            value={config.sufixo ?? ""}
            onChange={(e) => alterar("sufixo", e.target.value)}
            placeholder="%, kg, un"
          />
        </Grid>
      </Grid>
    )
  }

  if (tipo === "MONETARIO") {
    return (
      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            select
            label="Moeda"
            fullWidth
            size="small"
            value={config.moeda || "BRL"}
            onChange={(e) => alterar("moeda", e.target.value)}
          >
            <MenuItem value="BRL">Real (R$)</MenuItem>
            <MenuItem value="USD">Dólar (US$)</MenuItem>
            <MenuItem value="EUR">Euro (€)</MenuItem>
          </TextField>
        </Grid>
      </Grid>
    )
  }

  // TEXTO.
  return (
    <FormControlLabel
      sx={{ mt: 1 }}
      control={
        <Switch
          size="small"
          checked={Boolean(config.multilinha)}
          onChange={(e) => alterar("multilinha", e.target.checked)}
        />
      }
      label={<Typography variant="body2">Resposta longa (várias linhas)</Typography>}
    />
  )
}
