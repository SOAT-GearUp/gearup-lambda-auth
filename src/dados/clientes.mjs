import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

// Consulta de leitura direto na tabela da API. A Lambda não grava nada: a
// escrita de clientes continua exclusiva do agregado Cliente na API.
//
// "Documento" tem índice único (UX_Clientes_Documento), então a busca é um
// index scan de uma linha. "Ativo" = false indica cliente excluído
// (exclusão lógica em Cliente.Excluir()).
const CONSULTA_POR_CPF = `
  SELECT "Id"::text AS id, "Nome" AS nome, "Ativo" AS ativo
    FROM "Clientes"
   WHERE "Documento" = $1
   LIMIT 1`;

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
