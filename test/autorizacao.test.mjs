import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarHandlerAutorizacao } from '../src/autorizacao.mjs';
import { criarServicoToken } from '../src/seguranca/token.mjs';
import { criarLoggerEmMemoria } from './apoio.mjs';

const CHAVE = 'chave-de-teste-com-pelo-menos-32-bytes!!';
const servicoToken = criarServicoToken({ chave: CHAVE });

function montar() {
  const { logger, linhas } = criarLoggerEmMemoria();
  return { handler: criarHandlerAutorizacao({ servicoToken, logger }), linhas };
}

const evento = (authorization) => ({
  routeKey: 'ANY /api/{proxy+}',
  headers: authorization === undefined ? {} : { authorization },
  requestContext: { requestId: 'req-1' },
});

describe('Autorizador do API Gateway', () => {
  it('Autorizar_TokenValido_DevePermitirComContexto', async () => {
    const { handler } = montar();
    const { token } = await servicoToken.emitir({ id: 'c1', nome: 'Maria' });

    const resultado = await handler(evento(`Bearer ${token}`));

    assert.equal(resultado.isAuthorized, true);
    assert.deepEqual(resultado.context, { sub: 'c1', perfil: 'Cliente', metodo: 'cpf' });
  });

  it('Autorizar_EsquemaMinusculo_DevePermitir', async () => {
    const { handler } = montar();
    const { token } = await servicoToken.emitir({ id: 'c1', nome: 'Maria' });

    const resultado = await handler(evento(`bearer ${token}`));

    assert.equal(resultado.isAuthorized, true);
  });

  it('Autorizar_SemCabecalho_DeveNegar', async () => {
    const { handler, linhas } = montar();

    const resultado = await handler(evento());

    assert.equal(resultado.isAuthorized, false);
    assert.equal(linhas.at(-1).resultado, 'sem_token');
  });

  it('Autorizar_EsquemaDiferenteDeBearer_DeveNegar', async () => {
    const { handler } = montar();

    const resultado = await handler(evento('Basic dXNlcjpzZW5oYQ=='));

    assert.equal(resultado.isAuthorized, false);
  });

  it('Autorizar_TokenAdulterado_DeveNegar', async () => {
    const { handler, linhas } = montar();
    const { token } = await servicoToken.emitir({ id: 'c1', nome: 'Maria' });

    const resultado = await handler(evento(`Bearer ${token.slice(0, -2)}xx`));

    assert.equal(resultado.isAuthorized, false);
    assert.equal(linhas.at(-1).resultado, 'token_invalido');
  });
});
