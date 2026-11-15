/**
 * O ffmpeg de verdade sobre o que o navegador grava (src/reunioes/
 * audioConversor.js e transcricao.transcreverAudio).
 *
 * SO RODA ONDE HA FFMPEG — dentro da imagem do backend:
 *   docker compose run --rm --no-deps -v ./backend/test:/app/test:ro backend \
 *     node --test test/audioFfmpeg.test.js
 * Na maquina sem ffmpeg (e na CI) os testes aparecem como pulados.
 *
 * O audio de teste e sintetico (tom de 440 Hz ligando e desligando a cada
 * 10 s) e fatiado em pedacos de bytes, como o MediaRecorder entrega. O que se
 * prende:
 *   - os pedacos juntos dao a gravacao inteira, com os silencios no lugar;
 *   - um pedaco perdido no meio NAO desloca o resto: a corrida depois do
 *     buraco, com o cabecalho do pedaco 0, cai na linha do tempo certa;
 *   - sem o pedaco 0 nao ha leitura;
 *   - transcreverAudio manda ao provedor so os pedacos com som e devolve o
 *     horario absoluto de cada trecho.
 */
const { test, before } = require("node:test")
const assert = require("node:assert/strict")
const { execFileSync, spawnSync } = require("node:child_process")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const temFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0
const opcoes = { skip: temFfmpeg ? false : "ffmpeg nao instalado nesta maquina" }

const conversor = require("../src/reunioes/audioConversor")
const { transcreverAudio } = require("../src/reunioes/transcricao")

let pasta

/** Gera o audio de teste no formato dado e fatia em `n` pedacos de bytes. */
function gravar(nome, argsSaida, n = 8) {
  const original = path.join(pasta, `${nome}.orig`)
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=40",
    "-af", "volume='if(lt(mod(t,20),10),1,0)':eval=frame",
    ...argsSaida, original,
  ])
  const bytes = fs.readFileSync(original)
  const tam = Math.ceil(bytes.length / n)
  return Array.from({ length: n }, (_, i) => {
    const arquivo = path.join(pasta, `${nome}-${i}.parte`)
    fs.writeFileSync(arquivo, bytes.subarray(i * tam, (i + 1) * tam))
    return arquivo
  })
}

const WEBM = ["-c:a", "libopus", "-b:a", "24k", "-f", "webm", "-cluster_time_limit", "1000"]
const OGG = ["-c:a", "libopus", "-b:a", "24k", "-f", "ogg"]

before(() => {
  pasta = fs.mkdtempSync(path.join(os.tmpdir(), "quiron-ffmpeg-"))
})

const perto = (a, b, folga = 1.2) => Math.abs(a - b) <= folga

test("WebM: os pedacos juntos dao a gravacao inteira, com o silencio no lugar", opcoes, async () => {
  const partes = gravar("webm", WEBM)
  const destino = path.join(pasta, "webm.ogg")
  await conversor.normalizar({ partes, mime: "audio/webm;codecs=opus", temporario: path.join(pasta, "webm.bruto"), destino })
  assert.ok(perto(await conversor.duracao(destino), 40, 0.5))
  const s = await conversor.silencios(destino)
  assert.ok(perto(s[0].inicio, 10) && perto(s[0].fim, 20), JSON.stringify(s))
})

for (const [nome, mime, args] of [
  ["webm", "audio/webm;codecs=opus", WEBM],
  ["ogg", "audio/ogg;codecs=opus", OGG],
]) {
  test(`${nome}: a corrida depois de um buraco cai na linha do tempo certa`, opcoes, async () => {
    const partes = gravar(`${nome}-buraco`, args)
    const cabecalho = conversor.extrairCabecalho(mime, fs.readFileSync(partes[0]))
    assert.ok(cabecalho && cabecalho.length > 0, "achou o cabecalho no pedaco 0")

    // Sem o pedaco 3: a corrida 4..7 vai com o cabecalho na frente.
    const destino = path.join(pasta, `${nome}-depois.ogg`)
    await conversor.normalizar({ partes: partes.slice(4), mime, temporario: path.join(pasta, `${nome}-d.bruto`), destino, cabecalho })
    // A corrida comeca em silencio (o tempo antes dela) e o tom das 20-30 s
    // aparece onde estava, e nao no comeco do arquivo.
    assert.ok(perto(await conversor.duracao(destino), 40, 0.5))
    const s = await conversor.silencios(destino)
    assert.equal(s[0].inicio, 0)
    assert.ok(s[0].fim > 15 && s[0].fim < 23, JSON.stringify(s))
    // O silencio final vai ate o fim do arquivo (o ffmpeg 8 o fecha no fim; versoes antigas o deixam aberto).
    assert.ok(s.some((x) => perto(x.inicio, 30) && (x.fim === Infinity || perto(x.fim, 40))), JSON.stringify(s))
  })
}

test("sem o pedaco 0 nao ha cabecalho e a gravacao nao se le", opcoes, async () => {
  const partes = gravar("sem0", WEBM)
  await assert.rejects(
    conversor.normalizar({ partes: partes.slice(1), mime: "audio/webm", temporario: path.join(pasta, "sem0.bruto"), destino: path.join(pasta, "sem0.ogg") })
  )
})

test("transcreverAudio: so os pedacos com som vao ao provedor, e os trechos voltam no horario certo", opcoes, async () => {
  const partes = gravar("trans", WEBM)
  const ids = { idTenant: 1, idReuniao: 2, idAudio: 3 }
  // Um "disco" sobre os arquivos gerados, sem o pedaco 3.
  const disco = {
    listarPartes: async () => [0, 1, 2, 4, 5, 6, 7],
    arquivoDaParte: (_ids, n) => partes[n],
  }
  const enviados = []
  const provedor = {
    capacidades: () => ({ devolveTempos: true, limiteBytes: 1e9 }),
    async transcrever({ audio }) {
      enviados.push(audio.length)
      return [{ texto: `fala ${enviados.length}`, inicioMs: 500, fimMs: 2500, confianca: 0.9 }]
    },
  }
  const temporaria = fs.mkdtempSync(path.join(pasta, "t-"))
  const r = await transcreverAudio(
    { ...ids, id_tenant: 1, id_reuniao: 2, id_audio: 3, mime: "audio/webm;codecs=opus", usuario_nome: "Ana" },
    { provedor, conversor, disco, pastaTemporaria: temporaria }
  )
  assert.equal(r.falha, null)
  // Duas corridas: 0-2 (o tom das 0-10 s) e 4-7 (o tom das 20-30 s). O
  // silencio entre elas nao foi mandado.
  assert.equal(enviados.length, 2, JSON.stringify(r))
  assert.ok(perto(r.trechos[0].inicioMs / 1000, 0.5, 1), JSON.stringify(r.trechos))
  assert.ok(r.trechos[1].inicioMs / 1000 > 19 && r.trechos[1].inicioMs / 1000 < 22, JSON.stringify(r.trechos))
  assert.ok(r.segundos < 25, `mandou ${r.segundos} s de audio (deveria pular o silencio)`)
})
