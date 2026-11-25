import { EnvValidationError } from './config/env-validation.error.js';
import { DatabaseStartupError } from './infrastructure/database/startup.error.js';

/**
 * Linha de falha da subida para o stderr. Cita só a etapa e o motivo: nunca caminho, porta,
 * valor de variável nem dados de contato. Erros não previstos viram "erro inesperado".
 */
export function formatStartupFailure(error: unknown): string {
  if (error instanceof EnvValidationError) {
    return `[api] Falha na subida (config): ${error.message}.`;
  }
  if (error instanceof DatabaseStartupError) {
    return `[api] Falha na subida (${error.stageLabel}): ${error.message}.`;
  }
  return '[api] Falha na subida: erro inesperado.';
}
