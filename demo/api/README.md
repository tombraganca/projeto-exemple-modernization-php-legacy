# API da agenda de contatos

API REST em NestJS (ADR-001) com SQLite (ADR-005) via Kysely + better-sqlite3 (ADR-018).
O padrão de pastas e camadas está em [`ARCHITECTURE.md`](./ARCHITECTURE.md) (ADR-017).

Requisitos: Node.js 24 ou superior.

## Configuração (variáveis de ambiente)

A API lê a configuração **só** do ambiente (RN-027). Não há valor padrão no código e a aplicação não carrega
arquivo `.env` sozinha. Se uma variável obrigatória faltar ou for inválida, a API não sobe: escreve o motivo no
stderr (`[api] Falha na subida (config): variável SQLITE_PATH ausente.`) e sai com código 1.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SQLITE_PATH` | sim | Caminho do arquivo SQLite. Se o arquivo não existir, é criado vazio (ADR-012); o diretório precisa existir. Use caminho absoluto (relativo é resolvido a partir do diretório de trabalho). `:memory:` e `file:` não são aceitos. |
| `PORT` | sim | Porta HTTP, de 1 a 65535. |
| `SEED` | não | `true` (sem diferenciar maiúsculas) insere 24 contatos de exemplo **só se a tabela estiver vazia**. Qualquer outro valor ou ausência: não semeia. |

Na subida a API aplica as migrations pendentes (idempotente) e, com `SEED=true`, o seed. O `.env.example` e o
Docker Compose chegam no CARD-005.

## Rodar sem Docker

```bash
npm install
npm run build

mkdir -p /tmp/agenda
SQLITE_PATH=/tmp/agenda/contato.sqlite PORT=3000 SEED=true node dist/main.js
# ou, com um arquivo .env local (fora do git):
node --env-file=.env dist/main.js
```

A API responde em `http://127.0.0.1:3000/api/...` (prefixo `api`; os endpoints de contatos chegam nos CARD-006+).

> **Atenção:** sem Docker a API escuta em **todas as interfaces** da máquina, ou seja, fica acessível pela rede local.
> A restrição a `127.0.0.1` (ADR-010) chega com o Compose e a variável `HOST` no CARD-005. Até lá, rode só em redes
> confiáveis.

## Testes

```bash
npm test           # unitários (src/**/*.spec.ts), integração com SQLite temporário e estáticos (test/)
npm run test:e2e   # compila e sobe o processo real (test/*.e2e-spec.ts)
npm run lint
```

## Estrutura

Veja [`ARCHITECTURE.md`](./ARCHITECTURE.md): camadas, regras de dependência, nomes, tokens de DI, regras de SQL e o
roteiro para criar um módulo novo.
