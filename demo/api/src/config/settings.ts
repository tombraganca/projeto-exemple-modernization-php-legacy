import { EnvValidationError } from './env-validation.error.js';

/** Configuração da API, lida só do ambiente (RN-027). Sem nenhum valor padrão no código. */
export interface Settings {
  /** Caminho do arquivo SQLite (`SQLITE_PATH`). Relativo = a partir do diretório de trabalho do processo. */
  readonly sqlitePath: string;
  /** Porta HTTP (`PORT`). */
  readonly port: number;
  /** Semeia contatos de exemplo na base vazia (`SEED=true`). */
  readonly seed: boolean;
}

/** Token de injeção do `Settings`. */
export const SETTINGS = Symbol('SETTINGS');

export type Env = Readonly<Record<string, string | undefined>>;

function readSqlitePath(env: Env): string {
  const value = env.SQLITE_PATH?.trim() ?? '';
  if (value === '') throw new EnvValidationError('SQLITE_PATH', 'ausente');
  if (value === ':memory:' || value.toLowerCase().startsWith('file:')) {
    throw new EnvValidationError('SQLITE_PATH', 'inválida');
  }
  return value;
}

function readPort(env: Env): number {
  const value = env.PORT?.trim() ?? '';
  if (value === '') throw new EnvValidationError('PORT', 'ausente');
  if (!/^\d{1,5}$/.test(value))
    throw new EnvValidationError('PORT', 'inválida');
  const port = Number(value);
  if (port < 1 || port > 65535)
    throw new EnvValidationError('PORT', 'inválida');
  return port;
}

/** `SEED` liga só com `true` (sem diferenciar maiúsculas, após trim). Qualquer outro valor desliga (D-06). */
function readSeed(env: Env): boolean {
  return env.SEED?.trim().toLowerCase() === 'true';
}

/** Valida o ambiente e devolve `Settings` congelado. Lança `EnvValidationError`. */
export function loadSettings(env: Env): Settings {
  return Object.freeze({
    sqlitePath: readSqlitePath(env),
    port: readPort(env),
    seed: readSeed(env),
  });
}
