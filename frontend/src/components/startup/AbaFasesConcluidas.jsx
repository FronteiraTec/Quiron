/**
 * Aba "Fases concluidas": lista somente leitura das fases ja aprovadas.
 * Usada tanto em MinhaStartup quanto em StartupDetail.
 */
import { useEffect, useMemo, useState } from "react"
import { Box, Chip, Alert, CircularProgress, Typography } from "@mui/material"
import api from "../../services/api"
import TabelaDados from "../tabela/TabelaDados"

export default function AbaFasesConcluidas({ idStartup }) {
  const [fases, setFases] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    setCarregando(true)
    api
      .get(`/startups/${idStartup}/fases-concluidas`)
      .then(({ data }) => setFases(data.fases))
      .catch((err) => setAviso({ tipo: "error", texto: err.response?.data?.erro || "Erro ao carregar as fases." }))
      .finally(() => setCarregando(false))
  }, [idStartup])

  const colunas = useMemo(
    () => [
      {
        chave: "ordem",
        rotulo: "Ordem",
        alinhamento: "center",
        largura: 90,
        valorOrdenacao: (f) => Number(f.ordem),
        valorTexto: (f) => String(f.ordem),
        render: (f) => <Chip size="small" label={f.ordem} />,
      },
      {
        chave: "nome",
        rotulo: "Nome",
        obrigatoria: true,
        largura: 220,
        valorTexto: (f) => f.nome,
        render: (f) => (
          <Typography variant="body2" fontWeight={600}>
            {f.nome}
          </Typography>
        ),
      },
      {
        chave: "descricao",
        rotulo: "Descrição",
        valorTexto: (f) => f.descricao || "",
        render: (f) => (
          <Typography variant="body2" color="text.secondary">
            {f.descricao}
          </Typography>
        ),
      },
      {
        chave: "fim_ts",
        rotulo: "Concluída em",
        alinhamento: "center",
        largura: 140,
        valorOrdenacao: (f) => f.fim_ts,
        valorTexto: (f) => (f.fim_ts ? new Date(f.fim_ts).toLocaleDateString("pt-BR") : ""),
        render: (f) => (f.fim_ts ? new Date(f.fim_ts).toLocaleDateString("pt-BR") : "—"),
      },
      {
        chave: "aprovado_por_nome",
        rotulo: "Aprovada por",
        alinhamento: "center",
        largura: 180,
      },
    ],
    []
  )

  if (carregando) {
    return (
      <Box sx={{ textAlign: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      {aviso && (
        <Alert severity={aviso.tipo} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <TabelaDados
        dados={fases}
        colunas={colunas}
        chaveId="id_startup_trilha"
        chaveStorage="startup-fases-concluidas"
        ordemInicial="ordem"
        larguraMinima={720}
        mensagemVazio="Nenhuma fase concluída ainda."
      />
    </>
  )
}
