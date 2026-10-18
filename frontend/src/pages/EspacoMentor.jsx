/**
 * Espaco do Mentor — o ambiente de trabalho do mentor (migracoes 020 e 021).
 *
 * Quatro abas, cada uma uma pergunta:
 *   Minha biblioteca          o que eu tenho para trabalhar? (privada)
 *   Materiais da incubadora   o que a coordenacao preparou para os mentores?
 *                             (quem tem as chaves de editar tambem publica)
 *   Meus incubados            com quem eu trabalho, e onde cada um esta?
 *   Materiais compartilhados  o que eu ja entreguei, e a quem?
 *
 * O gesto central — compartilhar um material com UMA startup, num ponto da
 * trilha dela — nasce de dois lugares: da etapa, em Meus incubados, ou do
 * material, na biblioteca. Por isso o dialogo de compartilhar mora AQUI, na
 * pagina, e nao numa aba: as duas o abrem com o que ja sabem preenchido, e ao
 * fim as tres abas recarregam (o contador da biblioteca, o do incubado e a
 * lista consolidada mudam juntos).
 *
 * Quem entra: quem tem `mentoria.materiais.gerenciar` (a biblioteca),
 * `mentoria.materiais_incubadora.visualizar` (os materiais da incubadora) ou
 * `mentoria.materiais.compartilhar` (as outras duas). Esconder abas aqui so
 * evita oferecer o que responderia 403 — quem autoriza e o backend.
 *
 * Quem pode PUBLICAR para os mentores (a coordenacao) abre direto na aba da
 * incubadora: e o trabalho dela aqui, e nao a biblioteca pessoal.
 *
 * A aba vive na URL (?aba=), como em Engajamento: "veja o que voce ja
 * compartilhou" vira um link que leva direto ao lugar.
 */
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Alert, Box, Paper, Snackbar, Tab, Tabs, Typography } from "@mui/material"
import { Business, CoPresent, LocalLibrary, RocketLaunch, Share } from "@mui/icons-material"
import AppLayout from "../components/AppLayout"
import ConfirmDialog from "../components/programa/ConfirmDialog"
import AbaMinhaBiblioteca from "../components/espacoMentor/AbaMinhaBiblioteca"
import AbaMateriaisIncubadora from "../components/espacoMentor/AbaMateriaisIncubadora"
import AbaMeusIncubados from "../components/espacoMentor/AbaMeusIncubados"
import AbaCompartilhados from "../components/espacoMentor/AbaCompartilhados"
import DialogCompartilhar from "../components/espacoMentor/DialogCompartilhar"
import DialogMaterial from "../components/espacoMentor/DialogMaterial"
import DialogEditarCompartilhamento from "../components/espacoMentor/DialogEditarCompartilhamento"
import { compartilhamentos, erroDe } from "../hooks/useEspacoMentor"
import { useAuthStore } from "../store/authStore"
import { usePermissaoStore } from "../store/permissaoStore"

const GERENCIAR = "mentoria.materiais.gerenciar"
const COMPARTILHAR = "mentoria.materiais.compartilhar"
const INCUBADORA = "mentoria.materiais_incubadora"

export default function EspacoMentor() {
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant ?? null)
  // Ler `chaves` assina o store: quando as permissoes chegam, a tela redesenha.
  const chaves = usePermissaoStore((s) => s.chaves)
  const pode = usePermissaoStore((s) => s.pode)
  const podeBiblioteca = pode(GERENCIAR)
  const podeCompartilhar = pode(COMPARTILHAR)
  const podeVerBibliotecaInstitucional = pode("programa.biblioteca.visualizar")
  const incubadora = {
    ver: pode(`${INCUBADORA}.visualizar`),
    criar: pode(`${INCUBADORA}.criar`),
    editar: pode(`${INCUBADORA}.editar`),
    excluir: pode(`${INCUBADORA}.excluir`),
  }

  const abas = [
    podeBiblioteca && "biblioteca",
    incubadora.ver && "incubadora",
    podeCompartilhar && "incubados",
    podeCompartilhar && "compartilhados",
  ].filter(Boolean)
  // A coordenacao (quem publica para os mentores) abre na aba da incubadora.
  const abaPadrao = incubadora.ver && incubadora.criar ? "incubadora" : abas[0]

  const [params, setParams] = useSearchParams()
  const aba = abas.includes(params.get("aba")) ? params.get("aba") : abaPadrao
  const setAba = (valor) => setParams({ aba: valor }, { replace: true })

  // Incrementada depois de qualquer gravacao: as tres abas recarregam.
  const [versao, setVersao] = useState(0)
  const mudou = () => setVersao((v) => v + 1)

  const [compartilhando, setCompartilhando] = useState(null) // presets do dialogo
  const [vendo, setVendo] = useState(null)
  const [editando, setEditando] = useState(null)
  const [removendo, setRemovendo] = useState(null)
  const [toast, setToast] = useState(null)

  const concluirCompartilhamento = (c) => {
    setCompartilhando(null)
    mudou()
    setToast({ texto: `"${c.titulo}" foi compartilhado com ${c.startup_nome}.`, severidade: "success" })
  }

  const removerConfirmado = async () => {
    const alvo = removendo
    setRemovendo(null)
    try {
      await compartilhamentos.remover(alvo.id_compartilhamento)
      mudou()
      setToast({ texto: `"${alvo.titulo}" foi removido de ${alvo.startup_nome}.`, severidade: "info" })
    } catch (err) {
      setToast({ texto: erroDe(err, "Não foi possível remover o compartilhamento."), severidade: "error" })
    }
  }

  const acoesCompartilhamento = {
    onAbrir: setVendo,
    onEditar: setEditando,
    onRemover: setRemovendo,
  }

  // Chaves ainda carregando: `pode` responde true e a tela aparece inteira.
  // Depois disso, sem nenhuma das duas, nao ha o que mostrar.
  if (chaves !== null && abas.length === 0) {
    return (
      <AppLayout>
        <Cabecalho />
        <Alert severity="info" variant="outlined">
          Seu perfil não tem acesso ao Espaço do Mentor. Se você acompanha startups, peça à
          coordenação a permissão “Espaço do Mentor” na sua role.
        </Alert>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Cabecalho />

      <Paper sx={{ borderRadius: 0, overflow: "hidden" }}>
        <Tabs
          value={aba}
          onChange={(_, v) => setAba(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          {podeBiblioteca && (
            <Tab value="biblioteca" label="Minha biblioteca" icon={<LocalLibrary />} iconPosition="start" />
          )}
          {incubadora.ver && (
            <Tab value="incubadora" label="Materiais da incubadora" icon={<Business />} iconPosition="start" />
          )}
          {podeCompartilhar && (
            <Tab value="incubados" label="Meus incubados" icon={<RocketLaunch />} iconPosition="start" />
          )}
          {podeCompartilhar && (
            <Tab value="compartilhados" label="Materiais compartilhados" icon={<Share />} iconPosition="start" />
          )}
        </Tabs>
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          {aba === "biblioteca" && (
            <AbaMinhaBiblioteca
              idTenant={idTenant}
              versao={versao}
              podeCompartilhar={podeCompartilhar}
              onMudou={mudou}
              onCompartilhar={(material) => setCompartilhando({ material })}
              onAviso={setToast}
            />
          )}
          {aba === "incubadora" && (
            <AbaMateriaisIncubadora
              idTenant={idTenant}
              versao={versao}
              podeCriar={incubadora.criar}
              podeEditar={incubadora.editar}
              podeExcluir={incubadora.excluir}
              onMudou={mudou}
              onAviso={setToast}
            />
          )}
          {aba === "incubados" && (
            <AbaMeusIncubados
              idTenant={idTenant}
              versao={versao}
              onCompartilhar={setCompartilhando}
              {...acoesCompartilhamento}
            />
          )}
          {aba === "compartilhados" && (
            <AbaCompartilhados idTenant={idTenant} versao={versao} {...acoesCompartilhamento} />
          )}
        </Box>
      </Paper>

      <DialogCompartilhar
        aberto={Boolean(compartilhando)}
        presets={compartilhando ?? {}}
        idTenant={idTenant}
        podeVerBiblioteca={podeVerBibliotecaInstitucional}
        onFechar={() => setCompartilhando(null)}
        onConcluido={concluirCompartilhamento}
      />

      <DialogMaterial aberto={Boolean(vendo)} item={vendo} onFechar={() => setVendo(null)} />

      <DialogEditarCompartilhamento
        item={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null)
          mudou()
          setToast({ texto: "Compartilhamento atualizado.", severidade: "success" })
        }}
      />

      <ConfirmDialog
        aberto={Boolean(removendo)}
        titulo="Remover da startup"
        mensagem={
          removendo
            ? `Remover "${removendo.titulo}" de ${removendo.startup_nome}? A startup deixa de ver o material; ele continua na biblioteca de origem.`
            : ""
        }
        confirmarTexto="Remover"
        onConfirmar={removerConfirmado}
        onCancelar={() => setRemovendo(null)}
      />

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severidade === "error" ? 6000 : 3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severidade}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ borderRadius: "6px", alignItems: "center" }}
          >
            {toast.texto}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>
    </AppLayout>
  )
}

function Cabecalho() {
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <CoPresent sx={{ color: "primary.main" }} />
        <Typography variant="h4" fontWeight={700}>
          Espaço do Mentor
        </Typography>
      </Box>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Seus materiais de trabalho e o que você entrega a cada startup que acompanha, no ponto certo
        da trilha.
      </Typography>
    </>
  )
}
