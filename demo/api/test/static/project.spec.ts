import { execFileSync } from 'node:child_process';
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

/** Arquivos versionados no repositório (relativos à raiz do git), ou `null` sem git disponível. */
function gitLsFiles(): string[] | null {
  try {
    return execFileSync('git', ['ls-files', '--full-name'], {
      cwd: API_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return null;
  }
}

describe('Projeto da API', () => {
  describe('Nenhuma configuração fixa no código', () => {
    it('process.env só é lido em src/main.ts', () => {
      const offenders = listSourceFiles()
        .filter((f) => f.path !== 'main.ts')
        .filter((f) => /\bprocess\.env\b/.test(f.content))
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });

    it('não há caminho de banco, porta nem valor padrão numérico escritos no código', () => {
      const offenders = listSourceFiles()
        .filter(
          (f) =>
            /\.(sqlite|db)['"`]/.test(f.content) ||
            /listen\(\s*\d/.test(f.content) ||
            /(\?\?|\|\|)\s*\d{2,5}\b/.test(f.content),
        )
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });

    it('nenhum .env está versionado (só .env.example)', (ctx) => {
      const files = gitLsFiles();
      if (files === null) ctx.skip();
      const envs = (files ?? []).filter((f) => /(^|\/)\.env(\..*)?$/.test(f));
      expect(envs.filter((f) => !f.endsWith('.env.example'))).toEqual([]);
    });
  });

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

  describe('Nenhuma consulta monta SQL por concatenação', () => {
    const MIGRATIONS_DIR = 'infrastructure/database/migrations/';
    const importaSqlDoKysely = (content: string): boolean =>
      /import\s*\{[^}]*\bsql\b[^}]*\}\s*from\s*['"]kysely['"]/.test(content);

    it('o template sql do Kysely só aparece nas migrations', () => {
      const offenders = listSourceFiles()
        .filter((f) => !f.path.startsWith(MIGRATIONS_DIR))
        .filter((f) => importaSqlDoKysely(f.content))
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });

    it('as migrations não interpolam valores no SQL', () => {
      const offenders = listSourceFiles()
        .filter((f) => f.path.startsWith(MIGRATIONS_DIR))
        .filter((f) => /sql`[^`]*\$\{/.test(f.content))
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });

    it('não usa sql.raw, sql.lit, sql.ref, sql.id nem prepare com template interpolado', () => {
      const offenders = listSourceFiles({ includeSpecs: true })
        .filter(
          (f) =>
            /\bsql\.(raw|lit|ref|id)\s*\(/.test(f.content) ||
            /\.prepare\(\s*`[^`]*\$\{/.test(f.content) ||
            /\.exec\(\s*`[^`]*\$\{/.test(f.content),
        )
        .map((f) => f.path);
      expect(offenders).toEqual([]);
    });
  });
});
