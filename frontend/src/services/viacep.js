/**
 * Consulta de endereco por CEP no ViaCEP (https://viacep.com.br).
 *
 * NAO usa o cliente `api`: aquele tem baseURL "/api" e injeta o Bearer Token em
 * toda requisicao. Mandar o token do usuario para um servico de terceiros seria
 * vazar credencial sem nenhum ganho — o ViaCEP e publico e nao pede
 * autenticacao.
 *
 * `fetch` direto, e nao axios, pelo mesmo motivo: nada aqui precisa de
 * interceptor, e a resposta 401 do ViaCEP (que nao existe) nao deve deslogar
 * ninguem.
 *
 * O ViaCEP responde 200 COM `{ "erro": true }` para CEP inexistente — nao 404.
 * Quem chamar precisa olhar o corpo, e nao so o status; e o que esta funcao
 * resolve, devolvendo null nos dois casos.
 */

/** Quanto esperar antes de desistir. Formulario travado e pior que CEP nao preenchido. */
const TIMEOUT_MS = 8000

/**
 * Busca o endereco de um CEP.
 *
 * @param {string} cep - Com ou sem mascara; so os digitos importam.
 * @returns {Promise<{cep,uf,cidade,bairro,rua}|null>} null quando o CEP nao
 *   existe, e lanca quando a rede falha — sao coisas diferentes para quem
 *   preenche: "confira o numero" e "tente de novo".
 */
export async function buscarCep(cep) {
  const digitos = String(cep ?? "").replace(/\D/g, "")
  if (digitos.length !== 8) return null

  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS)

  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: controle.signal,
    })
    if (!resposta.ok) throw new Error("ViaCEP indisponivel")

    const dados = await resposta.json()
    if (dados.erro) return null

    // Renomeia para o vocabulario do nosso cadastro: o ViaCEP fala
    // logradouro/localidade, as colunas falam rua/cidade.
    return {
      cep: digitos,
      uf: dados.uf || "",
      cidade: dados.localidade || "",
      bairro: dados.bairro || "",
      rua: dados.logradouro || "",
    }
  } finally {
    clearTimeout(timer)
  }
}
