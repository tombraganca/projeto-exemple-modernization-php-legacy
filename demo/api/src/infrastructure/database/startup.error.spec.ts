import {
  DatabaseStartupError,
  classifySqliteError,
  sqliteCodeOf,
} from './startup.error.js';

const sqliteError = (code: string, message = 'x'): Error =>
  Object.assign(new Error(message), { code });

describe('DatabaseStartupError', () => {
  describe('classifySqliteError', () => {
    it.each([
      'SQLITE_CANTOPEN',
      'SQLITE_PERM',
      'SQLITE_READONLY',
      'SQLITE_READONLY_DBMOVED',
      'SQLITE_AUTH',
    ])('%s é sempre falha de banco', (code) => {
      expect(classifySqliteError(sqliteError(code), 'migrations')).toBe(
        'database',
      );
      expect(classifySqliteError(sqliteError(code), 'seed')).toBe('database');
    });

    it.each(['SQLITE_NOTADB', 'SQLITE_CORRUPT', 'SQLITE_ERROR'])(
      '%s fica na etapa em curso',
      (code) => {
        expect(classifySqliteError(sqliteError(code), 'migrations')).toBe(
          'migrations',
        );
        expect(classifySqliteError(sqliteError(code), 'seed')).toBe('seed');
      },
    );

    it('erro sem código fica na etapa em curso', () => {
      expect(classifySqliteError(new Error('?'), 'database')).toBe('database');
      expect(classifySqliteError('texto', 'migrations')).toBe('migrations');
    });
  });

  it('sqliteCodeOf só aceita códigos SQLITE_*', () => {
    expect(sqliteCodeOf(sqliteError('SQLITE_NOTADB'))).toBe('SQLITE_NOTADB');
    expect(sqliteCodeOf(sqliteError('ENOENT'))).toBeUndefined();
    expect(sqliteCodeOf(null)).toBeUndefined();
  });

  it.each([
    [
      'database',
      'SQLITE_CANTOPEN',
      'banco',
      'não foi possível abrir o banco de dados (SQLITE_CANTOPEN)',
    ],
    [
      'migrations',
      'SQLITE_NOTADB',
      'migrations',
      'falha ao aplicar as migrations (SQLITE_NOTADB)',
    ],
    [
      'seed',
      'SQLITE_CONSTRAINT_CHECK',
      'seed',
      'falha ao inserir os contatos de exemplo (SQLITE_CONSTRAINT_CHECK)',
    ],
    ['database', undefined, 'banco', 'não foi possível abrir o banco de dados'],
  ] as const)('%s/%s → (%s) %s', (stage, code, label, message) => {
    const e = new DatabaseStartupError(stage, code);
    expect(e.code).toBe('STARTUP_FAILED');
    expect(e.stageLabel).toBe(label);
    expect(e.message).toBe(message);
  });

  it('from() classifica e nunca vaza o caminho nem a mensagem original', () => {
    const origem = sqliteError(
      'SQLITE_CANTOPEN',
      'unable to open /segredo/x.db',
    );
    const e = DatabaseStartupError.from(origem, 'migrations');
    expect(e.stage).toBe('database');
    expect(e.sqliteCode).toBe('SQLITE_CANTOPEN');
    expect(e.message).not.toContain('/segredo');
    expect(e.cause).toBe(origem);
  });

  it('from() devolve o mesmo erro se já for DatabaseStartupError', () => {
    const e = new DatabaseStartupError('seed', 'SQLITE_ERROR');
    expect(DatabaseStartupError.from(e, 'migrations')).toBe(e);
  });
});
