/**
 * Painel direito: edicao das propriedades do no selecionado, sem modal e sem
 * troca de pagina. Mostra:
 *   - cabecalho com icone/tipo, breadcrumb e status
 *   - nome, descricao, ordem, ativo
 *   - campos especificos do tipo (tarefa ja traz prazo/carga/entregavel e
 *     secoes "em breve" para anexos, links, videos e checklist)
 *   - botoes Salvar / Cancelar (habilitados so quando ha alteracoes)
 *
 * O formulario mantem um rascunho local; ao trocar de no ou salvar, sincroniza.
 */
import { useEffect, useMemo, useState } from "react"
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Chip,
  Stack,
  InputAdornment,
  IconButton,
  Tooltip,
} from "@mui/material"
import {
  Save,
  Close,
  DeleteOutline,
  Schedule,
  Timelapse,
  Inventory2,
  AttachFile,
  Link as LinkIcon,
  Videocam,
  Checklist,
  Tag,
} from "@mui/icons-material"
import { motion } from "framer-motion"
import { TIPO_META } from "../../data/programaMock"
import Breadcrumb from "./Breadcrumb"
import EmptyState from "./EmptyState"

// Secoes "preparadas para crescer" mostradas na tarefa. Ainda sem edicao real.
const RECURSOS_TAREFA = [
  { icon: AttachFile, label: "Anexos" },
  { icon: LinkIcon, label: "Links" },
  { icon: Videocam, label: "Videos" },
  { icon: Checklist, label: "Checklist" },
]

export default function InspectorPanel({ programa, no, trilha, acoes, onSalvar, onExcluir }) {
  if (!no) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", height: "100%" }}>
        <EmptyState
          variante="selecao"
          titulo="Nenhum item selecionado"
          descricao="Escolha uma fase, modulo ou tarefa na arvore a esquerda para editar suas propriedades aqui."
        />
      </Box>
    )
  }

  const meta = TIPO_META[no.tipo]
  const Icone = meta.icon

  // Rascunho local do formulario, ressincronizado ao trocar de no.
  const [form, setForm] = useState(no)
  useEffect(() => setForm(no), [no.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const alterado = useMemo(
    () =>
      form.nome !== no.nome ||
      form.descricao !== no.descricao ||
      form.ativo !== no.ativo ||
      (form.prazo ?? "") !== (no.prazo ?? "") ||
      (form.cargaHoraria ?? "") !== (no.cargaHoraria ?? "") ||
      (form.entregavel ?? "") !== (no.entregavel ?? ""),
    [form, no]
  )

  const setCampo = (campo) => (e) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }))

  const salvar = () => {
    acoes.atualizar(no.id, {
      nome: form.nome.trim() || meta.label,
      descricao: form.descricao,
      ativo: form.ativo,
      ...(no.tipo === "tarefa" && {
        prazo: form.prazo,
        cargaHoraria: form.cargaHoraria,
        entregavel: form.entregavel,
      }),
    })
    onSalvar?.()
  }

  const cancelar = () => setForm(no)

  return (
    <motion.div
      key={no.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Cabecalho */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ mb: 1.5 }}>
          <Breadcrumb programa={programa} trilha={trilha} onSelecionar={acoes.setSelecionadoId} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: "8px",
              bgcolor: `${meta.cor}1f`,
              color: meta.cor,
            }}
          >
            <Icone sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Chip
              label={meta.label}
              size="small"
              sx={{
                height: 20,
                fontSize: 11,
                fontWeight: 600,
                bgcolor: `${meta.cor}1f`,
                color: meta.cor,
                mb: 0.25,
              }}
            />
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
              {form.nome || `Nova ${meta.label.toLowerCase()}`}
            </Typography>
          </Box>
          <Tooltip title="Excluir" arrow>
            <IconButton onClick={() => onExcluir(no)} sx={{ color: "error.main" }}>
              <DeleteOutline />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Divider />

      {/* Corpo rolavel */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5 }}>
        <Stack spacing={2.5}>
          <TextField
            label="Nome"
            fullWidth
            value={form.nome}
            onChange={setCampo("nome")}
            autoFocus
          />
          <TextField
            label="Descricao"
            fullWidth
            multiline
            minRows={3}
            value={form.descricao}
            onChange={setCampo("descricao")}
            placeholder={`Explique o objetivo desta ${meta.label.toLowerCase()}…`}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={form.ativo}
                  onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                />
              }
              label={form.ativo ? "Ativo" : "Inativo"}
            />
            <Chip
              icon={<Tag sx={{ fontSize: 15 }} />}
              label={`Ordem ${no.ordem}`}
              size="small"
              variant="outlined"
              sx={{ height: 26 }}
            />
          </Box>

          {/* --------- Campos especificos da Tarefa (preparados p/ crescer) --------- */}
          {no.tipo === "tarefa" && (
            <>
              <Divider textAlign="left">
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  DETALHES DA TAREFA
                </Typography>
              </Divider>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Prazo"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={form.prazo || ""}
                  onChange={setCampo("prazo")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Schedule sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Carga horaria"
                  fullWidth
                  placeholder="ex.: 2h30"
                  value={form.cargaHoraria || ""}
                  onChange={setCampo("cargaHoraria")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Timelapse sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              <TextField
                label="Entregavel"
                fullWidth
                placeholder="O que a startup deve entregar ao concluir?"
                value={form.entregavel || ""}
                onChange={setCampo("entregavel")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Inventory2 sx={{ fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  RECURSOS (em breve)
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                  {RECURSOS_TAREFA.map(({ icon: I, label }) => (
                    <Chip
                      key={label}
                      icon={<I sx={{ fontSize: 16 }} />}
                      label={label}
                      variant="outlined"
                      size="small"
                      sx={{
                        height: 30,
                        borderStyle: "dashed",
                        color: "text.secondary",
                        "& .MuiChip-icon": { color: "text.disabled" },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            </>
          )}
        </Stack>
      </Box>

      {/* Rodape de acoes */}
      <Divider />
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          px: 3,
          py: 2,
        }}
      >
        <Button
          onClick={cancelar}
          disabled={!alterado}
          startIcon={<Close />}
          sx={{ textTransform: "none" }}
        >
          Cancelar
        </Button>
        <Button
          onClick={salvar}
          disabled={!alterado}
          variant="contained"
          startIcon={<Save />}
          sx={{ textTransform: "none" }}
        >
          Salvar
        </Button>
      </Box>
    </motion.div>
  )
}
