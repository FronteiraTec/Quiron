/**
 * Aba "Minha biblioteca": os materiais de trabalho do mentor, organizados como
 * no gerenciador de arquivos do Windows (migracao 025).
 *
 * Privada por desenho: so o dono ve esta biblioteca (o backend recusa o
 * material e a pasta de outra pessoa com 404). O que a tela oferece e o que se
 * espera de um explorador:
 *
 *   PASTAS      criar, renomear (F2), mover (arrastando ou "Mover para…") e
 *               excluir — excluir uma pasta nunca apaga material: o que estava
 *               dentro sobe para a pasta de cima.
 *   VER         duplo clique abre o arquivo NA TELA, sem baixar: imagem, PDF,
 *               Word, planilha, CSV e texto (ver explorador/VisualizadorMaterial).
 *   EDITAR      texto e CSV se editam aqui mesmo; os outros formatos se trocam
 *               por uma versao nova, e o material continua o mesmo (pasta,
 *               titulo e compartilhamentos).
 *   ENVIAR      arrastar arquivos do computador para a pasta, ou "Novo".
 *
 * Compartilhar com uma startup continua sendo o gesto central da pagina: o
 * dialogo mora no EspacoMentor e e aberto daqui pelo `onCompartilhar`.
 *
 * Desvio consciente do padrao de listagem do sistema (components/tabela): esta
 * aba e um explorador, nao uma tabela — selecao multipla, arrastar e soltar e
 * renomear no lugar nao cabem no TabelaDados.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Box, Button, Drawer, Paper, Typography, useMediaQuery, useTheme } from "@mui/material"
import {
  ArchiveOutlined,
  CreateNewFolderOutlined,
  DeleteOutline,
  DriveFileMoveOutlined,
  DriveFileRenameOutline,
  Download,
  EditOutlined,
  FolderOpenOutlined,
  GridView,
  InfoOutlined,
  LinkOutlined,
  OpenInNew,
  Refresh,
  Share,
  Unarchive,
  UploadFile,
  UploadFileOutlined,
  ViewList,
  Visibility,
} from "@mui/icons-material"
import PainelFiltros, { contarFiltros } from "../tabela/PainelFiltros"
import ConfirmDialog from "../programa/ConfirmDialog"
import EmptyState from "../programa/EmptyState"
import DrawerMaterial from "./DrawerMaterial"
import { abrirMaterial } from "./abrirMaterial"
import BarraExplorador from "./explorador/BarraExplorador"
import PainelPastas from "./explorador/PainelPastas"
import AreaItens from "./explorador/AreaItens"
import MenuContexto from "./explorador/MenuContexto"
import DialogMoverPara from "./explorador/DialogMoverPara"
import DialogEditarArquivo from "./explorador/DialogEditarArquivo"
import PainelEnvios from "./explorador/PainelEnvios"
import VisualizadorMaterial from "./explorador/VisualizadorMaterial"
import { arquivoDoTexto } from "./explorador/previa/PreviaTexto"
import {
  bibliotecaPessoal,
  erroDe,
  moverItens,
  pastasPessoais,
  urlArquivoDoMaterial,
  useMinhaBiblioteca,
} from "../../hooks/useEspacoMentor"
import { ACEITOS, FORMATOS, LIMITE_ARQUIVO, LIMITE_ARQUIVO_MB } from "../../data/espacoMentorMeta"
import {
  ARQUIVADOS,
  caminhoDaPasta,
  chaveDe,
  contarConteudo,
  editavelNoNavegador,
  ehPasta,
  itensDaVisao,
  nomeDoItem,
  nomeLivre,
  ordenarItens,
  separarChaves,
  subpastas,
  temBuscaOuFiltro,
} from "../../data/exploradorMeta"
import { baixarArquivo, enviarArquivo, formatarTamanho } from "../../services/arquivos"

const FORMATOS_PESSOAIS = ["PDF", "DOCUMENTO", "PLANILHA", "APRESENTACAO", "IMAGEM", "LINK", "ARQUIVO"]
const CHAVE_PREFERENCIAS = "quiron.espaco-mentor.explorador"
const PREFERENCIAS_PADRAO = { visao: "grade", ordenacao: { campo: "nome", direcao: "asc" } }

/** A visao e a ordem sao do navegador da pessoa (localStorage pode faltar). */
function lerPreferencias() {
  try {
    const salvas = JSON.parse(localStorage.getItem(CHAVE_PREFERENCIAS) || "null")
    return { ...PREFERENCIAS_PADRAO, ...(salvas || {}) }
  } catch {
    return PREFERENCIAS_PADRAO
  }
}
function salvarPreferencias(prefs) {
  try {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(prefs))
  } catch {
    // Sem armazenamento (aba anonima, bloqueio): a preferencia vale so ate sair.
  }
}

/** O que um arquivo do computador tem de errado antes de subir, ou null. */
function problemaDoArquivo(f) {
  if (!f.type && f.size === 0) return "Pastas não são enviadas: envie os arquivos que estão dentro dela."
  if (f.size > LIMITE_ARQUIVO) return `Tem ${formatarTamanho(f.size)}; o limite é ${LIMITE_ARQUIVO_MB} MB.`
  if (f.type && !ACEITOS.split(",").includes(f.type)) {
    return "Tipo não aceito. Envie PDF, documento, planilha, apresentação, texto ou imagem."
  }
  return null
}

/** O titulo de um material que nasce de um arquivo: o nome, sem a extensao. */
const tituloDoArquivo = (nome) => (nome.replace(/\.[^.]+$/, "") || nome).slice(0, 200)

const quantos = (n, um, varios) => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

export default function AbaMinhaBiblioteca({ idTenant, versao, podeCompartilhar, onMudou, onCompartilhar, onAviso }) {
  const theme = useTheme()
  const compacto = useMediaQuery(theme.breakpoints.down("md"))
  const toque = useMediaQuery("(pointer: coarse)")
  const bib = useMinhaBiblioteca({ idTenant, versao })

  // A pasta aberta vive na URL (?pasta=): recarregar a pagina volta ao mesmo
  // lugar. Voltar/avancar sao do explorador, como no Windows.
  const [params, setParams] = useSearchParams()
  const pastaNaUrl = params.get("pasta")
  const atual = pastaNaUrl === ARQUIVADOS ? ARQUIVADOS : pastaNaUrl && Number(pastaNaUrl) > 0 ? Number(pastaNaUrl) : null
  const [historico, setHistorico] = useState({ voltar: [], avancar: [] })

  const [preferencias, setPreferencias] = useState(lerPreferencias)
  const [busca, setBusca] = useState("")
  const [filtros, setFiltros] = useState({})
  const [painelFiltros, setPainelFiltros] = useState(false)
  const [painelMovel, setPainelMovel] = useState(false)

  const [selecao, setSelecao] = useState(() => new Set())
  const [ancora, setAncora] = useState(null)
  const [renomeando, setRenomeando] = useState(null)
  const [nomesPendentes, setNomesPendentes] = useState({}) // chave -> nome, ate o servidor confirmar

  const [menu, setMenu] = useState(null) // { x, y, alvo }
  const [vendo, setVendo] = useState(null) // { id, editar }
  const [drawer, setDrawer] = useState(null) // { material, tipo }
  const [movendo, setMovendo] = useState(null) // itens
  const [aExcluir, setAExcluir] = useState(null) // itens
  const [editandoArquivo, setEditandoArquivo] = useState(null) // material
  const [envios, setEnvios] = useState([])

  const inputEnvio = useRef(null)
  const inputVersao = useRef(null)
  const destinoEnvio = useRef(null)
  const alvoVersao = useRef(null)

  const mudarPreferencias = (mudanca) =>
    setPreferencias((p) => {
      const nova = { ...p, ...mudanca }
      salvarPreferencias(nova)
      return nova
    })

  const recarregar = bib.recarregar
  const aviso = (texto, severidade = "success") => onAviso({ texto, severidade })
  const falha = (err, padrao) => onAviso({ texto: erroDe(err, padrao), severidade: "error" })

  // -------------------------------------------------------------------------
  // Navegacao
  // -------------------------------------------------------------------------

  const irPara = useCallback(
    (id) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          if (id === null) n.delete("pasta")
          else n.set("pasta", String(id))
          return n
        },
        { replace: true }
      )
      setSelecao(new Set())
      setAncora(null)
      setRenomeando(null)
      setBusca("")
    },
    [setParams]
  )

  const abrirPasta = (id) => {
    if (id === atual) return
    setHistorico((h) => ({ voltar: [...h.voltar, atual], avancar: [] }))
    irPara(id)
    setPainelMovel(false)
  }
  const voltar = () => {
    if (!historico.voltar.length) return
    const anterior = historico.voltar[historico.voltar.length - 1]
    setHistorico((h) => ({ voltar: h.voltar.slice(0, -1), avancar: [atual, ...h.avancar] }))
    irPara(anterior)
  }
  const avancar = () => {
    if (!historico.avancar.length) return
    const [proxima, ...resto] = historico.avancar
    setHistorico((h) => ({ voltar: [...h.voltar, atual], avancar: resto }))
    irPara(proxima)
  }
  const caminho = typeof atual === "number" ? caminhoDaPasta(bib.pastas, atual) : []
  const podeSubir = atual !== null
  const subir = () => {
    if (!podeSubir) return
    abrirPasta(atual === ARQUIVADOS ? null : caminho.length > 1 ? caminho[caminho.length - 2].id_pasta : null)
  }

  // A pasta da URL sumiu (excluida em outra aba, link velho): volta para a raiz.
  const pastaExiste = atual === null || atual === ARQUIVADOS || caminho.length > 0
  useEffect(() => {
    if (bib.carregado && !pastaExiste) irPara(null)
  }, [bib.carregado, pastaExiste, irPara])

  const nomeDaPasta = (id) =>
    id === null ? "Minha biblioteca" : id === ARQUIVADOS ? "Arquivados" : bib.pastas.find((p) => p.id_pasta === id)?.nome || "a pasta"
  const nomePastaAtual = nomeDaPasta(atual)
  const naRaizOuPasta = atual !== ARQUIVADOS
  const destinoAtual = naRaizOuPasta ? atual : null

  // -------------------------------------------------------------------------
  // O que a visao mostra
  // -------------------------------------------------------------------------

  const { itens, plana } = useMemo(() => {
    const visao = itensDaVisao({ pastas: bib.pastas, materiais: bib.materiais, pasta: atual, busca, filtros })
    const comNomes = visao.itens.map((i) => {
      const pendente = nomesPendentes[chaveDe(i)]
      if (!pendente) return i
      return ehPasta(i) ? { ...i, nome: pendente } : { ...i, titulo: pendente }
    })
    return { itens: ordenarItens(comNomes, preferencias.ordenacao), plana: visao.plana }
  }, [bib.pastas, bib.materiais, atual, busca, filtros, nomesPendentes, preferencias.ordenacao])

  const selecionados = itens.filter((i) => selecao.has(chaveDe(i)))
  const unico = selecionados.length === 1 ? selecionados[0] : null
  const materiaisDaVisao = itens.filter((i) => !ehPasta(i))
  const totalArquivados = bib.materiais.filter((m) => m.arquivado).length

  const selecionar = (nova, novaAncora) => {
    setSelecao(nova)
    setAncora(novaAncora)
  }

  // -------------------------------------------------------------------------
  // Abrir
  // -------------------------------------------------------------------------

  const abrir = (item) => {
    if (ehPasta(item)) abrirPasta(item.id_pasta)
    else setVendo({ id: item.id_material, editar: false })
  }

  const baixar = async (m) => {
    try {
      await baixarArquivo(urlArquivoDoMaterial(m), m.arquivo_nome)
    } catch (err) {
      falha(err, "Não foi possível baixar o arquivo.")
    }
  }

  const abrirLink = async (m) => {
    try {
      await abrirMaterial({ ...m, arquivo_url: null })
    } catch (err) {
      falha(err, "Não foi possível abrir o link.")
    }
  }

  /** "Editar": o texto se edita na tela; o resto, pelo caminho da versao nova. */
  const editar = (m) => {
    if (m.tipo === "LINK") setDrawer({ material: m })
    else if (editavelNoNavegador(m)) setVendo({ id: m.id_material, editar: true })
    else setEditandoArquivo(m)
  }

  // -------------------------------------------------------------------------
  // Criar
  // -------------------------------------------------------------------------

  /** Como no Windows: a pasta nasce com um nome livre, ja em edicao. */
  const novaPasta = async () => {
    if (!naRaizOuPasta) return
    setBusca("")
    setFiltros({})
    const nome = nomeLivre("Nova pasta", subpastas(bib.pastas, destinoAtual).map((p) => p.nome))
    try {
      const pasta = await pastasPessoais.criar(idTenant, { nome, idPastaPai: destinoAtual })
      await recarregar()
      const chave = `p:${pasta.id_pasta}`
      selecionar(new Set([chave]), chave)
      setRenomeando(chave)
    } catch (err) {
      falha(err, "Não foi possível criar a pasta.")
    }
  }

  const escolherArquivos = (destino = destinoAtual) => {
    destinoEnvio.current = destino
    inputEnvio.current?.click()
  }

  const atualizarEnvio = (id, mudanca) => setEnvios((lista) => lista.map((e) => (e.id === id ? { ...e, ...mudanca } : e)))

  /** Envia arquivos do computador para a pasta, um por vez, cada um virando um material. */
  const enviar = async (arquivos, destino) => {
    if (!arquivos.length) return
    if (destino === ARQUIVADOS) destino = null
    const lote = arquivos.map((arquivo, i) => ({ id: `${Date.now()}-${i}-${arquivo.name}`, nome: arquivo.name, arquivo, estado: "fila" }))
    // Os que terminaram saem do painel; os que ainda sobem, ficam.
    setEnvios((lista) => [...lista.filter((e) => e.estado === "fila" || e.estado === "enviando"), ...lote])

    let enviados = 0
    for (const e of lote) {
      const problema = problemaDoArquivo(e.arquivo)
      if (problema) {
        atualizarEnvio(e.id, { estado: "erro", erro: problema })
        continue
      }
      atualizarEnvio(e.id, { estado: "enviando" })
      try {
        const enviado = await enviarArquivo(e.arquivo, { idTenant, visibilidade: "PRIVADO" })
        await bibliotecaPessoal.criar(idTenant, {
          tipo: "ARQUIVO",
          titulo: tituloDoArquivo(e.nome),
          id_arquivo: enviado.id_arquivo,
          id_pasta: destino,
        })
        atualizarEnvio(e.id, { estado: "ok" })
        enviados += 1
      } catch (err) {
        atualizarEnvio(e.id, { estado: "erro", erro: erroDe(err, "Falha no envio.") })
      }
    }
    if (enviados) {
      await recarregar()
      onMudou()
    }
  }

  // -------------------------------------------------------------------------
  // Versao nova e edicao de texto
  // -------------------------------------------------------------------------

  const pedirNovaVersao = (m) => {
    alvoVersao.current = m
    setEditandoArquivo(null)
    inputVersao.current?.click()
  }

  const enviarNovaVersao = async (arquivo) => {
    const m = alvoVersao.current
    alvoVersao.current = null
    if (!m || !arquivo) return
    const problema = problemaDoArquivo(arquivo)
    if (problema) {
      aviso(`"${arquivo.name}": ${problema}`, "error")
      return
    }
    const id = `${Date.now()}-versao`
    setEnvios((lista) => [
      ...lista.filter((e) => e.estado === "fila" || e.estado === "enviando"),
      { id, nome: `${arquivo.name} (versão nova de "${m.titulo}")`, estado: "enviando" },
    ])
    try {
      const enviado = await enviarArquivo(arquivo, { idTenant: m.id_tenant ?? idTenant, visibilidade: "PRIVADO" })
      await bibliotecaPessoal.atualizar(m.id_material, { id_arquivo: enviado.id_arquivo })
      atualizarEnvio(id, { estado: "ok" })
      await recarregar()
      onMudou()
      aviso(
        m.total_compartilhamentos > 0
          ? `Versão nova de "${m.titulo}" enviada. As startups que o receberam já veem a nova.`
          : `Versão nova de "${m.titulo}" enviada.`
      )
    } catch (err) {
      atualizarEnvio(id, { estado: "erro", erro: erroDe(err, "Falha no envio.") })
    }
  }

  /** O texto editado no visualizador vira a versao nova do arquivo. */
  const salvarTexto = async (m, texto, { bom }) => {
    const arquivo = arquivoDoTexto(texto, { nome: m.arquivo_nome, mime: m.arquivo_mime, bom })
    if (arquivo.size > LIMITE_ARQUIVO) throw new Error(`O texto passou de ${LIMITE_ARQUIVO_MB} MB.`)
    let enviado
    try {
      enviado = await enviarArquivo(arquivo, { idTenant: m.id_tenant ?? idTenant, visibilidade: "PRIVADO" })
      await bibliotecaPessoal.atualizar(m.id_material, { id_arquivo: enviado.id_arquivo })
    } catch (err) {
      throw new Error(erroDe(err, "Não foi possível salvar o arquivo."))
    }
    await recarregar()
    onMudou()
    aviso(`"${m.titulo}" foi salvo.`)
  }

  // -------------------------------------------------------------------------
  // Renomear, mover, arquivar
  // -------------------------------------------------------------------------

  const renomear = async (item, nome) => {
    const chave = chaveDe(item)
    setRenomeando(null)
    setNomesPendentes((n) => ({ ...n, [chave]: nome }))
    try {
      if (ehPasta(item)) await pastasPessoais.renomear(item.id_pasta, nome)
      else await bibliotecaPessoal.atualizar(item.id_material, { titulo: nome })
      await recarregar()
    } catch (err) {
      falha(err, "Não foi possível renomear.")
    } finally {
      setNomesPendentes(({ [chave]: _, ...resto }) => resto)
    }
  }

  const mover = async (lista, destino) => {
    setMovendo(null)
    if (!lista.length) return
    const { pastas, materiais } = separarChaves(lista.map(chaveDe))
    try {
      await moverItens(idTenant, { destino, pastas, materiais })
      await recarregar()
      setSelecao(new Set())
      aviso(
        `${lista.length === 1 ? `"${nomeDoItem(lista[0])}" foi` : `${lista.length} itens foram`} para ${
          destino === null ? "Minha biblioteca" : `"${nomeDaPasta(destino)}"`
        }.`
      )
    } catch (err) {
      falha(err, "Não foi possível mover.")
    }
  }

  const alternarArquivado = async (lista, arquivar) => {
    const materiais = lista.filter((i) => !ehPasta(i) && Boolean(i.arquivado) !== arquivar)
    try {
      for (const m of materiais) await bibliotecaPessoal.atualizar(m.id_material, { arquivado: arquivar })
      await recarregar()
      onMudou()
      setSelecao(new Set())
      const rotulo = materiais.length === 1 ? `"${materiais[0].titulo}" foi` : `${materiais.length} materiais foram`
      aviso(arquivar ? `${rotulo} para Arquivados.` : `${rotulo} de volta para a biblioteca.`, arquivar ? "info" : "success")
    } catch (err) {
      falha(err, "Não foi possível alterar o material.")
    }
  }

  // -------------------------------------------------------------------------
  // Excluir
  // -------------------------------------------------------------------------

  /**
   * O que acontece com cada item. Material compartilhado nao se exclui (o
   * servidor recusa com 409): a startup perderia o que recebeu — ele e
   * ARQUIVADO no lugar. O ja arquivado e compartilhado fica como esta.
   */
  const planoDeExclusao = (lista = []) => {
    const materiais = lista.filter((i) => !ehPasta(i))
    const compartilhados = materiais.filter((m) => m.total_compartilhamentos > 0)
    return {
      pastas: lista.filter(ehPasta),
      apagar: materiais.filter((m) => !(m.total_compartilhamentos > 0)),
      arquivar: compartilhados.filter((m) => !m.arquivado),
      travados: compartilhados.filter((m) => m.arquivado),
    }
  }
  const plano = planoDeExclusao(aExcluir ?? [])

  const excluirConfirmado = async () => {
    const lista = aExcluir
    setAExcluir(null)
    const { pastas, apagar, arquivar } = planoDeExclusao(lista)
    try {
      for (const m of arquivar) await bibliotecaPessoal.atualizar(m.id_material, { arquivado: true })
      for (const m of apagar) await bibliotecaPessoal.excluir(m.id_material)
      // As mais fundas primeiro: o conteudo de cada uma sobe uma vez so.
      const profundidade = (p) => caminhoDaPasta(bib.pastas, p.id_pasta).length
      for (const p of [...pastas].sort((a, b) => profundidade(b) - profundidade(a))) {
        await pastasPessoais.excluir(p.id_pasta)
      }
      await recarregar()
      onMudou()
      setSelecao(new Set())
      const excluidos = apagar.length + pastas.length
      if (lista.length === 1 && arquivar.length === 1) {
        aviso(`"${arquivar[0].titulo}" foi arquivado. As startups continuam com ele.`, "info")
      } else if (lista.length === 1 && pastas.length === 1) {
        aviso(`A pasta "${pastas[0].nome}" foi excluída.`, "info")
      } else if (lista.length === 1) {
        aviso(`"${nomeDoItem(lista[0])}" foi excluído.`, "info")
      } else {
        aviso(
          [
            excluidos ? quantos(excluidos, "item excluído", "itens excluídos") : null,
            arquivar.length ? quantos(arquivar.length, "arquivado", "arquivados") : null,
          ]
            .filter(Boolean)
            .join(", ") + ".",
          "info"
        )
      }
    } catch (err) {
      await recarregar()
      falha(err, "Não foi possível excluir.")
    }
  }

  const textoExclusao = () => {
    if (!aExcluir?.length) return { titulo: "", mensagem: "", confirmar: "Excluir" }
    const { pastas, apagar, arquivar, travados } = plano

    if (aExcluir.length === 1) {
      const item = aExcluir[0]
      if (pastas.length) {
        const conteudo = contarConteudo(bib.pastas, bib.materiais, item.id_pasta)
        const total = conteudo.pastas + conteudo.materiais
        const pai = item.id_pasta_pai ? `"${nomeDaPasta(item.id_pasta_pai)}"` : "Minha biblioteca"
        const vai =
          total === 1
            ? `O item que está dentro dela vai para ${pai}`
            : `Os ${total} itens que estão dentro dela vão para ${pai}`
        return {
          titulo: "Excluir pasta",
          mensagem: total
            ? `Excluir a pasta "${item.nome}"? ${vai}. Nenhum material é apagado.`
            : `Excluir a pasta vazia "${item.nome}"?`,
          confirmar: "Excluir pasta",
        }
      }
      if (arquivar.length) {
        return {
          titulo: "Material compartilhado",
          mensagem: `"${item.titulo}" está com ${quantos(item.startups_compartilhadas?.length || 1, "startup", "startups")} e não pode ser excluído enquanto elas o tiverem. Para excluir, remova os compartilhamentos em “Materiais compartilhados”. Ou arquive: ele sai da sua biblioteca de trabalho e as startups continuam com ele.`,
          confirmar: "Arquivar",
        }
      }
      if (travados.length) {
        return {
          titulo: "Material compartilhado",
          mensagem: `"${item.titulo}" está com ${quantos(item.startups_compartilhadas?.length || 1, "startup", "startups")} e não pode ser excluído enquanto elas o tiverem. Remova os compartilhamentos em “Materiais compartilhados” e depois exclua.`,
          confirmar: "Entendi",
        }
      }
      return {
        titulo: "Confirmar exclusão",
        mensagem:
          item.tipo === "ARQUIVO"
            ? `Excluir "${item.titulo}"? O arquivo também é apagado. Esta ação não pode ser desfeita.`
            : `Excluir "${item.titulo}"? Esta ação não pode ser desfeita.`,
        confirmar: "Excluir",
      }
    }

    const linhas = [
      apagar.length && `${quantos(apagar.length, "material é apagado", "materiais são apagados")}, com os arquivos.`,
      pastas.length &&
        `${quantos(pastas.length, "pasta é excluída", "pastas são excluídas")}; o que estiver dentro vai para a pasta de cima.`,
      arquivar.length &&
        `${quantos(arquivar.length, "material está", "materiais estão")} com startups: ${arquivar.length === 1 ? "ele é arquivado" : "eles são arquivados"}, não excluído${arquivar.length === 1 ? "" : "s"}.`,
      travados.length &&
        `${quantos(travados.length, "arquivado compartilhado fica", "arquivados compartilhados ficam")} como está.`,
      (apagar.length || pastas.length) && "Esta ação não pode ser desfeita.",
    ].filter(Boolean)
    return {
      titulo: `Excluir ${aExcluir.length} itens`,
      mensagem: linhas.map((l) => (
        <Box component="span" key={l} sx={{ display: "block", mb: 0.5 }}>
          {l}
        </Box>
      )),
      confirmar: apagar.length || pastas.length ? "Excluir" : arquivar.length ? "Arquivar" : "Entendi",
    }
  }
  const exclusao = textoExclusao()
  const soInforma = aExcluir && !plano.apagar.length && !plano.pastas.length && !plano.arquivar.length

  // -------------------------------------------------------------------------
  // Menus e atalhos
  // -------------------------------------------------------------------------

  const acoesDoItem = (lista) => {
    if (!lista.length) return []
    const materiais = lista.filter((i) => !ehPasta(i))
    const soMateriais = materiais.length === lista.length
    const excluir = { rotulo: "Excluir", icone: <DeleteOutline fontSize="small" />, atalho: "Del", onClick: () => setAExcluir(lista), perigo: true }
    const moverPara = { rotulo: "Mover para…", icone: <DriveFileMoveOutlined fontSize="small" />, onClick: () => setMovendo(lista) }

    if (lista.length > 1) {
      return [
        moverPara,
        soMateriais && materiais.some((m) => !m.arquivado) && {
          rotulo: "Arquivar",
          icone: <ArchiveOutlined fontSize="small" />,
          onClick: () => alternarArquivado(lista, true),
        },
        soMateriais && materiais.some((m) => m.arquivado) && {
          rotulo: "Reativar",
          icone: <Unarchive fontSize="small" />,
          onClick: () => alternarArquivado(lista, false),
        },
        "-",
        excluir,
      ]
    }

    const item = lista[0]
    const renomearAcao = {
      rotulo: "Renomear",
      icone: <DriveFileRenameOutline fontSize="small" />,
      atalho: "F2",
      onClick: () => setRenomeando(chaveDe(item)),
    }
    if (ehPasta(item)) {
      return [
        { rotulo: "Abrir", icone: <FolderOpenOutlined fontSize="small" />, atalho: "Enter", onClick: () => abrir(item) },
        "-",
        renomearAcao,
        moverPara,
        "-",
        excluir,
      ]
    }
    const arquivo = item.tipo === "ARQUIVO"
    return [
      { rotulo: "Abrir", icone: <Visibility fontSize="small" />, atalho: "Enter", onClick: () => abrir(item) },
      arquivo && { rotulo: "Baixar", icone: <Download fontSize="small" />, onClick: () => baixar(item) },
      !arquivo && { rotulo: "Abrir link em nova aba", icone: <OpenInNew fontSize="small" />, onClick: () => abrirLink(item) },
      { rotulo: "Editar", icone: <EditOutlined fontSize="small" />, onClick: () => editar(item) },
      arquivo && { rotulo: "Enviar nova versão…", icone: <UploadFile fontSize="small" />, onClick: () => pedirNovaVersao(item) },
      "-",
      podeCompartilhar && !item.arquivado && {
        rotulo: "Compartilhar com uma startup",
        icone: <Share fontSize="small" />,
        onClick: () => onCompartilhar(item),
      },
      "-",
      renomearAcao,
      moverPara,
      item.arquivado
        ? { rotulo: "Reativar", icone: <Unarchive fontSize="small" />, onClick: () => alternarArquivado([item], false) }
        : { rotulo: "Arquivar", icone: <ArchiveOutlined fontSize="small" />, onClick: () => alternarArquivado([item], true) },
      { rotulo: "Propriedades", icone: <InfoOutlined fontSize="small" />, atalho: "Alt+Enter", onClick: () => setDrawer({ material: item }) },
      "-",
      excluir,
    ]
  }

  const acoesDoFundo = () => [
    naRaizOuPasta && { rotulo: "Nova pasta", icone: <CreateNewFolderOutlined fontSize="small" />, atalho: "Ctrl+Shift+N", onClick: novaPasta },
    naRaizOuPasta && { rotulo: "Enviar arquivos…", icone: <UploadFileOutlined fontSize="small" />, onClick: () => escolherArquivos() },
    naRaizOuPasta && { rotulo: "Novo link…", icone: <LinkOutlined fontSize="small" />, onClick: () => setDrawer({ material: null, tipo: "LINK" }) },
    "-",
    preferencias.visao === "grade"
      ? { rotulo: "Exibir como detalhes", icone: <ViewList fontSize="small" />, onClick: () => mudarPreferencias({ visao: "detalhes" }) }
      : { rotulo: "Exibir como ícones", icone: <GridView fontSize="small" />, onClick: () => mudarPreferencias({ visao: "grade" }) },
    { rotulo: "Atualizar", icone: <Refresh fontSize="small" />, onClick: recarregar },
  ]

  const abrirMenu = (e, alvo) => {
    setMenu({ x: e.clientX, y: e.clientY, alvo })
  }

  /** O menu do item da arvore: a pasta ganha a selecao, como na area. */
  const menuDaArvore = (e, pasta) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, alvo: pasta, lista: [pasta] })
  }

  const listaDoMenu = menu?.lista ?? (menu?.alvo ? (selecionados.length ? selecionados : [menu.alvo]) : [])
  const acoesDoMenu = menu ? (menu.alvo ? acoesDoItem(listaDoMenu) : acoesDoFundo()) : []

  const tecla = (acao, elemento) => {
    if (acao === "subir") subir()
    if (!selecionados.length) return
    if (acao === "abrir") abrir(selecionados[0])
    if (acao === "renomear" && unico) setRenomeando(chaveDe(unico))
    if (acao === "excluir") setAExcluir(selecionados)
    if (acao === "menu") {
      const r = elemento?.getBoundingClientRect?.()
      setMenu({ x: r ? r.left + r.width / 2 : 200, y: r ? r.top + r.height / 2 : 200, alvo: selecionados[0] })
    }
  }

  const atalhosGlobais = (e) => {
    if (e.defaultPrevented || e.target.closest?.("input, textarea, [role=dialog]")) return
    const ctrl = e.ctrlKey || e.metaKey
    if (e.altKey && e.key === "ArrowLeft") voltar()
    else if (e.altKey && e.key === "ArrowRight") avancar()
    else if (e.altKey && e.key === "ArrowUp") subir()
    else if (e.altKey && e.key === "Enter" && unico && !ehPasta(unico)) setDrawer({ material: unico })
    else if (ctrl && e.shiftKey && (e.key === "N" || e.key === "n")) novaPasta()
    else return
    e.preventDefault()
  }

  // As acoes da barra de comandos: o que vale para a selecao atual.
  const acoesSelecao = [
    { rotulo: "Abrir", icone: <Visibility fontSize="small" />, atalho: "Enter", desabilitada: !unico, onClick: () => unico && abrir(unico) },
    { rotulo: "Renomear", icone: <DriveFileRenameOutline fontSize="small" />, atalho: "F2", desabilitada: !unico, onClick: () => unico && setRenomeando(chaveDe(unico)) },
    { rotulo: "Mover para…", icone: <DriveFileMoveOutlined fontSize="small" />, desabilitada: !selecionados.length, onClick: () => setMovendo(selecionados) },
    podeCompartilhar && {
      rotulo: "Compartilhar com uma startup",
      icone: <Share fontSize="small" />,
      desabilitada: !unico || ehPasta(unico) || unico.arquivado,
      onClick: () => unico && onCompartilhar(unico),
    },
    { rotulo: "Excluir", icone: <DeleteOutline fontSize="small" />, atalho: "Del", desabilitada: !selecionados.length, perigo: true, onClick: () => setAExcluir(selecionados) },
  ]

  // -------------------------------------------------------------------------
  // Filtros
  // -------------------------------------------------------------------------

  const gruposFiltro = useMemo(
    () => [
      { id: "categoria", rotulo: "Categoria", tipo: "checkbox", itens: bib.categorias.map((c) => ({ id: c, rotulo: c })) },
      {
        id: "formato",
        rotulo: "Tipo de arquivo",
        tipo: "checkbox",
        itens: FORMATOS_PESSOAIS.map((f) => ({ id: f, rotulo: FORMATOS[f].rotulo })),
      },
      {
        id: "compartilhado",
        rotulo: "Compartilhamento",
        tipo: "radio",
        itens: [
          { id: "SIM", rotulo: "Já compartilhados" },
          { id: "NAO", rotulo: "Ainda não compartilhados" },
        ],
      },
    ],
    [bib.categorias]
  )

  // -------------------------------------------------------------------------
  // Desenho
  // -------------------------------------------------------------------------

  const bibliotecaVazia = bib.carregado && !bib.materiais.length && !bib.pastas.length
  const filtrando = temBuscaOuFiltro(busca, filtros)

  const vazio = bibliotecaVazia && atual === null ? (
    <EmptyState
      variante="programa"
      titulo="Sua biblioteca está vazia"
      descricao="Guarde aqui os modelos, planilhas e links que você usa nas mentorias, arraste os arquivos do seu computador para cá, ou use Novo. Organize em pastas e compartilhe cada um com a startup certa, no ponto certo da trilha."
      acaoTexto="Enviar arquivos"
      onAcao={() => escolherArquivos()}
    />
  ) : (
    <Box sx={{ textAlign: "center", py: 8, px: 3, color: "text.secondary" }}>
      <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
        {filtrando
          ? `Nada encontrado em ${nomePastaAtual}`
          : atual === ARQUIVADOS
            ? "Nenhum material arquivado"
            : "Esta pasta está vazia"}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        {filtrando
          ? "A pesquisa olha esta pasta e todas as que estão dentro dela."
          : atual === ARQUIVADOS
            ? "Arquivar tira o material da biblioteca de trabalho sem tirá-lo das startups que o receberam."
            : "Arraste arquivos do seu computador para cá, ou use Novo."}
      </Typography>
      {filtrando && (
        <Button
          size="small"
          onClick={() => {
            setBusca("")
            setFiltros({})
          }}
          sx={{ mt: 1.5, textTransform: "none" }}
        >
          Limpar pesquisa e filtros
        </Button>
      )}
    </Box>
  )

  const painel = (
    <PainelPastas
      pastas={bib.pastas}
      atual={atual}
      totalArquivados={totalArquivados}
      onAbrir={abrirPasta}
      onSoltarItens={(lista, destino) => mover(lista, destino)}
      onSoltarArquivos={enviar}
      onMenu={menuDaArvore}
    />
  )

  const tamanhoSelecao = selecionados.reduce((t, i) => t + (Number(i.arquivo_tamanho) || 0), 0)
  const vendoMaterial = vendo ? bib.materiais.find((m) => m.id_material === vendo.id) ?? null : null

  return (
    <Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Seus materiais de trabalho, em pastas, como no seu computador. Só você vê esta biblioteca, o que
        entra aqui só chega a uma startup quando você o compartilha.
      </Typography>

      {bib.erro && !bib.carregado ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography color="error">{bib.erro}</Typography>
          <Button size="small" onClick={recarregar} sx={{ mt: 1, textTransform: "none" }}>
            Tentar de novo
          </Button>
        </Paper>
      ) : (
        <Paper
          variant="outlined"
          onKeyDown={atalhosGlobais}
          sx={{
            borderRadius: 0,
            display: "flex",
            flexDirection: "column",
            height: { xs: "auto", md: "max(520px, calc(100vh - 330px))" },
          }}
        >
          <BarraExplorador
            podeVoltar={historico.voltar.length > 0}
            podeAvancar={historico.avancar.length > 0}
            podeSubir={podeSubir}
            onVoltar={voltar}
            onAvancar={avancar}
            onSubir={subir}
            caminho={caminho}
            arquivados={atual === ARQUIVADOS}
            pastas={bib.pastas}
            onAbrirPasta={abrirPasta}
            onSoltarItens={(lista, destino) => mover(lista, destino)}
            onSoltarArquivos={enviar}
            busca={busca}
            onBusca={setBusca}
            nomePastaAtual={nomePastaAtual}
            podeCriar={naRaizOuPasta}
            onNovaPasta={novaPasta}
            onEnviarArquivos={() => escolherArquivos()}
            onNovoLink={() => setDrawer({ material: null, tipo: "LINK" })}
            onNovoMaterial={() => setDrawer({ material: null, tipo: "ARQUIVO" })}
            acoesSelecao={acoesSelecao}
            ordenacao={preferencias.ordenacao}
            onOrdenacao={(ordenacao) => mudarPreferencias({ ordenacao })}
            visao={preferencias.visao}
            onVisao={(visao) => mudarPreferencias({ visao })}
            totalFiltros={contarFiltros(filtros)}
            onFiltros={() => setPainelFiltros(true)}
            compacto={compacto}
            onAbrirPainel={compacto ? () => setPainelMovel(true) : undefined}
          />

          <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
            {!compacto && (
              <Box sx={{ width: 248, flexShrink: 0, borderRight: 1, borderColor: "divider" }}>{painel}</Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <AreaItens
                itens={itens}
                visao={preferencias.visao}
                plana={plana}
                pastas={bib.pastas}
                idPastaAtual={destinoAtual}
                nomePastaAtual={nomePastaAtual}
                aceitaSoltar={naRaizOuPasta && !plana}
                selecao={selecao}
                ancora={ancora}
                renomeando={renomeando}
                ordenacao={preferencias.ordenacao}
                carregando={bib.carregando}
                toque={toque}
                compacto={compacto}
                vazio={vazio}
                onSelecao={selecionar}
                onAbrir={abrir}
                onMenu={abrirMenu}
                onTecla={tecla}
                onRenomear={renomear}
                onCancelarRenomear={() => setRenomeando(null)}
                onOrdenar={(campo) =>
                  mudarPreferencias({
                    ordenacao: {
                      campo,
                      direcao:
                        preferencias.ordenacao.campo === campo && preferencias.ordenacao.direcao === "asc" ? "desc" : "asc",
                    },
                  })
                }
                onSoltarItens={(lista, destino) => mover(lista, destino)}
                onSoltarArquivos={enviar}
              />
            </Box>
          </Box>

          {/* Barra de status, como a do Windows. */}
          <Box
            sx={{
              display: "flex",
              gap: 2,
              px: 2,
              py: 0.75,
              borderTop: 1,
              borderColor: "divider",
              color: "text.secondary",
              fontSize: 12,
            }}
          >
            <span>{quantos(itens.length, "item", "itens")}</span>
            {selecionados.length > 0 && (
              <span>
                {quantos(selecionados.length, "selecionado", "selecionados")}
                {tamanhoSelecao ? ` · ${formatarTamanho(tamanhoSelecao)}` : ""}
              </span>
            )}
            {plana && atual !== ARQUIVADOS && <span>Resultado em {nomePastaAtual} e nas pastas de dentro</span>}
          </Box>
        </Paper>
      )}

      <Drawer anchor="left" open={painelMovel} onClose={() => setPainelMovel(false)} PaperProps={{ sx: { width: 280 } }}>
        {painel}
      </Drawer>

      <input
        ref={inputEnvio}
        type="file"
        multiple
        hidden
        accept={ACEITOS}
        onChange={(e) => {
          const arquivos = Array.from(e.target.files || [])
          e.target.value = ""
          enviar(arquivos, destinoEnvio.current)
        }}
      />
      <input
        ref={inputVersao}
        type="file"
        hidden
        accept={ACEITOS}
        onChange={(e) => {
          const arquivo = e.target.files?.[0]
          e.target.value = ""
          enviarNovaVersao(arquivo)
        }}
      />

      <MenuContexto posicao={menu} acoes={acoesDoMenu} onFechar={() => setMenu(null)} />

      <VisualizadorMaterial
        aberto={Boolean(vendoMaterial)}
        material={vendoMaterial}
        lista={materiaisDaVisao}
        editarAoAbrir={Boolean(vendo?.editar)}
        podeCompartilhar={podeCompartilhar}
        onTrocar={(m) => setVendo({ id: m.id_material, editar: false })}
        onFechar={() => setVendo(null)}
        onBaixar={baixar}
        onAbrirLink={abrirLink}
        onCompartilhar={(m) => {
          setVendo(null)
          onCompartilhar(m)
        }}
        onPropriedades={(m) => setDrawer({ material: m })}
        onNovaVersao={pedirNovaVersao}
        onSalvarTexto={salvarTexto}
      />

      <DialogMoverPara
        aberto={Boolean(movendo)}
        itens={movendo ?? []}
        pastas={bib.pastas}
        onFechar={() => setMovendo(null)}
        onMover={(destino) => mover(movendo, destino)}
      />

      <DialogEditarArquivo
        material={editandoArquivo}
        onFechar={() => setEditandoArquivo(null)}
        onBaixar={baixar}
        onNovaVersao={pedirNovaVersao}
      />

      <PainelEnvios envios={envios} onFechar={() => setEnvios([])} />

      <PainelFiltros
        aberto={painelFiltros}
        onFechar={() => setPainelFiltros(false)}
        titulo="Filtrar materiais"
        grupos={gruposFiltro}
        selecionados={filtros}
        onAplicar={setFiltros}
        onLimpar={() => setFiltros({})}
      />

      <DrawerMaterial
        aberto={Boolean(drawer)}
        material={drawer?.material ?? null}
        tipoInicial={drawer?.tipo ?? "ARQUIVO"}
        idPasta={destinoAtual}
        idTenant={idTenant}
        categorias={bib.categorias}
        podeCompartilhar={podeCompartilhar}
        onFechar={() => setDrawer(null)}
        onSalvo={(material, { novo, arquivado } = {}) => {
          setDrawer(null)
          onMudou()
          if (novo) aviso(`"${material.titulo}" foi adicionado a ${nomePastaAtual}.`)
          else if (arquivado === true) aviso(`"${material.titulo}" foi para Arquivados.`, "info")
          else if (arquivado === false) aviso(`"${material.titulo}" voltou para a biblioteca.`)
          else aviso("Material atualizado.")
        }}
        onCompartilhar={(m) => {
          setDrawer(null)
          onCompartilhar(m)
        }}
      />

      <ConfirmDialog
        aberto={Boolean(aExcluir)}
        titulo={exclusao.titulo}
        mensagem={exclusao.mensagem}
        confirmarTexto={exclusao.confirmar}
        onConfirmar={soInforma ? () => setAExcluir(null) : excluirConfirmado}
        onCancelar={() => setAExcluir(null)}
      />
    </Box>
  )
}
