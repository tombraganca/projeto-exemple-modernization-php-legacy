import { assertParametrosPaginacao } from './pagination.js';

describe('assertParametrosPaginacao', () => {
  it.each([
    { limite: 20, deslocamento: 0 },
    { limite: 100, deslocamento: 40 },
    { limite: 1, deslocamento: 0 },
  ])('aceita %o', (p) => {
    expect(() => assertParametrosPaginacao(p)).not.toThrow();
  });

  it.each([
    { limite: 0, deslocamento: 0 },
    { limite: 101, deslocamento: 0 },
    { limite: 1.5, deslocamento: 0 },
    { limite: Number.NaN, deslocamento: 0 },
    { limite: 20, deslocamento: -1 },
    { limite: 20, deslocamento: 1.5 },
    { limite: 20, deslocamento: Number.NaN },
  ])('rejeita %o com RangeError', (p) => {
    expect(() => assertParametrosPaginacao(p)).toThrow(RangeError);
  });
});
