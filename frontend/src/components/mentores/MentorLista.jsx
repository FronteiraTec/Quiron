/**
 * Coluna esquerda da tela de Mentores: quem mentora, e com quanta carga.
 *
 * Cada item responde as duas perguntas que o admin faz ao distribuir startups:
 * quantas cada mentor ja acompanha, e quanto disso esta parado esperando ele.
 *
 * O caso "nenhuma startup" ganha destaque proprio de proposito: o mentor sem
 * vinculo entra no sistema e ve a fila vazia, sem nenhuma pista de que falta
 * alguem liga-lo a uma startup. E o unico estado desta tela que sempre pede
 * uma acao.
 */
import { Box, Typography, Avatar, Tooltip } from "@mui/material"
import { SupervisorAccount, WarningAmber } from "@mui/icons-material"

/** Primeira letra do nome, para o avatar sem foto. */
function inicial(nome) {
  return (nome || "?").trim().charAt(0).toUpperCase()
}

export default function MentorLista({ mentores, selecionado, onSelecionar }) {
  if (mentores.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8, px: 3, color: "text.secondary" }}>
        <SupervisorAccount sx={{ fontSize: 48, opacity: 0.4 }} />
        <Typography sx={{ mt: 1 }}>Nenhum mentor nesta incubadora.</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Mentor é um papel: defina "mentor" para um usuário em Usuários e ele
          aparece aqui.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ overflowY: "auto", flex: 1 }}>
      {mentores.map((m, i) => {
        const ativo = selecionado === m.id_usuario
        const semStartups = m.startups === 0

        return (
          <Box
            key={m.id_usuario}
            onClick={() => onSelecionar(m.id_usuario)}
            sx={{
              px: 2.5,
              py: 1.75,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              borderTop: i === 0 ? "none" : "1px solid",
              borderColor: "divider",
              // A barra na lateral marca o item aberto sem precisar de fundo forte.
              borderLeft: "3px solid",
              borderLeftColor: ativo ? "primary.main" : "transparent",
              bgcolor: ativo ? "action.selected" : "transparent",
              "&:hover": { bgcolor: ativo ? "action.selected" : "action.hover" },
            }}
          >
            <Avatar
              src={m.foto_url || undefined}
              sx={{ width: 38, height: 38, fontSize: 15, bgcolor: "primary.main" }}
            >
              {inicial(m.nome)}
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>
                {m.nome}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {m.email}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                {semStartups ? (
                  <Typography variant="caption" sx={{ color: "#f97316", fontWeight: 700 }}>
                    sem startups
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {m.startups} {m.startups === 1 ? "startup" : "startups"}
                  </Typography>
                )}

                {m.pendentes > 0 && (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      ·
                    </Typography>
                    <Tooltip
                      title={`${m.pendentes} ${
                        m.pendentes === 1 ? "entrega espera" : "entregas esperam"
                      } a resposta deste mentor`}
                      arrow
                    >
                      <Typography variant="caption" sx={{ color: "#f97316", fontWeight: 700 }}>
                        {m.pendentes} aguardando
                      </Typography>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Box>

            {semStartups && (
              <Tooltip title="Este mentor não acompanha nenhuma startup: a fila dele está vazia" arrow>
                <WarningAmber sx={{ fontSize: 17, color: "#f97316", flexShrink: 0 }} />
              </Tooltip>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
