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

## ADR 005 — Polling para atualização do painel

**Contexto:** o desafio exige listar estados atuais, sem definir streaming ou rastreamento de localização.

**Decisão:** polling em 10 segundos, invalidação imediata após escrita e pausa automática do intervalo em abas não visíveis pelo React Query.

**Consequência:** há atraso limitado entre telas e custo proporcional aos clientes ativos. SSE/WebSocket seria introduzido conforme latência e volume medidos. Não há indicador falso de “tempo real”.
