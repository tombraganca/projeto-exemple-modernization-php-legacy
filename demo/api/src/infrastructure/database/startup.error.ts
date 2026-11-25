import { AppError } from '../../shared/domain/app-error.js';

export type StartupStage = 'database' | 'migrations' | 'seed';

/** Rótulo da etapa na mensagem de falha da subida. */
export const STAGE_LABEL: Readonly<Record<StartupStage, string>> = {
  database: 'banco',
  migrations: 'migrations',
  seed: 'seed',
};

const STAGE_MESSAGE: Readonly<Record<StartupStage, string>> = {
  database: 'não foi possível abrir o banco de dados',
  migrations: 'falha ao aplicar as migrations',
  seed: 'falha ao inserir os contatos de exemplo',
};

/** Códigos do SQLite que indicam problema de acesso ao arquivo, qualquer que seja a etapa. */
const ACCESS_CODES = /^SQLITE_(CANTOPEN|PERM|READONLY|AUTH)(_|$)/;

/** Extrai o `code` de um `SqliteError` (ou de qualquer erro com `code` `SQLITE_*`). */
export function sqliteCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && code.startsWith('SQLITE_')
    ? code
    : undefined;
}

/** Decide a etapa da falha: erros de acesso ao arquivo são sempre `database`; o resto fica na etapa em curso. */
export function classifySqliteError(
  error: unknown,
  currentStage: StartupStage,
): StartupStage {
  const code = sqliteCodeOf(error);
  if (code !== undefined && ACCESS_CODES.test(code)) return 'database';
  return currentStage;
}

/**
 * Falha ao preparar o banco na subida. A mensagem traz só a etapa e o código do SQLite:
 * nunca o caminho do arquivo, valores de configuração ou dados de contato.
 */
export class DatabaseStartupError extends AppError {
  readonly code = 'STARTUP_FAILED';

  constructor(
    readonly stage: StartupStage,
    readonly sqliteCode?: string,
    options?: { cause?: unknown },
  ) {
    super(
      sqliteCode
        ? `${STAGE_MESSAGE[stage]} (${sqliteCode})`
        : STAGE_MESSAGE[stage],
      options,
    );
  }

  get stageLabel(): string {
    return STAGE_LABEL[this.stage];
  }

  /** Embrulha um erro qualquer, classificando a etapa pelo código do SQLite. */
  static from(
    error: unknown,
    currentStage: StartupStage,
  ): DatabaseStartupError {
    if (error instanceof DatabaseStartupError) return error;
    return new DatabaseStartupError(
      classifySqliteError(error, currentStage),
      sqliteCodeOf(error),
      { cause: error },
    );
  }
}
