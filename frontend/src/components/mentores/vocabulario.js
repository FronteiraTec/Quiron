/**
 * O vocabulario FECHADO do cadastro de mentor: os tres formatos de atendimento
 * e os tres status.
 *
 * FIXO NO CODIGO, ao contrario de tipo/situacao de startup (que sao dado por
 * incubadora, migracao 010). A diferenca nao e de estilo: la a incubadora
 * INVENTA rotulos ("Em tracao", "Aceleracao") e o sistema deriva o ciclo; aqui
 * os valores sao enums do banco (mentorFormato / mentorSituacao, migracao 016)
 * e existem para alimentar filtro e acao em massa. Tres cada, iguais para
 * todas — e este arquivo e o espelho do backend em mentores/perfil.js.
 *
 * As cores seguem as do resto do sistema: verde para o estado normal, ambar
 * para o que pede atencao, cinza para o que saiu de cena.
 */

/** Como o mentor atende. */
export const FORMATOS = [
  { chave: "PRESENCIAL", rotulo: "Presencial", cor: "#0ea5e9" },
  { chave: "ONLINE", rotulo: "Online", cor: "#6366f1" },
  { chave: "HIBRIDO", rotulo: "Híbrido", cor: "#8b5cf6" },
]

/**
 * O status do mentor SEGUNDO A COORDENACAO — nao o acesso dele ao sistema.
 * "Inativo" aqui nao tira o login de ninguem; isso e assunto de /usuarios.
 */
export const SITUACOES = [
  { chave: "ATIVO", rotulo: "Ativo", cor: "#10b981" },
  { chave: "INDISPONIVEL", rotulo: "Indisponível", cor: "#f59e0b" },
  { chave: "INATIVO", rotulo: "Inativo", cor: "#64748b" },
]

/** O padrao do banco: mentor sem cadastro editado le como ativo. */
export const SITUACAO_ATIVO = "ATIVO"
export const FORMATO_PADRAO = "HIBRIDO"

const achar = (lista, chave) => lista.find((item) => item.chave === chave)

/** O rotulo legivel, com o proprio valor como ultimo recurso. */
export const rotuloFormato = (chave) => achar(FORMATOS, chave)?.rotulo || chave || "—"
export const rotuloSituacao = (chave) => achar(SITUACOES, chave)?.rotulo || chave || "—"

export const corFormato = (chave) => achar(FORMATOS, chave)?.cor
export const corSituacao = (chave) => achar(SITUACOES, chave)?.cor
