// Fakes e utilitários compartilhados pelos testes.
import { criarLogger } from '../src/infra/logger.mjs';

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
