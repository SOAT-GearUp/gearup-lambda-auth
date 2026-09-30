#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Gera dist/lambda.zip com o código, as dependências de produção e o bundle
# de CAs do RDS (a conexão com o banco valida o certificado do servidor).
# O mesmo zip é usado pelas duas funções (autenticação e autorizador).
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf build dist
mkdir -p build dist certs

curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  -o certs/rds-global-bundle.pem

cp -r src certs package.json package-lock.json build/
(cd build && npm ci --omit=dev --no-audit --no-fund --ignore-scripts)
(cd build && zip -qr ../dist/lambda.zip .)

rm -rf build
echo "Pacote gerado: dist/lambda.zip ($(du -h dist/lambda.zip | cut -f1))"
