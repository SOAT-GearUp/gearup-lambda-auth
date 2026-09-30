variable "ambiente" {
  description = "Ambiente implantado: homolog (branch homolog) ou production (branch main)."
  type        = string

  validation {
    condition     = contains(["homolog", "production"], var.ambiente)
    error_message = "Use homolog ou production."
  }
}

variable "nome_projeto" {
  description = "Prefixo dos recursos; deve ser o mesmo do gearup-infra-k8s e do gearup-infra-db."
  type        = string
  default     = "gearup"
}

variable "tags_padrao" {
  description = "Tags aplicadas a todos os recursos."
  type        = map(string)
  default = {
    Projeto     = "GearUp"
    Fase        = "3"
    Repositorio = "gearup-lambda-auth"
    ManagedBy   = "Terraform"
  }
}

variable "pacote_zip" {
  description = "Caminho do pacote gerado por scripts/empacotar.sh."
  type        = string
  default     = "../dist/lambda.zip"
}

variable "url_backend" {
  description = "URL base da API no cluster (http://<nlb>). Vazio = lida do SSM /gearup/<ambiente>/api/url, publicada pela pipeline do GearUp."
  type        = string
  default     = ""
}

variable "expiracao_token_minutos" {
  description = "Validade do JWT emitido para o cliente."
  type        = number
  default     = 60
}

variable "limite_requisicoes_por_segundo" {
  description = "Throttling do API Gateway (rate). Protege a Lambda e o banco contra abuso e enumeração de CPFs."
  type        = number
  default     = 20
}

variable "limite_rajada" {
  description = "Throttling do API Gateway (burst)."
  type        = number
  default     = 40
}

variable "dias_retencao_logs" {
  description = "Retenção dos logs no CloudWatch (custo de armazenamento)."
  type        = number
  default     = 7
}
