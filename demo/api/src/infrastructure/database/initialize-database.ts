import type { Kysely } from 'kysely';
import type { Settings } from '../../config/settings.js';
import { openDatabase, type OpenedDatabase } from './connection.js';
import type { Database } from './database.types.js';
import { migrateToLatest } from './migrator.js';
import { DatabaseStartupError } from './startup.error.js';

/**
 * Prepara o banco para a aplicação: abre o arquivo e aplica as migrations.
 * Em falha, fecha a conexão e lança `DatabaseStartupError`. Nunca apaga, trunca ou recria o arquivo existente.
 */
export async function initializeDatabase(
  settings: Pick<Settings, 'sqlitePath' | 'seed'>,
): Promise<Kysely<Database>> {
  let opened: OpenedDatabase;
  try {
    opened = openDatabase(settings.sqlitePath);
  } catch (error) {
    throw DatabaseStartupError.from(error, 'database');
  }

  try {
    await migrateToLatest(opened.db);
    return opened.db;
  } catch (error) {
    if (opened.sqlite.open) opened.sqlite.close();
    throw DatabaseStartupError.from(error, 'migrations');
  }
}
