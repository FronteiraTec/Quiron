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
INSERT INTO tenant (nome, celular, email, pais, estado, cidade, rua)
VALUES ('Incubadora Demo', '11999999999', 'contato@incubadorademo.com',
        'Brasil', 'Sao Paulo', 'Sao Paulo', 'Rua Exemplo, 100')
ON CONFLICT DO NOTHING;

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
