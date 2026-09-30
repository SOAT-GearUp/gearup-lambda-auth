// Entry point da função gearup-auth-cpf-<ambiente> (handler: src/autenticar.handler).
// As dependências são montadas uma vez por ambiente de execução e
// reaproveitadas nas invocações "quentes" (pool de conexões incluso).
import { criarHandlerAutenticacao } from './autenticacao.mjs';
import { criarRepositorioClientes } from './dados/clientes.mjs';
import { lerConfiguracaoBanco, lerConfiguracaoToken } from './infra/config.mjs';
import { criarLogger } from './infra/logger.mjs';
import { criarServicoToken } from './seguranca/token.mjs';

let processar;

export const handler = async (evento) => {
  processar ??= criarHandlerAutenticacao({
    repositorio: criarRepositorioClientes(lerConfiguracaoBanco()),
    servicoToken: criarServicoToken(lerConfiguracaoToken()),
    logger: criarLogger(),
  });
  return processar(evento);
};
