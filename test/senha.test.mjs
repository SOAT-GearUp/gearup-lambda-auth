import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { senhaInformada, verificarContraAlgum, verificarSenha } from '../src/seguranca/senha.mjs';
import { gerarHash } from './apoio.mjs';

// Gerado pelo .NET com o mesmo algoritmo de GearUp.Infrastructure/Security/PasswordHasher.cs
// (Rfc2898DeriveBytes.Pbkdf2, SHA-256, 210.000 iterações, salt de 16 bytes, hash de 32 bytes)
// para a senha "SenhaCliente@123". Garante que a Lambda aceita as senhas gravadas pela API.
const HASH_GERADO_PELO_DOTNET = 'PBKDF2-SHA256$210000$ZumNEr0Wt5q86hsNdclbzw==$jScwAoaV1K6KYh99MDG5htfWt+cl+kxfPesxWPt9NGQ=';

describe('verificarSenha', () => {
  it('VerificarSenha_HashGeradoPeloDotNet_DeveAceitarSenhaCorreta', async () => {
    assert.equal(await verificarSenha('SenhaCliente@123', HASH_GERADO_PELO_DOTNET), true);
  });

  it('VerificarSenha_HashGeradoPeloDotNet_DeveRecusarSenhaErrada', async () => {
    assert.equal(await verificarSenha('SenhaCliente@124', HASH_GERADO_PELO_DOTNET), false);
  });

  it('VerificarSenha_HashGeradoNaLambda_DeveSeguirOMesmoFormato', async () => {
    const hash = await gerarHash('outra-senha', 1_000);

    assert.match(hash, /^PBKDF2-SHA256\$1000\$[^$]+\$[^$]+$/);
    assert.equal(await verificarSenha('outra-senha', hash), true);
  });

  it('VerificarSenha_HashMalformado_DeveRecusarSemLancarErro', async () => {
    for (const invalido of [
      undefined,
      '',
      'texto-qualquer',
      'PBKDF2-SHA256$abc$c2FsdA==$aGFzaA==',
      'PBKDF2-SHA256$-5$c2FsdA==$aGFzaA==',
      'PBKDF2-SHA256$1000$$aGFzaA==',
      'BCRYPT$1000$c2FsdA==$aGFzaA==',
    ]) {
      assert.equal(await verificarSenha('qualquer', invalido), false, `aceitou: ${invalido}`);
    }
  });
});

describe('verificarContraAlgum', () => {
  it('DeveAceitarQuandoAlgumDosHashesConfere', async () => {
    const hashes = [await gerarHash('errada', 1_000), await gerarHash('certa', 1_000)];

    assert.equal(await verificarContraAlgum('certa', hashes), true);
  });

  it('SemHashes_DeveRecusar', async () => {
    assert.equal(await verificarContraAlgum('qualquer', []), false);
    assert.equal(await verificarContraAlgum('qualquer', undefined), false);
  });
});

describe('senhaInformada', () => {
  it('ExigeTextoNaoVazioDeAte128Caracteres', () => {
    assert.equal(senhaInformada('abc'), true);
    assert.equal(senhaInformada('x'.repeat(128)), true);
    assert.equal(senhaInformada('x'.repeat(129)), false);
    assert.equal(senhaInformada(''), false);
    assert.equal(senhaInformada(undefined), false);
    assert.equal(senhaInformada(12345678), false);
  });
});
