import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  API_ROOT,
  listAllSrcPaths,
  listSourceFiles,
} from '../support/source-files.js';

const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(API_ROOT, file), 'utf8')) as Record<
    string,
    unknown
  >;

describe('Projeto da API', () => {
  describe('API criada a partir do esqueleto oficial, sem autenticação', () => {
    it('foi gerada pelo esqueleto oficial do NestJS', () => {
      expect(readJson('nest-cli.json').collection).toBe('@nestjs/schematics');
      const pkg = readJson('package.json');
      expect(Object.keys(pkg.dependencies as object)).toContain('@nestjs/core');
    });

    it('não tem dependências de autenticação', () => {
      const pkg = readJson('package.json');
      const deps = [
        ...Object.keys((pkg.dependencies as object) ?? {}),
        ...Object.keys((pkg.devDependencies as object) ?? {}),
      ];
      expect(
        deps.filter((d) => /passport|@nestjs\/jwt|auth|session/i.test(d)),
      ).toEqual([]);
    });

    it('não tem guardas nem módulos de autenticação em src/', () => {
      const offenders = listSourceFiles({ includeSpecs: true })
        .filter((f) =>
          /\bUseGuards\b|\bCanActivate\b|\bAPP_GUARD\b/.test(f.content),
        )
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });

    it('não tem código herdado do legado', () => {
      expect(listAllSrcPaths().filter((p) => p.endsWith('.php'))).toEqual([]);
      const offenders = listSourceFiles({ includeSpecs: true })
        .filter((f) => /\bPDO\b|banco\.php/.test(f.content))
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });
  });
});
