# ---------------------------------------------------------------------------
# Versões e backend do state
#
# Um state por ambiente, no mesmo bucket dos demais repositórios:
#   lambda-auth/homolog.tfstate e lambda-auth/production.tfstate
# A chave é passada em `terraform init` por scripts/tf-init.sh <dir> <chave>.
#
# Ao contrário do EKS e do RDS, aqui cada ambiente tem a sua própria pilha
# (funções + API Gateway): Lambda e HTTP API cobram por requisição, então
# um ambiente parado custa zero.
# ---------------------------------------------------------------------------
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = merge(var.tags_padrao, { Ambiente = var.ambiente })
  }
}
