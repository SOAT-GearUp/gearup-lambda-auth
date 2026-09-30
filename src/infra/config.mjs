// Configuração lida das variáveis de ambiente definidas pelo Terraform
// (terraform/lambda.tf) a partir do SSM Parameter Store.

function obrigatoria(ambiente, nome) {
  const valor = ambiente[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não configurada.`);
  return valor;
}

export function lerConfiguracaoBanco(ambiente = process.env) {
  return {
    host: obrigatoria(ambiente, 'DB_HOST'),
    porta: Number(ambiente.DB_PORT ?? 5432),
    banco: obrigatoria(ambiente, 'DB_NAME'),
    usuario: obrigatoria(ambiente, 'DB_USER'),
    senha: obrigatoria(ambiente, 'DB_PASSWORD'),
    ssl: ambiente.DB_SSL ?? 'require',
  };
}

export function lerConfiguracaoToken(ambiente = process.env) {
  return {
    chave: obrigatoria(ambiente, 'JWT_KEY'),
    emissor: ambiente.JWT_ISSUER ?? 'GearUp',
    audiencia: ambiente.JWT_AUDIENCE ?? 'GearUp.Clients',
    minutos: Number(ambiente.JWT_EXPIRATION_MINUTES ?? 60),
  };
}
