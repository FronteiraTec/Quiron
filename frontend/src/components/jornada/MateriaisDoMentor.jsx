/**
 * Os materiais que os mentores entregaram a startup, dentro da Jornada
 * (Espaco do Mentor, migracao 020).
 *
 * Dois formatos, para os dois lugares em que a startup os encontra:
 *
 *   MateriaisDoMentor  um painel com a lista — na visao da trilha (tudo o que
 *                      ela recebeu) e na de uma fase (o que e daquela fase e
 *                      dos passos dela). Cada item diz de quem veio, quando e
 *                      para que ponto da trilha, e abre o material com a
 *                      orientacao do mentor em destaque.
 *   MaterialNoPasso    o material DENTRO da atividade, ao lado do conteudo da
 *                      incubadora: a orientacao vem por extenso, porque ali ela
 *                      e instrucao de trabalho, e nao uma previa.
 *
 * Nao ha estado vazio de proposito: sem material, a secao nao aparece. Uma
 * caixa "seu mentor nao mandou nada" em toda fase so faria barulho.
 */
import { useState } from "react"
import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material"
import { CoPresent, ChevronRight, FormatQuote, OpenInNew } from "@mui/icons-material"
import IconeFormato from "../espacoMentor/IconeFormato"
import { FINALIDADES, dataBR, rotuloEtapa } from "../../data/espacoMentorMeta"

const VISIVEIS = 4

export default function MateriaisDoMentor({ materiais, titulo, descricao, onAbrir, mostrarEtapa = true }) {
  const [todos, setTodos] = useState(false)
  if (!materiais?.length) return null

  const lista = todos ? materiais : materiais.slice(0, VISIVEIS)

  return (
    <Paper
      elevation={0}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2.5, mb: 3 }}
      data-tour="jornada-materiais-mentor"
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <CoPresent sx={{ color: "primary.main", fontSize: 22 }} />
        <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{titulo}</Typography>
        <Chip size="small" label={materiais.length} sx={{ height: 22, fontWeight: 700 }} />
      </Box>
      {descricao && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {descricao}
        </Typography>
      )}

      <Stack spacing={0.5}>
        {lista.map((m) => (
          <Box
            key={m.id_compartilhamento}
            component="button"
            type="button"
            onClick={() => onAbrir(m)}
            sx={{
              all: "unset",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "flex-start",
              gap: 1.5,
              width: "100%",
              p: 1.25,
              borderRadius: "6px",
              cursor: "pointer",
              "&:hover": { bgcolor: "action.hover" },
              "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
            }}
          >
            <IconeFormato item={m} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{m.titulo}</Typography>
                {m.finalidade === "ATIVIDADE" && (
                  <Chip
                    size="small"
                    label={FINALIDADES.ATIVIDADE.rotulo}
                    sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: `${FINALIDADES.ATIVIDADE.cor}1f`, color: FINALIDADES.ATIVIDADE.cor }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {m.compartilhado_por_nome || "Mentor"} · {dataBR(m.criado_ts)}
                {mostrarEtapa ? ` · ${rotuloEtapa(m)}` : ""}
              </Typography>
              {m.orientacao && (
                <Typography variant="body2" color="text.secondary" noWrap sx={{ fontStyle: "italic", mt: 0.25 }}>
                  “{m.orientacao}”
                </Typography>
              )}
            </Box>
            <ChevronRight sx={{ color: "text.disabled", mt: 0.5 }} />
          </Box>
        ))}
      </Stack>

      {materiais.length > VISIVEIS && (
        <Button size="small" onClick={() => setTodos((v) => !v)} sx={{ mt: 1, textTransform: "none" }}>
          {todos ? "Mostrar menos" : `Mostrar todos (${materiais.length})`}
        </Button>
      )}
    </Paper>
  )
}

/**
 * Um material dentro da atividade (PassoConteudo). A orientacao por extenso,
 * como a devolutiva do mentor, e o material logo abaixo.
 */
export function MaterialNoPasso({ material, onAbrir }) {
  const finalidade = FINALIDADES[material.finalidade] || FINALIDADES.REFERENCIA
  return (
    <Box>
      {material.orientacao && (
        <Box
          sx={{
            p: 2,
            mb: 1,
            borderRadius: "4px",
            borderLeft: "3px solid",
            borderColor: "primary.main",
            bgcolor: "action.hover",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5, color: "text.secondary" }}>
            <FormatQuote sx={{ fontSize: 18 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.04em" }}>
              {(material.compartilhado_por_nome || "SEU MENTOR").toUpperCase()} · {dataBR(material.criado_ts)}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
            {material.orientacao}
          </Typography>
        </Box>
      )}
      <Box
        component="button"
        type="button"
        onClick={() => onAbrir(material)}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          width: "100%",
          px: 1.25,
          py: 1.25,
          borderRadius: "4px",
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
        }}
      >
        <IconeFormato item={material} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: 14.5 }}>{material.titulo}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {finalidade.rotulo}
            {!material.orientacao && material.compartilhado_por_nome
              ? ` · ${material.compartilhado_por_nome}, ${dataBR(material.criado_ts)}`
              : ""}
            {material.descricao ? ` · ${material.descricao}` : ""}
          </Typography>
        </Box>
        <OpenInNew sx={{ fontSize: 16, color: "text.disabled" }} />
      </Box>
    </Box>
  )
}
