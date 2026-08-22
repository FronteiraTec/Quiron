/**
 * Hook da tela de Mentores.
 *
 * "Mentor" nao e uma tabela: e o papel 'mentor' em tenant_usuarios. O que o
 * backend devolve por mentor sao tres coisas de origens diferentes, e vale
 * saber qual e qual ao ler a listagem:
 *
 *   O CADASTRO (mentor_perfil, migracao 016) — vinculo institucional, area,
 *   especialidades, demandas, disponibilidade, formato, status, observacoes.
 *   E o que a coordenacao digita. Opcional: quem nunca foi editado vem com os
 *   padroes (ATIVO / HIBRIDO).
 *
 *   A CARGA — quantas startups acompanha e quantas entregas esperam resposta
 *   dele. E o que decide para quem vai a proxima startup.
 *
 *   O HISTORICO — ultima mentoria e quantas no periodo, contadas da AGENDA
 *   (atividades de categoria Mentoria que ja aconteceram e apontam para ele).
 *   Nao e digitado por ninguem nesta tela: quem preenche isso e quem marca as
 *   atividades no calendario.
 *
 * O PERIODO E DA TELA: `dias` vai na requisicao porque a janela ("mentorias nos
 * ultimos 90 dias") muda com o programa de cada incubadora, e o backend devolve
 * a janela que de fato usou — e ela que rotula a coluna.
 *
 * Vincular, desvincular e salvar recarregam a lista porque as tres mudam o que
 * a listagem mostra: mover uma startup de um mentor para outro tem que aparecer
 * nos dois na hora, senao a distribuicao e feita olhando um numero velho.
 *
 * Endpoints:
 *   GET    /mentores?id_tenant=&dias=                  -> cadastro + carga + historico
 *   POST   /mentores                                   -> cria a pessoa (papel mentor) + cadastro
 *   PUT    /mentores/:idUsuario/perfil                 -> grava o cadastro
 *   PATCH  /mentores/:idUsuario/situacao               -> so o status (acao em massa)
 *   GET    /mentores/:idUsuario/startups?id_tenant=    -> acompanha + disponiveis
 *   POST   /mentores/:idUsuario/startups               -> vincula
 *   DELETE /mentores/:idUsuario/startups/:idStartup    -> desvincula
 */
import { useCallback, useEffect, useState } from "react"
import api from "../services/api"

/** Um trimestre: o horizonte em que "esse mentor sumiu" ainda e acionavel. */
export const DIAS_PADRAO = 90

export function useMentores(idTenant, dias = DIAS_PADRAO) {
  const [mentores, setMentores] = useState([])
  // A janela que o backend confirmou. Comeca igual a pedida para o rotulo da
  // coluna nao piscar entre dois valores no primeiro carregamento.
  const [diasAplicados, setDiasAplicados] = useState(dias)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!idTenant) {
      setMentores([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const { data } = await api.get("/mentores", { params: { id_tenant: idTenant, dias } })
      setMentores(data.mentores)
      setDiasAplicados(data.dias || dias)
    } catch (err) {
      setErro(err.response?.data?.erro || "Não foi possível carregar os mentores.")
      setMentores([])
    } finally {
      setCarregando(false)
    }
  }, [idTenant, dias])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Startups que o mentor acompanha + as que ainda pode acompanhar.
   * As duas listas vem juntas do backend: oferecer uma startup ja vinculada
   * so daria 409.
   */
  const buscarDetalhe = useCallback(
    async (idUsuario) => {
      const { data } = await api.get(`/mentores/${idUsuario}/startups`, {
        params: { id_tenant: idTenant },
      })
      return data
    },
    [idTenant]
  )

  /**
   * Cadastra um mentor: a pessoa e o cadastro dela.
   *
   * Uma chamada so porque o backend faz as duas coisas (ver mentorService.criar)
   * — "mentor" e o papel 'mentor' em tenant_usuarios, entao cadastrar um mentor
   * e cadastrar um usuario com esse papel, com senha provisoria e a role Mentor
   * ja alocada.
   */
  const criarMentor = useCallback(
    async (dados) => {
      const { data } = await api.post("/mentores", { id_tenant: idTenant, ...dados })
      await carregar()
      return data.mentor
    },
    [idTenant, carregar]
  )

  /** Grava o cadastro inteiro (PUT: campo apagado no formulario e apagado aqui). */
  const salvarPerfil = useCallback(
    async (idUsuario, perfil) => {
      await api.put(`/mentores/${idUsuario}/perfil`, { id_tenant: idTenant, ...perfil })
      await carregar()
    },
    [idTenant, carregar]
  )

  /** So o status. Usado um por vez pela acao em massa da tabela. */
  const alterarSituacao = useCallback(
    async (idUsuario, situacao) =>
      api.patch(`/mentores/${idUsuario}/situacao`, { id_tenant: idTenant, situacao }),
    [idTenant]
  )

  const vincular = useCallback(
    async (idUsuario, idStartup) => {
      await api.post(`/mentores/${idUsuario}/startups`, {
        id_tenant: idTenant,
        id_startup: idStartup,
      })
      await carregar()
    },
    [idTenant, carregar]
  )

  const desvincular = useCallback(
    async (idUsuario, idStartup) => {
      await api.delete(`/mentores/${idUsuario}/startups/${idStartup}`, {
        params: { id_tenant: idTenant },
      })
      await carregar()
    },
    [idTenant, carregar]
  )

  return {
    mentores,
    diasAplicados,
    carregando,
    erro,
    recarregar: carregar,
    buscarDetalhe,
    criarMentor,
    salvarPerfil,
    alterarSituacao,
    vincular,
    desvincular,
  }
}
