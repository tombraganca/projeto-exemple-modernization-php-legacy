import { posix } from 'node:path';

/**
 * Regras de dependência entre camadas (ADR-017, ARCHITECTURE.md).
 * Trabalha só com caminhos relativos a `src/` e com o texto do arquivo, para poder ser testado com casos sintéticos.
 */

export type Layer =
  | 'domain'
  | 'application'
  | 'module-infrastructure'
  | 'presentation'
  | 'database'
  | 'other';

export interface ImportRef {
  readonly specifier: string;
  /** Nomes importados entre chaves (`import { A, B } from …`); vazio quando não há chaves. */
  readonly names: readonly string[];
}

export interface Violation {
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
}

const IMPORT_RE =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

export function parseImports(content: string): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const m of content.matchAll(IMPORT_RE)) {
    const specifier = m[2] ?? m[3];
    if (!specifier) continue;
    const clause = m[1] ?? '';
    const braces = /\{([\s\S]*?)\}/.exec(clause);
    const names = braces
      ? braces[1]
          .split(',')
          .map((n) =>
            n
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0]
              .trim(),
          )
          .filter(Boolean)
      : [];
    refs.push({ specifier, names });
  }
  return refs;
}

export function layerOf(path: string): Layer {
  if (/^(shared\/domain|modules\/[^/]+\/domain)\//.test(path)) return 'domain';
  if (/^modules\/[^/]+\/application\//.test(path)) return 'application';
  if (/^modules\/[^/]+\/infrastructure\//.test(path))
    return 'module-infrastructure';
  if (/^(shared\/presentation|modules\/[^/]+\/presentation)\//.test(path))
    return 'presentation';
  if (path.startsWith('infrastructure/database/')) return 'database';
  return 'other';
}

const isRelative = (s: string): boolean => s.startsWith('.');

/** Resolve um import relativo para um caminho relativo a `src/` (ou `null` se sair de `src/`). */
export function resolveRelative(
  fromFile: string,
  specifier: string,
): string | null {
  const target = posix.normalize(
    posix.join(posix.dirname(fromFile), specifier),
  );
  return target.startsWith('..') ? null : target;
}

const isUnder = (target: string, prefix: RegExp): boolean =>
  prefix.test(target);

const ANY_INFRA = /^(infrastructure\/|modules\/[^/]+\/infrastructure\/)/;
const ANY_PRESENTATION =
  /^(shared\/presentation\/|modules\/[^/]+\/presentation\/)/;
const DB_PACKAGES = /^(kysely|better-sqlite3)(\/|$)/;

export function checkFile(path: string, content: string): Violation[] {
  const layer = layerOf(path);
  const violations: Violation[] = [];
  const fail = (specifier: string, reason: string): void => {
    violations.push({ file: path, specifier, reason });
  };

  for (const ref of parseImports(content)) {
    const { specifier } = ref;
    const target = isRelative(specifier)
      ? resolveRelative(path, specifier)
      : null;

    switch (layer) {
      case 'domain': {
        if (!isRelative(specifier)) {
          fail(
            specifier,
            'domain não importa pacotes (framework, banco ou outros)',
          );
          break;
        }
        const moduleDomain = /^modules\/([^/]+)\/domain\//.exec(path);
        const allowed =
          target !== null &&
          (target.startsWith('shared/domain/') ||
            (moduleDomain !== null &&
              target.startsWith(`modules/${moduleDomain[1]}/domain/`)));
        if (!allowed)
          fail(
            specifier,
            'domain só importa shared/domain e o próprio domínio',
          );
        break;
      }
      case 'application': {
        if (!isRelative(specifier)) {
          if (specifier !== '@nestjs/common') {
            fail(
              specifier,
              'application não importa pacotes além de @nestjs/common',
            );
          } else {
            const extra = ref.names.filter(
              (n) => n !== 'Injectable' && n !== 'Inject',
            );
            if (extra.length > 0 || ref.names.length === 0) {
              fail(
                specifier,
                'application usa de @nestjs/common só Injectable e Inject',
              );
            }
          }
          break;
        }
        if (
          target === null ||
          isUnder(target, ANY_INFRA) ||
          isUnder(target, ANY_PRESENTATION) ||
          target.startsWith('config/')
        ) {
          fail(
            specifier,
            'application não importa infrastructure, presentation nem config',
          );
        }
        break;
      }
      case 'module-infrastructure': {
        if (target !== null && isUnder(target, ANY_PRESENTATION)) {
          fail(specifier, 'infrastructure do módulo não importa presentation');
        }
        break;
      }
      case 'presentation': {
        if (!isRelative(specifier) && DB_PACKAGES.test(specifier)) {
          fail(specifier, 'presentation não importa o banco');
        }
        if (target !== null && isUnder(target, ANY_INFRA)) {
          fail(specifier, 'presentation não importa infrastructure');
        }
        break;
      }
      case 'database': {
        if (
          target !== null &&
          (/^modules\/[^/]+\/(application|infrastructure)\//.test(target) ||
            isUnder(target, ANY_PRESENTATION))
        ) {
          fail(
            specifier,
            'infrastructure/database não importa application, infrastructure de módulo nem presentation',
          );
        }
        break;
      }
      case 'other':
        break;
    }
  }
  return violations;
}
