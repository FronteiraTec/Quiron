---
name: upload-de-arquivos-dois-regimes
description: Como o upload funciona — PUBLICO vs PRIVADO, e por que <img src> obrigou os dois regimes
metadata:
  type: project
---

Criado em 20/07/2026 (migracao 007). Bytes no volume `uploads` do container
(`UPLOAD_DIR=/app/uploads`); a tabela `arquivo` guarda so o registro. Todo
acesso ao disco mora em `arquivoService` — trocar por S3 mexe num arquivo so.

**DOIS REGIMES, e a razao nao e capricho:**

- `PRIVADO` (anexo de entrega) — sai pela API com token. Autorizacao: ser quem
  enviou, ou ter `avaliacoes.entregas.baixar` no tenant do arquivo. Foi isto
  que deu funcao aquela chave, que existia sem enforcement.
- `PUBLICO` (logo, avatar) — sai SEM token. Motivo tecnico, nao preguica: a tag
  `<img src>` do navegador nao envia cabecalho `Authorization`, entao exigir
  token deixaria toda imagem quebrada. A protecao e o nome de armazenamento ser
  UUID aleatorio.

**Consequencia no front:** para abrir um arquivo PRIVADO nao da para usar
`<a href>` — nao envia o cabecalho. Use `abrirArquivo()` de
`services/arquivos.js`, que busca com fetch, vira blob e abre o blob local. Ja
caiu nessa uma vez: o botao com `component="a" href={url}` parecia certo e
devolvia 401.

**Limite conhecido:** a autorizacao de PRIVADO e por TENANT, nao por startup. Um
mentor com a chave que descobrisse o UUID abriria anexo de startup que ele nao
acompanha. Fechar exige ligar `arquivo` a `entrega`, o que o upload nao pode
fazer (o anexo sobe ANTES de a entrega existir) — teria de ser amarrado no
envio.

**Armadilha do nginx:** o padrao de `client_max_body_size` e 1MB e ele recusa
ANTES da API, devolvendo 413 em HTML. Um PDF de 3MB morria ali sem passar pelas
regras do service. Esta em 16m no `nginx/default.conf`, contra 15MB do app
(`MAX_PRIVADO`). Mexeu num, confira o outro.

**Nao ha limpeza de orfaos.** Remover o anexo da entrega nao apaga o byte, de
proposito (rascunho que se desfaz e refaz perderia o arquivo). O volume so
cresce; um varredor de arquivos sem referencia ainda nao existe.

**SVG fica fora da lista de imagens** — e XML, pode carregar `<script>`, e
servido da mesma origem viraria XSS contra os outros usuarios.

Related: [[anexos-nao-sao-enviados-ao-servidor]], [[rbac-papel-e-baseline-permissao-estende]]
