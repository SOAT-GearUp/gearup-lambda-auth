# ---------------------------------------------------------------------------
# Dependências de outros repositórios, resolvidas sem ler states alheios:
#
#   gearup-infra-k8s -> VPC e subnets privadas (por tag)
#   gearup-infra-db  -> /gearup/banco/{host,porta,usuario,senha} no SSM
#   gearup-api       -> /gearup/<ambiente>/jwt/chave e /gearup/<ambiente>/api/host
#
# Ordem de deploy: infra-k8s -> infra-db -> GearUp -> gearup-lambda-auth.
# ---------------------------------------------------------------------------

data "aws_vpc" "plataforma" {
  tags = {
    Name = "${var.nome_projeto}-vpc"
  }
}

data "aws_subnets" "privadas" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.plataforma.id]
  }

  tags = {
    Camada = "privada"
  }
}

# Learner Lab: não é possível criar roles. A LabRole já confia em
# lambda.amazonaws.com e tem as permissões de VPC e CloudWatch Logs.
data "aws_iam_role" "lab" {
  name = "LabRole"
}

data "aws_ssm_parameter" "banco" {
  for_each = toset(["host", "porta", "usuario", "senha"])
  name     = "/${var.nome_projeto}/banco/${each.value}"
}

data "aws_ssm_parameter" "chave_jwt" {
  name = "/${var.nome_projeto}/${var.ambiente}/jwt/chave"
}

data "aws_ssm_parameter" "url_api" {
  count = var.url_backend == "" ? 1 : 0
  name  = "/${var.nome_projeto}/${var.ambiente}/api/host"
}

locals {
  sufixo = var.ambiente
  # Gateway -> NLB em HTTP (porta 80): o TLS do cliente termina no API Gateway
  # e o NLB não tem certificado (sem domínio próprio no lab). Trade-off e
  # evolução (VPC Link) na ADR-002 do repositório gearup-api.
  url_backend = trimsuffix(var.url_backend != "" ? var.url_backend : "http://${nonsensitive(data.aws_ssm_parameter.url_api[0].value)}", "/")

  variaveis_token = {
    JWT_KEY                = data.aws_ssm_parameter.chave_jwt.value
    JWT_ISSUER             = "GearUp"
    JWT_AUDIENCE           = "GearUp.Clients"
    JWT_EXPIRATION_MINUTES = tostring(var.expiracao_token_minutos)
    AMBIENTE               = var.ambiente
  }
}
