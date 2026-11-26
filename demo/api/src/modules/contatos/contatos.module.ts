import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { ContatoRepository } from './application/contato.repository.js';
import { KyselyContatoRepository } from './infrastructure/kysely-contato.repository.js';

/** Módulo de contatos. Controllers e DTOs (`presentation/`) entram nos CARD-006+. */
@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: ContatoRepository, useClass: KyselyContatoRepository },
  ],
  exports: [ContatoRepository],
})
export class ContatosModule {}
