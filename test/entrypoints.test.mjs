import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Os entry points leem a configuração das variáveis de ambiente, exatamente
// como na Lambda. Nenhum dos cenários abaixo chega a abrir conexão com o banco.
process.env.JWT_KEY = 'chave-de-teste-com-pelo-menos-32-bytes!!';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'gearup_test';
process.env.DB_USER = 'gearup';
process.env.DB_PASSWORD = 'senha';

describe('entry points das funções', () => {
  it('autenticar.handler rejeita CPF inválido sem tocar no banco', async () => {
    const { handler } = await import('../src/autenticar.mjs');

    const resposta = await handler({ body: JSON.stringify({ cpf: '000' }), headers: {}, requestContext: { requestId: 'r' } });

    assert.equal(resposta.statusCode, 400);
  });

  it('autorizador.handler nega requisição sem token', async () => {
    const { handler } = await import('../src/autorizador.mjs');

    const resultado = await handler({ headers: {}, requestContext: { requestId: 'r' } });

    assert.deepEqual(resultado, { isAuthorized: false });
  });
});
