---
name: nginx-restart-apos-rebuild
description: Depois de rebuildar backend/frontend com docker compose, reiniciar o nginx_proxy senao da 502
metadata:
  type: project
---

Ao rodar `docker compose up -d --build backend frontend`, os containers `node_api`/`react_app` são recriados e ganham novo IP na rede `quiron`. O `nginx_proxy` **não** é recriado e mantém o IP antigo em cache no upstream, resultando em `502 Bad Gateway` em `http://localhost/` e `/api/*`.

**Como aplicar:** sempre rode `docker restart nginx_proxy` após um rebuild que recrie backend/frontend. Depois valide com `curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health` (espera 200).
