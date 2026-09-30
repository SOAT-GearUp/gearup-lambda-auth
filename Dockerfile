# ---------------------------------------------------------------------------
# Imagem para executar a função localmente com o Runtime Interface Emulator
# que já vem na imagem base oficial da AWS (mesmo runtime da Lambda).
#
#   docker compose -f local/docker-compose.yml up --build
#
# Em produção a função é publicada como .zip (scripts/empacotar.sh), não como
# imagem: o LabRole do Learner Lab tem acesso somente leitura ao ECR, e o zip
# dispensa um repositório de imagens extra.
# ---------------------------------------------------------------------------
FROM public.ecr.aws/lambda/nodejs:22

COPY package.json package-lock.json ${LAMBDA_TASK_ROOT}/
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts

COPY src ${LAMBDA_TASK_ROOT}/src

# Troque para "src/autorizador.handler" para testar o autorizador.
CMD ["src/autenticar.handler"]
