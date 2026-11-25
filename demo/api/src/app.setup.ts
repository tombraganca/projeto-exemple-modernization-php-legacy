import {
  type INestApplication,
  VERSION_NEUTRAL,
  VersioningType,
} from '@nestjs/common';

/** Prefixo global das rotas: o contrato é `/api/contatos` (ADR-014). */
export const API_PREFIX = 'api';

/**
 * Pipeline HTTP da aplicação, usado pelo `main.ts` e pelos testes de integração.
 *
 * - CARD-001: prefixo `api`, versionamento por URI com versão neutra (controller sem `@Version` responde em
 *   `/api/<rota>`), shutdown hooks (fecha o banco ao encerrar).
 * - CARD-004: logger pino e request id. CARD-005: CORS e same-origin. CARD-006+: Swagger.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
  app.enableShutdownHooks();
  return app;
}
