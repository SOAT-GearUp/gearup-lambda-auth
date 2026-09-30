import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

// Consulta de leitura direto nas tabelas da API. A Lambda não grava nada:
// clientes e usuários continuam sendo criados e alterados só pela API.
//
// "Documento" tem índice único (UX_Clientes_Documento) e "Usuarios"."ClienteId"
// tem índice (IX_Usuarios_ClienteId), então são dois index scans pequenos.
// "Ativo" = false no cliente indica exclusão lógica (Cliente.Excluir()).
// Traz os hashes de todos os usuários ativos de perfil Cliente (Perfil = 4,
// enum PerfilUsuario) ligados ao cliente; o normal é haver um.
const PERFIL_CLIENTE = 4;
const CONSULTA_POR_CPF = `
  SELECT c."Id"::text AS id,
         c."Nome"     AS nome,
         c."Ativo"    AS ativo,
         COALESCE(array_agg(u."SenhaHash") FILTER (WHERE u."Id" IS NOT NULL), '{}') AS "hashesSenha"
    FROM "Clientes" c
    LEFT JOIN "Usuarios" u
      ON u."ClienteId" = c."Id" AND u."Perfil" = ${PERFIL_CLIENTE} AND u."Ativo"
   WHERE c."Documento" = $1
   GROUP BY c."Id", c."Nome", c."Ativo"`;

const CAMINHO_CA_RDS = new URL('../../certs/rds-global-bundle.pem', import.meta.url);

// O RDS exige TLS (rds.force_ssl = 1). O bundle de CAs da AWS é baixado no
// empacotamento (scripts/empacotar.sh); DB_SSL=disable só para o Postgres
// local do docker compose.
export function configurarSsl(modo, caminhoCa = CAMINHO_CA_RDS) {
  if (modo === 'disable') return false;
  if (existsSync(caminhoCa)) return { ca: readFileSync(caminhoCa, 'utf8') };
  return { rejectUnauthorized: true };
}

export function criarRepositorioClientes(config, { Pool = pg.Pool } = {}) {
  let pool;

  // Pool criado uma vez por ambiente de execução e reaproveitado entre
  // invocações "quentes". max = 2 porque cada instância da Lambda atende uma
  // requisição por vez; o limite protege as conexões do db.t3.micro.
  const obterPool = () => {
    pool ??= new Pool({
      host: config.host,
      port: config.porta,
      database: config.banco,
      user: config.usuario,
      password: config.senha,
      ssl: configurarSsl(config.ssl),
      max: 2,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 3_000,
      statement_timeout: 3_000,
    });
    return pool;
  };

  return {
    async buscarPorCpf(cpf) {
      const { rows } = await obterPool().query(CONSULTA_POR_CPF, [cpf]);
      return rows[0] ?? null;
    },
  };
}
