/**
 * Um campo personalizavel, desenhado a partir da sua definicao.
 *
 * SERVE OS DOIS MODULOS que oferecem campos proprios — o cadastro de startup
 * (startup_campo) e a gestao de tarefas (tarefa_campo) —, e por isso mora em
 * components/campos e nao dentro de um deles. As duas definicoes tem o mesmo
 * formato e o mesmo conjunto de tipos (ver backend/src/campos), entao um
 * segundo componente seria a mesma tela desenhada duas vezes, divergindo na
 * primeira correcao.
 *
 * A definicao mora no banco e o desenho mora aqui. Cada tipo tem uma
 * renderizacao propria —
 * um campo monetario com entrada livre e um campo de categoria em texto seriam
 * duas formas diferentes de gravar dado errado.
 *
 * DUAS REPRESENTACOES, e por isso os dois conversores exportados junto:
 *
 *   TELA  -> o texto que a pessoa ve e edita ("12.345,67", "123.456.789-00")
 *   BANCO -> o valor normalizado que a API grava (12345.67, "12345678900")
 *
 * A conversao acontece na borda (ao abrir e ao salvar o formulario), nunca a
 * cada tecla: mascarar no `onChange` e desmascarar no `value` faria o cursor
 * saltar para o fim do campo a cada digito.
 */
import { TextField, MenuItem, InputAdornment } from "@mui/material"
import {
  aplicarMascara,
  posicoesDaMascara,
  desmascarar,
  mascararMoeda,
  moedaParaNumero,
  numeroParaMoeda,
} from "../../utils/mascaras"
import { simboloDaMoeda } from "../../utils/camposExtras"

/**
 * O valor do banco vira o texto do formulario.
 *
 * @param {Object} campo - a definicao (startup_campo / tarefa_campo).
 * @param {*} valor - o que estava no `campos_extras` do registro.
 */
export function valorParaFormulario(campo, valor) {
  if (valor === null || valor === undefined) return ""
  if (campo.tipo === "MONETARIO") return numeroParaMoeda(valor)
  if (campo.tipo === "DOCUMENTO") return aplicarMascara(valor, campo.config?.mascara)
  return String(valor)
}

/**
 * O texto do formulario vira o valor da API.
 *
 * Devolve `null` para campo vazio — e o que diz "nao preenchido" a quem grava,
 * distinto de "" que viraria um valor vazio dentro do JSONB.
 */
export function valorParaEnvio(campo, texto) {
  const bruto = String(texto ?? "").trim()
  if (!bruto) return null

  switch (campo.tipo) {
    case "MONETARIO":
      return moedaParaNumero(bruto)
    case "DOCUMENTO":
      // Sem mascara, como o CNPJ: guardar "123.456.789-00" faria "12345678900"
      // nao encontrar nada numa busca futura.
      return desmascarar(bruto)
    case "NUMERICO":
      return bruto
    default:
      return bruto
  }
}

export default function CampoPersonalizado({ campo, valor, onChange, size = "small" }) {
  const config = campo.config || {}

  const comuns = {
    label: campo.rotulo,
    fullWidth: true,
    size,
    required: campo.obrigatorio,
    helperText: campo.descricao || undefined,
  }

  if (campo.tipo === "CATEGORIA") {
    const opcoes = Array.isArray(config.opcoes) ? config.opcoes : []
    return (
      <TextField {...comuns} select value={valor ?? ""} onChange={(e) => onChange(e.target.value)}>
        {/* Sem esta linha nao ha como DESFAZER a escolha de um campo opcional:
            select do MUI nao tem "limpar". */}
        {!campo.obrigatorio && (
          <MenuItem value="">
            <em>Nao informado</em>
          </MenuItem>
        )}
        {opcoes.map((o) => (
          <MenuItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </MenuItem>
        ))}
      </TextField>
    )
  }

  if (campo.tipo === "NUMERICO") {
    return (
      <TextField
        {...comuns}
        type="number"
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value)}
        inputProps={{
          min: config.min,
          max: config.max,
          // O passo segue as casas decimais configuradas: com casas = 2 as
          // setinhas do campo andam de 0,01, nao de 1.
          step: config.casas ? 1 / 10 ** config.casas : 1,
        }}
        InputProps={
          config.sufixo
            ? { endAdornment: <InputAdornment position="end">{config.sufixo}</InputAdornment> }
            : undefined
        }
      />
    )
  }

  if (campo.tipo === "MONETARIO") {
    return (
      <TextField
        {...comuns}
        value={valor ?? ""}
        onChange={(e) => onChange(mascararMoeda(e.target.value))}
        placeholder="0,00"
        inputProps={{ inputMode: "numeric" }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">{simboloDaMoeda(config.moeda)}</InputAdornment>
          ),
        }}
      />
    )
  }

  if (campo.tipo === "DOCUMENTO") {
    const mascara = config.mascara || ""
    return (
      <TextField
        {...comuns}
        value={valor ?? ""}
        onChange={(e) => onChange(aplicarMascara(e.target.value, mascara))}
        placeholder={mascara}
        inputProps={{ maxLength: mascara.length }}
        helperText={
          campo.descricao ||
          (mascara ? `Formato: ${mascara} (${posicoesDaMascara(mascara)} caracteres).` : undefined)
        }
      />
    )
  }

  // TEXTO.
  return (
    <TextField
      {...comuns}
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value)}
      multiline={Boolean(config.multilinha)}
      minRows={config.multilinha ? 3 : undefined}
    />
  )
}
