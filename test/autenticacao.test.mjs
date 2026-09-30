import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeJwt } from 'jose';
import { criarHandlerAutenticacao } from '../src/autenticacao.mjs';
import { criarServicoToken } from '../src/seguranca/token.mjs';
import { criarLoggerEmMemoria, criarRepositorioFake, eventoHttp } from './apoio.mjs';

const CHAVE = 'chave-de-teste-com-pelo-menos-32-bytes!!';
const ATIVO = { id: '8d1f7a52-3f0e-4c1e-9d59-2c1a6a3f9b10', nome: 'Maria Souza', ativo: true };
const INATIVO = { id: '0b8e2c4d-1111-4c1e-9d59-2c1a6a3f9b10', nome: 'João Lima', ativo: false };

function montar(clientes = { '52998224725': ATIVO, '11144477735': INATIVO }) {
  const repositorio = criarRepositorioFake(clientes);
  const { logger, linhas } = criarLoggerEmMemoria();
  const handler = criarHandlerAutenticacao({ repositorio, servicoToken: criarServicoToken({ chave: CHAVE }), logger });
  return { handler, repositorio, linhas };
}

const corpoDe = (resposta) => JSON.parse(resposta.body);

describe('POST /auth/cpf', () => {
  it('Autenticar_ClienteAtivo_DeveDevolverTokenDoCliente', async () => {
    const { handler, repositorio } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '529.982.247-25' } }));
    const corpo = corpoDe(resposta);

    assert.equal(resposta.statusCode, 200);
    assert.equal(corpo.tipo, 'Bearer');
    assert.deepEqual(corpo.cliente, { id: ATIVO.id, nome: ATIVO.nome });
    assert.equal(decodeJwt(corpo.accessToken).cliente_id, ATIVO.id);
    assert.deepEqual(repositorio.consultas, ['52998224725']);
  });

  it('Autenticar_CorpoEmBase64_DeveSerDecodificado', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725' }, base64: true }));

    assert.equal(resposta.statusCode, 200);
  });

  it('Autenticar_CpfInvalido_DeveDevolver400SemConsultarBanco', async () => {
    const { handler, repositorio } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '12345678900' } }));

    assert.equal(resposta.statusCode, 400);
    assert.equal(corpoDe(resposta).code, 'CPF_INVALIDO');
    assert.equal(repositorio.consultas.length, 0);
  });

  it('Autenticar_SemCpf_DeveDevolver400', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp());

    assert.equal(resposta.statusCode, 400);
    assert.equal(corpoDe(resposta).code, 'CPF_INVALIDO');
  });

  it('Autenticar_CorpoNaoJson_DeveDevolver400', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: 'cpf=52998224725' }));

    assert.equal(resposta.statusCode, 400);
    assert.equal(corpoDe(resposta).code, 'CORPO_INVALIDO');
  });

  it('Autenticar_ClienteInexistente_DeveDevolver404', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '93541134780' } }));

    assert.equal(resposta.statusCode, 404);
    assert.equal(corpoDe(resposta).code, 'CLIENTE_NAO_ENCONTRADO');
  });

  it('Autenticar_ClienteInativo_DeveDevolver403', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '11144477735' } }));

    assert.equal(resposta.statusCode, 403);
    assert.equal(corpoDe(resposta).code, 'CLIENTE_INATIVO');
  });

  it('Autenticar_BancoIndisponivel_DeveDevolver503ELogarErro', async () => {
    const { logger, linhas } = criarLoggerEmMemoria();
    const repositorio = { buscarPorCpf: async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); } };
    const handler = criarHandlerAutenticacao({ repositorio, servicoToken: criarServicoToken({ chave: CHAVE }), logger });

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725' } }));

    assert.equal(resposta.statusCode, 503);
    assert.equal(corpoDe(resposta).code, 'BANCO_INDISPONIVEL');
    assert.equal(linhas.at(-1).level, 'error');
    assert.equal(linhas.at(-1).codigoErro, 'ETIMEDOUT');
  });

  it('Autenticar_ComCorrelationId_DevePropagarNaRespostaENosLogs', async () => {
    const { handler, linhas } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725' }, cabecalhos: { 'x-correlation-id': 'abc-123' } }));

    assert.equal(resposta.headers['x-correlation-id'], 'abc-123');
    assert.equal(linhas.at(-1).correlationId, 'abc-123');
  });

  it('Autenticar_CorrelationIdInseguro_DeveUsarRequestIdDoGateway', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725' }, cabecalhos: { 'x-correlation-id': '<script>' } }));

    assert.equal(resposta.headers['x-correlation-id'], 'req-123');
  });

  it('Autenticar_QualquerResultado_NaoDeveLogarCpfCompleto', async () => {
    const { handler, linhas } = montar();

    await handler(eventoHttp({ corpo: { cpf: '52998224725' } }));
    await handler(eventoHttp({ corpo: { cpf: '93541134780' } }));

    const texto = JSON.stringify(linhas);
    assert.equal(texto.includes('52998224725'), false);
    assert.equal(texto.includes('93541134780'), false);
  });
});
