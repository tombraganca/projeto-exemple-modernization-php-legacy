import {
  LIMITES_CONTATO,
  SEXOS,
  isSexo,
} from '../../../modules/contatos/domain/contato.js';
import { CONTATOS_EXEMPLO } from './contatos.seed-data.js';

const tamanho = (s: string): number => Array.from(s).length;
const CAMPOS_TEXTO = ['nome', 'endereco', 'telefone', 'email'] as const;

describe('CONTATOS_EXEMPLO', () => {
  it('tem mais de 20 contatos (exercita a paginação de 20)', () => {
    expect(CONTATOS_EXEMPLO.length).toBe(24);
  });

  it('cobre os quatro códigos de sexo, ao menos 4 de cada', () => {
    for (const sexo of SEXOS) {
      expect(
        CONTATOS_EXEMPLO.filter((c) => c.sexo === sexo).length,
      ).toBeGreaterThanOrEqual(4);
    }
    expect(CONTATOS_EXEMPLO.every((c) => isSexo(c.sexo))).toBe(true);
  });

  it('respeita os limites por caractere e tem um nome com 50 e um endereço com 80', () => {
    for (const c of CONTATOS_EXEMPLO) {
      for (const campo of CAMPOS_TEXTO) {
        expect(tamanho(c[campo])).toBeLessThanOrEqual(LIMITES_CONTATO[campo]);
      }
    }
    expect(
      CONTATOS_EXEMPLO.some((c) => tamanho(c.nome) === LIMITES_CONTATO.nome),
    ).toBe(true);
    expect(
      CONTATOS_EXEMPLO.some(
        (c) => tamanho(c.endereco) === LIMITES_CONTATO.endereco,
      ),
    ).toBe(true);
  });

  it('tem e-mails válidos, em minúsculas, no domínio example.com', () => {
    for (const { email } of CONTATOS_EXEMPLO) {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(email).toBe(email.toLowerCase());
      expect(email.endsWith('@example.com')).toBe(true);
    }
  });

  it('tem telefones brasileiros só com dígitos: fixo (10) e celular (11)', () => {
    const re = /^[1-9][1-9](9\d{8}|[2-5]\d{7})$/;
    for (const { telefone } of CONTATOS_EXEMPLO) {
      expect(telefone).toMatch(re);
    }
    expect(CONTATOS_EXEMPLO.some((c) => c.telefone.length === 10)).toBe(true);
    expect(CONTATOS_EXEMPLO.some((c) => c.telefone.length === 11)).toBe(true);
  });

  it('não tem campo vazio nem com espaço nas pontas', () => {
    for (const c of CONTATOS_EXEMPLO) {
      for (const campo of CAMPOS_TEXTO) {
        expect(c[campo].trim()).toBe(c[campo]);
        expect(c[campo]).not.toBe('');
      }
    }
  });

  it('tem acentos ("João Pedro Araújo" e "Rua das Acácias, 120 · Recife")', () => {
    expect(CONTATOS_EXEMPLO.map((c) => c.nome)).toContain('João Pedro Araújo');
    expect(CONTATOS_EXEMPLO.map((c) => c.endereco)).toContain(
      'Rua das Acácias, 120 · Recife',
    );
  });
});
