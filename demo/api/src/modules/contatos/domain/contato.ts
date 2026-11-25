/** Códigos de sexo (ADR-013): Masculino, Feminino, Outro, Não informado. */
export const SEXOS = ['M', 'F', 'O', 'N'] as const;
export type Sexo = (typeof SEXOS)[number];

export const isSexo = (valor: unknown): valor is Sexo =>
  typeof valor === 'string' && (SEXOS as readonly string[]).includes(valor);

/** Tamanho máximo de cada campo, em caracteres (code points), como o `length()` do SQLite (RN-005, D-03). */
export const LIMITES_CONTATO = {
  nome: 50,
  endereco: 80,
  telefone: 35,
  email: 40,
} as const;

export interface Contato {
  readonly id: number;
  readonly nome: string;
  readonly endereco: string;
  readonly telefone: string;
  readonly email: string;
  readonly sexo: Sexo;
}

/** Dados de um contato sem o id gerado pelo banco. */
export type DadosContato = Omit<Contato, 'id'>;

/** Id válido de contato: inteiro seguro maior que zero. */
export const isIdContato = (id: unknown): id is number =>
  Number.isSafeInteger(id) && (id as number) > 0;
