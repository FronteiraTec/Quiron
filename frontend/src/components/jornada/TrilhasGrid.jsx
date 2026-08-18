/**
 * As trilhas da startup — a tela de entrada da Jornada quando ha mais de uma.
 *
 * Mostra o que esta sendo feito e o que ja foi percorrido, cada trilha com um
 * anel de progresso e a contagem de passos concluidos. A referencia e a tela
 * de formacoes de uma plataforma de cursos: o cartao responde "quanto falta"
 * antes de o incubado precisar abrir qualquer coisa.
 *
 * O anel e um SVG e nao um componente do MUI porque precisa de meia-volta
 * (semicirculo) e de um traco grosso com ponta arredondada — configuracoes
 * que o CircularProgress nao expoe sem sobrescrever o SVG interno de qualquer
 * jeito.
 */
import { Box, Typography, Chip, Card, CardActionArea } from "@mui/material"
import { CheckCircle, PlayArrow, Lock } from "@mui/icons-material"
import { motion } from "framer-motion"

export default function TrilhasGrid({ trilhas, trilhaAtivaId, onAbrir }) {
  const emAndamento = trilhas.filter((t) => t.status === "EM_ANDAMENTO")
  const concluidas = trilhas.filter((t) => t.status === "CONCLUIDA")

  // Sem maxWidth nem `mx: auto`: o AppLayout ja da o respiro lateral (p: 3), e
  // limitar a 1080 deixava metade de um monitor largo vazia.
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
        Minha Jornada
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        As trilhas da sua startup na incubadora. Abra uma para continuar de onde parou.
      </Typography>

      {emAndamento.length > 0 && (
        <Secao titulo="EM ANDAMENTO">
          <Grade>
            {emAndamento.map((t) => (
              <CardTrilha
                key={t.id_no}
                trilha={t}
                ativa={Number(t.id_no) === Number(trilhaAtivaId)}
                onAbrir={onAbrir}
              />
            ))}
          </Grade>
        </Secao>
      )}

      {concluidas.length > 0 && (
        <Secao titulo="JÁ PERCORRIDAS">
          <Grade>
            {concluidas.map((t) => (
              <CardTrilha
                key={t.id_no}
                trilha={t}
                ativa={Number(t.id_no) === Number(trilhaAtivaId)}
                onAbrir={onAbrir}
              />
            ))}
          </Grade>
        </Secao>
      )}

      {trilhas.length === 0 && (
        <Typography color="text.secondary">
          Sua startup ainda não foi colocada em nenhuma trilha. Fale com a incubadora.
        </Typography>
      )}
    </Box>
  )
}

function Secao({ titulo, children }) {
  return (
    <Box sx={{ mb: 5 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: 1, display: "block", mb: 1.5 }}
      >
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

/**
 * Grade fluida: as colunas nascem da largura disponivel, nao de uma contagem
 * fixa por breakpoint. Num monitor largo isso vira cinco ou seis cartoes por
 * linha sem precisar de um breakpoint para cada tamanho de tela.
 *
 * O `minmax(260px, 1fr)` e o que impede o efeito colateral: sem o minimo, uma
 * unica trilha esticaria por toda a largura da tela.
 */
function Grade({ children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}
    >
      {children}
    </Box>
  )
}

function CardTrilha({ trilha, ativa, onAbrir }) {
  const concluida = trilha.status === "CONCLUIDA"
  const total = trilha.passos || 0
  const feitos = trilha.passos_concluidos || 0
  const pct = total ? Math.round((feitos / total) * 100) : 0

  // Trilha sem passo nenhum ainda: nao ha o que abrir, e um cartao clicavel
  // que leva a uma tela vazia so frustra.
  const vazia = total === 0

  return (
    <Card
      component={motion.div}
      whileHover={vazia ? undefined : { y: -3 }}
      transition={{ duration: 0.18 }}
      elevation={0}
      sx={{
        border: "1px solid",
        borderColor: ativa ? "primary.main" : "divider",
        // Raio proprio, em px, em vez do `shape.borderRadius` do tema (12 por
        // padrao, e configuravel pelo usuario ate 24): a grade e de cartoes
        // grandes lado a lado, e o canto arredondado que fica bem num botao
        // deixa a parede de cartoes borrada.
        borderRadius: "4px",
        overflow: "hidden",
        opacity: concluida ? 0.9 : 1,
      }}
    >
      <CardActionArea
        disabled={vazia}
        onClick={() => onAbrir(trilha.id_no)}
        sx={{ p: 2.5, height: "100%", display: "block", textAlign: "left" }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, letterSpacing: 0.8, color: "primary.main" }}
            >
              TRILHA
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25 }}>
              {trilha.nome}
            </Typography>
          </Box>
          {concluida ? (
            <CheckCircle sx={{ color: "success.main", fontSize: 22 }} />
          ) : vazia ? (
            <Lock sx={{ color: "text.disabled", fontSize: 20 }} />
          ) : (
            <PlayArrow sx={{ color: "primary.main", fontSize: 22 }} />
          )}
        </Box>

        {trilha.descricao && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: 40,
            }}
          >
            {trilha.descricao}
          </Typography>
        )}

        <Box sx={{ display: "grid", placeItems: "center", py: 1.5 }}>
          <AnelProgresso pct={pct} concluida={concluida} />
        </Box>

        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mt: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1 }}>
            {feitos}/{total}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
            passos
            <br />
            concluídos
          </Typography>
          <Box sx={{ ml: "auto" }}>
            {vazia ? (
              <Chip
                label="sem conteúdo"
                size="small"
                sx={{ height: 22, fontSize: 11, borderRadius: "3px" }}
              />
            ) : (
              <Chip
                label={concluida ? "concluída" : `${pct}%`}
                size="small"
                color={concluida ? "success" : "primary"}
                variant={concluida ? "filled" : "outlined"}
                sx={{ height: 22, fontSize: 11, fontWeight: 700, borderRadius: "3px" }}
              />
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}

/**
 * Semicirculo de progresso. Raio e traco fixos: o cartao tem largura de grade,
 * entao nao ha ganho em parametrizar o que nunca varia.
 */
function AnelProgresso({ pct, concluida }) {
  const R = 52
  const LARGURA = 12
  const arco = Math.PI * R // meia circunferencia
  const preenchido = (Math.min(100, Math.max(0, pct)) / 100) * arco

  return (
    <Box
      component="svg"
      viewBox="0 0 140 78"
      role="img"
      aria-label={`${pct}% concluído`}
      sx={{ width: "100%", maxWidth: 160, display: "block" }}
    >
      {/* Trilho */}
      <path
        d={`M ${70 - R} 70 A ${R} ${R} 0 0 1 ${70 + R} 70`}
        fill="none"
        strokeWidth={LARGURA}
        strokeLinecap="round"
        style={{ stroke: "currentColor", opacity: 0.12 }}
      />
      {/* Preenchimento */}
      {pct > 0 && (
        <Box
          component="path"
          d={`M ${70 - R} 70 A ${R} ${R} 0 0 1 ${70 + R} 70`}
          fill="none"
          strokeWidth={LARGURA}
          strokeLinecap="round"
          strokeDasharray={`${preenchido} ${arco}`}
          sx={{ stroke: concluida ? "success.main" : "primary.main" }}
        />
      )}
    </Box>
  )
}
