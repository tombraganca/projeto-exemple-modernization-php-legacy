import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { SETTINGS, type Settings } from './config/settings.js';
import { formatStartupFailure } from './startup-failure.js';

/**
 * Subida da API. A configuração vem do `.env` da API e do ambiente do processo (D-10), validada antes de o banco
 * ser aberto; depois o provider DATABASE abre/migra/semeia o banco e a app escuta na porta configurada.
 * Em falha, escreve uma linha no stderr e sai com código 1 (estado "Falha na subida", JOR-06).
 */
async function bootstrap(): Promise<void> {
  let app: INestApplication | undefined;
  try {
    app = await NestFactory.create(AppModule.fromEnvironment(), {
      abortOnError: false,
    });
    const { port } = app.get<Settings>(SETTINGS);
    configureApp(app);
    await app.listen(port);
    Logger.log(`API no ar na porta ${port}`, 'Bootstrap');
  } catch (error) {
    await app?.close().catch(() => undefined);
    throw error;
  }
}

try {
  await bootstrap();
} catch (error) {
  process.stderr.write(`${formatStartupFailure(error)}\n`);
  process.exitCode = 1;
}
