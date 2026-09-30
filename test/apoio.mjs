// Fakes e utilitários compartilhados pelos testes.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { criarLogger } from '../src/infra/logger.mjs';

// Mesmo formato do PasswordHasher da API, com poucas iterações para os testes
// ficarem rápidos (as 210.000 reais são cobertas pelo fixture do .NET).
export async function gerarHash(senha, iteracoes = 1_000) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(senha, salt, iteracoes, 32, 'sha256');
  return `PBKDF2-SHA256$${iteracoes}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function criarLoggerEmMemoria() {
  const linhas = [];
  const logger = criarLogger({}, (linha) => linhas.push(JSON.parse(linha)));
  return { logger, linhas };
}

export function criarRepositorioFake(clientes = {}) {
  const consultas = [];
  return {
    consultas,
    async buscarPorCpf(cpf) {
      consultas.push(cpf);
      return clientes[cpf] ?? null;
    },
  };
}

export function eventoHttp({ corpo, cabecalhos = {}, base64 = false } = {}) {
  const texto = corpo === undefined ? undefined : typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
  return {
    version: '2.0',
    routeKey: 'POST /auth/cpf',
    headers: cabecalhos,
    requestContext: { requestId: 'req-123' },
    body: base64 && texto ? Buffer.from(texto).toString('base64') : texto,
    isBase64Encoded: base64,
  };
}
