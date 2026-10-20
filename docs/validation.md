# Registro de validação

Validação realizada em **20/10/2026**, no Windows, com JDK 21 e Node.js 24. Os testes de navegador usaram Chrome instalado, controlado pelo Playwright em perfis isolados.

| Verificação | Resultado |
| --- | --- |
| `mvnw clean verify` | 47 testes aprovados: 33 de domínio, 11 de integração e 3 regras de arquitetura |
| `npm test` | 9 testes aprovados em quatro arquivos |
| `npm run test:e2e` | 4 cenários aprovados: dois em desktop e dois com viewport móvel |
| `npm run build` | TypeScript e bundle de produção aprovados, sem alerta de chunk circular ou tamanho |
| `npm run lint` | Aprovado com zero warnings |
| `npm run format:check` | Aprovado |
| `npm audit --omit=dev` | Nenhuma vulnerabilidade de dependência de runtime reportada na consulta |
| Persistência em arquivo | Oito pedidos com os mesmos IDs após encerrar e reiniciar a API; login também preservado no banco |
| Bundle de produção | Login e painel exercitados no Vite Preview, sem exceções JavaScript observadas |
| Responsividade | Interface inspecionada em 1440 px e 393 px; sem overflow horizontal da página móvel |
| Compose | Configuração aceita pelo parser do Docker Compose; tags das quatro imagens encontradas no registry |

Total: **60 testes automatizados aprovados**. JaCoCo registrou **260/270 linhas cobertas (96,3%)** e **38/50 branches (76%)** no back-end, incluindo contratos e configuração. O relatório é gerado por execução; os percentuais não são uma afirmação de ausência de defeitos.

## Fluxo comprovado

| Fronteira | Evidência |
| --- | --- |
| Interface → autenticação | Cadastro e login reais pelo navegador; cookie HttpOnly e SameSite=Lax verificados |
| Interface → API | Criação e avanço pelas etapas via HTTP com CSRF |
| API → banco | Flyway executado; dados consultados após reinício da API com banco em arquivo |
| Banco → resposta | Total, versão, histórico e isolamento por usuário verificados na integração |
| Resposta → interface | Status final, filtro, recarga da sessão e logout verificados pelo Playwright |
| Concorrência | Duas transações observando a mesma versão: apenas uma confirmou; histórico permaneceu consistente |

Os testes reais revelaram um problema na limpeza do cache durante a troca de sessão. A implementação foi corrigida e há teste de regressão para a navegação de login/logout e remoção de dados privados.

## Limites da verificação

- Os containers **não foram construídos/executados**: a engine Docker local estava indisponível. A validação do Compose e das tags não substitui executar `docker compose up --build`.
- O workflow GitHub Actions foi criado, mas não executado remotamente. Não foi criado ou publicado um repositório remoto.
- Não foram executados teste de carga, pentest, análise SAST do Java ou teste em celular físico. O audit do npm abrange dependências de runtime, não certifica segurança da aplicação.
- O relatório JaCoCo completo e os relatórios Playwright são gerados nos diretórios descritos no README; artefatos de build, dados e sessões não são incluídos no ZIP.
