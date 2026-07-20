docker compose restart
docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Image}}"
