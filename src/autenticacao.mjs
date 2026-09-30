import { cpfValido, mascararCpf, somenteDigitos } from './dominio/cpf.mjs';
import { erro, lerCorpoJson, obterCorrelationId, resposta } from './infra/http.mjs';

// POST /auth/cpf  { "cpf": "123.456.789-09" }
//
//   1. valida o CPF (formato e dígitos verificadores)       -> 400 CPF_INVALIDO
//   2. consulta a existência do cliente na base              -> 404 CLIENTE_NAO_ENCONTRADO
//   3. consulta o status do cliente (Ativo)                  -> 403 CLIENTE_INATIVO
//   4. gera e devolve o JWT para consumo das APIs protegidas -> 200
//      (mesmo formato do /api/autenticacao/login: accessToken + expiraEm)
//
// Falha de banco vira 503 BANCO_INDISPONIVEL (log level=error, que alimenta o
// alarme do CloudWatch), nunca um 500 com stack trace para o cliente.
export function criarHandlerAutenticacao({ repositorio, servicoToken, logger }) {
  return async (evento) => {
    const correlationId = obterCorrelationId(evento);
    const log = logger.com({ correlationId, rota: 'POST /auth/cpf' });
    const inicio = Date.now();

    let corpo;
    try {
      corpo = lerCorpoJson(evento);
    } catch {
      log.warn('Corpo da requisição não é um JSON válido.', { resultado: 'corpo_invalido' });
      return erro(400, 'CORPO_INVALIDO', 'Envie um JSON no formato {"cpf": "..."}.', correlationId);
    }

    if (!cpfValido(corpo?.cpf)) {
      log.warn('CPF inválido.', { resultado: 'cpf_invalido' });
      return erro(400, 'CPF_INVALIDO', 'O CPF informado é inválido.', correlationId);
    }

    const cpf = somenteDigitos(corpo.cpf);
    const cpfMascarado = mascararCpf(cpf);

    let cliente;
    try {
      cliente = await repositorio.buscarPorCpf(cpf);
    } catch (falha) {
      log.error('Falha ao consultar o cliente no banco de dados.', {
        resultado: 'erro_banco',
        erro: falha?.message,
        codigoErro: falha?.code,
        duracaoMs: Date.now() - inicio,
      });
      return erro(503, 'BANCO_INDISPONIVEL', 'Não foi possível validar o cliente no momento. Tente novamente.', correlationId);
    }

    if (!cliente) {
      log.warn('Cliente não encontrado.', { resultado: 'nao_encontrado', cpf: cpfMascarado });
      return erro(404, 'CLIENTE_NAO_ENCONTRADO', 'Não existe cliente cadastrado com este CPF.', correlationId);
    }

    if (!cliente.ativo) {
      log.warn('Cliente inativo tentou autenticar.', { resultado: 'inativo', cpf: cpfMascarado, clienteId: cliente.id });
      return erro(403, 'CLIENTE_INATIVO', 'O cadastro deste cliente está inativo.', correlationId);
    }

    const { token, expiraEm } = await servicoToken.emitir(cliente);

    log.info('Token emitido para o cliente.', {
      resultado: 'sucesso',
      cpf: cpfMascarado,
      clienteId: cliente.id,
      duracaoMs: Date.now() - inicio,
    });

    return resposta(200, {
      accessToken: token,
      tipo: 'Bearer',
      expiraEm,
      cliente: { id: cliente.id, nome: cliente.nome },
    }, correlationId);
  };
}
