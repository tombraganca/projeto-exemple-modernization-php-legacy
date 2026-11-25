import type { Kysely } from 'kysely';
import type { Database } from '../../../src/infrastructure/database/database.types.js';
import { initializeDatabase } from '../../../src/infrastructure/database/initialize-database.js';
import { dadosValidos } from '../../support/contato.fixture.js';
import {
  createTempDir,
  removeTempDir,
  tempDatabasePath,
  testSettings,
} from '../../support/temp-database.js';

describe('Texto em UTF-8 sem depender do ambiente', () => {
  let dir: string;
  let db: Kysely<Database>;

  beforeEach(async () => {
    dir = createTempDir();
    db = await initializeDatabase(testSettings(tempDatabasePath(dir)));
  });

  afterEach(async () => {
    await db.destroy();
    removeTempDir(dir);
  });

  it.each([
    ['nome', 'João'],
    ['nome', 'Conceição Ávila Müller'],
    ['endereco', 'Rua das Acácias, 120 · Recife'],
    ['nome', 'Ñandú Çağlar'],
  ] as const)(
    'Acentos gravados e lidos idênticos: %s %j',
    async (campo, valor) => {
      const { id } = await db
        .insertInto('contato')
        .values(dadosValidos({ [campo]: valor }))
        .returning('id')
        .executeTakeFirstOrThrow();

      const linha = await db
        .selectFrom('contato')
        .select([campo])
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      const lido = linha[campo];
      expect(Buffer.from(lido, 'utf8').equals(Buffer.from(valor, 'utf8'))).toBe(
        true,
      );

      const { hex } = await db
        .selectFrom('contato')
        .select((eb) => eb.fn<string>('hex', [eb.ref(campo)]).as('hex'))
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
      expect(hex).toBe(
        Buffer.from(valor, 'utf8').toString('hex').toUpperCase(),
      );
    },
  );
});
