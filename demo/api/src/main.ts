import { type INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadSettings } from './config/settings.js';
import { formatStartupFailure } from './startup-failure.js';

/**
 * Subida da API. Único lugar que lê `process.env` (RN-027): valida o ambiente antes de criar qualquer coisa,
 * abre/migra/semeia o banco (provider DATABASE) e escuta na porta configurada.
 * Em falha, escreve uma linha no stderr e sai com código 1 (estado "Falha na subida", JOR-06).
 */
async function bootstrap(): Promise<void> {
  const settings = loadSettings(process.env);
  let app: INestApplication | undefined;
  try {
    app = await NestFactory.create(AppModule.register(settings), {
      abortOnError: false,
    });
    configureApp(app);
    await app.listen(settings.port);
  } catch (error) {
    await app?.close().catch(() => undefined);
    throw error;
  }
  Logger.log(`API no ar na porta ${settings.port}`, 'Bootstrap');
}

try {
  await bootstrap();
} catch (error) {
  process.stderr.write(`${formatStartupFailure(error)}\n`);
  process.exitCode = 1;
}
