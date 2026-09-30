import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { configurarSsl, criarRepositorioClientes } from '../src/dados/clientes.mjs';
import { lerConfiguracaoBanco, lerConfiguracaoToken } from '../src/infra/config.mjs';

describe('lerConfiguracaoBanco', () => {
  const completo = { DB_HOST: 'rds', DB_NAME: 'gearup_homolog', DB_USER: 'gearup', DB_PASSWORD: 'x' };

  it('usa porta 5432 e SSL obrigatório por padrão', () => {
    const config = lerConfiguracaoBanco(completo);

    assert.equal(config.porta, 5432);
    assert.equal(config.ssl, 'require');
  });

  it('falha com mensagem clara quando falta variável', () => {
    assert.throws(() => lerConfiguracaoBanco({ ...completo, DB_HOST: '' }), /DB_HOST/);
  });
});

describe('lerConfiguracaoToken', () => {
  it('aplica os mesmos padrões da API', () => {
    const config = lerConfiguracaoToken({ JWT_KEY: 'k' });

    assert.equal(config.emissor, 'GearUp');
    assert.equal(config.audiencia, 'GearUp.Clients');
    assert.equal(config.minutos, 60);
  });

  it('exige JWT_KEY', () => {
    assert.throws(() => lerConfiguracaoToken({}), /JWT_KEY/);
  });
});

describe('configurarSsl', () => {
  it('desliga TLS apenas quando pedido explicitamente', () => {
    assert.equal(configurarSsl('disable'), false);
  });

  it('usa o bundle de CAs do RDS quando presente', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'ca-'));
    const arquivo = join(pasta, 'ca.pem');
    writeFileSync(arquivo, 'CERT');

    assert.deepEqual(configurarSsl('require', arquivo), { ca: 'CERT' });
  });

  it('sem bundle, continua validando o certificado', () => {
    assert.deepEqual(configurarSsl('require', join(tmpdir(), 'inexistente.pem')), { rejectUnauthorized: true });
  });
});

describe('criarRepositorioClientes', () => {
  it('consulta por Documento com parâmetro e reaproveita o pool', async () => {
    const criados = [];
    class PoolFake {
      constructor(opcoes) { this.opcoes = opcoes; this.consultas = []; criados.push(this); }
      async query(sql, parametros) {
        this.consultas.push({ sql, parametros });
        return { rows: [{ id: 'c1', nome: 'Maria', ativo: true, hashesSenha: ['h'] }] };
      }
    }
    const repositorio = criarRepositorioClientes(
      { host: 'h', porta: 5432, banco: 'b', usuario: 'u', senha: 's', ssl: 'disable' },
      { Pool: PoolFake },
    );

    const primeiro = await repositorio.buscarPorCpf('52998224725');
    await repositorio.buscarPorCpf('11144477735');

    assert.deepEqual(primeiro, { id: 'c1', nome: 'Maria', ativo: true, hashesSenha: ['h'] });
    assert.match(criados[0].consultas[0].sql, /"Perfil" = 4/);
    assert.equal(criados.length, 1);
    assert.equal(criados[0].opcoes.max, 2);
    assert.match(criados[0].consultas[0].sql, /"Documento" = \$1/);
    assert.deepEqual(criados[0].consultas[0].parametros, ['52998224725']);
  });

  it('devolve null quando o cliente não existe', async () => {
    class PoolVazio { async query() { return { rows: [] }; } }
    const repositorio = criarRepositorioClientes({ ssl: 'disable' }, { Pool: PoolVazio });

    assert.equal(await repositorio.buscarPorCpf('93541134780'), null);
  });
});
