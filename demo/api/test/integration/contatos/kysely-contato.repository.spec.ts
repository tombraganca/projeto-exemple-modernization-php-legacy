import type { Kysely } from 'kysely';
import { performance } from 'node:perf_hooks';
import type { Database } from '../../../src/infrastructure/database/database.types.js';
import { initializeDatabase } from '../../../src/infrastructure/database/initialize-database.js';
import type { ContatoRepository } from '../../../src/modules/contatos/application/contato.repository.js';
import { KyselyContatoRepository } from '../../../src/modules/contatos/infrastructure/kysely-contato.repository.js';
import { dadosValidos } from '../../support/contato.fixture.js';
import {
  createTempDir,
  removeTempDir,
  tempDatabasePath,
  testSettings,
} from '../../support/temp-database.js';

describe('Repositório de contato (Kysely + SQLite real)', () => {
  let dir: string;
  let db: Kysely<Database>;
  let repo: ContatoRepository;

  beforeEach(async () => {
    dir = createTempDir();
    db = await initializeDatabase(testSettings(tempDatabasePath(dir)));
    repo = new KyselyContatoRepository(db);
  });

  afterEach(async () => {
    await db.destroy();
    removeTempDir(dir);
  });

  async function criar(n: number): Promise<number[]> {
    const ids: number[] = [];
    for (let i = 1; i <= n; i += 1) {
      ids.push((await repo.inserir(dadosValidos({ nome: `Contato ${i}` }))).id);
    }
    return ids;
  }

  async function contar(): Promise<number> {
    const { n } = await db
      .selectFrom('contato')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .executeTakeFirstOrThrow();
    return Number(n);
  }

  const range = (de: number, ate: number): number[] =>
    Array.from({ length: de - ate + 1 }, (_, i) => de - i);

  describe('listar', () => {
    it('Listar paginado em ordem decrescente de id', async () => {
      await criar(25);
      const pagina = await repo.listar({ limite: 20, deslocamento: 0 });
      expect(pagina.itens.map((c) => c.id)).toEqual(range(25, 6));
      expect(pagina.total).toBe(25);
    });

    it('Segunda página traz o restante', async () => {
      await criar(25);
      const pagina = await repo.listar({ limite: 20, deslocamento: 20 });
      expect(pagina.itens.map((c) => c.id)).toEqual(range(5, 1));
      expect(pagina.total).toBe(25);
    });

    it('Página além do fim', async () => {
      await criar(25);
      expect(await repo.listar({ limite: 20, deslocamento: 40 })).toEqual({
        itens: [],
        total: 25,
      });
    });

    it('Base vazia', async () => {
      expect(await repo.listar({ limite: 20, deslocamento: 0 })).toEqual({
        itens: [],
        total: 0,
      });
    });

    it('Ordem segue id mesmo após atualização', async () => {
      await criar(3);
      await repo.atualizar(1, dadosValidos({ nome: 'Atualizado' }));
      const pagina = await repo.listar({ limite: 20, deslocamento: 0 });
      expect(pagina.itens.map((c) => c.id)).toEqual([3, 2, 1]);
    });

    it('devolve objetos de domínio com os seis campos', async () => {
      await criar(1);
      const [c] = (await repo.listar({ limite: 20, deslocamento: 0 })).itens;
      expect(Object.keys(c).sort()).toEqual(
        ['email', 'endereco', 'id', 'nome', 'sexo', 'telefone'].sort(),
      );
    });
  });

  describe('obterPorId', () => {
    it('Obter por id existente', async () => {
      await criar(9);
      const dados = dadosValidos({ nome: 'Décimo', sexo: 'O' });
      const { id } = await repo.inserir(dados);
      expect(id).toBe(10);
      expect(await repo.obterPorId(10)).toEqual({ id: 10, ...dados });
    });

    it('Obter por id inexistente', async () => {
      await expect(repo.obterPorId(999)).resolves.toBeNull();
    });
  });

  it('Inserir devolve o id gerado', async () => {
    const dados = dadosValidos({ sexo: 'N' });
    const gravado = await repo.inserir(dados);
    expect(gravado).toEqual({ id: expect.any(Number), ...dados });
    expect(await repo.obterPorId(gravado.id)).toEqual(gravado);
  });

  it('Inserir ignora propriedades extras', async () => {
    const dados = { ...dadosValidos(), id: 999, excluido: 1 };
    const gravado = await repo.inserir(dados);
    expect(gravado.id).toBe(1);
    expect(gravado).not.toHaveProperty('excluido');
  });

  describe('atualizar', () => {
    it('Atualizar existente', async () => {
      await criar(12);
      const antes11 = await repo.obterPorId(11);
      const novos = dadosValidos({
        nome: 'Novo Nome',
        endereco: 'Av. Nova, 1',
        telefone: '1132104321',
        email: 'novo@example.com',
        sexo: 'M',
      });

      expect(await repo.atualizar(10, novos)).toEqual({ id: 10, ...novos });
      expect(await repo.obterPorId(10)).toEqual({ id: 10, ...novos });
      expect(await repo.obterPorId(11)).toEqual(antes11);
    });

    it('Atualizar inexistente', async () => {
      await criar(2);
      await expect(repo.atualizar(999, dadosValidos())).resolves.toBeNull();
      expect(await contar()).toBe(2);
    });
  });

  describe('excluir', () => {
    it('Excluir inexistente', async () => {
      await criar(2);
      await expect(repo.excluir(999)).resolves.toBe(false);
      expect(await contar()).toBe(2);
    });

    it('Exclusão remove a linha fisicamente', async () => {
      await criar(7);
      await expect(repo.excluir(7)).resolves.toBe(true);
      expect(await repo.obterPorId(7)).toBeNull();
      const linha = await db
        .selectFrom('contato')
        .select('id')
        .where('id', '=', 7)
        .executeTakeFirst();
      expect(linha).toBeUndefined();
      expect(await contar()).toBe(6);
    });

    it('Id não é reaproveitado depois da exclusão', async () => {
      await criar(7);
      await repo.excluir(7);
      expect((await repo.inserir(dadosValidos())).id).toBe(8);
    });
  });

  describe('segurança das consultas', () => {
    it('Valores com caracteres de SQL são gravados literalmente', async () => {
      await criar(2);
      const nome = "Robert'); DROP TABLE contato;--";
      const { id } = await repo.inserir(dadosValidos({ nome }));
      expect((await repo.obterPorId(id))?.nome).toBe(nome);
      expect(await contar()).toBe(3);
    });

    it('Id malicioso não altera a consulta', async () => {
      await criar(5);
      const malicioso = '1 OR 1=1' as unknown as number;
      await expect(repo.obterPorId(malicioso)).resolves.toBeNull();
      await expect(repo.excluir(malicioso)).resolves.toBe(false);
      await expect(
        repo.atualizar(malicioso, dadosValidos()),
      ).resolves.toBeNull();
      expect(await contar()).toBe(5);
    });
  });

  it('RNF: listar e obterPorId em menos de 100 ms com 1.000 contatos', async () => {
    await db
      .insertInto('contato')
      .values(
        Array.from({ length: 1000 }, (_, i) =>
          dadosValidos({ nome: `Contato ${i + 1}` }),
        ),
      )
      .execute();
    await repo.listar({ limite: 20, deslocamento: 0 });

    let inicio = performance.now();
    const pagina = await repo.listar({ limite: 20, deslocamento: 980 });
    expect(performance.now() - inicio).toBeLessThan(100);
    expect(pagina.total).toBe(1000);

    inicio = performance.now();
    await repo.obterPorId(500);
    expect(performance.now() - inicio).toBeLessThan(100);
  });
});
