/**
 * Aba "Modelos": sub-abas Business Model Canvas / Analise SWOT / Matriz GUT / 5W2H.
 * Usada tanto em MinhaStartup quanto em StartupDetail.
 *
 * Cada modelo e uma experiencia guiada propria (ver ./modelos): o objetivo e
 * ensinar o empreendedor incubado a construir o modelo, nao apenas preencher
 * formularios.
 */
import { useState } from "react"
import { Box, Tab, Tabs } from "@mui/material"
import DashboardCustomizeOutlinedIcon from "@mui/icons-material/DashboardCustomizeOutlined"
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined"
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined"
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined"
import { motion, AnimatePresence } from "framer-motion"
import CanvasBoard from "./modelos/CanvasBoard"
import AnaliseSwot from "./modelos/AnaliseSwot"
import MatrizGut from "./modelos/MatrizGut"
import Plano5w2h from "./modelos/Plano5w2h"

// Na ordem de uso: o negocio (Canvas), o diagnostico (SWOT), o que atacar
// primeiro (GUT) e o plano de acao (5W2H).
const MODELOS = [
  { valor: "canvas", rotulo: "Business Model Canvas", Icone: DashboardCustomizeOutlinedIcon, Componente: CanvasBoard },
  { valor: "swot", rotulo: "Análise SWOT", Icone: GridViewOutlinedIcon, Componente: AnaliseSwot },
  { valor: "gut", rotulo: "Matriz GUT", Icone: FlagOutlinedIcon, Componente: MatrizGut },
  { valor: "5w2h", rotulo: "Plano de ação 5W2H", Icone: ChecklistOutlinedIcon, Componente: Plano5w2h },
]

export default function AbaModelos({ idStartup, nomeStartup }) {
  const [modelo, setModelo] = useState("canvas")
  const atual = MODELOS.find((m) => m.valor === modelo)

  return (
    <>
      <Tabs
        value={modelo}
        onChange={(_, v) => setModelo(v)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2.5 }}
      >
        {MODELOS.map((m) => (
          <Tab
            key={m.valor}
            value={m.valor}
            label={m.rotulo}
            icon={<m.Icone sx={{ fontSize: 19 }} />}
            iconPosition="start"
            sx={{ textTransform: "none", minHeight: 48 }}
          />
        ))}
      </Tabs>

      <AnimatePresence mode="wait">
        <Box
          key={modelo}
          component={motion.div}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <atual.Componente idStartup={idStartup} nomeStartup={nomeStartup} />
        </Box>
      </AnimatePresence>
    </>
  )
}
