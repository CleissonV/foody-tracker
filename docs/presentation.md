# Roteiro de apresentação técnica

## Demonstração em aproximadamente 5 minutos

1. Cadastrar uma conta. Mostrar que acessar sem sessão retorna ao login.
2. Criar um pedido com dois itens e endereço. Mostrar o total calculado.
3. Abrir detalhes, iniciar preparo, enviar para entrega e concluir. Mostrar o histórico.
4. Criar outro pedido e demonstrar a confirmação de cancelamento.
5. Abrir a mesma conta em duas abas, alterar em uma e explicar o conflito de versão se a outra tentar gravar um estado desatualizado antes do polling.
6. Recarregar a página, filtrar status e sair. Explicar que os dados sobrevivem ao reinício, mas sessões em memória exigem novo login.
7. Mostrar `git log --oneline`, testes e as decisões documentadas.

## Explicação de arquitetura

“Organizei um monólito por funcionalidade porque o domínio é pequeno e o desafio tem prazo curto. Controllers validam contratos HTTP; serviços delimitam transações e autorização; o agregado protege as transições. Pedido e histórico são gravados juntos. Usei H2 em arquivo para reduzir os pré-requisitos, com migrações versionadas e Hibernate em modo de validação.”

## Perguntas que você deve conseguir responder

| Pergunta | Ponto principal |
| --- | --- |
| Por que não microserviços? | Não há escala medida, equipes independentes ou fronteiras que compensem o custo operacional. |
| Por que sessão, não JWT? | Aplicação web na mesma origem; revogação simples e infraestrutura do Spring. CSRF permanece ativo. |
| O que impede acesso ao pedido de outro usuário? | Toda consulta/alteração usa o ID do usuário autenticado junto do ID do pedido. |
| O que impede sobrescrita por outra tela? | `expectedVersion` detecta intenção desatualizada; `@Version` protege a corrida no banco. |
| Por que histórico na mesma transação? | O status e o registro de mudança não podem divergir se ocorrer falha. |
| Por que não WebSocket agora? | O enunciado não exige streaming; polling entrega o fluxo. SSE ou WebSocket dependem da necessidade de latência/direção. |
| Como escalaria? | PostgreSQL, sessões em Redis, métricas, eventos com outbox; separar serviços só quando houver motivo. |
| Como integrar pagamentos/marketplaces? | Idempotência, autenticação de webhooks, timeouts, retries controlados e processamento assíncrono. |
| Isso está pronto para produção? | Não: faltam rate limit, TLS operacional, recuperação de conta, observabilidade e banco externo para réplicas. |
| Como você usou IA? | Apoiou implementação, testes e documentação; explicar as decisões e as partes revisadas sem atribuir experiência que você não tenha. |

## Arquivos para estudar antes da entrevista

- `orders/domain/OrderStatus.java`: tabela de transições.
- `orders/domain/DeliveryOrder.java`: agregado e histórico.
- `orders/application/OrderService.java`: transação, proprietário e concorrência.
- `config/SecurityConfig.java` e `auth/api/AuthController.java`: autenticação, sessão e CSRF.
- `frontend/src/lib/api.ts`: cliente HTTP, token CSRF e sessão expirada.
- `ApiIntegrationTest.java`: testes com infraestrutura real.
- `docs/system-design.md`: limites e evolução.

Leia e execute o código. Não memorize o roteiro sem entender os mecanismos demonstrados.
