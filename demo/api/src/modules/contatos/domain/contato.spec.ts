import { LIMITES_CONTATO, SEXOS, isIdContato, isSexo } from './contato.js';

describe('domínio de contato', () => {
  it('tem os quatro códigos de sexo do ADR-013', () => {
    expect(SEXOS).toEqual(['M', 'F', 'O', 'N']);
  });

  it('tem os limites de tamanho do legado (RN-005)', () => {
    expect(LIMITES_CONTATO).toEqual({
      nome: 50,
      endereco: 80,
      telefone: 35,
      email: 40,
    });
  });

  describe('isSexo', () => {
    it.each(['M', 'F', 'O', 'N'])('aceita %j', (v) => {
      expect(isSexo(v)).toBe(true);
    });

    it.each(['m', 'X', '', ' M', 'MF', null, undefined, 1])(
      'recusa %j',
      (v) => {
        expect(isSexo(v)).toBe(false);
      },
    );
  });

  describe('isIdContato', () => {
    it.each([1, 42, Number.MAX_SAFE_INTEGER])('aceita %j', (v) => {
      expect(isIdContato(v)).toBe(true);
    });

    it.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      '1',
      '1 OR 1=1',
      null,
      undefined,
    ])('recusa %j', (v) => {
      expect(isIdContato(v)).toBe(false);
    });
  });
});
