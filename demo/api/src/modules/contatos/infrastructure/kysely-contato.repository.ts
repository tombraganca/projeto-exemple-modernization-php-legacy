import { Inject, Injectable } from '@nestjs/common';
import type { Kysely, Selectable } from 'kysely';
import { DATABASE } from '../../../infrastructure/database/database.module.js';
import type {
  ContatoTable,
  Database,
} from '../../../infrastructure/database/database.types.js';
import {
  assertParametrosPaginacao,
  type Pagina,
  type ParametrosPaginacao,
} from '../../../shared/domain/pagination.js';
import { ContatoRepository } from '../application/contato.repository.js';
import {
  isIdContato,
  isSexo,
  type Contato,
  type DadosContato,
} from '../domain/contato.js';

/** Monta o objeto de domínio campo a campo, sem devolver a linha crua. */
function toContato(row: Selectable<ContatoTable>): Contato {
  if (!isSexo(row.sexo)) {
    throw new Error('valor de sexo fora do domínio lido do banco');
  }
  return {
    id: row.id,
    nome: row.nome,
    endereco: row.endereco,
    telefone: row.telefone,
    email: row.email,
    sexo: row.sexo,
  };
}

/** Só os cinco campos gravados, descartando propriedades extras. */
function toRow(dados: DadosContato): Omit<ContatoTable, 'id'> {
  return {
    nome: dados.nome,
    endereco: dados.endereco,
    telefone: dados.telefone,
    email: dados.email,
    sexo: dados.sexo,
  };
}

@Injectable()
export class KyselyContatoRepository extends ContatoRepository {
  constructor(@Inject(DATABASE) private readonly db: Kysely<Database>) {
    super();
  }

  async listar(params: ParametrosPaginacao): Promise<Pagina<Contato>> {
    assertParametrosPaginacao(params);
    return this.db.transaction().execute(async (trx) => {
      const rows = await trx
        .selectFrom('contato')
        .selectAll()
        .orderBy('id', 'desc')
        .limit(params.limite)
        .offset(params.deslocamento)
        .execute();
      const { total } = await trx
        .selectFrom('contato')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      return { itens: rows.map(toContato), total: Number(total) };
    });
  }

  async obterPorId(id: number): Promise<Contato | null> {
    if (!isIdContato(id)) return null;
    const row = await this.db
      .selectFrom('contato')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toContato(row) : null;
  }

  async inserir(dados: DadosContato): Promise<Contato> {
    const row = await this.db
      .insertInto('contato')
      .values(toRow(dados))
      .returningAll()
      .executeTakeFirstOrThrow();
    return toContato(row);
  }

  async atualizar(id: number, dados: DadosContato): Promise<Contato | null> {
    if (!isIdContato(id)) return null;
    const row = await this.db
      .updateTable('contato')
      .set(toRow(dados))
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    return row ? toContato(row) : null;
  }

  async excluir(id: number): Promise<boolean> {
    if (!isIdContato(id)) return false;
    const result = await this.db
      .deleteFrom('contato')
      .where('id', '=', id)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}
