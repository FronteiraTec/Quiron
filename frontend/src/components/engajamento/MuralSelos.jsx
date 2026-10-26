/**
 * O mural de selos da incubadora: o catálogo (o que dá para conquistar) e as
 * concessões recentes (quem conquistou).
 *
 * O CATALOGO VEM PRIMEIRO, e nao as concessoes. Antes de ser conquistado, o
 * selo tem uma funcao sozinho: dizer o que a incubadora reconhece. Um mural que
 * so lista quem ganhou o que nao explica a ninguem o que vale a pena fazer.
 *
 * O CRITERIO APARECE NO CARTAO, nao escondido num tooltip: e o que separa o
 * selo de um adesivo, e e o mesmo texto que a credencial publica mostra para
 * quem nao conhece a incubadora.
 *
 * NAO HA PONTUACAO EM LUGAR NENHUM deste componente, e nao e omissao — selo
 * mede evolucao e protagonismo, e vale zero ponto (ver o cabecalho da migracao
 * 017). O aviso no topo existe porque a pergunta "quantos pontos vale?" vai
 * ser feita, e a resposta precisa estar escrita.
 */
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material"
import { MilitaryTech, WorkspacePremium } from "@mui/icons-material"

import SeloAvatar from "./SeloAvatar"
import { dataBR } from "./vocabulario"

function CartaoSelo({ selo, podeConceder, onConceder }) {
  return (
    <Paper
      sx={{
        borderRadius: 0,
        p: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderTop: "3px solid",
        borderTopColor: selo.cor,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <SeloAvatar selo={selo} tamanho={44} apagado={!selo.ativo} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap title={selo.nome}>
            {selo.nome}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {selo.categoria || "Sem categoria"}
            {" · "}
            {selo.pessoas === 0
              ? "ninguém ainda"
              : `${selo.pessoas} ${selo.pessoas === 1 ? "pessoa" : "pessoas"}`}
          </Typography>
        </Box>
      </Box>

      {selo.criterio && (
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {selo.criterio}
        </Typography>
      )}

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: "auto" }}>
        {!selo.ativo && <Chip size="small" label="Desativado" />}
        {podeConceder && selo.ativo && (
          <Button size="small" onClick={() => onConceder(selo)}>
            Conceder
          </Button>
        )}
      </Box>
    </Paper>
  )
}

export default function MuralSelos({
  selos = [],
  concessoes = [],
  podeConceder = false,
  onConceder,
}) {
  return (
    <Box data-tour="engajamento-selos">
      <Alert severity="info" icon={<MilitaryTech />} sx={{ borderRadius: 0, mb: 3 }}>
        <strong>Selos não valem pontos e é de propósito.</strong> Eles reconhecem evolução e
        protagonismo: validar uma hipótese, pivotar com evidência, ajudar outro empreendedor,
        compartilhar conhecimento. Transformar isso em pontuação faria as pessoas fazerem o
        trabalho pelo ponto. Cada selo vira uma credencial verificável que a pessoa publica no
        LinkedIn.
      </Alert>

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        O que esta incubadora reconhece
      </Typography>

      {selos.length === 0 ? (
        <Paper sx={{ borderRadius: 0, p: 4, textAlign: "center", mb: 3 }}>
          <WorkspacePremium sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">
            Nenhum selo criado ainda. A coordenação cria os selos em Configurações → Engajamento.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {selos.map((selo) => (
            <Grid item xs={12} sm={6} md={4} key={selo.id_selo}>
              <CartaoSelo selo={selo} podeConceder={podeConceder} onConceder={onConceder} />
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
        Conquistas recentes
      </Typography>

      {concessoes.length === 0 ? (
        <Paper sx={{ borderRadius: 0, p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">Nenhum selo concedido ainda.</Typography>
        </Paper>
      ) : (
        <Paper sx={{ borderRadius: 0 }}>
          {concessoes.map((c) => (
            <Box
              key={c.id_concessao}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                "&:last-of-type": { borderBottom: "none" },
              }}
            >
              <SeloAvatar
                selo={{ ...c, nome: c.selo }}
                tamanho={36}
                apagado={Boolean(c.revogado_ts)}
              />

              <Avatar src={c.foto_url || undefined} sx={{ width: 28, height: 28, fontSize: 13 }}>
                {(c.usuario || "?").charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" noWrap>
                  <strong>{c.usuario}</strong> recebeu {c.selo}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {dataBR(c.concedido_ts)}
                  {c.startup ? ` · ${c.startup}` : ""}
                  {c.concedido_por_nome ? ` · por ${c.concedido_por_nome}` : ""}
                </Typography>
              </Box>

              {c.revogado_ts ? (
                <Tooltip title={c.motivo_revogacao || "Revogada"}>
                  <Chip size="small" label="Revogada" variant="outlined" />
                </Tooltip>
              ) : (
                c.publico && (
                  <Tooltip title="A pessoa tornou a credencial pública.">
                    <Chip size="small" label="Credencial pública" variant="outlined" />
                  </Tooltip>
                )
              )}
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  )
}
