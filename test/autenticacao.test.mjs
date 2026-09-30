import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { decodeJwt } from 'jose';
import { criarHandlerAutenticacao } from '../src/autenticacao.mjs';
import { criarServicoToken } from '../src/seguranca/token.mjs';
import { criarLoggerEmMemoria, criarRepositorioFake, eventoHttp, gerarHash } from './apoio.mjs';

const CHAVE = 'chave-de-teste-com-pelo-menos-32-bytes!!';
const SENHA = 'SenhaCliente@123';

let ATIVO;
let SEM_USUARIO;
let INATIVO;

before(async () => {
  ATIVO = { id: '8d1f7a52-3f0e-4c1e-9d59-2c1a6a3f9b10', nome: 'Maria Souza', ativo: true, hashesSenha: [await gerarHash(SENHA)] };
  SEM_USUARIO = { id: '5a0c3d11-2222-4c1e-9d59-2c1a6a3f9b10', nome: 'Ana Reis', ativo: true, hashesSenha: [] };
  INATIVO = { id: '0b8e2c4d-1111-4c1e-9d59-2c1a6a3f9b10', nome: 'João Lima', ativo: false, hashesSenha: [await gerarHash(SENHA)] };
});

function montar() {
  const repositorio = criarRepositorioFake({ '52998224725': ATIVO, '11144477735': INATIVO, '71428793860': SEM_USUARIO });
  const { logger, linhas } = criarLoggerEmMemoria();
  const handler = criarHandlerAutenticacao({ repositorio, servicoToken: criarServicoToken({ chave: CHAVE }), logger });
  return { handler, repositorio, linhas };
}

const corpoDe = (resposta) => JSON.parse(resposta.body);

describe('POST /auth/cpf', () => {
  it('Autenticar_CpfESenhaCorretos_DeveDevolverTokenDoCliente', async () => {
    const { handler, repositorio } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '529.982.247-25', senha: SENHA } }));
    const corpo = corpoDe(resposta);

    assert.equal(resposta.statusCode, 200);
    assert.equal(corpo.tipo, 'Bearer');
    assert.deepEqual(corpo.cliente, { id: ATIVO.id, nome: ATIVO.nome });
    assert.equal(decodeJwt(corpo.accessToken).cliente_id, ATIVO.id);
    assert.deepEqual(repositorio.consultas, ['52998224725']);
  });

  it('Autenticar_CorpoEmBase64_DeveSerDecodificado', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: SENHA }, base64: true }));

    assert.equal(resposta.statusCode, 200);
  });

  it('Autenticar_SenhaErrada_DeveDevolver401', async () => {
    const { handler, linhas } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: 'senha-errada' } }));

    assert.equal(resposta.statusCode, 401);
    assert.equal(corpoDe(resposta).code, 'CREDENCIAIS_INVALIDAS');
    assert.equal(linhas.at(-1).possuiUsuario, true);
  });

  it('Autenticar_ClienteSemUsuario_DeveDevolverOMesmo401DaSenhaErrada', async () => {
    const { handler } = montar();

    const semUsuario = await handler(eventoHttp({ corpo: { cpf: '714.287.938-60', senha: SENHA } }));
    const senhaErrada = await handler(eventoHttp({ corpo: { cpf: '529.982.247-25', senha: 'senha-errada' } }));

    assert.equal(semUsuario.statusCode, 401);
    assert.deepEqual(
      { ...corpoDe(semUsuario), correlationId: null },
      { ...corpoDe(senhaErrada), correlationId: null },
    );
  });

  it('Autenticar_SemSenha_DeveDevolver400SemConsultarBanco', async () => {
    const { handler, repositorio } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725' } }));

    assert.equal(resposta.statusCode, 400);
    assert.equal(corpoDe(resposta).code, 'SENHA_OBRIGATORIA');
    assert.equal(repositorio.consultas.length, 0);
  });

  it('Autenticar_CpfInvalido_DeveDevolver400SemConsultarBanco', async () => {
    const { handler, repositorio } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '12345678900', senha: SENHA } }));

    assert.equal(resposta.statusCode, 400);
    assert.equal(corpoDe(resposta).code, 'CPF_INVALIDO');
    assert.equal(repositorio.consultas.length, 0);
  });

  it('Autenticar_SemCorpo_DeveDevolver400', async () => {
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

    const resposta = await handler(eventoHttp({ corpo: { cpf: '93541134780', senha: SENHA } }));

    assert.equal(resposta.statusCode, 404);
    assert.equal(corpoDe(resposta).code, 'CLIENTE_NAO_ENCONTRADO');
  });

  it('Autenticar_ClienteInativo_DeveDevolver403MesmoComSenhaCorreta', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '11144477735', senha: SENHA } }));

    assert.equal(resposta.statusCode, 403);
    assert.equal(corpoDe(resposta).code, 'CLIENTE_INATIVO');
  });

  it('Autenticar_BancoIndisponivel_DeveDevolver503ELogarErro', async () => {
    const { logger, linhas } = criarLoggerEmMemoria();
    const repositorio = { buscarPorCpf: async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); } };
    const handler = criarHandlerAutenticacao({ repositorio, servicoToken: criarServicoToken({ chave: CHAVE }), logger });

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: SENHA } }));

    assert.equal(resposta.statusCode, 503);
    assert.equal(corpoDe(resposta).code, 'BANCO_INDISPONIVEL');
    assert.equal(linhas.at(-1).level, 'error');
    assert.equal(linhas.at(-1).codigoErro, 'ETIMEDOUT');
  });

  it('Autenticar_ComCorrelationId_DevePropagarNaRespostaENosLogs', async () => {
    const { handler, linhas } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: SENHA }, cabecalhos: { 'x-correlation-id': 'abc-123' } }));

    assert.equal(resposta.headers['x-correlation-id'], 'abc-123');
    assert.equal(linhas.at(-1).correlationId, 'abc-123');
  });

  it('Autenticar_CorrelationIdInseguro_DeveUsarRequestIdDoGateway', async () => {
    const { handler } = montar();

    const resposta = await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: SENHA }, cabecalhos: { 'x-correlation-id': '<script>' } }));

    assert.equal(resposta.headers['x-correlation-id'], 'req-123');
  });

  it('Autenticar_QualquerResultado_NaoDeveLogarCpfCompletoNemSenha', async () => {
    const { handler, linhas } = montar();

    await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: SENHA } }));
    await handler(eventoHttp({ corpo: { cpf: '52998224725', senha: 'senha-errada' } }));
    await handler(eventoHttp({ corpo: { cpf: '93541134780', senha: SENHA } }));

    const texto = JSON.stringify(linhas);
    for (const segredo of ['52998224725', '93541134780', SENHA, 'senha-errada']) {
      assert.equal(texto.includes(segredo), false, `vazou nos logs: ${segredo}`);
    }
  });
});
