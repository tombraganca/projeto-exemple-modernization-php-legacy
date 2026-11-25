import { DynamicModule, Global, Module } from '@nestjs/common';
import { SETTINGS, Settings } from './settings.js';

/** Disponibiliza o `Settings` já validado pelo token `SETTINGS` para toda a aplicação. */
@Global()
@Module({})
export class SettingsModule {
  static register(settings: Settings): DynamicModule {
    return {
      module: SettingsModule,
      providers: [{ provide: SETTINGS, useValue: settings }],
      exports: [SETTINGS],
    };
  }
}
