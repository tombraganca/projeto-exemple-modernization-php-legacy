import { AppError } from '../shared/domain/app-error.js';

export type EnvVariable = 'SQLITE_PATH' | 'PORT';
export type EnvProblem = 'ausente' | 'inválida';

/** Variável de ambiente obrigatória ausente ou inválida. A mensagem nunca traz o valor recebido. */
export class EnvValidationError extends AppError {
  readonly code = 'ENV_INVALID';

  constructor(
    readonly variable: EnvVariable,
    readonly reason: EnvProblem,
  ) {
    super(`variável ${variable} ${reason}`);
  }
}
