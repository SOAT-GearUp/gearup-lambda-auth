import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// Verificação de senha compatível com o PasswordHasher da API
// (GearUp.Infrastructure/Security/PasswordHasher.cs), que grava na coluna
// "Usuarios"."SenhaHash" o formato:
//
//   PBKDF2-SHA256$<iterações>$<salt base64>$<hash base64>
//
// A Lambda só verifica; quem cria e troca senhas continua sendo a API.

const derivar = promisify(pbkdf2);
const ALGORITMO = 'PBKDF2-SHA256';
const TAMANHO_MAXIMO_SENHA = 128;

export function senhaInformada(valor) {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= TAMANHO_MAXIMO_SENHA;
}

export async function verificarSenha(senha, hashArmazenado) {
  const partes = typeof hashArmazenado === 'string' ? hashArmazenado.split('$') : [];
  if (partes.length !== 4 || partes[0] !== ALGORITMO) return false;

  const iteracoes = Number(partes[1]);
  if (!Number.isInteger(iteracoes) || iteracoes <= 0) return false;

  const salt = Buffer.from(partes[2], 'base64');
  const esperado = Buffer.from(partes[3], 'base64');
  if (salt.length === 0 || esperado.length === 0) return false;

  const calculado = await derivar(senha, salt, iteracoes, esperado.length, 'sha256');
  return timingSafeEqual(calculado, esperado);
}

// Quando não há usuário para o cliente, ainda assim gastamos o mesmo tempo de
// um PBKDF2 real. Sem isso, "sem usuário" responderia visivelmente mais rápido
// que "senha errada", e o tempo de resposta revelaria qual dos dois aconteceu.
const HASH_FICTICIO = `${ALGORITMO}$210000$${randomBytes(16).toString('base64')}$${randomBytes(32).toString('base64')}`;

export async function verificarContraAlgum(senha, hashes) {
  if (!hashes?.length) {
    await verificarSenha(senha, HASH_FICTICIO);
    return false;
  }
  for (const hash of hashes) {
    if (await verificarSenha(senha, hash)) return true;
  }
  return false;
}
