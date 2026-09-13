/**
 * Envio e abertura de arquivos.
 *
 * Ate 20/07/2026 nao havia upload: o front guardava `URL.createObjectURL(f)` —
 * uma `blob:` URL que so existe na aba de quem enviou. O mentor, que e
 * exatamente quem precisa abrir o anexo para avaliar, recebia um link morto.
 *
 * POR QUE ABRIR UM ANEXO DA TRABALHO: anexo de entrega e PRIVADO e exige token.
 * Uma tag <a href> ou <img src> nao envia cabecalho Authorization — o navegador
 * simplesmente nao manda. Entao para abrir um arquivo privado e preciso buscar
 * com fetch (aí sim com o cabecalho), virar blob e abrir esse blob local. Para
 * arquivo PUBLICO nada disso e necessario: a url entra direto no src.
 */
import api, { TOKEN_KEY } from "./api"

/**
 * Envia um arquivo.
 * @param {File} file
 * @param {{idTenant: number, visibilidade?: "PUBLICO"|"PRIVADO"}} opcoes
 * @returns {Promise<{id_arquivo, nome_original, mime, tamanho, url}>}
 */
export async function enviarArquivo(file, { idTenant, visibilidade = "PRIVADO" }) {
  const form = new FormData()
  form.append("arquivo", file)
  form.append("id_tenant", idTenant)
  form.append("visibilidade", visibilidade)

  // Sem Content-Type manual: o browser precisa gerar o boundary do multipart.
  const { data } = await api.post("/arquivos", form)
  return data.arquivo
}

/**
 * Abre um arquivo privado numa nova aba.
 *
 * Busca com o token, transforma em blob e abre. O objectURL e revogado depois
 * de um minuto: revogar na hora fecharia a aba que acabou de abrir, e nunca
 * revogar vaza memoria a cada anexo aberto.
 *
 * @param {string} url - caminho vindo da API (ex.: /api/arquivos/<uuid>)
 * @param {string} [nome] - usado como titulo do download, quando o browser baixa.
 */
export async function abrirArquivo(url, nome) {
  const token = localStorage.getItem(TOKEN_KEY)
  const resposta = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!resposta.ok) {
    // A API responde JSON de erro; se nem isso vier, cai na mensagem generica.
    const detalhe = await resposta.json().catch(() => null)
    throw new Error(detalhe?.erro || "Não foi possível abrir o arquivo.")
  }

  const blob = await resposta.blob()
  const objectUrl = URL.createObjectURL(blob)

  const aba = window.open(objectUrl, "_blank", "noopener")
  if (!aba) {
    // Bloqueador de pop-up: cai para download, que nao depende de janela nova.
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = nome || "arquivo"
    link.click()
  }

  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}

/**
 * Normaliza um item de `entrega.anexos`.
 *
 * A coluna e TEXT[] e o conteudo variou ao longo do tempo: ha JSON
 * ({nome, tamanho, url}, gravado pela Jornada desde o upload de verdade), ha
 * url pura e ha linhas que guardam so o nome do arquivo. Os tres precisam
 * chegar as telas como {nome, url} — quem le anexo (incubado na Jornada,
 * mentor nas Entregas) nao pode depender de qual epoca gravou a linha.
 *
 * @param {string|object} valor
 * @returns {{nome?: string, url?: string, tamanho?: number}}
 */
export function parseAnexo(valor) {
  if (valor && typeof valor === "object") return valor
  try {
    const obj = JSON.parse(valor)
    if (obj && typeof obj === "object") return obj
  } catch {
    // Nao era JSON: cai no tratamento de texto simples abaixo.
  }
  return { url: valor, nome: String(valor).split("/").pop() }
}

/**
 * Da para abrir este anexo?
 *
 * Desde 20/07/2026 os anexos NOVOS sobem de verdade e chegam como
 * `/api/arquivos/<uuid>` — esses abrem. O que esta funcao filtra e o passado:
 * `blob:` (de quando o front so guardava URL.createObjectURL, viva apenas na
 * aba de quem enviou) e linhas que gravaram so o NOME do arquivo, que viraria
 * link relativo para lugar nenhum. Os bytes desses nunca chegaram ao servidor,
 * entao nao ha o que recuperar — vale mais dizer "indisponivel" do que
 * oferecer um botao que nao abre nada.
 */
export function anexoAcessivel(anexo) {
  const url = anexo?.url
  if (!url || url.startsWith("blob:")) return false
  return /^https?:\/\//i.test(url) || url.startsWith("/")
}

/**
 * Reduz uma imagem antes de envia-la, preservando a proporcao.
 *
 * POR QUE: o regime PUBLICO aceita no maximo 2MB (arquivoService) e uma foto
 * de celular passa disso sozinha. Mesmo cabendo, subir 4000px para exibir
 * numa coluna de 700 gasta disco aqui e banda de quem le depois.
 *
 * Difere do redutor do logo (LogoConteudo), que encaixa a imagem num quadrado
 * transparente porque os logos convivem numa grade e precisam do mesmo
 * tamanho. Imagem no meio de uma aula nao: ela mantem a forma que tem.
 *
 * GIF passa direto — rasterizar num canvas guardaria so o primeiro quadro, e
 * uma animacao viraria uma imagem parada sem ninguem pedir.
 *
 * @param {File} arquivo
 * @param {{ladoMax?: number, qualidade?: number}} [opcoes]
 * @returns {Promise<File>} o proprio arquivo quando nao ha o que reduzir
 */
export function reduzirImagem(arquivo, { ladoMax = 1600, qualidade = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith("image/") || arquivo.type === "image/gif") {
      resolve(arquivo)
      return
    }

    const leitor = new FileReader()
    leitor.onerror = () => reject(new Error("Não foi possível ler a imagem."))
    leitor.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."))
      img.onload = () => {
        const escala = Math.min(1, ladoMax / Math.max(img.width, img.height))

        // Ja cabe: devolve o original em vez de recodificar, o que so
        // perderia qualidade sem ganhar bytes.
        if (escala === 1) {
          resolve(arquivo)
          return
        }

        const canvas = document.createElement("canvas")
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height)

        // PNG continua PNG por causa da transparencia; o resto sai JPEG, que
        // e menor para fotografia.
        const tipo = arquivo.type === "image/png" ? "image/png" : "image/jpeg"
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Não foi possível processar a imagem."))
              return
            }
            resolve(new File([blob], arquivo.name, { type: tipo }))
          },
          tipo,
          qualidade
        )
      }
      img.src = leitor.result
    }
    leitor.readAsDataURL(arquivo)
  })
}

/** Formata bytes para exibicao ("1,4 MB"). */
export function formatarTamanho(bytes) {
  if (!bytes && bytes !== 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}
