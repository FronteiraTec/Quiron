# Arquitetura do Backend — Layered Architecture

O backend segue **arquitetura em camadas**. Cada requisição flui de cima para
baixo, e cada camada só conhece a camada imediatamente abaixo:

```
HTTP  →  Routes  →  Controllers  →  Services  →  Repositories  →  PostgreSQL
                       (HTTP)      (regra de     (acesso a
                                    negócio)      dados / SQL)
```

## Responsabilidade de cada camada

| Camada | Pasta | Responsabilidade |
|---|---|---|
| **Routes** | `src/routes/` | Define os endpoints e liga-os aos controllers/middlewares. |
| **Controllers** | `src/controllers/` | Fino: lê `req`, chama o service, devolve `res`. Sem regra de negócio. |
| **Services** | `src/services/` | Regra de negócio, validações e orquestração de repositórios. |
| **Repositories** | `src/repositories/` | Único lugar com SQL. Um por agregado do `schema.sql`. |
| **Middlewares** | `src/middlewares/` | Autenticação (Bearer Token) e tratamento central de erros. |
| **Config** | `src/config/` | Conexão com o banco (pool `pg`). |
| **Utils** | `src/utils/` | Ferramentas puras: SHA-256 (`senha.js`) e JWT (`jwt.js`). |

## Mapa: tabelas do `schema.sql` → repositórios

| Repositório | Tabelas cobertas |
|---|---|
| `usuarioRepository` | `usuarios` |
| `preferenciaRepository` | `usuario_preferencias` |
| `tenantRepository` | `tenant`, `tenant_usuarios` |
| `startupRepository` | `startup`, `startup_membros`, `mentor_startup`, `startup_fase` |
| `faseRepository` | `fase` |
| `moduloRepository` | `modulo` |
| `tarefaRepository` | `tarefa` |
| `questionarioRepository` | `questionarios`, `pergunta`, `alternativa` |
| `entregaRepository` | `entrega`, `resposta` |
| `avaliacaoRepository` | `avaliacao` |
| `eventoRepository` | `evento`, `evento_confirmacao`, `evento_presenca` |
| `auditLogRepository` | `audit_log` |

## Como adicionar uma nova feature (ex.: Startups)

1. **Repository** — já existe `startupRepository.js` (SQL).
2. **Service** — criar `services/startupService.js` (regra de negócio).
3. **Controller** — criar `controllers/startupController.js` (HTTP).
4. **Route** — criar `routes/startupRoutes.js` e registrar em `routes/index.js`.

A fatia de **auth** (`usuarioRepository` → `authService` → `authController` →
`authRoutes`) serve de referência completa do padrão.
