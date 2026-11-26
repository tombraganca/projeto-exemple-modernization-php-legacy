import type { Migration, MigrationProvider } from 'kysely/migration';
import * as m0001 from './0001-create-contato.js';

/**
 * Todas as migrations, em ordem de nome. Mapa estático: as migrations vão para o `dist/` junto com o código
 * e rodam igual no Vitest e no `node dist/main.js`.
 */
export const MIGRATIONS: Readonly<Record<string, Migration>> = {
  '0001-create-contato': m0001,
};

export class StaticMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve({ ...MIGRATIONS });
  }
}
