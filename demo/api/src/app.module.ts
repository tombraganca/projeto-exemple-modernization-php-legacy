import { DynamicModule, Module } from '@nestjs/common';
import { SettingsModule } from './config/settings.module.js';
import type { Settings } from './config/settings.js';
import { ContatosModule } from './modules/contatos/contatos.module.js';

/**
 * Composição raiz. Recebe o `Settings` já validado no `main.ts` (ou montado no teste).
 * CARD-004 acrescenta o filtro global (`APP_FILTER`) e o logger; CARD-006+ o pipe global (`APP_PIPE`).
 */
@Module({})
export class AppModule {
  static register(settings: Settings): DynamicModule {
    return {
      module: AppModule,
      imports: [SettingsModule.register(settings), ContatosModule],
    };
  }
}
