# Publica a URL do gateway para a pipeline do gearup-api (smoke test) e para a
# documentação, sem que ninguém precise ler este state.
resource "aws_ssm_parameter" "url_gateway" {
  name  = "/${var.nome_projeto}/${var.ambiente}/gateway/url"
  type  = "String"
  value = aws_apigatewayv2_api.gearup.api_endpoint
}

output "url_gateway" {
  description = "URL pública do API Gateway deste ambiente."
  value       = aws_apigatewayv2_api.gearup.api_endpoint
}

output "url_autenticacao" {
  description = "Endpoint de autenticação por CPF."
  value       = "${aws_apigatewayv2_api.gearup.api_endpoint}/auth/cpf"
}

output "url_swagger" {
  description = "Swagger da API através do gateway (habilitado em homolog)."
  value       = "${aws_apigatewayv2_api.gearup.api_endpoint}/swagger/index.html"
}

output "funcoes" {
  description = "Funções Lambda implantadas."
  value       = [aws_lambda_function.auth.function_name, aws_lambda_function.autorizador.function_name]
}

output "backend" {
  description = "URL da API no cluster para onde o gateway encaminha /api, /health e /swagger."
  value       = local.url_backend
}
