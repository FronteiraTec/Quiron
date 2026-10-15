## O que muda

<!-- Uma ou duas frases: o que este PR faz e por quê. -->

## Como conferir

<!-- O caminho para ver funcionando: tela, rota, usuário de teste. -->

## Checklist

- [ ] O PR é para a **`dev`** (só a `dev` vai para a `main`)
- [ ] Mexeu no banco? Migração nova em `database/migrations/` **e** `database/schema.sql` atualizado ([guia](../database/README.md))
- [ ] Remove ou renomeia coluna/tabela? Está em duas etapas ([por quê](../database/README.md#as-regras-e-por-que-existem))
- [ ] Variável de ambiente nova? Está no `.env.exemplo` **e** no `.env` do servidor (dev e prod) antes do merge
