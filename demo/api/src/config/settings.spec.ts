import { EnvValidationError } from './env-validation.error.js';
import { loadSettings, type Env } from './settings.js';

const VALIDO: Env = { SQLITE_PATH: '/tmp/agenda/contato.sqlite', PORT: '3000' };

function erroDe(env: Env): EnvValidationError {
  try {
    loadSettings(env);
  } catch (e) {
    if (e instanceof EnvValidationError) return e;
    throw e;
  }
  throw new Error('esperava EnvValidationError');
}

describe('loadSettings', () => {
  it('lê caminho, porta e seed do ambiente', () => {
    expect(loadSettings({ ...VALIDO, SEED: 'true' })).toEqual({
      sqlitePath: '/tmp/agenda/contato.sqlite',
      port: 3000,
      seed: true,
    });
  });

  it('remove espaços nas pontas do caminho', () => {
    expect(
      loadSettings({ ...VALIDO, SQLITE_PATH: '  ./data/a.sqlite ' }).sqlitePath,
    ).toBe('./data/a.sqlite');
  });

  it('devolve um objeto congelado', () => {
    expect(Object.isFrozen(loadSettings(VALIDO))).toBe(true);
  });

  describe('SQLITE_PATH', () => {
    it.each([undefined, '', '   '])('%j → ausente', (valor) => {
      const e = erroDe({ ...VALIDO, SQLITE_PATH: valor });
      expect(e.variable).toBe('SQLITE_PATH');
      expect(e.reason).toBe('ausente');
      expect(e.message).toBe('variável SQLITE_PATH ausente');
      expect(e.code).toBe('ENV_INVALID');
    });

    it.each([':memory:', 'file:x.db', 'FILE:/tmp/x.db'])(
      '%j → inválida',
      (valor) => {
        const e = erroDe({ ...VALIDO, SQLITE_PATH: valor });
        expect(e.variable).toBe('SQLITE_PATH');
        expect(e.reason).toBe('inválida');
        expect(e.message).not.toContain(valor);
      },
    );
  });

  describe('PORT', () => {
    it.each([undefined, '', '  '])('%j → ausente', (valor) => {
      const e = erroDe({ ...VALIDO, PORT: valor });
      expect(e.variable).toBe('PORT');
      expect(e.reason).toBe('ausente');
    });

    it.each(['abc', '0', '65536', '3000.5', '-1', '1e3', '99999'])(
      '%j → inválida',
      (valor) => {
        const e = erroDe({ ...VALIDO, PORT: valor });
        expect(e.variable).toBe('PORT');
        expect(e.reason).toBe('inválida');
        expect(e.message).toBe('variável PORT inválida');
        expect(e.message).not.toContain(valor);
      },
    );

    it.each([
      ['1', 1],
      ['65535', 65535],
      [' 8080 ', 8080],
    ])('%j → %d', (valor, esperado) => {
      expect(loadSettings({ ...VALIDO, PORT: valor }).port).toBe(esperado);
    });
  });

  describe('SEED', () => {
    it.each(['true', 'TRUE', 'True', ' true '])('%j → ligado', (valor) => {
      expect(loadSettings({ ...VALIDO, SEED: valor }).seed).toBe(true);
    });

    it.each([undefined, 'false', '1', 'yes', '', 'truee'])(
      '%j → desligado',
      (valor) => {
        expect(loadSettings({ ...VALIDO, SEED: valor }).seed).toBe(false);
      },
    );
  });

  it('a mensagem nunca contém o valor recebido', () => {
    const segredo = '/segredo/banco.sqlite';
    expect(
      erroDe({ SQLITE_PATH: segredo, PORT: 'porta-secreta' }).message,
    ).not.toMatch(/segredo|porta-secreta/);
  });
});
