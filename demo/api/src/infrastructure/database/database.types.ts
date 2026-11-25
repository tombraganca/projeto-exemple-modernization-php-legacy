import type { Generated } from 'kysely';

/**
 * Tipos das tabelas para o Kysely. Espelham o SQL das migrations, não o domínio:
 * a conversão de linha para objeto de domínio é feita pelo adapter.
 */
export interface ContatoTable {
  id: Generated<number>;
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
  /** O CHECK garante M/F/O/N; o adapter converte com `isSexo`. */
  sexo: string;
}

export interface Database {
  contato: ContatoTable;
}
