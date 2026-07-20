---
name: anexos-nao-sao-enviados-ao-servidor
description: Anexos de entrega nunca sobem para o servidor — o banco guarda blob:/nome, entao o mentor nao consegue abrir o arquivo
metadata:
  type: project
---

Nao existe upload de arquivo no sistema. Em `PassoConteudo.jsx` o incubado
anexa um PDF e o front grava `{nome, tamanho, url: URL.createObjectURL(f)}` —
uma `blob:` URL, que so vale na aba de quem enviou. Isso vai para
`entrega.anexos` (`TEXT[]`) e o pg serializa o objeto como JSON string. Ha
ainda linhas mais antigas (seed) que guardam so o NOME do arquivo.

**Consequencia:** quem NAO enviou o arquivo (o mentor avaliando a entrega)
nunca consegue abrir o anexo. O link ou esta morto (`blob:`) ou e um caminho
relativo para lugar nenhum (`entrevistas-consolidado.pdf`).

**How to apply:** ao exibir anexos fora da sessao de quem enviou, valide a URL
antes de oferecer botao de abrir — so `http(s)://` ou `/` sao reais; `blob:` e
nome puro devem aparecer como "indisponivel". Ver `anexoAcessivel()` em
`frontend/src/components/entregas/EntregaPainel.jsx`. Resolver de verdade exige
um endpoint de upload + storage, que ainda nao existe.

Related: [[telas-do-mentor-entregas-e-feedback]]
