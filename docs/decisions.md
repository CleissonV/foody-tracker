# Decisões de arquitetura

## ADR 001 — Monólito modular e camadas por funcionalidade

**Contexto:** desafio de poucas horas, dois módulos pequenos e consistência forte entre pedido e histórico.

**Decisão:** `auth` e `orders`, com domínio, aplicação, API e infraestrutura. Domínio mantém transições; serviço define transações. JPA é usado diretamente nas entidades e Spring Data nos repositórios. Respostas são mapeadas ainda na transação, com Open Session in View desativado.

**Alternativas:** microserviços introduziriam comunicação, implantação e consistência distribuída sem uma necessidade demonstrada. Uma implementação hexagonal completa duplicaria entidades e adaptadores sem uma segunda infraestrutura real.

**Consequência:** menor custo de execução e revisão, com acoplamento explícito ao JPA. Se outra persistência surgir, a fronteira pode ser extraída a partir de requisitos reais.

## ADR 002 — Sessão HttpOnly em vez de JWT

**Contexto:** uma aplicação web na mesma origem, sem clientes móveis obrigatórios ou integrações machine-to-machine.

**Decisão:** sessão do Spring Security, cookie HttpOnly/SameSite, rotação de ID no login, expiração e CSRF em toda escrita. O navegador não lê a credencial de sessão. O front consulta `/auth/me` ao recarregar.

**Alternativa:** JWT em `localStorage` aumentaria a exposição a XSS; access/refresh tokens em cookies exigiriam um protocolo de renovação e revogação sem benefício necessário neste exercício.

**Consequência:** logout invalida a sessão imediatamente, mas reiniciar a única instância exige novo login. Réplicas demandariam um armazenamento de sessões compartilhado. CSRF continua obrigatório mesmo com SameSite.

## ADR 003 — H2 em arquivo + Flyway

**Contexto:** o enunciado permite SQLite “ou similar” e o avaliador deve executar sem instalar um banco.

**Decisão:** H2 embarcado em arquivo. Flyway cria o schema e Hibernate apenas valida. Testes usam o mesmo motor em memória, com a mesma migração.

**Alternativas:** SQLite possui integração menos direta com Hibernate e diferenças de locking/dialeto. PostgreSQL seria apropriado para um ambiente compartilhado, mas aumentaria os pré-requisitos de execução manual.

**Consequência:** persistência após reinício e setup mínimo. Uma instância por arquivo; não é um banco para replicar horizontalmente. A migração para PostgreSQL precisa de driver, configuração e testes próprios.

## ADR 004 — Concorrência otimista e histórico transacional

**Contexto:** duas telas podem tentar alterar o mesmo pedido. Apenas atualizar a coluna `status` permite sobrescritas silenciosas.

**Decisão:** `expectedVersion` no contrato, `@Version` no agregado e histórico na mesma transação. Uma versão desatualizada gera `409` e obriga a interface a recarregar. O status atual não é alterado diretamente por setters públicos.

**Consequência:** o cliente deve enviar a versão que observou e tratar conflito. Não há fila ou lock distribuído. Existe teste de duas transações concorrentes e teste HTTP de tela desatualizada.

## ADR 005 — SSE para atualização entre sessões

**Contexto:** pedidos novos e mudanças de status devem aparecer automaticamente em outras telas da mesma conta.

**Decisão:** SSE autenticado por cookie, uma conexão por aba, eventos de invalidação publicados com `@TransactionalEventListener` após commit. O cliente busca os dados por REST, mantendo filtros, paginação e autorização existentes. Heartbeat a cada 15 s, reconexão automática, recarga após conectar e polling de 10 s somente enquanto o canal está indisponível. O botão de atualização manual foi removido.

**Alternativas:** polling permanente adiciona atraso e leituras sem mudança. WebSocket seria útil para tráfego bidirecional; esse requisito só precisa de servidor → navegador.

**Consequência:** o canal é efêmero e local à instância. Não é uma fila durável; recarregar no evento `ready` recupera alterações perdidas durante desconexões. Réplicas precisarão distribuir invalidações via broker e compartilhar sessões. Limites de 8 conexões por usuário e 200 por instância evitam crescimento sem limite. O Nginx desativa buffering para este endpoint. Substitui a decisão inicial de polling permanente.

## ADR 006 — Perfil, foto local e revogação de credenciais

**Contexto:** permitir ao usuário editar os próprios dados e a foto, sem criar dependências de serviços externos. Uma troca de senha não deve manter outras sessões antigas autorizadas.

**Decisão:** módulo `profile`, concorrência otimista para os dados, confirmação da senha atual em alterações sensíveis e contador de versão de credenciais. Um filtro confere esse contador em cada requisição autenticada. A sessão atual é rotacionada e recebe o principal atualizado; outras sessões são recusadas na próxima chamada. Fotos limitadas são reencodadas e persistidas como BLOB na tabela do usuário.

**Consequência:** banco e volume existentes preservam a imagem; o upload tem validação real e não depende do MIME declarado. O contador adiciona uma consulta escalar por requisição. Não há storage externo ou CDN, confirmação da posse do novo e-mail nem notificações de alteração de conta. O mesmo perfil não pode sobrescrever uma edição concorrente com uma versão antiga.

## ADR 007 — Consulta de CEP opcional no navegador

**Contexto:** reduzir digitação ao criar um pedido, preservando a possibilidade de corrigir endereços e trabalhar quando o provedor estiver indisponível.

**Decisão:** cliente ViaCEP isolado em `lib/postalCode.ts`, chamado pelo componente de endereço ao completar oito dígitos. O provedor permite CORS e não exige segredo. A consulta envia só o CEP; não inclui cookies nem referrer da aplicação. Timeout de 5 s, AbortController, checagem da resposta e proteção contra respostas antigas. A CSP do Nginx libera apenas o host HTTPS necessário.

**Consequência:** não é preciso adicionar um proxy no servidor para essa leitura pública. A busca depende da rede do navegador e do serviço externo; falhas têm preenchimento manual. Rua/bairro podem vir vazios em CEPs genéricos. Número e complemento são informados pelo usuário. O back-end continua validando o pedido e não confia na consulta como comprovação de endereço. Testes automatizados simulam o provedor; uma consulta real foi conferida separadamente.
