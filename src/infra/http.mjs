// Utilitários para eventos HTTP API (payload 2.0) do API Gateway.

const CABECALHO_CORRELACAO = 'x-correlation-id';
const CORRELACAO_VALIDA = /^[A-Za-z0-9._-]{1,128}$/;

// Mesma regra do CorrelationIdMiddleware da API: aceita o X-Correlation-ID do
// cliente se for seguro; senão usa o requestId do API Gateway, que também
// aparece nos access logs do gateway.
export function obterCorrelationId(evento) {
  const recebido = evento?.headers?.[CABECALHO_CORRELACAO];
  if (recebido && CORRELACAO_VALIDA.test(recebido)) return recebido;
  return evento?.requestContext?.requestId ?? 'sem-correlacao';
}

export function lerCorpoJson(evento) {
  if (!evento?.body) return {};
  const texto = evento.isBase64Encoded
    ? Buffer.from(evento.body, 'base64').toString('utf8')
    : evento.body;
  return JSON.parse(texto);
}

export function resposta(status, corpo, correlationId) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(corpo),
  };
}

// Mesmo formato de erro da API (ErrorResponse em GlobalExceptionHandler.cs).
export function erro(status, codigo, mensagem, correlationId) {
  return resposta(status, { code: codigo, message: mensagem, correlationId }, correlationId);
}
