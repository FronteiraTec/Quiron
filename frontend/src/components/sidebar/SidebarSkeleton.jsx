/**
 * SidebarSkeleton - esqueleto exibido enquanto o usuario/menu carrega.
 * Reproduz o ritmo visual da lista para evitar "pulos" de layout. O cabecalho
 * (marca) nao entra aqui: ele aparece de verdade mesmo durante o carregamento
 * (ver SidebarConteudo).
 */
import { Box, Skeleton } from "@mui/material"

export default function SidebarSkeleton({ recolhida = false }) {
  return (
    <Box sx={{ p: 2 }} aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.75, px: 0.5, py: 1.25 }}>
          <Skeleton variant="circular" width={22} height={22} />
          {!recolhida && (
            <Skeleton
              variant="text"
              width={`${50 + (i % 4) * 12}%`}
              height={18}
              sx={{ borderRadius: "6px" }}
            />
          )}
        </Box>
      ))}
    </Box>
  )
}
