$ErrorActionPreference = "Stop"

# Credenciais fictícias, válidas apenas para o laboratório.
$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "us-east-1"
$env:AWS_PAGER = ""

$endpoint = "http://localhost:4566"

# Create table chat if id string if table chat does not exist
Write-Host "Criando tabela chat..."
aws dynamodb create-table `
  --table-name chat `
  --attribute-definitions AttributeName=id,AttributeType=S `
  --key-schema AttributeName=id,KeyType=HASH `
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 `
  --endpoint-url $endpoint `
  --region us-east-1 `
  --output json


Write-Host "Verificando ListTables..."
aws dynamodb list-tables `
  --endpoint-url $endpoint `
  --region us-east-1 `
  --output json

if ($LASTEXITCODE -ne 0) {
  throw "ListTables falhou. Verifique o container e a porta 4566."
}

Write-Host "Verificando DescribeTable da tabela existente..."
aws dynamodb describe-table `
  --table-name chat `
  --endpoint-url $endpoint `
  --region us-east-1 `
  --query 'Table.{Name:TableName,Status:TableStatus,Keys:KeySchema}' `
  --output json

if ($LASTEXITCODE -ne 0) {
  throw "DescribeTable falhou. Registre o erro antes de avançar."
}

#delete table chat
# aws dynamodb delete-table `
#   --table-name chat `
#   --endpoint-url $endpoint `
#   --region us-east-1 `
#   --output json

Write-Host "Consultas concluídas; nenhuma escrita foi realizada."