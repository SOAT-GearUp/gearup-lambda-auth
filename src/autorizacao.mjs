import { obterCorrelationId } from './infra/http.mjs';

// Lambda authorizer do API Gateway (HTTP API, payload 2.0, respostas simples).
//
// Barra na borda qualquer chamada a /api/* sem um JWT válido — assinatura,
// issuer, audience e expiração — antes que ela chegue ao cluster. Aceita
// tanto o token de cliente (emitido por /auth/cpf) quanto o de funcionário
// (emitido por /api/autenticacao/login), pois ambos usam a mesma chave.
//
// A autorização por perfil (Roles) continua na API: o gateway garante
// "quem é", a API decide "o que pode".
export function criarHandlerAutorizacao({ servicoToken, logger }) {
  return async (evento) => {
    const log = logger.com({ correlationId: obterCorrelationId(evento), rota: evento?.routeKey });
    const cabecalho = evento?.headers?.authorization ?? '';
    const [esquema, token] = cabecalho.split(' ');

    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      log.warn('Requisição sem token Bearer.', { resultado: 'sem_token' });
      return { isAuthorized: false };
    }

    try {
      const claims = await servicoToken.validar(token);
      return {
        isAuthorized: true,
        // Disponível no gateway como $context.authorizer.<campo> (access logs).
        context: {
          sub: String(claims.sub ?? ''),
          perfil: String(claims.role ?? ''),
          metodo: String(claims.amr ?? 'senha'),
        },
      };
    } catch (falha) {
      log.warn('Token rejeitado.', { resultado: 'token_invalido', motivo: falha?.code ?? falha?.message });
      return { isAuthorized: false };
    }
  };
}
