/**
 * O vocabulario de cadastro que toda incubadora ganha ao nascer: os TIPOS e as
 * SITUACOES (status) de startup, e nada mais.
 *
 * FONTE CANONICA das duas listas, no mesmo espirito de eventos/categoriasPadrao:
 * sao PADRAO, nao lista fixa. A incubadora renomeia, recolore, acrescenta e
 * desativa o que nao usa — que e exatamente o pedido de "cada incubadora pode
 * ter ANY tipos".
 *
 * POR QUE A SITUACAO TEM UM `ciclo`
 * `startup.status` continua sendo o enum statusStartup (ATIVA/PAUSADA/
 * ENCERRADA) porque HA CODIGO ATRAS DELE: os relatorios e a agenda excluem a
 * startup ENCERRADA do programa (`s.status <> 'ENCERRADA'`). Se a situacao
 * fosse texto livre puro, "Graduada" nao significaria nada para essas
 * consultas e a startup graduada continuaria contando como incubada ativa.
 *
 * Entao cada situacao cadastrada declara a QUAL dos tres estados de ciclo ela
 * equivale. A incubadora inventa quantos rotulos quiser ("Em tracao",
 * "Aceleracao", "Desligada"); o sistema continua sabendo quem esta dentro do
 * programa. O `status` e derivado do `ciclo` da situacao escolhida — ver
 * startupRepository.
 *
 * NOTA: database/seed.sql repete estas listas em SQL porque cria o tenant demo
 * direto no banco, sem passar pelo service. Mexeu aqui, veja la.
 */

/** Tipos de startup padrao. Puro vocabulario: nao ha codigo atras deles. */
const TIPOS_PADRAO = [
  { chave: "INCUBADA",   rotulo: "Incubada",   cor: "#6366f1", ordem: 1 },
  { chave: "RESIDENTE",  rotulo: "Residente",  cor: "#0ea5e9", ordem: 2 },
  { chave: "ASSOCIADA",  rotulo: "Associada",  cor: "#10b981", ordem: 3 },
  { chave: "GRADUADA",   rotulo: "Graduada",   cor: "#f59e0b", ordem: 4 },
]

/**
 * Situacoes padrao. Os rotulos e as cores sao os de data/startupMeta.js — no
 * dia da virada nada muda de aparencia; a incubadora edita a partir dai.
 */
const SITUACOES_PADRAO = [
  { chave: "ATIVA",     rotulo: "Ativa",     cor: "#10b981", ciclo: "ATIVA",     ordem: 1 },
  { chave: "PAUSADA",   rotulo: "Pausada",   cor: "#f59e0b", ciclo: "PAUSADA",   ordem: 2 },
  { chave: "ENCERRADA", rotulo: "Concluida", cor: "#64748b", ciclo: "ENCERRADA", ordem: 3 },
]

/** Situacao usada quando o formulario nao manda nenhuma. */
const SITUACAO_FALLBACK = "ATIVA"

/** Os tres estados de ciclo — o enum statusStartup do banco. */
const CICLOS_VALIDOS = ["ATIVA", "PAUSADA", "ENCERRADA"]

/**
 * Os tipos de campo personalizavel mudaram de casa: hoje moram em
 * campos/tipos.js, junto da validacao da `config` de cada um, porque a gestao
 * de tarefas define campos com a mesma lista. Continua reexportado daqui para
 * quem ja importava de padroes.
 */
const { TIPOS_CAMPO } = require("../campos/tipos")

module.exports = {
  TIPOS_PADRAO,
  SITUACOES_PADRAO,
  SITUACAO_FALLBACK,
  CICLOS_VALIDOS,
  TIPOS_CAMPO,
}
