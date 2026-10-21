# Variante de produção — PostgreSQL e Vercel Services

A branch `main` permanece no commit `a4aaa514d5bf1e133d3f4969766f4603e463c7c4`, com H2 em arquivo e os comandos originais para avaliação. As adaptações estão somente em `deploy/vercel-postgres`. Não é necessário PostgreSQL para testar a entrega na branch padrão.

## Configuração

O perfil Spring `production` ativa PostgreSQL, migrações em `db/postgresql` e Spring Session JDBC. Sem esse perfil, o banco continua H2 e as sessões continuam locais. Esta variante também inclui uma migração H2 de BLOB para BINARY VARYING para manter a mesma representação de foto em ambos os bancos; isso não altera a branch main.

O Neon foi provisionado pelo Marketplace da Vercel no plano Free, na região iad1, somente para o ambiente production do projeto `lume-agencia/foody-tracker`. Contas, pedidos, fotos e sessões são armazenados no PostgreSQL. Não se copiam os dados do H2 local para produção.

- `DATABASE_URL`: conexão de aplicação via endpoint com pool.
- `DATABASE_URL_UNPOOLED`: conexão direta para o Flyway.
- `PORT=8080`: porta HTTP do container.
- O Dockerfile define `SPRING_PROFILES_ACTIVE=production` e bind em `0.0.0.0`.
- O JDBC verifica TLS e hostname com a truststore Java; credenciais ficam fora da URL JDBC e do Git.
- Pool limitado a quatro conexões por instância, mínimo ocioso zero.
- Sessões expiram após 30 minutos de inatividade. Cookie `FOODY_SESSION`: HttpOnly, Secure e SameSite=Lax. A persistência não torna o login permanente.
- OpenAPI e Swagger ficam desativados em produção.

## Sincronização

Os eventos locais continuam sendo enviados após commit. Para detectar commits feitos por outra instância, cada processo consulta a contagem e a soma de versões dos pedidos dos proprietários com streams ativos, a cada dois segundos. A invalidação não transporta dados de pedidos e o cliente recarrega lista, indicadores e detalhes via REST autenticado.

Esse polling é deliberadamente simples para o mini rastreador: uma consulta agregada por proprietário ativo por ciclo, com filtro indexado por owner_id. Para uma operação grande, substituir por um mecanismo de mensagens compartilhado. Não há dependência de uma conexão PostgreSQL permanente com LISTEN/NOTIFY nem de afinidade de sessão.

A identidade de cada stream é relida do Spring Session JDBC. Uma rotação de ID encerra o canal antigo para reconectar com o cookie atual. A versão de credenciais continua sendo verificada para revogar outras sessões.

## Execução e verificação

O `vercel.json` da raiz publica React e o container Java como Services da Vercel (beta). `/api/*` vai para a API; os demais caminhos vão para o front-end. A proteção de acesso da Vercel permanece habilitada.

`scripts/verify-production.mjs` inicia duas APIs Java isoladas em 8082/8083, usando o PostgreSQL fornecido pelo ambiente. Verifica sessões compartilhadas, CSRF, SSE entre instâncias, pedidos, fotos, rotação/revogação, logout e persistência após reiniciar os processos. Cria somente contas e pedidos de verificação exclusivos com domínio e2e.invalid. Não apaga dados existentes. Usar um banco dedicado de verificação.

```sh
# Após ./mvnw verify, com JAVA_HOME e as URLs PostgreSQL no ambiente:
node scripts/verify-production.mjs
```

Credenciais, arquivos .env, artefatos de build e dados locais são excluídos do Git e do upload para a Vercel. O perfil H2 e a suíte E2E continuam disponíveis para execução sem serviços externos.

## Validação da publicação — 21/10/2026

- Produção: https://foody-mini-tracker.vercel.app/
- Revisão de aplicação publicada: `472e5ffd5dd7c4fcc6e6c97248a9670bc85012c2`.
- Deployment: `dpl_514w2nWawX18wyLqZ8NHhBQLTB1G`, promovido ao domínio definitivo.
- 60 testes Java e 12 cenários E2E desktop/mobile aprovados.
- Verificação com PostgreSQL real aprovada: duas instâncias, sessões compartilhadas, SSE entre instâncias, fotos, revogação de sessão e dados preservados após reinício dos dois processos.
- Regressão PostgreSQL de listagem sem filtro, por status, por ID e por ambos os filtros aprovada. Não se enviam parâmetros nulos para predicados opcionais no SQL.
- Smoke HTTP no domínio definitivo e verificação visual no navegador aprovados: login, pedido criado no deployment anterior, status, tabela e filtros.
- Container Java com compilação tier 1 para reduzir o tempo de início; logs do deployment registraram inicialização em aproximadamente 12 segundos. O ambiente escala a zero e o primeiro acesso pode demorar.
- A proteção de autenticação da Vercel continua ativa; o link pode exigir acesso à equipe antes do login da aplicação.

Esta documentação registra a variante publicada; a branch `main` e seus comandos H2 foram preservados.
