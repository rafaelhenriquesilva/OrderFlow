1. Confira as versões — 5 minutos
No terminal PowerShell do VS Code, execute:
```
node --version
npm --version
docker version
aws --version
```

2. Identifique o container do Floci — 5 minutos
```
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
```
- Localize a linha do Floci. Copie o nome do container e substitua NOME_DO_CONTAINER neste comando:
```
docker inspect NOME_DO_CONTAINER --format '{{.Config.Image}} {{.Image}}'
docker inspect floci --format '{{.Config.Image}} {{.Image}}'
```

3. Uma distinção importante: latest é uma etiqueta que pode apontar para outra imagem no próximo download. O sha256 que você obteve identifica a imagem local; ainda precisamos consultar o digest do repositório para fixá-la no Compose.
- Execute este comando:
```
docker image inspect floci/floci:latest --format '{{json .RepoDigests}}'
```