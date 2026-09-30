# ---------------------------------------------------------------------------
# Alarmes no CloudWatch
#
# A função de autenticação roda em subnet privada sem NAT, então não alcança
# a internet para enviar telemetria ao Datadog (e o Learner Lab não permite
# criar a role do Datadog Forwarder). O monitoramento da camada serverless
# fica no CloudWatch, que já recebe as métricas nativas de Lambda e API
# Gateway sem custo. Os 10 primeiros alarmes são gratuitos.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "erros_auth" {
  alarm_name          = "${var.nome_projeto}-auth-cpf-${local.sufixo}-erros"
  alarm_description   = "Falhas de execucao da Lambda de autenticacao por CPF."
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.auth.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 3
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "latencia_auth" {
  alarm_name          = "${var.nome_projeto}-auth-cpf-${local.sufixo}-latencia"
  alarm_description   = "p95 da duracao da Lambda de autenticacao acima de 2s."
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  dimensions          = { FunctionName = aws_lambda_function.auth.function_name }
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2000
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "gateway_5xx" {
  alarm_name          = "${var.nome_projeto}-api-${local.sufixo}-5xx"
  alarm_description   = "Respostas 5xx no API Gateway (Lambda, banco ou cluster com falha)."
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = aws_apigatewayv2_api.gearup.id, Stage = "$default" }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}

# Falhas tratadas (503 BANCO_INDISPONIVEL) não contam como erro da Lambda:
# viram métrica a partir dos logs JSON com level=error.
resource "aws_cloudwatch_log_metric_filter" "falhas_banco" {
  name           = "${var.nome_projeto}-auth-cpf-${local.sufixo}-falhas-banco"
  log_group_name = aws_cloudwatch_log_group.auth.name
  pattern        = "{ $.resultado = \"erro_banco\" }"

  metric_transformation {
    name          = "FalhasConsultaCliente"
    namespace     = "GearUp/Autenticacao"
    value         = "1"
    default_value = "0"
    dimensions    = {}
  }
}

resource "aws_cloudwatch_metric_alarm" "falhas_banco" {
  alarm_name          = "${var.nome_projeto}-auth-cpf-${local.sufixo}-falhas-banco"
  alarm_description   = "A Lambda nao conseguiu consultar clientes no RDS."
  namespace           = "GearUp/Autenticacao"
  metric_name         = aws_cloudwatch_log_metric_filter.falhas_banco.metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}
