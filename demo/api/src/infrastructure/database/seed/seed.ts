import { Logger } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { Database } from '../database.types.js';
import { DatabaseStartupError } from '../startup.error.js';
import { CONTATOS_EXEMPLO } from './contatos.seed-data.js';

const logger = new Logger('Seed');

/**
 * Insere os contatos de exemplo só se `enabled` e a tabela `contato` estiver vazia (D-05).
 * Contagem e inserção na mesma transação: entram todos ou nenhum. Devolve quantos foram inseridos.
 * O log traz só a contagem, nunca dados de contato. Falha = `DatabaseStartupError` (etapa `seed`).
 */
export async function seedIfEmpty(
  db: Kysely<Database>,
  enabled: boolean,
): Promise<number> {
  if (!enabled) return 0;
  try {
    const inseridos = await db.transaction().execute(async (trx) => {
      const { total } = await trx
        .selectFrom('contato')
        .select((eb) => eb.fn.countAll<number>().as('total'))
        .executeTakeFirstOrThrow();
      if (Number(total) > 0) return 0;
      await trx
        .insertInto('contato')
        .values(CONTATOS_EXEMPLO.map((c) => ({ ...c })))
        .execute();
      return CONTATOS_EXEMPLO.length;
    });
    logger.log(
      inseridos > 0
        ? `Seed: ${inseridos} contatos de exemplo inseridos.`
        : 'Seed ignorado: a tabela contato já tem registros.',
    );
    return inseridos;
  } catch (error) {
    throw DatabaseStartupError.from(error, 'seed');
  }
}
