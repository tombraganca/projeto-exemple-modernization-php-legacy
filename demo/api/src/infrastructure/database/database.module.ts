import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { SETTINGS, type Settings } from '../../config/settings.js';
import type { Database } from './database.types.js';
import { initializeDatabase } from './initialize-database.js';

/** Token de injeção do `Kysely<Database>` já migrado. Só adapters em `modules/*\/infrastructure` o injetam. */
export const DATABASE = Symbol('DATABASE');

@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [SETTINGS],
      useFactory: (settings: Settings) => initializeDatabase(settings),
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}
