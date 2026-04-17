# syntax=docker/dockerfile:1

FROM --platform=linux/amd64 node:24-alpine AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx esbuild src/lambda.ts \
  --bundle \
  --platform=node \
  --target=node24 \
  --format=cjs \
  --outfile=dist/lambda.js

FROM --platform=linux/amd64 public.ecr.aws/lambda/nodejs:24
COPY --from=builder /build/dist/lambda.js ${LAMBDA_TASK_ROOT}/lambda.js
CMD ["lambda.handler"]
