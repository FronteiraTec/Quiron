/**
 * Abre um material — da biblioteca pessoal ou de um compartilhamento.
 *
 * Tres caminhos, e a diferenca e de autorizacao, nao de gosto:
 *
 *   ARQUIVO   e PRIVADO e exige token. Uma tag <a href> nao manda cabecalho
 *             Authorization, entao o arquivo e buscado com fetch e aberto como
 *             blob (services/arquivos.abrirArquivo). O caminho ja vem montado
 *             pelo backend (`arquivo_url`): o dono abre pela biblioteca, a
 *             startup pelo compartilhamento.
 *   LINK      endereco externo: abre numa aba nova, sem dar a ela acesso a esta
 *             (`noopener`).
 *   AULA      e um documento da Biblioteca, sem arquivo nem endereco: quem
 *             chama decide como mostrar (o DialogMaterial le o corpo).
 */
import { abrirArquivo } from "../../services/arquivos"

// So http(s) abre numa aba. O link do material pessoal ja chega validado pelo
// backend, mas o conteudo da Biblioteca nao tem essa checagem — e um
// `javascript:` aberto por window.open rodaria com a origem do Quiron.
const URL_HTTP = /^https?:\/\//i
// Um arquivo servido pela propria API: precisa do token, nao de uma aba crua.
const URL_API = /^\/api\//

/** O material tem o que abrir sem passar pelo leitor de aula? */
export function temAbertura(item) {
  return Boolean(item?.arquivo_url || item?.url)
}

/**
 * @param {object} item - material ou compartilhamento (com `arquivo_url` ou `url`).
 * @returns {Promise<void>} rejeita com a mensagem pronta para a tela.
 */
export async function abrirMaterial(item) {
  if (item?.arquivo_url) {
    await abrirArquivo(item.arquivo_url, item.arquivo_nome)
    return
  }
  if (item?.url) {
    if (URL_API.test(item.url)) {
      await abrirArquivo(item.url, item.conteudo_nome_arquivo || item.titulo)
      return
    }
    if (!URL_HTTP.test(item.url)) throw new Error("O endereço deste material não é um link válido.")
    window.open(item.url, "_blank", "noopener")
    return
  }
  throw new Error("Este material não tem arquivo nem endereço para abrir.")
}
