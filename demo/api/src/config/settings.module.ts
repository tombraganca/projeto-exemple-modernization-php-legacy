import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SETTINGS, Settings, loadSettings, type Env } from './settings.js';

/** Variáveis que compõem o `Settings`. */
const SETTINGS_KEYS = ['SQLITE_PATH', 'PORT', 'SEED'] as const;

/** Disponibiliza o `Settings` já validado pelo token `SETTINGS` para toda a aplicação. */
@Global()
@Module({})
export class SettingsModule {
  /** `Settings` pronto (testes): não lê `.env` nem o ambiente do processo. */
  static register(settings: Settings): DynamicModule {
    return {
      module: SettingsModule,
      providers: [{ provide: SETTINGS, useValue: settings }],
      exports: [SETTINGS],
    };
  }

  /**
   * Subida real (D-10, ADR-017): o `ConfigModule` carrega o `.env` do diretório de trabalho (ausente não é erro)
   * e o ambiente do processo vence o `.env`. A validação é a mesma `loadSettings`: falha rejeita a criação da app
   * antes de o banco ser aberto.
   */
  static async fromEnvironment(): Promise<DynamicModule> {
    const config = await ConfigModule.forRoot({
      envFilePath: '.env',
      validate: (env: Env) => {
        loadSettings(env);
        return env;
      },
    });
    return {
      module: SettingsModule,
      imports: [config],
      providers: [
        {
          provide: SETTINGS,
          inject: [ConfigService],
          useFactory: (configService: ConfigService): Settings =>
            loadSettings(
              Object.fromEntries(
                SETTINGS_KEYS.map((key) => [
                  key,
                  configService.get<string>(key),
                ]),
              ),
            ),
        },
      ],
      exports: [SETTINGS],
    };
  }
}
