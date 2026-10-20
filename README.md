# Foody · Mini Rastreador de Pedidos

Aplicação full-stack para acompanhar um pedido do recebimento à entrega. Java 21 + Spring Boot 3.5, React + TypeScript, MUI e Vite. Identidade visual baseada no site da Foody: fonte Sen, coral e tons neutros.

## Começar com Docker

Pré-requisito: Docker com Compose e engine em execução.

```sh
docker compose up --build
```

- Aplicação: http://127.0.0.1:5173
- Swagger: http://127.0.0.1:8080/swagger-ui.html
- Saúde da API: http://127.0.0.1:8080/actuator/health

O primeiro build baixa dependências e executa os testes Java. Aguarde a API iniciar. Cadastre sua conta pela aplicação. Não existe usuário padrão criado automaticamente.

O banco H2 é persistido no volume `foody-data`. `docker compose down` preserva os dados. Remover o volume apaga os dados.

## Rodar sem Docker

Pré-requisitos: **JDK 21** (`JAVA_HOME` configurado), **Node.js 22.12+** e acesso à internet no primeiro build. Maven é baixado pelo Wrapper; não exige instalação global.

Terminal 1 — API:

```sh
cd backend
chmod +x ./mvnw
./mvnw spring-boot:run
```

No PowerShell/Windows:

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

Terminal 2 — front-end:

```sh
cd frontend
npm ci
npm run dev
```

Acesse **http://127.0.0.1:5173**. O Vite encaminha `/api` à API na porta 8080, mantendo a mesma origem. Use esse host de forma consistente para os cookies.

O banco local fica em `backend/data/foody.mv.db`; reiniciar a API preserva usuários e pedidos. Sessões ficam na memória e exigem novo login após reiniciar o servidor.

### Dados de demonstração, opcionais

Com a API em execução, na raiz do projeto:

```sh
node scripts/seed-demo.mjs
```

Conta local: **demo@foody.local** · Senha: **FoodyDemo123!**. O script cria oito pedidos em diferentes etapas e não duplica pedidos se a conta já tiver dados. Nome, endereço e pedidos são fictícios. `DEMO_EMAIL`, `DEMO_PASSWORD` e `API_URL` permitem substituir as configurações. Não use a credencial de demonstração em um ambiente público.

## Escopo entregue

| Requisito | Implementação |
| --- | --- |
| Cadastro e login | Nome, e-mail único normalizado e senha com BCrypt |
| Acesso autenticado | Spring Security, sessão HttpOnly, proteção CSRF e logout |
| Criar pedido | Cliente, endereço estruturado e 1–50 itens com quantidade e preço |
| Atualizar status | Máquina de estados, histórico transacional e proteção contra concorrência |
| Listar e buscar por ID | Paginação, ordenação estável e filtro por status |
| Persistência | H2 em arquivo, migração Flyway, Hibernate em `validate` |
| React | Cadastro, login, painel, criação, detalhes, atualização e cancelamento |
| Git | Commits separados por entrega; repositório local incluído |

Complementos: indicadores reais por status, layout responsivo, estados de carregamento/erro/vazio, documentação OpenAPI, testes de domínio/integração/arquitetura/UI/E2E, JaCoCo, Docker e CI.

### Regras assumidas

- Cada conta possui sua própria operação: **listar todos** significa todos os pedidos do usuário autenticado. Outro usuário recebe `404` ao tentar consultar/alterar um pedido alheio. A API obtém o proprietário da sessão, nunca do JSON enviado pelo cliente.
- Pedidos iniciam como `RECEBIDO`. Os estados ativos avançam uma etapa por vez; podem ser cancelados antes da entrega. `ENTREGUE` e `CANCELADO` são terminais. Cancelamento em rota foi permitido por não haver restrição no enunciado.
- Repetir o mesmo status retorna `409`; não gera eventos duplicados. Atualizações exigem `expectedVersion` para detectar telas desatualizadas.
- A lista usa polling a cada 10 segundos enquanto a aba está ativa. Não há rastreamento GPS, mapa ou WebSocket implementado.
- Preços são em BRL. O servidor calcula totais com `BigDecimal`; preço zero é permitido porque o enunciado não exige precificação. CEP e UF são validados por formato; o endereço não é geocodificado.
- O cadastro retorna `201`; a interface autentica em seguida pelo endpoint de login.

## Arquitetura e system design

Monólito modular organizado por funcionalidade, com camadas explícitas:

| Camada | Responsabilidade |
| --- | --- |
| `auth/api`, `orders/api` | Contratos HTTP, validação e identificação do usuário |
| `application` | Casos de uso, autorização por proprietário, transações e projeções de resposta |
| `domain` | Agregado de pedido, itens, endereço e transições de status |
| `infra` | Repositórios Spring Data JPA |
| `config`, `shared/api` | Segurança, configuração e erros padronizados |

O domínio usa anotações JPA por pragmatismo. Esta é uma arquitetura em camadas; não há uma camada de abstrações criada apenas para imitar uma arquitetura hexagonal. O ArchUnit verifica dependências e impede acesso direto dos controllers aos repositórios.

Decisões e evolução: [system design](docs/system-design.md) · [ADRs](docs/decisions.md) · [contrato HTTP](docs/api.md) · [roteiro de apresentação](docs/presentation.md).

Evidências e limites dos testes executados: [registro de validação](docs/validation.md).

## Testes e qualidade

API, da pasta `backend`:

```sh
./mvnw clean verify
```

Windows: `.\mvnw.cmd clean verify`. Inclui testes com a cadeia real do Spring Security, Flyway e H2, matriz de transições, isolamento de usuários, CSRF real, rotação de sessão, concorrência e limite de consultas da listagem. Relatório de cobertura: `backend/target/site/jacoco/index.html`.

Front-end, da pasta `frontend`:

```sh
npm run lint
npm test
npm run build
```

E2E, após compilar o JAR com `./mvnw verify`:

```sh
npx playwright install chromium
npm run test:e2e
```

O Playwright inicia uma API isolada em **8081**, com banco em memória, e o Vite em **5174**. Executa os fluxos em desktop e viewport móvel. Não usa dados da API de desenvolvimento. Os testes criam contas exclusivas e usam HTTP real. O projeto móvel emula o viewport do Pixel 7; não substitui teste em um dispositivo Android real.

Relatório: `frontend/playwright-report/index.html`. A configuração aceita `PLAYWRIGHT_EXECUTABLE_PATH` para um Chromium/Chrome já instalado e `PLAYWRIGHT_CHANNEL` para selecionar um canal. O padrão da CI é o Chromium instalado pelo Playwright.

O workflow `.github/workflows/ci.yml` executa build, testes e lint em cada push/PR e guarda os relatórios. Sua execução remota depende de publicar o repositório no GitHub.

## Configuração

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `8080` | Porta da API |
| `SERVER_ADDRESS` | `127.0.0.1` | Interface local; no container, `0.0.0.0` |
| `DATABASE_URL` | `jdbc:h2:file:./data/foody;DB_CLOSE_ON_EXIT=FALSE` | Banco H2 |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `sa` / vazio | Credenciais do banco embarcado local |
| `COOKIE_SECURE` | `false` | Em HTTPS, configurar `true` |
| `DOCS_ENABLED` | `true` | `false` bloqueia Swagger/OpenAPI |
| `API_TARGET` | `http://127.0.0.1:8080` | Proxy do Vite em desenvolvimento |

As configurações Java leem variáveis de ambiente do processo. Um arquivo `.env` sozinho não é carregado pelo Spring Boot. Não há segredos obrigatórios para desenvolvimento local.

### Limites intencionais

H2 em arquivo e sessões na memória atendem uma instância local. Alta disponibilidade, limitação de tentativas de login, confirmação de e-mail, recuperação de senha, papéis de operador, idempotência de criação e notificações por push ficam fora deste exercício. O plano de evolução descreve quando introduzir esses recursos; a implementação atual não é apresentada como pronta para produção de alto volume.

## Versionamento e entrega

```sh
git log --oneline
```

O ZIP inclui `.git` com o histórico. Após extrair, execute os comandos na pasta `foody-tracker`. Para publicar, crie um repositório vazio no GitHub e use a URL real:

```sh
git remote add origin <URL_DO_SEU_REPOSITORIO>
git push -u origin main
```

Não publique `data/`, credenciais ou dependências. Esses caminhos estão no `.gitignore`.

## Uso de IA e referências visuais

Projeto implementado com apoio do Codex, conforme permitido pelo desafio. O responsável pela entrega deve revisar as decisões, executar o projeto e conhecer os fluxos antes da apresentação. O histórico registra etapas concretas de implementação; não simula dias de trabalho.

Logos e cores de referência: [Foody Delivery](https://foodydelivery.com/). Uso restrito ao contexto demonstrativo deste desafio. Fonte Sen: SIL Open Font License; veja [avisos de terceiros](docs/third-party-notices.md).
