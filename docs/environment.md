# Ambiente — OrderFlow

## Ferramentas
- Node.js: v20.19.3
- npm: 10.8.2
- Docker Desktop: 4.43.1
- Docker Engine: 28.3.0
- Containers: linux/amd64
- AWS CLI: 2.36.42

## Floci
- Container: floci
- Imagem: floci/floci:latest
- ID da imagem: sha256:4e451c39c7bb88e3cd4f87e8fc0c25d5b47695a51185d521e2241fa00486e8eb
- Endpoint AWS no Windows: http://localhost:4566
- Console: http://localhost:4500/console/aws
- Container da console: floci-ui
- Região utilizada: us-east-1
- Credenciais locais fictícias: test / test
- Referência imutável: floci/floci@sha256:4e451c39c7bb88e3cd4f87e8fc0c25d5b47695a51185d521e2241fa00486e8eb
## Validação
- DynamoDB: gravação, listagem e remoção testadas anteriormente.
- Tabela do experimento: chat
- Prefixo dos recursos do curso: orderflow-dev

## Pendências
- Fixar a imagem do Floci por versão ou digest.
- Aplicar a referência imutável no Compose do OrderFlow.
