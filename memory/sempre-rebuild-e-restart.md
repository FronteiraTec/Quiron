---
name: sempre-rebuild-e-restart
description: Após alterar código, sempre rebuildar os containers afetados e reiniciar o nginx para o usuário ver no ar
metadata:
  type: feedback
---

O usuário quer ver as atualizações no ar (http://localhost) sem ter que subir nada manualmente.

**Why:** o frontend é servido como build estático e o backend roda em container; mudanças no código não aparecem até rebuildar.

**How to apply:** ao final de cada alteração, rodar `docker compose up -d --build --force-recreate <serviço(s) afetado(s)>` e em seguida `docker restart nginx_proxy` (ver [[nginx-restart-apos-rebuild]]), e confirmar com curl que `http://localhost/api/health` responde 200 antes de avisar o usuário.

**Atenção (cache do build):** já aconteceu de `docker compose up -d --build backend` **bater em cache e NÃO recriar o container** (o `node_api` continuou rodando código antigo — sintoma: campos novos não aparecem na API, validações novas não pegam). Provável quirk de timestamp do OneDrive. Por isso use sempre `--force-recreate`; em caso de dúvida, `docker compose build --no-cache <svc>` e confirme o código dentro do container com `docker exec node_api sh -c "grep <trecho-novo> src/..."` antes de testar.
