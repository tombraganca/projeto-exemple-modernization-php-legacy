import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { initializeDatabase } from '../../../src/infrastructure/database/initialize-database.js';
import { DatabaseStartupError } from '../../../src/infrastructure/database/startup.error.js';
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

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

describe('Migrations da tabela contato', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = createTempDir();
    path = tempDatabasePath(dir);
  });

  afterEach(() => {
    removeTempDir(dir);
  });

  async function subir(): Promise<void> {
    const db = await initializeDatabase(testSettings(path));
    await db.destroy();
  }

  function esquema(): string[] {
    const raw = openRaw(path);
    try {
      return raw
        .prepare<[], { sql: string | null }>(
          "SELECT sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_autoindex%' ORDER BY type, name",
        )
        .all()
        .map((r) => r.sql ?? '');
    } finally {
      raw.close();
    }
  }

  it('Banco ausente nasce vazio com o esquema completo', async () => {
    expect(existsSync(path)).toBe(false);

    await subir();

    expect(existsSync(path)).toBe(true);
    const raw = openRaw(path);
    try {
      const colunas = raw
        .prepare<[], ColumnInfo>('PRAGMA table_info(contato)')
        .all();
      expect(
        colunas.map(({ name, type, notnull, pk }) => ({
          name,
          type,
          notnull,
          pk,
        })),
      ).toEqual([
        { name: 'id', type: 'INTEGER', notnull: 0, pk: 1 },
        { name: 'nome', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'endereco', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'telefone', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'email', type: 'TEXT', notnull: 1, pk: 0 },
        { name: 'sexo', type: 'TEXT', notnull: 1, pk: 0 },
      ]);
      const ddl = raw
        .prepare<[], { sql: string }>(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'contato'",
        )
        .get()?.sql;
      expect(ddl).toMatch(/id\s+INTEGER PRIMARY KEY AUTOINCREMENT/);
      expect(
        raw
          .prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM contato')
          .get()?.n,
      ).toBe(0);
      expect(
        raw.prepare<[], { encoding: string }>('PRAGMA encoding').get()
          ?.encoding,
      ).toBe('UTF-8');
    } finally {
      raw.close();
    }
  });

  it('Tabela sem UNIQUE, sem timestamps e sem exclusão lógica', async () => {
    await subir();

    const raw = openRaw(path);
    try {
      expect(raw.prepare('PRAGMA index_list(contato)').all()).toEqual([]);
      const nomes = raw
        .prepare<[], ColumnInfo>('PRAGMA table_info(contato)')
        .all()
        .map((c) => c.name);
      expect(nomes).toEqual([
        'id',
        'nome',
        'endereco',
        'telefone',
        'email',
        'sexo',
      ]);
      const ddl =
        raw
          .prepare<[], { sql: string }>(
            "SELECT sql FROM sqlite_master WHERE name = 'contato'",
          )
          .get()?.sql ?? '';
      expect(ddl).not.toMatch(/UNIQUE/i);
    } finally {
      raw.close();
    }
  });

  it('Migrations são idempotentes', async () => {
    await subir();
    const raw = openRaw(path);
    const insert = raw.prepare(INSERT_CONTATO_SQL);
    insert.run(dadosValidos({ nome: 'Um' }));
    insert.run(dadosValidos({ nome: 'Dois' }));
    insert.run(dadosValidos({ nome: 'Três' }));
    raw.close();

    await subir();

    const depois = openRaw(path);
    try {
      expect(
        depois
          .prepare<[], { n: number }>(
            'SELECT COUNT(*) AS n FROM kysely_migration',
          )
          .get()?.n,
      ).toBe(1);
      expect(
        depois
          .prepare<[], { nome: string }>('SELECT nome FROM contato ORDER BY id')
          .all()
          .map((r) => r.nome),
      ).toEqual(['Um', 'Dois', 'Três']);
    } finally {
      depois.close();
    }
  });

  it('Subir duas vezes seguidas sem nenhum dado', async () => {
    await subir();
    const antes = esquema();

    await subir();

    expect(esquema()).toEqual(antes);
  });

  it('Falha de migration impede a subida e não toca no arquivo', async () => {
    const conteudo = Buffer.from('isto não é um banco SQLite\n'.repeat(40));
    writeFileSync(path, conteudo);

    const erro = await initializeDatabase(testSettings(path)).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(DatabaseStartupError);
    expect((erro as DatabaseStartupError).stage).toBe('migrations');
    expect((erro as DatabaseStartupError).sqliteCode).toBe('SQLITE_NOTADB');
    expect(readFileSync(path).equals(conteudo)).toBe(true);
  });

  it('Diretório do banco inexistente é falha na etapa banco', async () => {
    const erro = await initializeDatabase(
      testSettings(tempDatabasePath(`${dir}/nao-existe`)),
    ).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(DatabaseStartupError);
    expect((erro as DatabaseStartupError).stage).toBe('database');
    expect((erro as DatabaseStartupError).message).not.toContain(dir);
  });
});
