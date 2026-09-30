-- Subconjunto do schema criado pelas migrations da API GearUp:
-- apenas as tabelas que a Lambda lê ("Clientes" e "Usuarios").
CREATE TABLE "Clientes" (
    "Id"         uuid                     NOT NULL,
    "Nome"       character varying(150)   NOT NULL,
    "Documento"  character varying(14)    NOT NULL,
    "Email"      character varying(254)   NOT NULL,
    "Telefone"   character varying(11)    NOT NULL,
    "Ativo"      boolean                  NOT NULL,
    "CriadoEm"   timestamp with time zone NOT NULL,
    "ExcluidoEm" timestamp with time zone NULL,
    CONSTRAINT "PK_Clientes" PRIMARY KEY ("Id")
);

CREATE UNIQUE INDEX "UX_Clientes_Documento" ON "Clientes" ("Documento");

INSERT INTO "Clientes" VALUES
  ('8d1f7a52-3f0e-4c1e-9d59-2c1a6a3f9b10', 'Maria Souza', '52998224725', 'maria@exemplo.com', '11999990000', true,  now(), NULL),
  ('0b8e2c4d-1111-4c1e-9d59-2c1a6a3f9b10', 'João Lima',   '11144477735', 'joao@exemplo.com',  '11988880000', false, now(), now());

-- Usuários de perfil Cliente (Perfil = 4). SenhaHash gerado pelo PasswordHasher
-- da API (.NET) para a senha "SenhaCliente@123".
CREATE TABLE "Usuarios" (
    "Id"          uuid                   NOT NULL,
    "NomeUsuario" character varying(100) NOT NULL,
    "SenhaHash"   character varying(500) NOT NULL,
    "Perfil"      integer                NOT NULL,
    "ClienteId"   uuid                   NULL,
    "Ativo"       boolean                NOT NULL,
    CONSTRAINT "PK_Usuarios" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Usuarios_Clientes_ClienteId" FOREIGN KEY ("ClienteId") REFERENCES "Clientes" ("Id")
);

CREATE INDEX "IX_Usuarios_ClienteId" ON "Usuarios" ("ClienteId");

-- Cliente sem usuário: autentica com CPF válido, mas recebe 401.
INSERT INTO "Clientes" VALUES
  ('5a0c3d11-2222-4c1e-9d59-2c1a6a3f9b10', 'Ana Reis', '71428793860', 'ana@exemplo.com', '11977770000', true, now(), NULL);

INSERT INTO "Usuarios" VALUES
  ('a1b2c3d4-0000-4000-8000-000000000001', 'maria', 'PBKDF2-SHA256$210000$ZumNEr0Wt5q86hsNdclbzw==$jScwAoaV1K6KYh99MDG5htfWt+cl+kxfPesxWPt9NGQ=', 4, '8d1f7a52-3f0e-4c1e-9d59-2c1a6a3f9b10', true),
  ('a1b2c3d4-0000-4000-8000-000000000002', 'joao',  'PBKDF2-SHA256$210000$ZumNEr0Wt5q86hsNdclbzw==$jScwAoaV1K6KYh99MDG5htfWt+cl+kxfPesxWPt9NGQ=', 4, '0b8e2c4d-1111-4c1e-9d59-2c1a6a3f9b10', true);
