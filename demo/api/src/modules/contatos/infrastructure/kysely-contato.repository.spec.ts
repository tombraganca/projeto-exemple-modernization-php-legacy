import type { Kysely } from 'kysely';
import type { Database } from '../../../infrastructure/database/database.types.js';
import { KyselyContatoRepository } from './kysely-contato.repository.js';

/** Kysely falso: qualquer acesso conta como "tocou no banco". */
function bancoEspiao(): { db: Kysely<Database>; acessos: () => number } {
  let acessos = 0;
  const db = new Proxy(
    {},
    {
      get() {
        acessos += 1;
        throw new Error('o banco não deveria ser consultado');
      },
    },
  ) as Kysely<Database>;
  return { db, acessos: () => acessos };
}

const DADOS = {
  nome: 'Ana',
  endereco: 'Rua A',
  telefone: '81987654321',
  email: 'a@example.com',
  sexo: 'F',
} as const;

const IDS_INVALIDOS: unknown[] = [
  0,
  -1,
  1.5,
  Number.NaN,
  Number.MAX_SAFE_INTEGER + 1,
  '1',
  '1 OR 1=1',
];

describe('KyselyContatoRepository (guardas)', () => {
  it.each(IDS_INVALIDOS)(
    'id inválido %j: null/false sem consultar o banco',
    async (id) => {
      const { db, acessos } = bancoEspiao();
      const repo = new KyselyContatoRepository(db);

      await expect(repo.obterPorId(id as number)).resolves.toBeNull();
      await expect(repo.atualizar(id as number, DADOS)).resolves.toBeNull();
      await expect(repo.excluir(id as number)).resolves.toBe(false);
      expect(acessos()).toBe(0);
    },
  );

  it.each([
    { limite: 0, deslocamento: 0 },
    { limite: 101, deslocamento: 0 },
    { limite: 20, deslocamento: -1 },
    { limite: 20, deslocamento: 1.5 },
  ])('listar %o: RangeError sem consultar o banco', async (params) => {
    const { db, acessos } = bancoEspiao();
    const repo = new KyselyContatoRepository(db);

    await expect(repo.listar(params)).rejects.toBeInstanceOf(RangeError);
    expect(acessos()).toBe(0);
  });
});
