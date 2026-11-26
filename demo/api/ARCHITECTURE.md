# Arquitetura da API

Este documento detalha, na prática, duas decisões registradas como ADR:

- **ADR-017 · Arquitetura em camadas por módulo na API**: estrutura de pastas, regras de dependência, nomes e montagem do pipeline HTTP.
- **ADR-018 · Persistência com Kysely + better-sqlite3 (Node 24)**: migrations em TypeScript, migração na subida e consultas só pelo builder.

Configuração: `@nestjs/config` carrega o `.env` da API (decisão do dev no CARD-001, D-10; ajuste do ADR-017 pedido ao agente Contexto).

Se algo aqui contradisser um ADR, vale o ADR. Mudança de padrão começa pelo ADR, depois por este arquivo.

## Estrutura de `src/`

```
src/
  main.ts                    cria a app (AppModule.fromEnvironment), configureApp, listen na porta de SETTINGS; falha de subida
  startup-failure.ts         linha de falha da subida para o stderr (sem valores de configuração)
  app.setup.ts               configureApp(app): pipeline HTTP (prefixo, versionamento, logger, CORS, Swagger)
  app.module.ts              composição raiz; APP_FILTER (CARD-004) e APP_PIPE (CARD-006+)
  config/                    validação do ambiente + Settings tipados (token SETTINGS)
  shared/
    domain/                  AppError, paginação e tipos sem dependência de framework
    presentation/            (CARD-004) filtro de exceções, DTO de erro; ValidationPipe (CARD-006+)
  infrastructure/
    logging/                 (CARD-004) nestjs-pino, request id, log em arquivo (ADR-016)
    database/                DatabaseModule (token DATABASE), conexão, migrations, migrator, seed, inicialização
  modules/
    <funcionalidade>/        no plural do domínio (ex.: contatos)
      domain/                entidades, invariantes, erros de domínio
      application/           portas (classes abstratas = token de DI) e casos de uso
      infrastructure/        adapters Kysely das portas
      presentation/          controllers e DTOs
      <funcionalidade>.module.ts
```

`infrastructure/storage/` **não existe** neste projeto: a agenda não guarda arquivos. Não crie pastas vazias: cada pasta nasce
com o card que lhe dá conteúdo.

## Regras de dependência

Verificadas por `test/static/architecture.spec.ts`, que roda no `npm test`.

| Camada | Pode importar | Não pode importar |
|---|---|---|
| `**/domain/**` | só `shared/domain` e o próprio domínio | `@nestjs/*`, `kysely`, `better-sqlite3`, `infrastructure`, `application`, `presentation`, `config` |
| `**/application/**` | `domain`, `shared/domain`; de `@nestjs/common` só `Injectable`/`Inject` | `kysely`, `better-sqlite3`, `infrastructure`, `presentation` |
| `modules/*/infrastructure` | `domain`, `application` (portas), `infrastructure/database` | `presentation` |
| `modules/*/presentation` | `application`, `domain`, `shared/presentation` | `infrastructure` (do módulo ou central) |
| `infrastructure/database` | `config`, `shared/domain`, `modules/*/domain` (tipos do seed) | `modules/*/application`, `modules/*/infrastructure`, `presentation` |

## Nomes

- Pastas e arquivos em inglês, estilo Nest: `kebab-case` + sufixo de tipo (`.module.ts`, `.repository.ts`, `.error.ts`, `.spec.ts`).
- Identificadores técnicos em inglês (`Settings`, `loadSettings`, `DatabaseModule`, `DATABASE`, `configureApp`, `AppError`).
- Termos de domínio em português: `Contato`, `DadosContato`, `Sexo`, `SEXOS`, `ContatoRepository.listar/obterPorId/inserir/atualizar/excluir`
  e os campos do contrato JSON (`itens`, `pagina`, `tamanhoPagina`, `total`).
- Mensagens ao operador e ao usuário em pt-BR.
- Imports relativos terminam em `.js` (projeto ESM).

## Pipeline HTTP: quem acrescenta o quê em `configureApp`

| Card | Acrescenta |
|---|---|
| CARD-001 | `setGlobalPrefix('api')`, `enableVersioning({ type: URI, defaultVersion: VERSION_NEUTRAL })`, `enableShutdownHooks()` |
| CARD-004 | logger pino (`app.useLogger`), request id; o filtro global entra como `APP_FILTER` no `app.module.ts` |
| CARD-005 | CORS só da origem local e política same-origin/CSRF (P-03) |
| CARD-006+ | Swagger; o `ValidationPipe` global entra como `APP_PIPE` no `app.module.ts` |

**Rotas e versão.** Controller sem `@Version` responde em `/api/<rota>` (ex.: `/api/contatos`, contrato do ADR-014). Não use
`@Version('1')`: isso move a rota para `/api/v1/...` e quebra o contrato. Versão explícita só com decisão registrada, e o card de
endpoint testa a rota neutra em integração.

## Injeção de dependência

| Token | O que é | Onde nasce |
|---|---|---|
| `SETTINGS` | `Settings` imutável: `loadSettings` sobre o `ConfigService` (`.env` + ambiente do processo) | `config/settings.module.ts` (global) |
| `DATABASE` | `Kysely<Database>` já migrado (e semeado, se `SEED=true`) | `infrastructure/database/database.module.ts` |
| Portas | Classes abstratas em `modules/*/application` (ex.: `ContatoRepository`) | `<funcionalidade>.module.ts` liga a porta ao adapter |

Só adapters em `modules/*/infrastructure` injetam `DATABASE`. Controllers e casos de uso dependem da porta.

## Configuração

- `SettingsModule.fromEnvironment()` usa `ConfigModule.forRoot({ envFilePath: '.env', validate })` do `@nestjs/config`:
  carrega o `.env` do diretório de trabalho (ausente não é erro) e o ambiente do processo vence o `.env`.
- Nenhum código da aplicação lê `process.env` (verificado em `test/static/project.spec.ts`): todo mundo injeta `SETTINGS`.
- `loadSettings` é pura e é o `validate` do ConfigModule: valida, não tem valor padrão e devolve um objeto congelado. Erro = `EnvValidationError`
  (`variável <X> ausente|inválida`, nunca o valor).
- Localmente: `cp .env.example .env && npm run start:dev`. Testes usam `AppModule.register(settings)`, sem `.env`.
- Variável nova: campo em `Settings`, regra em `loadSettings`, chave em `SETTINGS_KEYS` (`settings.module.ts`), caso em `settings.spec.ts`, linha no `.env.example` e no README.

## Banco e SQL (ADR-018)

- Migrations em `infrastructure/database/migrations/NNNN-descricao.ts`, registradas no mapa estático de `migrations/index.ts`.
- Migration publicada é imutável: mudança de esquema = migration nova.
- **Um DDL por migration** (ou `db.transaction()` explícito): o Kysely não envolve migrations SQLite em transação.
- O template `sql` do Kysely só aparece em `migrations/` e sem interpolação. Fora disso, só o builder (valores, `limit` e `offset`
  vão como `?`). Proibido `sql.raw`, `sql.lit`, `sql.ref`, `sql.id` e `prepare` com template interpolado em `src/`
  (verificado em `test/static/project.spec.ts`).
- Os tipos em `database.types.ts` espelham o SQL; o adapter converte linhas em objetos de domínio campo a campo.

## Erros

- `AppError` (`shared/domain`) é a base: `code` estável e `message` sem valores de configuração nem dados pessoais.
- Erros de domínio estendem `AppError` no `domain/` do módulo (ex.: `ContatoNaoEncontradoError`, quando um card precisar).
- O filtro global (CARD-004) traduz `AppError` para HTTP; o resto vira 500 genérico com o detalhe só no log (RN-026).
- Falha na subida: `[api] Falha na subida (<etapa>): <mensagem>.` no stderr e código de saída 1.

## Casos de uso

Só existem quando há regra ou orquestração. Caso de uso que apenas repassa a chamada para a porta não é criado: o controller usa
a porta diretamente.

## Testes (Vitest)

| Tipo | Onde | Comando |
|---|---|---|
| Unitário | `src/**/*.spec.ts`, ao lado do código | `npm test` |
| Integração (SQLite real em arquivo temporário) | `test/integration/**/*.spec.ts` | `npm test` |
| Estáticos (arquitetura, nada fixo, SQL) | `test/static/*.spec.ts` | `npm test` |
| Subida do processo real | `test/*.e2e-spec.ts` | `npm run test:e2e` (compila antes) |

- Mock de porta: `{ provide: ContatoRepository, useValue: { listar: vi.fn(), … } }`.
- Endpoint em integração: `Test.createTestingModule({ imports: [AppModule.register(settings)] })`, depois `configureApp(app)` e
  `app.init()`, com SQLite temporário (`test/support/temp-database.ts`).

## Roteiro: novo módulo

1. `modules/<nome>/domain`: tipos, invariantes e erros, sem framework.
2. `modules/<nome>/application`: porta como classe abstrata (e caso de uso, se houver regra).
3. Migration nova em `infrastructure/database/migrations` + tipos em `database.types.ts`.
4. `modules/<nome>/infrastructure`: adapter Kysely com `@Inject(DATABASE)`.
5. `modules/<nome>/<nome>.module.ts`: `imports: [DatabaseModule]`, liga porta → adapter, exporta a porta.
6. `modules/<nome>/presentation`: controller sem `@Version`, DTOs; importa o módulo no `AppModule`.
7. Testes: unitário ao lado do código, integração em `test/integration`, e rode `npm test` (inclui o teste de arquitetura).
