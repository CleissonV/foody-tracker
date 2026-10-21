# Foody · Mini Rastreador de Pedidos

Aplicação full-stack para acompanhar um pedido do recebimento à entrega. Java 21 + Spring Boot 3.5, React + TypeScript, MUI e Vite. Identidade visual baseada no site da Foody: fonte Sen, coral e tons neutros.

## Variante de produção

Esta branch, `deploy/vercel-postgres`, contém a configuração PostgreSQL + Vercel Services. A [branch `main`](https://github.com/CleissonV/foody-tracker/tree/main) mantém a entrega H2 original para avaliação. Consulte [configuração e verificação de produção](docs/production.md).

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
| Listar e buscar por ID | Paginação, ordenação estável, filtro por status e busca por ID |
| Persistência | H2 em arquivo, migração Flyway, Hibernate em `validate` |
| React | Cadastro, login, painel, criação, detalhes, atualização e cancelamento |
| Git | Commits separados por entrega; repositório local incluído |

Complementos: indicadores reais por status, layout responsivo, estados de carregamento/erro/vazio, documentação OpenAPI, testes de domínio/integração/arquitetura/UI/E2E, JaCoCo, Docker e CI.

### Meu perfil

Acesse **Meu perfil** no menu ou clique no avatar do cabeçalho. Link direto: `http://127.0.0.1:5173/#perfil`.

- Editar nome e e-mail. A troca do e-mail exige a senha atual e respeita a unicidade da conta.
- Trocar a senha com confirmação da senha atual e repetição da nova senha.
- Escolher foto com prévia, confirmar o envio ou remover a imagem atual. PNG/JPEG de até 2 MB; o servidor valida o conteúdo real, limita dimensões, recorta ao centro e reencoda em PNG 256×256, sem os metadados originais.
- Nome e foto atualizados aparecem no cabeçalho e no menu. A imagem é persistida no mesmo banco, sem dependência de armazenamento externo.
- Alterar e-mail ou senha rotaciona a sessão atual e revoga outras sessões na próxima requisição. O usuário permanece conectado na sessão que confirmou a alteração.
- Atualizações de dados e senha usam a versão do perfil para detectar alterações concorrentes. Os formulários preservam rascunhos ao trocar a foto.

A migração Flyway `V2__user_profiles.sql` atualiza bancos existentes sem apagar usuários ou pedidos. As fotos fazem parte do arquivo/volume H2 e dos seus backups. Não são incluídas no código ou no ZIP.

### Buscar pedidos por ID

Use **Buscar pedido por ID** no cabeçalho da tabela. Aceita o UUID completo ou o início do código exibido, com ou sem `#`, sem distinguir maiúsculas/minúsculas. A consulta é feita no servidor após 300 ms sem digitação, cobre todas as páginas e combina com o status selecionado. Alterar a busca volta à primeira página; o botão de limpar mantém o filtro de status. Indicadores continuam mostrando os totais da operação.

### Busca de endereço por CEP

O CEP aparece primeiro no endereço. A consulta usa a API pública [ViaCEP](https://viacep.com.br/) diretamente pelo navegador, sem enviar cookies da aplicação. Há máscara 00000-000, indicador de consulta, timeout de 5 s e cancelamento ao mudar o CEP ou fechar o formulário. Respostas antigas não sobrescrevem o CEP atual nem edições feitas durante a consulta.

Rua, bairro, cidade e UF continuam editáveis. CEP inexistente, indisponibilidade ou CEP genérico de município permitem completar o endereço manualmente. Ao trocar o CEP, valores anteriores preenchidos automaticamente são limpos; número, complemento e correções manuais são preservados. O Nginx permite somente o domínio do ViaCEP como conexão externa adicional na CSP. A consulta não verifica o endereço de entrega nem substitui a revisão do usuário.

### Regras assumidas

- Cada conta possui sua própria operação: **listar todos** significa todos os pedidos do usuário autenticado. Outro usuário recebe `404` ao tentar consultar/alterar um pedido alheio. A API obtém o proprietário da sessão, nunca do JSON enviado pelo cliente.
- Pedidos iniciam como `RECEBIDO`. Os estados ativos avançam uma etapa por vez; podem ser cancelados antes da entrega. `ENTREGUE` e `CANCELADO` são terminais. Cancelamento em rota foi permitido por não haver restrição no enunciado.
- Repetir o mesmo status retorna `409`; não gera eventos duplicados. Atualizações exigem `expectedVersion` para detectar telas desatualizadas.
- Lista, indicadores e detalhes recebem atualizações por SSE após cada criação ou mudança de status confirmada. Outras sessões da mesma conta se sincronizam automaticamente. Reconexões recarregam os dados; durante falhas do canal, há fallback de consulta a cada 10 segundos. Não há rastreamento GPS, mapa ou WebSocket.
- Preços são em BRL. O servidor calcula totais com `BigDecimal`; preço zero é permitido porque o enunciado não exige precificação. O formulário consulta o ViaCEP ao completar 8 dígitos e preenche rua, bairro, cidade e UF; número/complemento permanecem manuais. A API Java valida formato e campos, mas não consulta o provedor nem exige que a busca tenha sucesso. O endereço não é geocodificado.
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

Repositório privado: [CleissonV/foody-tracker](https://github.com/CleissonV/foody-tracker). O histórico completo está na branch `main`; cada push executa os checks do GitHub Actions. Acesso requer autorização do proprietário.

```sh
git clone https://github.com/CleissonV/foody-tracker.git
cd foody-tracker
```

O ZIP também inclui `.git` com o histórico. O envio ao GitHub não implica publicação em produção: a configuração atual de H2 e sessões exige uma API com volume persistente e uma única instância.

Não publique `data/`, credenciais ou dependências. Esses caminhos estão no `.gitignore`.

## Uso de IA e referências visuais

Projeto implementado com apoio do Codex, conforme permitido pelo desafio. O responsável pela entrega deve revisar as decisões, executar o projeto e conhecer os fluxos antes da apresentação. O histórico registra etapas concretas de implementação; não simula dias de trabalho.

Logos e cores de referência: [Foody Delivery](https://foodydelivery.com/). Uso restrito ao contexto demonstrativo deste desafio. Fonte Sen: SIL Open Font License; veja [avisos de terceiros](docs/third-party-notices.md).
