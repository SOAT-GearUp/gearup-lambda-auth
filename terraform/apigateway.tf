# ---------------------------------------------------------------------------
# API Gateway (HTTP API) — porta de entrada única do GearUp
#
#   POST /auth/cpf ................ Lambda de autenticação       (público)
#   POST /api/autenticacao/login .. API no EKS (login funcionário) (público)
#   GET  /health/{proxy+} ......... API no EKS (healthchecks)      (público)
#   GET  /swagger/{proxy+} ........ API no EKS (documentação)      (público)
#   ANY  /api/{proxy+} ............ API no EKS                     (JWT obrigatório)
#
# O HTTP API escolhe sempre a rota mais específica, então o login não cai no
# `ANY /api/{proxy+}` protegido.
#
# CUSTO: US$ 1,00 por milhão de requisições; parado = US$ 0.
# ---------------------------------------------------------------------------

resource "aws_apigatewayv2_api" "gearup" {
  name          = "${var.nome_projeto}-api-${local.sufixo}"
  description   = "Entrada unica do GearUp (${var.ambiente}): autenticacao por CPF e roteamento para o EKS"
  protocol_type = "HTTP"
}

resource "aws_cloudwatch_log_group" "gateway" {
  name              = "/aws/apigateway/${var.nome_projeto}-api-${local.sufixo}"
  retention_in_days = var.dias_retencao_logs
}

resource "aws_apigatewayv2_stage" "padrao" {
  api_id      = aws_apigatewayv2_api.gearup.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.limite_requisicoes_por_segundo
    throttling_burst_limit = var.limite_rajada
  }

  # Access log estruturado (JSON). requestId é o mesmo valor que a Lambda de
  # autenticação usa como correlationId quando o cliente não envia
  # X-Correlation-ID.
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.gateway.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      requestTime        = "$context.requestTime"
      routeKey           = "$context.routeKey"
      status             = "$context.status"
      latencyMs          = "$context.responseLatency"
      integrationLatency = "$context.integrationLatency"
      integrationStatus  = "$context.integrationStatus"
      integrationError   = "$context.integrationErrorMessage"
      authorizerError    = "$context.authorizer.error"
      perfil             = "$context.authorizer.perfil"
      metodoAutenticacao = "$context.authorizer.metodo"
    })
  }
}

# ------------------------------ Autenticação --------------------------------

resource "aws_apigatewayv2_integration" "auth" {
  api_id                 = aws_apigatewayv2_api.gearup.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.auth.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "auth_cpf" {
  api_id    = aws_apigatewayv2_api.gearup.id
  route_key = "POST /auth/cpf"
  target    = "integrations/${aws_apigatewayv2_integration.auth.id}"
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id                            = aws_apigatewayv2_api.gearup.id
  name                              = "jwt-gearup"
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.autorizador.invoke_arn
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  identity_sources                  = ["$request.header.Authorization"]
  # Cache por token: um mesmo JWT não reinvoca o autorizador por 5 minutos.
  authorizer_result_ttl_in_seconds = 300
}

# ------------------------------ API no EKS ----------------------------------

resource "aws_apigatewayv2_integration" "api" {
  for_each = {
    api     = "/api/{proxy}"
    health  = "/health/{proxy}"
    swagger = "/swagger/{proxy}"
    login   = "/api/autenticacao/login"
  }

  api_id               = aws_apigatewayv2_api.gearup.id
  integration_type     = "HTTP_PROXY"
  integration_method   = "ANY"
  integration_uri      = "${local.url_backend}${each.value}"
  timeout_milliseconds = 29000
}

resource "aws_apigatewayv2_route" "api_protegida" {
  api_id             = aws_apigatewayv2_api.gearup.id
  route_key          = "ANY /api/{proxy+}"
  target             = "integrations/${aws_apigatewayv2_integration.api["api"].id}"
  authorization_type = "CUSTOM"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "publicas" {
  for_each = {
    "POST /api/autenticacao/login" = "login"
    "GET /health/{proxy+}"         = "health"
    "GET /swagger/{proxy+}"        = "swagger"
  }

  api_id    = aws_apigatewayv2_api.gearup.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.api[each.value].id}"
}
