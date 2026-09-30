// Entry point da função gearup-autorizador-<ambiente> (handler: src/autorizador.handler).
// Não acessa o banco, por isso roda fora da VPC (sem cold start de ENI).
import { criarHandlerAutorizacao } from './autorizacao.mjs';
import { lerConfiguracaoToken } from './infra/config.mjs';
import { criarLogger } from './infra/logger.mjs';
import { criarServicoToken } from './seguranca/token.mjs';

let processar;

export const handler = async (evento) => {
  processar ??= criarHandlerAutorizacao({
    servicoToken: criarServicoToken(lerConfiguracaoToken()),
    logger: criarLogger({ funcao: 'autorizador' }),
  });
  return processar(evento);
};
