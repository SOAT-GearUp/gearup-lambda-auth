// Logs estruturados em JSON (uma linha por evento), no mesmo espírito do
// AddJsonConsole da API. Escrevemos direto no stdout para que o runtime da
// Lambda não embrulhe a linha em outro JSON: o CloudWatch Logs Insights
// indexa os campos (correlationId, resultado, clienteId...) automaticamente.

export function criarLogger(contexto = {}, escrever = (linha) => process.stdout.write(`${linha}\n`)) {
  const registrar = (nivel, mensagem, extra = {}) => {
    escrever(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: nivel,
      service: process.env.SERVICO ?? 'gearup-auth-cpf',
      env: process.env.AMBIENTE ?? 'local',
      message: mensagem,
      ...contexto,
      ...extra,
    }));
  };

  return {
    info: (mensagem, extra) => registrar('info', mensagem, extra),
    warn: (mensagem, extra) => registrar('warn', mensagem, extra),
    error: (mensagem, extra) => registrar('error', mensagem, extra),
    com: (extra) => criarLogger({ ...contexto, ...extra }, escrever),
  };
}
