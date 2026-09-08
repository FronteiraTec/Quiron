/**
 * O seletor de pessoas dos dois drawers de ação (lançar participação e
 * conceder selo).
 *
 * MOSTRA QUEM NAO DISPUTA, EM VEZ DE ESCONDER. O admin da incubadora e o
 * incubado sem startup ativa nao recebem ponto — mas somem-los da lista faria
 * a coordenacao procurar um nome que existe e nao encontrar, e concluir que o
 * cadastro esta errado. Eles aparecem com a marca "não pontua" e ficam
 * desabilitados quando a acao e de ponto.
 *
 * `exigirLiga` distingue os dois usos: ponto so vai para quem disputa; SELO vai
 * para qualquer pessoa da incubadora — reconhecer o trabalho de alguem da
 * coordenacao ou de um incubado recem-chegado e legitimo, porque selo nao
 * mexe em placar nenhum.
 */
import { Autocomplete, Avatar, Box, Chip, TextField, Typography } from "@mui/material"

import { rotuloLiga } from "./vocabulario"

export default function SeletorPessoas({
  participantes = [],
  valor = [],
  onChange,
  exigirLiga = false,
  rotulo = "Pessoas",
  ajuda,
}) {
  return (
    <Autocomplete
      multiple
      options={participantes}
      value={valor}
      onChange={(_, novo) => onChange(novo)}
      getOptionLabel={(p) => p.nome}
      isOptionEqualToValue={(a, b) => a.id_usuario === b.id_usuario}
      getOptionDisabled={(p) => exigirLiga && !p.liga}
      filterSelectedOptions
      renderOption={(props, p) => {
        const { key, ...resto } = props
        return (
          <Box component="li" key={key} {...resto} sx={{ gap: 1.5 }}>
            <Avatar src={p.foto_url || undefined} sx={{ width: 28, height: 28, fontSize: 13 }}>
              {(p.nome || "?").charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" noWrap>
                {p.nome}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {p.liga ? rotuloLiga(p.liga) : "Não pontua"}
                {p.startup ? ` · ${p.startup}` : ""}
              </Typography>
            </Box>
          </Box>
        )
      }}
      renderTags={(selecionados, getTagProps) =>
        selecionados.map((p, i) => {
          const { key, ...resto } = getTagProps({ index: i })
          return <Chip key={key} {...resto} size="small" label={p.nome} />
        })
      }
      renderInput={(params) => (
        <TextField {...params} label={rotulo} placeholder="Buscar pessoa..." helperText={ajuda} />
      )}
    />
  )
}
