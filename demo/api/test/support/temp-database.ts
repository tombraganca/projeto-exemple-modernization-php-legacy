import BetterSqlite3 from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Settings } from '../../src/config/settings.js';

/** Cria um diretório temporário exclusivo para o teste. */
export function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'agenda-api-'));
}

/** Remove o diretório temporário e tudo dentro dele. */
export function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** Caminho do arquivo SQLite dentro do diretório temporário (o arquivo não é criado). */
export function tempDatabasePath(dir: string, file = 'contato.sqlite'): string {
  return join(dir, file);
}

/** `Settings` montado à mão para testes (`port: 0` só é aceito aqui). */
export function testSettings(
  sqlitePath: string,
  overrides: Partial<Settings> = {},
): Settings {
  return Object.freeze({ sqlitePath, port: 0, seed: false, ...overrides });
}

/** Conexão nativa direta ao arquivo, para inspecionar ou inserir "diretamente no banco". */
export function openRaw(path: string): BetterSqlite3.Database {
  return new BetterSqlite3(path);
}

/** Lê o `code` de um erro lançado de forma síncrona. */
export function errorCodeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}
