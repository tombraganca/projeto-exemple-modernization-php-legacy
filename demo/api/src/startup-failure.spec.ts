import { EnvValidationError } from './config/env-validation.error.js';
import { DatabaseStartupError } from './infrastructure/database/startup.error.js';
import { formatStartupFailure } from './startup-failure.js';

describe('formatStartupFailure', () => {
  it.each([
    [
      new EnvValidationError('SQLITE_PATH', 'ausente'),
      '[api] Falha na subida (config): variável SQLITE_PATH ausente.',
    ],
    [
      new EnvValidationError('PORT', 'inválida'),
      '[api] Falha na subida (config): variável PORT inválida.',
    ],
    [
      new DatabaseStartupError('database', 'SQLITE_CANTOPEN'),
      '[api] Falha na subida (banco): não foi possível abrir o banco de dados (SQLITE_CANTOPEN).',
    ],
    [
      new DatabaseStartupError('migrations', 'SQLITE_NOTADB'),
      '[api] Falha na subida (migrations): falha ao aplicar as migrations (SQLITE_NOTADB).',
    ],
    [
      new DatabaseStartupError('seed', 'SQLITE_CONSTRAINT_CHECK'),
      '[api] Falha na subida (seed): falha ao inserir os contatos de exemplo (SQLITE_CONSTRAINT_CHECK).',
    ],
  ])('%s', (erro, linha) => {
    expect(formatStartupFailure(erro)).toBe(linha);
  });

  it('erro não previsto não vaza a mensagem original', () => {
    const linha = formatStartupFailure(
      new Error('EADDRINUSE /segredo porta 3000'),
    );
    expect(linha).toBe('[api] Falha na subida: erro inesperado.');
  });
});
