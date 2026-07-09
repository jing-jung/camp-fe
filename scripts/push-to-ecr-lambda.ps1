#!/usr/bin/env pwsh
# StockBrief-fe Lambda ECR 푸시 스크립트

$ErrorActionPreference = "Stop"

# 설정
$AWS_REGION = "ap-northeast-2"
$ECR_REPOSITORY = "389998437416.dkr.ecr.ap-northeast-2.amazonaws.com/stockbrief-dev-frontend"
$IMAGE_TAG = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "latest" }

# API 및 Cognito 환경 변수 (빌드 시 필요)
$API_BASE_URL = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "https://api.stockbrief.example.com/v1" }
$COGNITO_REGION = if ($env:COGNITO_REGION) { $env:COGNITO_REGION } else { "ap-northeast-2" }
$COGNITO_USER_POOL_ID = if ($env:COGNITO_USER_POOL_ID) { $env:COGNITO_USER_POOL_ID } else { "" }
$COGNITO_APP_CLIENT_ID = if ($env:COGNITO_APP_CLIENT_ID) { $env:COGNITO_APP_CLIENT_ID } else { "" }
$COGNITO_HOSTED_UI_DOMAIN = if ($env:COGNITO_HOSTED_UI_DOMAIN) { $env:COGNITO_HOSTED_UI_DOMAIN } else { "" }
$COGNITO_REDIRECT_URI = if ($env:COGNITO_REDIRECT_URI) { $env:COGNITO_REDIRECT_URI } else { "http://localhost:3000/auth/callback" }

Write-Host "=== StockBrief Frontend Lambda ECR Push ===" -ForegroundColor Cyan
Write-Host "ECR Repository: $ECR_REPOSITORY"
Write-Host "Image Tag: $IMAGE_TAG"
Write-Host "API Base URL: $API_BASE_URL"
Write-Host "Build Type: Lambda Web Adapter"
Write-Host ""

# 1. ECR 로그인
Write-Host "[1/4] ECR에 로그인 중..." -ForegroundColor Yellow
$password = aws ecr get-login-password --region $AWS_REGION
if ($LASTEXITCODE -ne 0) {
    Write-Host "ECR 로그인 실패" -ForegroundColor Red
    exit 1
}
$password | docker login --username AWS --password-stdin "$ECR_REPOSITORY".Split('/')[0]
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker 로그인 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✓ ECR 로그인 완료" -ForegroundColor Green

# 2. Docker 이미지 빌드 (Lambda용)
Write-Host ""
Write-Host "[2/4] Docker Lambda 이미지 빌드 중..." -ForegroundColor Yellow
docker build `
    -f Dockerfile.lambda `
    --build-arg "NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL" `
    --build-arg "NEXT_PUBLIC_COGNITO_REGION=$COGNITO_REGION" `
    --build-arg "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID" `
    --build-arg "NEXT_PUBLIC_COGNITO_APP_CLIENT_ID=$COGNITO_APP_CLIENT_ID" `
    --build-arg "NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN=$COGNITO_HOSTED_UI_DOMAIN" `
    --build-arg "NEXT_PUBLIC_COGNITO_REDIRECT_URI=$COGNITO_REDIRECT_URI" `
    -t "stockbrief-frontend-lambda:$IMAGE_TAG" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker 빌드 실패" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Docker Lambda 이미지 빌드 완료" -ForegroundColor Green

# 3. 이미지 태그
Write-Host ""
Write-Host "[3/4] Docker 이미지 태그 중..." -ForegroundColor Yellow
docker tag "stockbrief-frontend-lambda:$IMAGE_TAG" "${ECR_REPOSITORY}:$IMAGE_TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker 태그 실패" -ForegroundColor Red
    exit 1
}

# latest 태그도 추가
if ($IMAGE_TAG -ne "latest") {
    docker tag "stockbrief-frontend-lambda:$IMAGE_TAG" "${ECR_REPOSITORY}:latest"
}
Write-Host "✓ Docker 이미지 태그 완료" -ForegroundColor Green

# 4. ECR에 푸시
Write-Host ""
Write-Host "[4/4] ECR에 푸시 중..." -ForegroundColor Yellow
docker push "${ECR_REPOSITORY}:$IMAGE_TAG"
if ($LASTEXITCODE -ne 0) {
    Write-Host "ECR 푸시 실패" -ForegroundColor Red
    exit 1
}

# latest 태그도 푸시
if ($IMAGE_TAG -ne "latest") {
    docker push "${ECR_REPOSITORY}:latest"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ECR latest 푸시 실패" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ ECR 푸시 완료" -ForegroundColor Green

Write-Host ""
Write-Host "=== 배포 완료 ===" -ForegroundColor Cyan
Write-Host "이미지: ${ECR_REPOSITORY}:$IMAGE_TAG" -ForegroundColor Green
Write-Host "타입: Lambda Web Adapter" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  1. Terraform apply로 Lambda + CloudFront 배포"
Write-Host "  2. CloudFront URL 확인: terraform output frontend_hosted_url"
Write-Host ""
