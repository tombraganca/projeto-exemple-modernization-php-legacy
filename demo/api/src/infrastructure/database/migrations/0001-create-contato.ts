import { sql, type Kysely } from 'kysely';

/**
 * Tabela `contato` (ADR-005, ADR-013, RN-005, RN-007, RN-009, RN-020).
 * Migration publicada é imutável: mudança de esquema = migration nova.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE contato (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      nome     TEXT NOT NULL CONSTRAINT ck_contato_nome_tamanho     CHECK (length(nome) <= 50),
      endereco TEXT NOT NULL CONSTRAINT ck_contato_endereco_tamanho CHECK (length(endereco) <= 80),
      telefone TEXT NOT NULL CONSTRAINT ck_contato_telefone_tamanho CHECK (length(telefone) <= 35),
      email    TEXT NOT NULL CONSTRAINT ck_contato_email_tamanho    CHECK (length(email) <= 40),
      sexo     TEXT NOT NULL CONSTRAINT ck_contato_sexo             CHECK (sexo IN ('M', 'F', 'O', 'N'))
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE contato`.execute(db);
}
