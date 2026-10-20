# System design

## Objetivo e fronteira

Receber pedidos, consultar suas etapas e registrar mudanças de status com autenticação. Uma conta representa uma operação isolada. Não há integrações externas, rastreamento de localização ou mensageria em execução.

## Arquitetura implementada

```mermaid
flowchart TD
  Browser["React + React Query"] --> Proxy["Vite ou Nginx: mesma origem"]
  Proxy --> Security["Spring Security: sessão + CSRF"]
  Security --> Auth["Autenticação"]
  Security --> Orders["Casos de uso de pedidos"]
  Auth --> UsersDB["Usuários no H2"]
  Orders --> Domain["Agregado: pedido + itens + histórico"]
  Orders --> Repo["Spring Data JPA"]
  Repo --> OrdersDB["H2: pedidos, itens, histórico"]
```

Os dois nós H2 representam tabelas no mesmo banco. O monólito tem um processo, um banco e uma unidade de implantação. O Nginx serve arquivos estáticos e encaminha chamadas HTTP. A API inicia vinculada ao loopback por padrão; no Compose, a porta é publicada apenas em `127.0.0.1`.

## Modelo de dados

```mermaid
erDiagram
  APP_USERS ||--o{ DELIVERY_ORDERS : owns
  DELIVERY_ORDERS ||--|{ ORDER_ITEMS : contains
  DELIVERY_ORDERS ||--|{ ORDER_STATUS_HISTORY : records
  APP_USERS ||--o{ ORDER_STATUS_HISTORY : changes
  APP_USERS {
    uuid id PK
    string email UK
    string password_hash
  }
  DELIVERY_ORDERS {
    uuid id PK
    uuid owner_id FK
    string customer_name
    string status
    bigint version
    timestamp created_at
    timestamp updated_at
  }
  ORDER_ITEMS {
    uuid id PK
    uuid order_id FK
    int quantity
    decimal unit_price
  }
  ORDER_STATUS_HISTORY {
    uuid id PK
    uuid order_id FK
    uuid changed_by FK
    int sequence_number
    string status
    timestamp changed_at
  }
```

O endereço é um snapshot embutido no pedido. Alterar um endereço futuro não muda uma entrega passada. O valor total é derivado dos itens, evitando duas fontes persistidas para o mesmo valor. Valores monetários usam `NUMERIC`/`BigDecimal`. Datas são instantes UTC; a interface usa o fuso do navegador.

Índices cobrem proprietário + criação, proprietário + status e associações de itens/histórico. A paginação ordena por `createdAt DESC, id DESC`, evitando ordem ambígua para instantes iguais. Offset pagination é suficiente ao tamanho do exercício; novas inserções podem deslocar páginas. Grandes volumes exigiriam cursor composto e ajuste de índices pelo plano real da consulta.

## Consistência e concorrência

```mermaid
sequenceDiagram
  participant A as Tela A
  participant B as Tela B
  participant API as API
  participant DB as H2
  A->>API: PATCH status, expectedVersion=0
  API->>DB: Ler pedido do proprietário
  API->>DB: Gravar estado + evento, version=1
  DB-->>API: Commit
  API-->>A: 200, version=1
  B->>API: PATCH status, expectedVersion=0
  API->>DB: Ler pedido do proprietário
  API-->>B: 409 ORDER_CONFLICT
```

O serviço compara a versão informada com a persistida, prevenindo escritas iniciadas por uma tela antiga. `@Version` também protege a janela entre leitura e gravação por duas transações simultâneas. A alteração do pedido e o evento de histórico estão na mesma transação: ambos confirmam ou ambos sofrem rollback. A restrição de sequência única do histórico também pode rejeitar a segunda escrita concorrente; a API a apresenta como conflito de dados (`409`).

Ao receber `409`, a interface busca o pedido atual, exibe o conflito e exige nova ação do usuário. Escritas não são repetidas automaticamente. A criação ainda não possui chave de idempotência: um cliente externo pode duplicar pedidos em um retry após perder a resposta. A UI desabilita o envio durante a requisição, mas isso não substitui idempotência no servidor.

O histórico é de alterações do pedido, não um sistema de event sourcing ou um log de auditoria imutável protegido contra administradores do banco.

## Máquina de estados

```mermaid
stateDiagram-v2
  [*] --> RECEBIDO
  RECEBIDO --> EM_PREPARO
  EM_PREPARO --> SAIU_PARA_ENTREGA
  SAIU_PARA_ENTREGA --> ENTREGUE
  RECEBIDO --> CANCELADO
  EM_PREPARO --> CANCELADO
  SAIU_PARA_ENTREGA --> CANCELADO
  ENTREGUE --> [*]
  CANCELADO --> [*]
```

`OrderStatus` é a fonte das transições permitidas. A API retorna `allowedNextStatuses`; a interface mostra as ações que recebeu, sem reproduzir a regra de negócio.

## Segurança

- Senhas com BCrypt, custo 12. O limite de 72 bytes UTF-8 é validado antes do hash.
- Autenticação pela infraestrutura do Spring Security; mensagens de credenciais inválidas não distinguem usuário desconhecido de senha incorreta.
- A sessão é persistida explicitamente no `SecurityContextRepository`; o identificador muda no login. Expiração após 30 minutos de inatividade. Polling conta como atividade, portanto uma aba ativa mantém a sessão.
- Cookie HttpOnly, SameSite=Lax, transporte apenas por cookie; em HTTPS, `COOKIE_SECURE=true`. Não há token de autenticação no `localStorage`.
- Token CSRF obtido por endpoint, guardado em memória e enviado no header em toda escrita, inclusive cadastro e login. Login e logout exigem renovação do token.
- Cada busca/alteração inclui o proprietário autenticado. IDs de terceiros retornam `404`, reduzindo enumeração e prevenindo IDOR.
- Erros usam `application/problem+json` e não devolvem stack trace ou hash de senha. O console H2 permanece desativado. Swagger pode ser bloqueado por configuração.
- Nginx adiciona CSP e headers de segurança. Os assets da interface são locais, sem carregamento de analytics ou scripts do site de referência.

Limitação: autenticação pública não tem rate limit. Antes de exposição pública, adicionar limite de tentativas por IP/conta, respostas adequadas a abuso e TLS no gateway. A ausência é deliberadamente declarada, não coberta pelo rótulo de “acesso seguro”.

## Leitura e atualização da interface

React Query administra cache, invalidação e polling. A listagem retorna um resumo; itens e histórico completos só aparecem no detalhe. `default_batch_fetch_size=50` agrupa a carga de itens necessária para os totais, evitando uma consulta por pedido. Um teste garante no máximo três statements para uma página de oito pedidos. O teste não é um benchmark nem prova um limite universal para qualquer página.

Com a página ativa, lista e indicadores geram aproximadamente **0,2 requisição/s por usuário**, sem considerar interações. Um detalhe aberto acrescenta **0,1 requisição/s**. Cem operadores com detalhe aberto poderiam gerar cerca de 30 requisições/s só de polling; estes são cálculos de frequência, não capacidade medida do servidor.

Sessão expirada limpa o cache e retorna ao login. Mutations invalidam lista e indicadores; erros de rede possuem estado recuperável. As duas abas de um mesmo usuário se sincronizam na próxima leitura, não instantaneamente.

## Evolução para maior volume — proposta, não implementada

1. **Medir primeiro:** latência p50/p95/p99, erros, taxa de pedidos, consultas lentas, consumo de conexões e conflitos. Health check já existe; métricas de negócio, tracing e dashboards ainda não.
2. **Banco externo:** PostgreSQL/Cloud SQL, backups, pool limitado e migrações validadas contra esse banco. A migração atual foi executada no H2; não se afirma portabilidade automática.
3. **Escalar instâncias:** serviço Java em containers, sessões em Redis via Spring Session e balanceamento. H2 em arquivo não deve ser compartilhado por réplicas.
4. **Atualizações por evento:** SSE se o único fluxo for servidor → navegador; WebSocket se houver necessidade bidirecional, por exemplo localização de entregador. Autorização por operação e heartbeat permanecem necessários.
5. **Notificações confiáveis:** gravar um outbox na mesma transação do status; um worker publica e reprocessa com entrega pelo menos uma vez e deduplicação. Um evento disparado antes do commit pode anunciar um estado que será revertido.
6. **Integrações:** adaptadores para marketplaces/pagamentos, timeouts, circuit breaker, retries limitados, idempotência e fila de falhas. Webhooks precisam de verificação de autenticidade e proteção contra replay.
7. **Multioperador:** separar `workspace/organization` de usuário e introduzir associação e papéis, em vez de simplesmente remover o filtro `ownerId`.

Um caminho possível na GCP seria Cloud Run para a API, Cloud SQL para PostgreSQL, Secret Manager para credenciais e Cloud Tasks/Pub/Sub para trabalhos assíncronos. Não foram provisionados recursos GCP. Kubernetes e microserviços não são pré-requisitos para este domínio ou este volume ainda não medido.
