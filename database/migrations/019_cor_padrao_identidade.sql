-- ===========================================================================
-- 019 — Cor primaria padrao: o lima da identidade visual
--
-- CONTEXTO
-- O sistema passou a seguir a identidade do modelo de apresentacao do Desafio
-- Empreende UFFS 2026: preto, branco e lima (#76db00). O tema do frontend e
-- montado a partir de usuario_preferencias.cor_primaria, entao o padrao da
-- coluna troca o indigo (#4f46e5) pelo lima.
--
-- POR QUE TAMBEM O UPDATE
-- A linha de preferencias nasce no primeiro PUT /preferencias (upsert) e grava
-- o conjunto inteiro — inclusive a cor que estava em vigor. Quem so trocou o
-- tema claro/escuro, ou recolheu a Sidebar, tem '#4f46e5' salvo sem nunca ter
-- escolhido cor nenhuma. Mudar so o DEFAULT deixaria essas pessoas no indigo.
--
-- O indigo era tambem a opcao "Azul" do painel de conta, entao quem a
-- escolheu de proposito nao se distingue de quem nunca escolheu: os dois
-- migram. Quem escolheu outra cor (verde, laranja...) fica com ela — o tema
-- novo ajusta qualquer cor salva ao claro e ao escuro.
--
-- `atualizado_ts` fica como esta: ele registra a ultima acao da pessoa, e
-- esta troca nao foi dela.
--
-- NAO-DESTRUTIVA e idempotente: troca um valor padrao e uma cor; rodar de
-- novo nao muda nada.
-- ===========================================================================

ALTER TABLE usuario_preferencias
    ALTER COLUMN cor_primaria SET DEFAULT '#76db00';

UPDATE usuario_preferencias
   SET cor_primaria = '#76db00'
 WHERE lower(cor_primaria) = '#4f46e5';
