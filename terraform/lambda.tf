# ---------------------------------------------------------------------------
# Funções serverless
#
#   gearup-auth-cpf-<amb> ...... POST /auth/cpf: valida CPF, consulta o cliente
#                                no RDS e emite o JWT. Roda na VPC (subnets
#                                privadas) para alcançar o banco.
#   gearup-autorizador-<amb> ... Lambda authorizer das rotas /api/*: valida o
#                                JWT. Fora da VPC (não acessa o banco).
#
# CUSTO: US$ 0 dentro do free tier (1 mi de requisições/mês). Sem NAT: a
# função na VPC não tem internet, e não precisa — só fala com o RDS.
# ---------------------------------------------------------------------------

resource "aws_security_group" "lambda" {
  name        = "${var.nome_projeto}-lambda-auth-${local.sufixo}"
  description = "Lambda de autenticacao: sem entrada; saida apenas para o PostgreSQL na VPC"
  vpc_id      = data.aws_vpc.plataforma.id
}

resource "aws_vpc_security_group_egress_rule" "lambda_postgres" {
  security_group_id = aws_security_group.lambda.id
  cidr_ipv4         = data.aws_vpc.plataforma.cidr_block
  ip_protocol       = "tcp"
  from_port         = 5432
  to_port           = 5432
  description       = "PostgreSQL (RDS)"
}

resource "aws_cloudwatch_log_group" "auth" {
  name              = "/aws/lambda/${var.nome_projeto}-auth-cpf-${local.sufixo}"
  retention_in_days = var.dias_retencao_logs
}

resource "aws_cloudwatch_log_group" "autorizador" {
  name              = "/aws/lambda/${var.nome_projeto}-autorizador-${local.sufixo}"
  retention_in_days = var.dias_retencao_logs
}

resource "aws_lambda_function" "auth" {
  function_name = "${var.nome_projeto}-auth-cpf-${local.sufixo}"
  description   = "Autenticacao de clientes do GearUp por CPF e senha (${var.ambiente})"
  role          = data.aws_iam_role.lab.arn

  filename         = var.pacote_zip
  source_code_hash = filebase64sha256(var.pacote_zip)
  handler          = "src/autenticar.handler"
  runtime          = "nodejs22.x"
  architectures    = ["x86_64"]
  # 512 MB: na Lambda, mais memória = mais CPU. O PBKDF2 de 210.000
  # iterações é lento de propósito (contra força bruta) e fica em ~0,2 s.
  memory_size = 512
  timeout     = 10

  vpc_config {
    subnet_ids         = data.aws_subnets.privadas.ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.auth.name
  }

  environment {
    variables = merge(local.variaveis_token, {
      SERVICO     = "gearup-auth-cpf"
      DB_HOST     = data.aws_ssm_parameter.banco["host"].value
      DB_PORT     = data.aws_ssm_parameter.banco["porta"].value
      DB_USER     = data.aws_ssm_parameter.banco["usuario"].value
      DB_PASSWORD = data.aws_ssm_parameter.banco["senha"].value
      DB_NAME     = "${var.nome_projeto}_${var.ambiente}"
      DB_SSL      = "require"
    })
  }
}

resource "aws_lambda_function" "autorizador" {
  function_name = "${var.nome_projeto}-autorizador-${local.sufixo}"
  description   = "Lambda authorizer JWT do API Gateway do GearUp (${var.ambiente})"
  role          = data.aws_iam_role.lab.arn

  filename         = var.pacote_zip
  source_code_hash = filebase64sha256(var.pacote_zip)
  handler          = "src/autorizador.handler"
  runtime          = "nodejs22.x"
  architectures    = ["x86_64"]
  memory_size      = 128
  timeout          = 5

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.autorizador.name
  }

  environment {
    variables = merge(local.variaveis_token, { SERVICO = "gearup-autorizador" })
  }
}

resource "aws_lambda_permission" "gateway_auth" {
  statement_id  = "PermitirApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.gearup.execution_arn}/*/*"
}

resource "aws_lambda_permission" "gateway_autorizador" {
  statement_id  = "PermitirApiGatewayAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.autorizador.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.gearup.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.jwt.id}"
}
