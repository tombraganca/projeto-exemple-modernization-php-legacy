import type { DadosContato } from '../../src/modules/contatos/domain/contato.js';

/** Contato válido pelas regras novas, com campos sobrescrevíveis. */
export function dadosValidos(
  override: Partial<DadosContato> = {},
): DadosContato {
  return {
    nome: 'Ana Beatriz Souza',
    endereco: 'Rua das Acácias, 120 · Recife',
    telefone: '81987654321',
    email: 'ana.souza@example.com',
    sexo: 'F',
    ...override,
  };
}

/** SQL de inserção direta (fora da aplicação), parametrizado. */
export const INSERT_CONTATO_SQL =
  'INSERT INTO contato (nome, endereco, telefone, email, sexo) VALUES (@nome, @endereco, @telefone, @email, @sexo)';
