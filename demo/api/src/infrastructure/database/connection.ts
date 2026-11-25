import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './database.types.js';

export interface OpenedDatabase {
  readonly db: Kysely<Database>;
  /** Conexão nativa, para fechar quando a inicialização falha antes de o Kysely assumir. */
  readonly sqlite: BetterSqlite3.Database;
}

/**
 * Abre (ou cria) o arquivo SQLite no caminho dado. Não cria diretórios e não liga WAL.
 * Lança o erro do driver se não conseguir abrir.
 */
export function openDatabase(path: string): OpenedDatabase {
  const sqlite = new BetterSqlite3(path);
  const db = new Kysely<Database>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  return { db, sqlite };
}
