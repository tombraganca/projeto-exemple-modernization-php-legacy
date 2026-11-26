import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/** Raiz do projeto da API (`demo/api`). */
export const API_ROOT = resolve(import.meta.dirname, '..', '..');
export const SRC_ROOT = join(API_ROOT, 'src');

export interface SourceFile {
  /** Caminho relativo a `src/`, sempre com `/`. */
  readonly path: string;
  readonly absolutePath: string;
  readonly content: string;
}

const toPosix = (p: string): string => p.split(sep).join('/');

/** Lista os `.ts` de `src/`. Por padrão ignora os `*.spec.ts`. */
export function listSourceFiles(
  options: { includeSpecs?: boolean } = {},
): SourceFile[] {
  if (!existsSync(SRC_ROOT)) return [];
  return readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' })
    .map(toPosix)
    .filter((p) => p.endsWith('.ts'))
    .filter((p) => options.includeSpecs || !p.endsWith('.spec.ts'))
    .sort()
    .map((p) => {
      const absolutePath = join(SRC_ROOT, p);
      return {
        path: p,
        absolutePath,
        content: readFileSync(absolutePath, 'utf8'),
      };
    });
}

/** Lista todos os arquivos (qualquer extensão) de `src/`, relativos a `src/`. */
export function listAllSrcPaths(): string[] {
  if (!existsSync(SRC_ROOT)) return [];
  return readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' })
    .map(toPosix)
    .sort();
}
