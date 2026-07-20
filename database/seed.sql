-- ---------------------------------------------------------------------------
-- Seed inicial da plataforma.
--
-- Executado automaticamente pelo Postgres na primeira inicializacao do banco
-- (docker-entrypoint-initdb.d), APOS o schema. Cria o usuario ROOT
-- (super-admin) que tem acesso a gestao global de incubadoras (tenants).
--
-- Credenciais padrao (TROQUE a senha apos o primeiro login):
--   email:  root@quiron.com
--   senha:  Root@123
--
-- O hash abaixo esta no formato "<salt>:<sha256(salt+senha)>" (ver
-- backend/src/utils/senha.js). Se mudar a senha, gere um novo hash com:
--   node -e "console.log(require('./backend/src/utils/senha').gerarHash('SUA_SENHA'))"
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, celular, senha_hash, root)
VALUES (
    'Root',
    'root@quiron.com',
    '00000000000',
    'fa66661a76241b65c58035a4c8ba447f:a6199e9e9b69516624ab066682147151da2bd6d2d328dfab67a4d59c04a84618',
    TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Incubadora (tenant) de exemplo + usuario ADMIN vinculado a ela.
--
-- Um admin sempre pertence a uma incubadora (tabela tenant_usuarios, papel
-- 'admin'). Criamos aqui uma incubadora demo e o admin dela.
--
-- Credenciais do admin (TROQUE a senha apos o primeiro login):
--   email:  admin@quiron.com
--   senha:  Admin@123
-- ---------------------------------------------------------------------------
-- WHERE NOT EXISTS, e nao ON CONFLICT: a tabela tenant nao tem constraint
-- unica em email, entao "ON CONFLICT DO NOTHING" fica sem alvo, nunca dispara
-- e reexecutar o seed criava uma segunda "Incubadora Demo" — com os usuarios
-- vinculados as duas. Mesmo padrao usado na startup mais abaixo.
INSERT INTO tenant (nome, celular, email, pais, estado, cidade, rua)
SELECT 'Incubadora Demo', '11999999999', 'contato@incubadorademo.com',
       'Brasil', 'Sao Paulo', 'Sao Paulo', 'Rua Exemplo, 100'
 WHERE NOT EXISTS (
     SELECT 1 FROM tenant WHERE email = 'contato@incubadorademo.com'
 );

INSERT INTO usuarios (nome, email, celular, senha_hash)
VALUES (
    'Admin',
    'admin@quiron.com',
    '11988888888',
    '0c6ebc462ab207b52bbe028c7dda98db:289345b83dfb826212bfec7ed2b94518425ed9dc8f8c1fdc3b042366dfe666a5'
)
ON CONFLICT (email) DO NOTHING;

-- Vincula o admin a incubadora demo com papel 'admin'.
INSERT INTO tenant_usuarios (id_tenant, id_usuario, papel)
SELECT t.id_tenant, u.id_usuario, 'admin'
  FROM tenant t, usuarios u
 WHERE t.email = 'contato@incubadorademo.com'
   AND u.email = 'admin@quiron.com'
ON CONFLICT (id_tenant, id_usuario) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Usuario INCUBADO (papel 'usuario') + startup de exemplo.
--
-- E este usuario que enxerga a visao do incubado: "Minha Empresa" (Blueprint),
-- "Minha Jornada" e "Minha Startup". Sem ele, so existiam root/admin e nao
-- havia como testar a experiencia do empreendedor.
--
-- Credenciais do incubado (TROQUE a senha apos o primeiro login):
--   email:  incubado@quiron.com
--   senha:  Incubado@123
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, celular, senha_hash)
VALUES (
    'Flavia (FlipTech)',
    'incubado@quiron.com',
    '11977777777',
    'dac7f7c6f690e1e460a6cfb73970c86b:cccda1efbc4435b0683b0448081c9a8fd6470dada6de1c13f5ef223f7361ab00'
)
ON CONFLICT (email) DO NOTHING;

-- Vincula o incubado a incubadora demo com papel 'usuario'.
INSERT INTO tenant_usuarios (id_tenant, id_usuario, papel)
SELECT t.id_tenant, u.id_usuario, 'usuario'
  FROM tenant t, usuarios u
 WHERE t.email = 'contato@incubadorademo.com'
   AND u.email = 'incubado@quiron.com'
ON CONFLICT (id_tenant, id_usuario) DO NOTHING;

-- Startup de exemplo, na incubadora demo.
INSERT INTO startup (id_tenant, nome, status)
SELECT t.id_tenant, 'FlipTech', 'ATIVA'
  FROM tenant t
 WHERE t.email = 'contato@incubadorademo.com'
   AND NOT EXISTS (SELECT 1 FROM startup s WHERE s.nome = 'FlipTech');

-- Vincula o incubado como lider da FlipTech.
INSERT INTO startup_membros (id_startup, id_usuario, lider)
SELECT s.id_startup, u.id_usuario, TRUE
  FROM startup s, usuarios u
 WHERE s.nome = 'FlipTech'
   AND u.email = 'incubado@quiron.com'
ON CONFLICT (id_startup, id_usuario) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Usuario MENTOR (papel 'mentor').
--
-- E este usuario que enxerga a visao de quem acompanha: a fila de "Entregas" a
-- avaliar e o historico de "Feedback". Sem ele so havia admin e incubado, e o
-- recorte do mentor (que ve apenas as startups que acompanha, e nao o tenant
-- inteiro como o admin) nao tinha como ser exercitado.
--
-- Credenciais do mentor (TROQUE a senha apos o primeiro login):
--   email:  mentor@quiron.com
--   senha:  Mentor@123
-- ---------------------------------------------------------------------------
INSERT INTO usuarios (nome, email, celular, senha_hash)
VALUES (
    'Ricardo (Mentor)',
    'mentor@quiron.com',
    '11966666666',
    'd4ffc386955c0dcda85750c148800954:20e2cb9eeac0ec10034146a9a1ce22dd3a5c98699f41ee8c972b55b2e5e22f13'
)
ON CONFLICT (email) DO NOTHING;

-- Vincula o mentor a incubadora demo com papel 'mentor'.
INSERT INTO tenant_usuarios (id_tenant, id_usuario, papel)
SELECT t.id_tenant, u.id_usuario, 'mentor'
  FROM tenant t, usuarios u
 WHERE t.email = 'contato@incubadorademo.com'
   AND u.email = 'mentor@quiron.com'
ON CONFLICT (id_tenant, id_usuario) DO NOTHING;

-- Coloca a FlipTech sob a mentoria dele. E este vinculo (mentor_startup) que
-- define o que entra na fila de avaliacao do mentor.
INSERT INTO mentor_startup (id_usuario_mentor, id_startup)
SELECT u.id_usuario, s.id_startup
  FROM usuarios u, startup s
 WHERE u.email = 'mentor@quiron.com'
   AND s.nome = 'FlipTech'
ON CONFLICT DO NOTHING;
