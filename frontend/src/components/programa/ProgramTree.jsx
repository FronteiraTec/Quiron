/**
 * Painel esquerdo: a arvore completa do programa.
 *
 * Junta a busca (SearchInput), a lista de fases (TreeNode recursivos), a
 * entrada rapida de nova fase e os estados vazio / de "nenhum resultado".
 * O menu de contexto (ContextMenu) e controlado pelo componente pai (Programa)
 * e apenas disparado daqui via ctx.abrirMenu.
 */
import { Box, Typography, Divider } from "@mui/material"
import { AutoStories } from "@mui/icons-material"
import TreeNode from "./TreeNode"
import QuickAdd from "./QuickAdd"
import SearchInput from "./SearchInput"
import EmptyState from "./EmptyState"
import { TIPO_META } from "../../data/trilhaMeta"

export default function ProgramTree({ arvore, termo, ctx }) {
  const fases = arvore.filhos ?? []
  const buscando = Boolean(termo.trim())

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Cabecalho do programa */}
      <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              borderRadius: "7px",
              bgcolor: `${TIPO_META.PROGRAMA.cor}1f`,
              color: TIPO_META.PROGRAMA.cor,
            }}
          >
            <AutoStories sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              noWrap
              sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, cursor: "pointer" }}
              onClick={() => ctx.setSelecionadoId(arvore.id_no)}
            >
              {arvore.nome}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {fases.length} fase{fases.length === 1 ? "" : "s"}
            </Typography>
          </Box>
        </Box>
        <SearchInput value={ctx.termo} onChange={ctx.setTermo} />
      </Box>

      <Divider />

      {/* Lista rolavel */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1, py: 1 }}>
        {fases.length === 0 && buscando && (
          <EmptyState
            variante="busca"
            titulo="Nada encontrado"
            descricao={`Nenhum item corresponde a "${termo}".`}
          />
        )}

        {fases.length === 0 && !buscando && (
          <EmptyState
            variante="fases"
            titulo="Comece seu programa"
            descricao="Crie a primeira fase da trilha de incubação."
          />
        )}

        {fases.map((fase) => (
          <TreeNode key={fase.id_no} no={fase} nivel={0} ctx={ctx} />
        ))}

        {!buscando && (
          <Box sx={{ mt: 0.5 }}>
            <QuickAdd
              tipoFilho="FASE"
              cor={TIPO_META.FASE.cor}
              indent={0}
              onAdd={(nome) => ctx.adicionar(arvore.id_no, "FASE", nome)}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}
