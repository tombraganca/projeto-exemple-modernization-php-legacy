import type { Kysely } from 'kysely';
import type { Database } from '../../../src/infrastructure/database/database.types.js';
import { initializeDatabase } from '../../../src/infrastructure/database/initialize-database.js';
import { CONTATOS_EXEMPLO } from '../../../src/infrastructure/database/seed/contatos.seed-data.js';
import { seedIfEmpty } from '../../../src/infrastructure/database/seed/seed.js';
import { DatabaseStartupError } from '../../../src/infrastructure/database/startup.error.js';
import {
  LIMITES_CONTATO,
  SEXOS,
} from '../../../src/modules/contatos/domain/contato.js';
import { KyselyContatoRepository } from '../../../src/modules/contatos/infrastructure/kysely-contato.repository.js';
import {
  INSERT_CONTATO_SQL,
  dadosValidos,
} from '../../support/contato.fixture.js';
import {
  createTempDir,
  openRaw,
  removeTempDir,
  tempDatabasePath,
  testSettings,
} from '../../support/temp-database.js';

describe('Seed opcional de contatos de exemplo', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = createTempDir();
    path = tempDatabasePath(dir);
  });

  afterEach(() => {
    removeTempDir(dir);
  });

  async function subir(seed: boolean): Promise<void> {
    const db = await initializeDatabase(testSettings(path, { seed }));
    await db.destroy();
  }

  function linhas(): Record<string, string | number>[] {
    const raw = openRaw(path);
    try {
      return raw.prepare('SELECT * FROM contato ORDER BY id').all() as Record<
        string,
        string | number
      >[];
    } finally {
      raw.close();
    }
  }

  it('SEED ligado em base vazia', async () => {
    await subir(true);

    const todos = linhas();
    expect(todos.length).toBeGreaterThan(20);
    expect(todos.length).toBe(CONTATOS_EXEMPLO.length);
    expect(new Set(todos.map((c) => c.sexo))).toEqual(new Set(SEXOS));
    for (const c of todos) {
      for (const campo of ['nome', 'endereco', 'telefone', 'email'] as const) {
        const valor = String(c[campo]);
        expect(Array.from(valor).length).toBeLessThanOrEqual(
          LIMITES_CONTATO[campo],
        );
        expect(valor.trim()).not.toBe('');
      }
      expect(String(c.email)).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(String(c.telefone)).toMatch(/^[1-9][1-9](9\d{8}|[2-5]\d{7})$/);
    }
    expect(
      todos.some((c) =>
        /[À-ÿ]/.test(`${String(c.nome)} ${String(c.endereco)}`),
      ),
    ).toBe(true);
  });

  it('SEED desligado', async () => {
    await subir(false);
    expect(linhas()).toHaveLength(0);
  });

  it('SEED ligado não duplica a cada subida', async () => {
    await subir(true);
    const n = linhas().length;

    await subir(true);

    expect(linhas()).toHaveLength(n);
  });

  it('SEED ligado não mexe em base que já tem dados', async () => {
    await subir(false);
    const raw = openRaw(path);
    const insert = raw.prepare(INSERT_CONTATO_SQL);
    insert.run(dadosValidos({ nome: 'Um' }));
    insert.run(dadosValidos({ nome: 'Dois' }));
    insert.run(dadosValidos({ nome: 'Três' }));
    raw.close();
    const antes = linhas();

    await subir(true);

    expect(linhas()).toEqual(antes);
  });

  it('Seed respeita as mesmas regras do banco', async () => {
    await expect(subir(true)).resolves.toBeUndefined();
  });

  it('falha no seed vira DatabaseStartupError na etapa seed', async () => {
    const db = await initializeDatabase(testSettings(path));
    await db.destroy();

    const erro = await seedIfEmpty(db, true).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(DatabaseStartupError);
    expect((erro as DatabaseStartupError).stage).toBe('seed');
  });

  it('Seed exercita a paginação', async () => {
    let db: Kysely<Database> | undefined;
    try {
      db = await initializeDatabase(testSettings(path, { seed: true }));
      const repo = new KyselyContatoRepository(db);

      const p1 = await repo.listar({ limite: 20, deslocamento: 0 });
      expect(p1.itens).toHaveLength(20);
      expect(p1.total).toBeGreaterThan(20);

      const p2 = await repo.listar({ limite: 20, deslocamento: 20 });
      expect(p2.itens.length).toBeGreaterThanOrEqual(1);
    } finally {
      await db?.destroy();
    }
  });
});
