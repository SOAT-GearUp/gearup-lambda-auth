import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { criarServicoToken } from '../src/seguranca/token.mjs';

const CHAVE = 'chave-de-teste-com-pelo-menos-32-bytes!!';
const CLIENTE = { id: '8d1f7a52-3f0e-4c1e-9d59-2c1a6a3f9b10', nome: 'Maria Souza' };

describe('criarServicoToken', () => {
  it('rejeita chave com menos de 32 bytes', () => {
    assert.throws(() => criarServicoToken({ chave: 'curta' }), /32 bytes/);
    assert.throws(() => criarServicoToken({ chave: '' }), /32 bytes/);
  });

  it('emite JWT HS256 com as claims que a API GearUp espera', async () => {
    const agora = new Date('2026-09-29T12:00:00Z');
    const servico = criarServicoToken({ chave: CHAVE, minutos: 60, agora: () => agora });

    const { token, expiraEm } = await servico.emitir(CLIENTE);
    const claims = decodeJwt(token);

    assert.equal(decodeProtectedHeader(token).alg, 'HS256');
    assert.equal(claims.iss, 'GearUp');
    assert.equal(claims.aud, 'GearUp.Clients');
    assert.equal(claims.sub, CLIENTE.id);
    assert.equal(claims.cliente_id, CLIENTE.id);
    assert.equal(claims.role, 'Cliente');
    assert.equal(claims.unique_name, CLIENTE.nome);
    assert.equal(claims.amr, 'cpf');
    assert.ok(claims.jti);
    assert.equal(claims.exp - claims.iat, 3600);
    assert.equal(expiraEm, '2026-09-29T13:00:00.000Z');
  });

  it('valida um token emitido com a mesma chave', async () => {
    const servico = criarServicoToken({ chave: CHAVE });
    const { token } = await servico.emitir(CLIENTE);

    const claims = await servico.validar(token);

    assert.equal(claims.cliente_id, CLIENTE.id);
  });

  it('rejeita token assinado com outra chave', async () => {
    const outro = criarServicoToken({ chave: `${CHAVE}-diferente` });
    const { token } = await outro.emitir(CLIENTE);

    await assert.rejects(criarServicoToken({ chave: CHAVE }).validar(token));
  });

  it('rejeita token de outra audiência', async () => {
    const outro = criarServicoToken({ chave: CHAVE, audiencia: 'OutraApi' });
    const { token } = await outro.emitir(CLIENTE);

    await assert.rejects(criarServicoToken({ chave: CHAVE }).validar(token));
  });

  it('rejeita token expirado além da tolerância de 30s', async () => {
    const emissao = new Date('2026-09-29T12:00:00Z');
    const { token } = await criarServicoToken({ chave: CHAVE, minutos: 1, agora: () => emissao }).emitir(CLIENTE);

    const depois = new Date('2026-09-29T12:01:31Z');
    await assert.rejects(criarServicoToken({ chave: CHAVE, agora: () => depois }).validar(token), { code: 'ERR_JWT_EXPIRED' });
  });
});
