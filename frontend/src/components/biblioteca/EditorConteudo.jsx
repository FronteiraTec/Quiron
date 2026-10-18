/**
 * Editor em tela cheia de um conteudo da Biblioteca.
 *
 * A TELA
 * Uma pagina, nao um formulario. De cima para baixo: uma faixa discreta de
 * chrome (tipo, estado do salvamento, fechar), o logo, o TITULO em tamanho de
 * titulo mesmo — sem caixa, sem rotulo flutuante —, as propriedades numa lista
 * quieta logo abaixo, e entao o corpo, ocupando a pagina.
 *
 * Ate 12/09/2026 era o contrario: titulo, resumo, as dez tags do acervo e um
 * divisor "CONTEUDO" vinham primeiro, e a aula — a razao da tela existir —
 * aparecia por ultimo, dentro de um quadro com borda. Quem abria para escrever
 * atravessava o cadastro antes de chegar ao texto.
 *
 * O titulo e as propriedades recebem o MESMO recuo lateral do editor de blocos
 * (RECUO), para que titulo, propriedades e primeira linha do texto fiquem na
 * mesma vertical. E o que faz a pagina parecer um documento e nao tres caixas
 * empilhadas.
 *
 * SALVAMENTO
 * Nao ha botao "Salvar": as alteracoes vao sozinhas depois de uma pequena
 * pausa (useSalvamentoAutomatico), e o estado aparece no topo. Fechar grava o
 * que estiver pendente antes de sair.
 *
 * O documento da aula fica numa REF, e nao no estado do React: ele muda a cada
 * tecla, e guarda-lo no estado re-renderizaria esta pagina inteira — com os
 * campos, as tags e o proprio editor — a cada caractere digitado.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Box,
  Drawer,
  Typography,
  TextField,
  IconButton,
  Button,
  Divider,
  Stack,
  Tooltip,
  Alert,
  Skeleton,
} from "@mui/material"
import { Close, UploadFile, AccountTree, Inventory2 } from "@mui/icons-material"
import { SeletorLogo } from "./LogoConteudo"
import PlayerYoutube from "./PlayerYoutube"
import { Propriedade, ValorTexto, ValorTags } from "./PropriedadesConteudo"
import IndicadorSalvamento from "../editor/IndicadorSalvamento"
import { ehYoutube } from "../../utils/youtube"
import { TIPO_CONTEUDO, TAGS } from "../../data/bibliotecaMeta"
import { useSalvamentoAutomatico } from "../../hooks/useSalvamentoAutomatico"
import { useAuthStore } from "../../store/authStore"

// O BlockNote carrega o ProseMirror junto e nao e pequeno. Separando-o num
// pedaco proprio, quem abre a Biblioteca para procurar um link nao baixa o
// editor de aula — ele chega quando uma AULA e realmente aberta.
const EditorDocumento = lazy(() => import("../editor/EditorDocumento"))

// Titulo que o servidor da a um conteudo recem-criado (useBiblioteca.criar).
// Serve para reconhecer "acabou de nascer" e so entao focar o campo do nome.
const TITULO_NOVO = "Sem título"

export default function EditorConteudo({ conteudo, onSalvar, onFechar }) {
  const aberto = Boolean(conteudo)

  // Fechar pelo Esc tem de gravar o que estiver pendente, igual ao botao. Quem
  // sabe fazer isso e a pagina la dentro, entao ela registra a funcao aqui.
  const refFechar = useRef(null)

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={() => (refFechar.current ? refFechar.current() : onFechar())}
      PaperProps={{ sx: { width: "100%", maxWidth: "100%" } }}
    >
      {conteudo && (
        <EditorConteudoInterno
          key={conteudo.id_conteudo}
          conteudo={conteudo}
          onSalvar={onSalvar}
          onFechar={onFechar}
          registrarFechar={(fn) => (refFechar.current = fn)}
        />
      )}
    </Drawer>
  )
}

// Em tela cheia o conteudo nao deve esticar de ponta a ponta: uma coluna
// central mantem a linha de texto legivel em monitores largos.
const COLUNA = { width: "100%", maxWidth: 980, mx: "auto" }

// O mesmo recuo lateral que o editor de blocos usa (ver components/editor/
// estilos.js). E o que alinha titulo, propriedades e texto na mesma vertical.
const RECUO = { px: { xs: "28px", sm: "54px" } }

function EditorConteudoInterno({ conteudo, onSalvar, onFechar, registrarFechar }) {
  const meta = TIPO_CONTEUDO[conteudo.tipo]

  // A API pode devolver resumo/tags nulos; o formulario espera string e array.
  // logo_url vira null explicito para nao confundir "ausente" com "nulo".
  const normalizar = (c) => ({
    ...c,
    resumo: c.resumo ?? "",
    tags: c.tags ?? [],
    logo_url: c.logo_url ?? null,
  })

  const [form, setForm] = useState(() => normalizar(conteudo))

  // Dono do arquivo de logo enviado (o upload exige o tenant).
  const idTenant = useAuthStore((s) => s.usuario?.id_tenant)

  // Erro ao escolher a imagem do logo (tipo/tamanho invalido).
  const [erroLogo, setErroLogo] = useState(null)

  /**
   * O corpo da aula.
   *
   * A listagem do acervo NAO traz o documento (seria arrastar todas as aulas
   * para desenhar uma grade de cards), entao ao abrir um conteudo existente
   * ele chega em dois tempos: primeiro o item da lista, depois a busca
   * completa. Enquanto `conteudo.documento` for `undefined`, o corpo ainda nao
   * chegou — e `null` aqui e o que impede uma gravacao disparada pelo titulo
   * de sobrescrever a aula com um documento vazio.
   *
   * Quando chega, ja vem no formato do editor mesmo para aula escrita no
   * editor antigo: a conversao acontece no servidor (documentoAula.js).
   */
  const corpoCarregado = conteudo.tipo !== "AULA" || Array.isArray(conteudo.documento)
  const documento = useRef(Array.isArray(conteudo.documento) ? conteudo.documento : null)

  useEffect(() => {
    if (documento.current === null && Array.isArray(conteudo.documento)) {
      documento.current = conteudo.documento
    }
  }, [conteudo.documento])

  // O formulario e a fonte da verdade na hora de gravar; a ref abaixo evita
  // que a funcao de salvar precise ser recriada a cada tecla.
  const refForm = useRef(form)
  refForm.current = form

  /** O que vai para a API. So os campos que o tipo usa. */
  const montarPatch = useCallback(() => {
    const f = refForm.current
    return {
      titulo: f.titulo.trim() || TITULO_NOVO,
      resumo: f.resumo,
      tags: f.tags,
      logo_url: f.logo_url,
      ...(f.tipo === "AULA" && {
        duracao: f.duracao,
        // Sem o corpo carregado nao ha o que gravar: mandar `null` aqui
        // apagaria a aula por causa de uma virgula no titulo.
        ...(Array.isArray(documento.current) ? { documento: documento.current } : {}),
      }),
      ...(f.tipo === "VIDEO" && { url: f.url, duracao: f.duracao }),
      ...(f.tipo === "ARQUIVO" && { url: f.url, nome_arquivo: f.nome_arquivo }),
      ...(f.tipo === "TEMPLATE" && { url: f.url, nome_arquivo: f.nome_arquivo }),
      ...(f.tipo === "LINK" && { url: f.url }),
    }
  }, [])

  const gravar = useCallback(
    (patch) => onSalvar(conteudo.id_conteudo, patch),
    [conteudo.id_conteudo, onSalvar]
  )

  const salvamento = useSalvamentoAutomatico({ obterValor: montarPatch, salvar: gravar })
  const { avisarAlteracao, salvarAgora, pendente } = salvamento

  const setCampo = (campo) => (e) => {
    const { value } = e.target
    setForm((f) => ({ ...f, [campo]: value }))
    avisarAlteracao()
  }

  const alternarTag = (tag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }))
    avisarAlteracao()
  }

  const trocarLogo = (logo) => {
    setErroLogo(null)
    setForm((f) => ({ ...f, logo_url: logo }))
    avisarAlteracao()
  }

  const alterarDocumento = useCallback(
    (novo) => {
      documento.current = novo
      avisarAlteracao()
    },
    [avisarAlteracao]
  )

  /**
   * Fechar grava o que ainda nao foi. Sem isso, escrever e fechar em menos de
   * um segundo perderia a ultima alteracao — exatamente o que o salvamento
   * automatico existe para impedir.
   *
   * Se a gravacao falhar, a tela NAO fecha: sair ali jogaria fora o que a
   * pessoa acabou de escrever, e sem nem dizer que jogou.
   */
  const fechar = async () => {
    if (pendente && !(await salvarAgora())) return
    onFechar()
  }

  // O Drawer precisa desta funcao para tratar o Esc como o botao de fechar.
  // Sem chaves, o retorno de `registrarFechar` viraria a funcao de limpeza do
  // efeito — e o React chamaria `fechar` a cada render.
  useEffect(() => {
    registrarFechar(fechar)
  })

  // `usos` so chega na busca completa; guardar aqui evita piscar a secao.
  const usos = useMemo(() => conteudo.usos ?? [], [conteudo.usos])

  // Conteudo recem-criado nasce como "Sem título": ai sim vale levar o cursor
  // ao nome. Num conteudo que ja existe o foco ficava no titulo e roubava o
  // "/" de quem queria abrir o menu de blocos no corpo.
  const ehNovo = conteudo.titulo === TITULO_NOVO

  const temDuracao = form.tipo === "AULA" || form.tipo === "VIDEO"
  const temArquivo = form.tipo === "ARQUIVO" || form.tipo === "TEMPLATE"
  const temUrl = temArquivo || form.tipo === "VIDEO" || form.tipo === "LINK"

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Chrome: so o que precisa estar sempre a mao. */}
      <Box
        sx={{
          ...COLUNA,
          ...RECUO,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Typography
          noWrap
          sx={{ flex: 1, minWidth: 0, fontSize: 13, color: "text.secondary" }}
        >
          <Box component="span" sx={{ color: meta.cor, fontWeight: 700 }}>
            {meta.label}
          </Box>
          {"  ·  "}
          {form.titulo || `Nova ${meta.label.toLowerCase()}`}
        </Typography>

        <IndicadorSalvamento
          estado={salvamento.estado}
          erro={salvamento.erro}
          salvoEm={salvamento.salvoEm}
          onTentarNovamente={salvarAgora}
        />

        <Tooltip title="Fechar" arrow>
          <IconButton onClick={fechar} size="small">
            <Close />
          </IconButton>
        </Tooltip>
      </Box>

      {/* A pagina */}
      <Box sx={{ flex: 1, overflowY: "auto", pb: 8 }}>
        <Box sx={COLUNA}>
          {erroLogo && (
            <Box sx={{ ...RECUO, pt: 2 }}>
              <Alert severity="error" onClose={() => setErroLogo(null)} sx={{ borderRadius: 2 }}>
                {erroLogo}
              </Alert>
            </Box>
          )}

          {/* Logo + titulo + propriedades, todos no recuo do editor. */}
          <Box sx={{ ...RECUO, pt: 4 }}>
            <Box sx={{ mb: 1.5 }}>
              <SeletorLogo
                conteudo={form}
                idTenant={idTenant}
                onChange={trocarLogo}
                onErro={setErroLogo}
                tamanho={56}
              />
            </Box>

            <TextField
              variant="standard"
              fullWidth
              multiline
              autoFocus={ehNovo}
              value={form.titulo}
              onChange={setCampo("titulo")}
              placeholder="Sem título"
              // O titulo e uma linha so (VARCHAR(200) no banco): Enter nao
              // quebra linha, so tira o cursor do caminho.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              InputProps={{ disableUnderline: true }}
              inputProps={{ maxLength: 200 }}
              sx={{
                mb: 2.5,
                "& .MuiInputBase-input": {
                  p: 0,
                  fontSize: { xs: 28, sm: 34 },
                  fontWeight: 800,
                  lineHeight: 1.2,
                },
                "& .MuiInputBase-input::placeholder": { opacity: 0.35 },
              }}
            />

            <Stack spacing={0.25} sx={{ mb: 3 }}>
              <Propriedade rotulo="Resumo">
                <ValorTexto
                  multiline
                  valor={form.resumo}
                  onChange={setCampo("resumo")}
                  placeholder="Uma frase sobre o que o incubado aprende aqui"
                />
              </Propriedade>

              <Propriedade rotulo="Tags">
                <ValorTags tags={TAGS} escolhidas={form.tags} onAlternar={alternarTag} />
              </Propriedade>

              {temDuracao && (
                <Propriedade rotulo="Duração">
                  <ValorTexto
                    valor={form.duracao}
                    onChange={setCampo("duracao")}
                    placeholder="ex.: 8 min"
                  />
                </Propriedade>
              )}

              {temArquivo && (
                <Propriedade rotulo="Arquivo">
                  <ValorTexto
                    valor={form.nome_arquivo}
                    onChange={setCampo("nome_arquivo")}
                    placeholder="ex.: canvas-startup.pdf"
                  />
                </Propriedade>
              )}

              {temUrl && (
                <Propriedade rotulo={form.tipo === "LINK" ? "Endereço" : "Link"}>
                  <ValorTexto
                    valor={form.url}
                    onChange={setCampo("url")}
                    placeholder="https://…"
                  />
                </Propriedade>
              )}
            </Stack>
          </Box>

          {/* O corpo. */}
          {form.tipo === "AULA" &&
            (corpoCarregado ? (
              // So monta com o corpo em maos: o editor le `documento` uma vez,
              // na criacao (ele nao e controlado), e montar antes da resposta
              // da API abriria uma aula em branco por cima de uma aula cheia.
              <Suspense fallback={<EsqueletoEditor />}>
                <EditorDocumento
                  documento={conteudo.documento}
                  onChange={alterarDocumento}
                  idTenant={idTenant}
                />
              </Suspense>
            ) : (
              <EsqueletoEditor />
            ))}

          {/* Confere o link antes de salvar: e exatamente este player que a
              startup vera dentro do passo da trilha. Link errado ou video
              privado aparece aqui, e nao so quando o incubado abrir. */}
          {form.tipo === "VIDEO" && ehYoutube(form.url) && (
            <Box sx={RECUO}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 700, display: "block", mb: 0.75 }}
              >
                COMO A STARTUP VAI VER
              </Typography>
              <PlayerYoutube url={form.url} titulo={form.titulo} duracao={form.duracao} />
            </Box>
          )}

          {temArquivo && (
            <Box sx={RECUO}>
              {form.tipo === "TEMPLATE" && (
                <Alert
                  icon={<Inventory2 fontSize="inherit" />}
                  severity="info"
                  sx={{ borderRadius: 2, mb: 2 }}
                >
                  Templates viram o modelo do <b>entregável</b> que a startup preenche e devolve.
                </Alert>
              )}
              <Button
                variant="outlined"
                startIcon={<UploadFile />}
                sx={{ textTransform: "none" }}
                disabled
              >
                Enviar arquivo (em breve)
              </Button>
            </Box>
          )}

          {/* Onde e usado (reutilizacao) */}
          {usos.length > 0 && (
            <Box sx={{ ...RECUO, mt: 6 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ fontWeight: 700, display: "block", mb: 1 }}
              >
                USADO NA TRILHA
              </Typography>
              <Stack spacing={0.5}>
                {usos.map((u, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AccountTree sx={{ fontSize: 16, color: "primary.main" }} />
                    <Typography variant="body2" color="text.secondary">
                      {u.fase} <span style={{ opacity: 0.5 }}>›</span> {u.passo}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

/** Espaco reservado enquanto o editor de blocos chega. */
function EsqueletoEditor() {
  return (
    <Box sx={RECUO}>
      <Skeleton width="45%" height={34} />
      <Skeleton width="100%" />
      <Skeleton width="92%" />
      <Skeleton width="70%" />
    </Box>
  )
}
