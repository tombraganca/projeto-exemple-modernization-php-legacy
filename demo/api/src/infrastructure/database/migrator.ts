import type { Kysely } from 'kysely';
import { Migrator } from 'kysely/migration';
import { StaticMigrationProvider } from './migrations/index.js';
import { DatabaseStartupError } from './startup.error.js';

/**
 * Aplica as migrations pendentes. Idempotente: a tabela `kysely_migration` registra o que já rodou.
 * Lança `DatabaseStartupError` (etapa `migrations`, ou `database` se o erro for de acesso ao arquivo).
 */
export async function migrateToLatest(db: Kysely<any>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });
  const { error } = await migrator.migrateToLatest();
  if (error !== undefined) throw DatabaseStartupError.from(error, 'migrations');
}
