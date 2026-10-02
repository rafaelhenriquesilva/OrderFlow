# OrderFlow — arquitetura inicial

## Primeiro fluxo
Criar pedido, consultar pedido e listar pedidos de uma loja.

## Estrutura
Aplicação Node.js/TypeScript modular.
Módulos previstos: pedidos, estoque, pagamentos, documentos,
notificações, financeiro e analytics.

## Regras iniciais
- Cada pedido pertence a uma loja.
- Toda consulta de pedido exige loja e identificador.
- Criar pedido não pode sobrescrever um pedido existente.
- Listagem operacional deve usar Query.
- A tabela chat pertence ao experimento anterior e será preservada.
- Novos recursos usam o prefixo orderflow-dev.

## Compatibilidade
O suporte anunciado no repositório deve ser validado na imagem fixada.
Sucesso local não comprova isolamento ou comportamento na AWS.

## Pendências
- Aplicar o digest no Compose.
- Validar persistência antes de recriar o container.
- Definir PK/SK e índices no módulo de DynamoDB.
- Testar condições, Query e transações separadamente.