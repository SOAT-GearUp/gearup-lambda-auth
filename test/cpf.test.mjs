import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cpfValido, mascararCpf, somenteDigitos } from '../src/dominio/cpf.mjs';

describe('cpfValido', () => {
  it('aceita CPF válido sem formatação', () => {
    assert.equal(cpfValido('52998224725'), true);
  });

  it('aceita CPF válido com pontos, traço e espaços', () => {
    assert.equal(cpfValido(' 529.982.247-25 '), true);
  });

  it('aceita CPF numérico', () => {
    assert.equal(cpfValido(11144477735), true);
  });

  it('rejeita dígito verificador errado', () => {
    assert.equal(cpfValido('52998224726'), false);
  });

  it('rejeita todos os dígitos iguais', () => {
    assert.equal(cpfValido('11111111111'), false);
  });

  it('rejeita tamanho diferente de 11', () => {
    assert.equal(cpfValido('5299822472'), false);
    assert.equal(cpfValido('529982247250'), false);
  });

  it('rejeita caracteres fora do formato de CPF', () => {
    assert.equal(cpfValido('529a982247-25'), false);
    assert.equal(cpfValido("52998224725' OR 1=1"), false);
  });

  it('rejeita valores ausentes ou de outro tipo', () => {
    assert.equal(cpfValido(undefined), false);
    assert.equal(cpfValido(null), false);
    assert.equal(cpfValido({}), false);
    assert.equal(cpfValido(''), false);
  });
});

describe('somenteDigitos', () => {
  it('remove a formatação', () => {
    assert.equal(somenteDigitos('529.982.247-25'), '52998224725');
  });

  it('devolve vazio para tipos não suportados', () => {
    assert.equal(somenteDigitos(undefined), '');
  });
});

describe('mascararCpf', () => {
  it('mantém só os dígitos centrais', () => {
    assert.equal(mascararCpf('52998224725'), '***.982.247-**');
  });

  it('não expõe nada de valores inválidos', () => {
    assert.equal(mascararCpf('123'), '***');
  });
});
