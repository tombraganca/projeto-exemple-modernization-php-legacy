import { DynamicModule, Module } from '@nestjs/common';
import { SettingsModule } from './config/settings.module.js';
import type { Settings } from './config/settings.js';
import { ContatosModule } from './modules/contatos/contatos.module.js';

/**
 * Composição raiz.
 * CARD-004 acrescenta o filtro global (`APP_FILTER`) e o logger; CARD-006+ o pipe global (`APP_PIPE`).
 */
@Module({})
export class AppModule {
  /** Subida real: configuração do `.env` + ambiente do processo, validada por `loadSettings` (D-10). */
  static fromEnvironment(): DynamicModule {
    return AppModule.compose(SettingsModule.fromEnvironment());
  }

  /** Testes: `Settings` montado à mão, sem `.env` nem ambiente do processo. */
  static register(settings: Settings): DynamicModule {
    return AppModule.compose(SettingsModule.register(settings));
  }

  private static compose(
    settings: DynamicModule | Promise<DynamicModule>,
  ): DynamicModule {
    return { module: AppModule, imports: [settings, ContatosModule] };
  }
}
