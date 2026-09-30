-- Subconjunto do schema criado pela migration InitialCreate da API GearUp:
-- apenas a tabela que a Lambda lê.
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
