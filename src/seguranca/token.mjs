import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

// Emite e valida o JWT consumido pela API GearUp.
//
// O token precisa ser indistinguível do emitido por /api/autenticacao/login
// (GearUp.Infrastructure/Security/TokenService.cs): mesmo algoritmo (HS256),
// mesma chave, issuer e audience, e as claims que a API lê:
//   role        -> ClaimTypes.Role, usado em [Authorize(Roles = "...Cliente...")]
//   cliente_id  -> ClaimsPrincipalExtensions.ObterClienteId (acesso às próprias OS)
//   unique_name -> ClaimTypes.Name

const codificador = new TextEncoder();
const TAMANHO_MINIMO_CHAVE = 32;

export function criarServicoToken({
  chave,
  emissor = 'GearUp',
  audiencia = 'GearUp.Clients',
  minutos = 60,
  agora = () => new Date(),
}) {
  if (!chave || codificador.encode(chave).length < TAMANHO_MINIMO_CHAVE) {
    throw new Error(`JWT_KEY deve possuir pelo menos ${TAMANHO_MINIMO_CHAVE} bytes.`);
  }

  const segredo = codificador.encode(chave);

  return {
    async emitir(cliente) {
      const emitidoEm = Math.floor(agora().getTime() / 1000);
      const expiraEm = emitidoEm + minutos * 60;

      const token = await new SignJWT({
        role: 'Cliente',
        unique_name: cliente.nome,
        cliente_id: cliente.id,
        amr: 'cpf',
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(cliente.id)
        .setIssuer(emissor)
        .setAudience(audiencia)
        .setIssuedAt(emitidoEm)
        .setNotBefore(emitidoEm)
        .setExpirationTime(expiraEm)
        .setJti(randomUUID())
        .sign(segredo);

      return { token, expiraEm: new Date(expiraEm * 1000).toISOString() };
    },

    async validar(token) {
      const { payload } = await jwtVerify(token, segredo, {
        issuer: emissor,
        audience: audiencia,
        algorithms: ['HS256'],
        clockTolerance: 30, // mesmo ClockSkew da API
        currentDate: agora(),
      });
      return payload;
    },
  };
}
