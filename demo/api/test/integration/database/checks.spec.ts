import type BetterSqlite3 from 'better-sqlite3';
import { initializeDatabase } from '../../../src/infrastructure/database/initialize-database.js';
import {
  LIMITES_CONTATO,
  SEXOS,
} from '../../../src/modules/contatos/domain/contato.js';
import {
  INSERT_CONTATO_SQL,
  dadosValidos,
} from '../../support/contato.fixture.js';
import {
  createTempDir,
  errorCodeOf,
  openRaw,
  removeTempDir,
  tempDatabasePath,
  testSettings,
} from '../../support/temp-database.js';

type Campo = keyof typeof LIMITES_CONTATO;
const CAMPOS = Object.keys(LIMITES_CONTATO) as Campo[];

/** Valor de `n` caracteres que respeita o formato do campo (para isolar o CHECK de tamanho). */
function textoCom(campo: Campo, n: number): string {
  if (campo === 'email')
    return `${'a'.repeat(n - '@example.com'.length)}@example.com`;
  if (campo === 'telefone') return '9'.repeat(n);
  return 'x'.repeat(n);
}

describe('Regras de dados garantidas pelo banco', () => {
  let dir: string;
  let raw: BetterSqlite3.Database;

  beforeEach(async () => {
    dir = createTempDir();
    const path = tempDatabasePath(dir);
    const db = await initializeDatabase(testSettings(path));
    await db.destroy();
    raw = openRaw(path);
  });

  afterEach(() => {
    raw.close();
    removeTempDir(dir);
  });

  const inserir = (dados: Record<string, unknown>): number =>
    Number(raw.prepare(INSERT_CONTATO_SQL).run(dados).lastInsertRowid);
  const tentarInserir = (dados: Record<string, unknown>): string | undefined =>
    errorCodeOf(() => raw.prepare(INSERT_CONTATO_SQL).run(dados));
  const contar = (): number =>
    raw.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM contato').get()!
      .n;
  const ler = (id: number): Record<string, unknown> =>
    raw.prepare('SELECT * FROM contato WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;

  it('os limites do DDL batem com LIMITES_CONTATO e o domínio com SEXOS', () => {
    const ddl = raw
      .prepare<[], { sql: string }>(
        "SELECT sql FROM sqlite_master WHERE name = 'contato'",
      )
      .get()!.sql;
    for (const campo of CAMPOS) {
      expect(ddl).toContain(
        `CHECK (length(${campo}) <= ${LIMITES_CONTATO[campo]})`,
      );
    }
    expect(ddl).toContain(
      `CHECK (sexo IN (${SEXOS.map((s) => `'${s}'`).join(', ')}))`,
    );
  });

  describe('Domínio de sexo', () => {
    it.each([...SEXOS])('Códigos de sexo aceitos: %s', (codigo) => {
      const id = inserir(dadosValidos({ sexo: codigo }));
      expect(ler(id).sexo).toBe(codigo);
    });

    it.each(['X', 'm', 'MF', '', ' M'])(
      'Códigos de sexo rejeitados: %j',
      (valor) => {
        expect(tentarInserir({ ...dadosValidos(), sexo: valor })).toBe(
          'SQLITE_CONSTRAINT_CHECK',
        );
        expect(contar()).toBe(0);
      },
    );

    it('Sexo nulo rejeitado', () => {
      expect(tentarInserir({ ...dadosValidos(), sexo: null })).toBe(
        'SQLITE_CONSTRAINT_NOTNULL',
      );
      expect(contar()).toBe(0);
    });

    it('Atualização para sexo inválido também é rejeitada', () => {
      const id = inserir(dadosValidos({ sexo: 'F' }));
      expect(
        errorCodeOf(() =>
          raw.prepare('UPDATE contato SET sexo = ? WHERE id = ?').run('X', id),
        ),
      ).toBe('SQLITE_CONSTRAINT_CHECK');
      expect(ler(id).sexo).toBe('F');
    });
  });

  describe('Limites de tamanho', () => {
    it.each(CAMPOS)('Tamanho exato no limite é aceito: %s', (campo) => {
      const valor = textoCom(campo, LIMITES_CONTATO[campo]);
      const id = inserir({ ...dadosValidos(), [campo]: valor });
      expect(ler(id)[campo]).toBe(valor);
    });

    it.each(CAMPOS)('Limite + 1 é rejeitado: %s', (campo) => {
      const valor = textoCom(campo, LIMITES_CONTATO[campo] + 1);
      expect(tentarInserir({ ...dadosValidos(), [campo]: valor })).toBe(
        'SQLITE_CONSTRAINT_CHECK',
      );
      expect(contar()).toBe(0);
    });

    it('Limite conta caracteres, não bytes (nome acentuado no limite)', () => {
      const nome = 'ã'.repeat(50);
      const id = inserir(dadosValidos({ nome }));
      const linha = raw
        .prepare<[number], { nome: string; bytes: number }>(
          'SELECT nome, length(CAST(nome AS BLOB)) AS bytes FROM contato WHERE id = ?',
        )
        .get(id)!;
      expect(linha.nome).toBe(nome);
      expect(linha.bytes).toBe(100);
    });

    it('Nome acentuado acima do limite é rejeitado', () => {
      expect(tentarInserir(dadosValidos({ nome: 'ã'.repeat(51) }))).toBe(
        'SQLITE_CONSTRAINT_CHECK',
      );
      expect(contar()).toBe(0);
    });

    it('Atualização acima do limite é rejeitada', () => {
      const id = inserir(dadosValidos({ nome: 'Ana' }));
      expect(
        errorCodeOf(() =>
          raw
            .prepare('UPDATE contato SET nome = ? WHERE id = ?')
            .run('x'.repeat(51), id),
        ),
      ).toBe('SQLITE_CONSTRAINT_CHECK');
      expect(ler(id).nome).toBe('Ana');
    });

    it.each(CAMPOS)(
      'Campos de texto obrigatórios não aceitam nulo: %s',
      (campo) => {
        expect(tentarInserir({ ...dadosValidos(), [campo]: null })).toBe(
          'SQLITE_CONSTRAINT_NOTNULL',
        );
        expect(contar()).toBe(0);
      },
    );
  });

  it('Dois contatos idênticos são gravados', () => {
    const a = inserir(dadosValidos());
    const b = inserir(dadosValidos());
    expect(a).not.toBe(b);
    expect(contar()).toBe(2);
  });
});
