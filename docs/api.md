# Contrato HTTP

Base local: `http://127.0.0.1:8080/api`. JSON UTF-8. A documentação executável fica em `/swagger-ui.html`, e o schema em `/v3/api-docs`.

## Autenticação e CSRF

1. `GET /auth/csrf`: preservar o cookie da resposta; ler `headerName` e `token`.
2. Enviar o token no header informado em todo `POST`/`PATCH`, com o mesmo cookie.
3. `POST /auth/register`: criar conta; `POST /auth/login`: autenticar.
4. Após login, obter um novo token. A API rotaciona o identificador de sessão.
5. `POST /auth/logout`: enviar CSRF, invalidar sessão; obter token novo antes da próxima escrita.

O token devolvido pelo endpoint usa a proteção padrão do Spring Security; não substitua o valor por um token extraído de HTML ou inventado pelo cliente.

| Método | Caminho | Sucesso | Acesso |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | 200 | Público |
| POST | `/auth/register` | 201 | Público, com CSRF |
| POST | `/auth/login` | 200 + cookie | Público, com CSRF |
| GET | `/auth/me` | 200 | Autenticado |
| POST | `/auth/logout` | 204 | Com CSRF; invalida sessão atual |
| POST | `/orders` | 201 + Location | Autenticado, com CSRF |
| GET | `/orders?page=0&size=12&status=RECEBIDO` | 200 | Autenticado |
| GET | `/orders/{id}` | 200 | Proprietário |
| PATCH | `/orders/{id}/status` | 200 | Proprietário, com CSRF |
| GET | `/orders/stats` | 200 | Autenticado |
| PATCH | `/profile` | 200 | Autenticado, com CSRF |
| PUT | `/profile/password` | 200 | Autenticado, com CSRF e senha atual |
| PUT | `/profile/avatar` | 200 | Autenticado, multipart com CSRF |
| GET | `/profile/avatar` | 200, PNG | Autenticado; sempre a própria foto |
| DELETE | `/profile/avatar` | 200 | Autenticado, com CSRF |

Cadastro:

```json
{"name":"Ana Oliveira","email":"ana@example.com","password":"SenhaForte123!"}
```

Login:

```json
{"email":"ana@example.com","password":"SenhaForte123!"}
```

E-mails são normalizados para minúsculas. Senha de cadastro: 8–72 caracteres, respeitando também o máximo de 72 bytes UTF-8 do BCrypt.

## Perfil

`GET /auth/me`, login, cadastro e alterações de perfil retornam `id`, `name`, `email`, `avatarUrl` (ou `null`) e `version`. Dados de `/auth/me` são consultados no banco; não dependem do nome/e-mail armazenado no principal da sessão.

`PATCH /profile`:

```json
{"name":"Ana Santos","email":"ana@example.com","expectedVersion":0}
```

Se o e-mail mudar, incluir `currentPassword`. `PUT /profile/password`:

```json
{"currentPassword":"SenhaForte123!","newPassword":"NovaSenha123!","expectedVersion":1}
```

Após atualizar os dados ou a senha, obter novo CSRF: a sessão atual é rotacionada. Alterar e-mail ou senha incrementa a versão de credenciais; outras sessões recebem `401 SESSION_REVOKED` na próxima chamada. A senha nova deve ser diferente da atual. A API não confirma posse do novo e-mail por mensagem de verificação.

`PUT /profile/avatar`: `multipart/form-data`, campo `file`. Não definir manualmente o `Content-Type` no navegador: o `FormData` fornece o boundary. Enviar CSRF no header, como nas outras escritas. Arquivos maiores que 2 MB retornam `413`; conteúdo incompatível com PNG/JPEG retorna `415`. Dimensões máximas: 4096 px por lado e 8 milhões de pixels. O arquivo é reencodado em PNG quadrado de 256 px. O nome original e os metadados não são armazenados.

`GET /profile/avatar` retorna somente a imagem do usuário autenticado; não aceita ID de outro usuário. Sem imagem, retorna `404 AVATAR_NOT_FOUND`. `DELETE /profile/avatar` retorna o perfil com `avatarUrl: null`. A URL muda a cada troca para evitar uma imagem antiga na interface; as respostas continuam sem cache público.

Erros adicionais: `400 INVALID_CURRENT_PASSWORD`, `400 PASSWORD_UNCHANGED`, `409 PROFILE_CONFLICT` e `409 EMAIL_ALREADY_EXISTS`. O front deve usar a versão retornada por cada alteração, inclusive upload/remoção de foto.

## Criar pedido

```json
{
  "customerName": "Maria Silva",
  "deliveryAddress": {
    "street": "Rua das Flores",
    "number": "42",
    "complement": "Casa",
    "neighborhood": "Centro",
    "city": "Bauru",
    "state": "SP",
    "postalCode": "17010-000"
  },
  "items": [
    {"name": "Pizza Margherita", "quantity": 2, "unitPrice": 29.90}
  ]
}
```

Preço de `0.00` a `999999.99`, no máximo duas casas decimais. Quantidade inteira de 1 a 999; de 1 a 50 itens. Endereço e cliente obrigatórios; complemento opcional. Campos desconhecidos são rejeitados. O servidor controla ID, proprietário, timestamps, status inicial e versão.

## Atualizar status

```json
{"status":"EM_PREPARO","expectedVersion":0}
```

Usar `version` da última leitura. A resposta contém a nova versão, o histórico atualizado e `allowedNextStatuses`. Estados inválidos ou repetidos retornam `409 INVALID_STATUS_TRANSITION`; versão antiga retorna `409 ORDER_CONFLICT`.

## Listagem e indicadores

Paginação zero-based, tamanho entre 1 e 100, padrão 12. Filtro de status opcional. Ordenação fixa por criação e ID decrescentes.

```json
{
  "content": [],
  "page": 0,
  "size": 12,
  "totalElements": 0,
  "totalPages": 0
}
```

Uma entrada de `content` inclui ID, cliente, endereço, status, quantidade total de unidades, total, datas, versão e próximas etapas. O detalhe inclui itens e histórico completos. Os indicadores são globais da conta e não apenas da página/filtro atual.

## Erros

Formato `application/problem+json`, alinhado ao RFC 9457:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "O pedido foi alterado em outra sessão. Atualize e tente novamente.",
  "instance": "/api/orders/00000000-0000-0000-0000-000000000000/status",
  "code": "ORDER_CONFLICT"
}
```

| HTTP | Situação |
| --- | --- |
| 400 | Validação, JSON inválido, campo desconhecido, UUID/enum inválido |
| 401 | Sessão ausente/expirada ou credenciais incorretas |
| 403 | CSRF ausente/inválido ou recurso bloqueado |
| 404 | Pedido inexistente ou pertencente a outra conta |
| 405 | Método não suportado |
| 409 | E-mail duplicado, transição inválida, versão antiga ou conflito concorrente |
| 415 | Content-Type não suportado |
| 500 | Falha inesperada, mensagem pública genérica |

Falhas de validação também retornam `errors`, mapeando campos a mensagens. Nunca há senha, hash ou stack trace nas respostas de erro.

## Swagger

No Swagger, execute `/auth/csrf`, copie `token` e informe no botão **Authorize**, campo `csrf`. Cadastre/autentique e, após login, renove o token no Authorize. O navegador mantém o cookie automaticamente. A descrição de CSRF na UI é essencial: informar somente o cookie não autoriza uma escrita.
