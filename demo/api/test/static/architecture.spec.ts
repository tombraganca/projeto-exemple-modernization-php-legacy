import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkFile,
  layerOf,
  parseImports,
} from '../support/architecture-rules.js';
import { listSourceFiles, SRC_ROOT } from '../support/source-files.js';

describe('Arquitetura em camadas (ADR-017)', () => {
  it('o código de src/ respeita as regras de dependência entre camadas', () => {
    const violations = listSourceFiles().flatMap((f) =>
      checkFile(f.path, f.content),
    );
    expect(violations).toEqual([]);
  });

  it('não existe infrastructure/storage (a agenda não guarda arquivos)', () => {
    expect(existsSync(join(SRC_ROOT, 'infrastructure', 'storage'))).toBe(false);
  });

  describe('o verificador detecta violações (casos sintéticos)', () => {
    it('classifica as camadas pelo caminho', () => {
      expect(layerOf('shared/domain/app-error.ts')).toBe('domain');
      expect(layerOf('modules/contatos/domain/contato.ts')).toBe('domain');
      expect(
        layerOf('modules/contatos/application/contato.repository.ts'),
      ).toBe('application');
      expect(
        layerOf('modules/contatos/infrastructure/kysely-contato.repository.ts'),
      ).toBe('module-infrastructure');
      expect(
        layerOf('modules/contatos/presentation/contatos.controller.ts'),
      ).toBe('presentation');
      expect(layerOf('shared/presentation/filter.ts')).toBe('presentation');
      expect(layerOf('infrastructure/database/connection.ts')).toBe('database');
      expect(layerOf('main.ts')).toBe('other');
    });

    it('lê imports, re-exports, imports de tipo e dinâmicos', () => {
      const refs = parseImports(
        [
          "import { Injectable, Inject as I } from '@nestjs/common';",
          "import type { Kysely } from 'kysely';",
          "export * from './a.js';",
          "import './side-effect.js';",
          "const m = await import('../b.js');",
        ].join('\n'),
      );
      expect(refs.map((r) => r.specifier)).toEqual([
        '@nestjs/common',
        'kysely',
        './a.js',
        './side-effect.js',
        '../b.js',
      ]);
      expect(refs[0].names).toEqual(['Injectable', 'Inject']);
    });

    it.each([
      [
        'modules/contatos/domain/contato.ts',
        "import { Injectable } from '@nestjs/common';",
      ],
      [
        'modules/contatos/domain/contato.ts',
        "import type { Kysely } from 'kysely';",
      ],
      [
        'modules/contatos/domain/contato.ts',
        "import { X } from '../application/contato.repository.js';",
      ],
      [
        'shared/domain/pagination.ts',
        "import { S } from '../../config/settings.js';",
      ],
      [
        'modules/contatos/application/contato.repository.ts',
        "import { Kysely } from 'kysely';",
      ],
      [
        'modules/contatos/application/contato.repository.ts',
        "import { Controller } from '@nestjs/common';",
      ],
      [
        'modules/contatos/application/x.ts',
        "import { DATABASE } from '../../../infrastructure/database/database.module.js';",
      ],
      [
        'modules/contatos/application/x.ts',
        "import { K } from '../infrastructure/kysely-contato.repository.js';",
      ],
      [
        'modules/contatos/infrastructure/x.ts',
        "import { C } from '../presentation/contatos.controller.js';",
      ],
      [
        'modules/contatos/presentation/x.ts',
        "import { K } from '../infrastructure/kysely-contato.repository.js';",
      ],
      [
        'modules/contatos/presentation/x.ts',
        "import { D } from '../../../infrastructure/database/database.module.js';",
      ],
      ['modules/contatos/presentation/x.ts', "import { sql } from 'kysely';"],
      [
        'infrastructure/database/x.ts',
        "import { R } from '../../modules/contatos/application/contato.repository.js';",
      ],
      [
        'infrastructure/database/x.ts',
        "import { K } from '../../modules/contatos/infrastructure/kysely-contato.repository.js';",
      ],
    ])('%s: %s é violação', (path, code) => {
      expect(checkFile(path, code)).toHaveLength(1);
    });

    it.each([
      [
        'modules/contatos/domain/contato.ts',
        "import { AppError } from '../../../shared/domain/app-error.js';",
      ],
      [
        'modules/contatos/application/contato.repository.ts',
        "import type { Contato } from '../domain/contato.js';",
      ],
      [
        'modules/contatos/application/x.ts',
        "import { Injectable, Inject } from '@nestjs/common';",
      ],
      [
        'modules/contatos/infrastructure/x.ts',
        "import { DATABASE } from '../../../infrastructure/database/database.module.js';",
      ],
      [
        'modules/contatos/infrastructure/x.ts',
        "import { ContatoRepository } from '../application/contato.repository.js';",
      ],
      [
        'modules/contatos/presentation/x.ts',
        "import { ContatoRepository } from '../application/contato.repository.js';",
      ],
      [
        'infrastructure/database/seed/x.ts',
        "import type { DadosContato } from '../../../modules/contatos/domain/contato.js';",
      ],
      [
        'infrastructure/database/x.ts',
        "import { Settings } from '../../config/settings.js';",
      ],
    ])('%s: %s é permitido', (path, code) => {
      expect(checkFile(path, code)).toEqual([]);
    });
  });
});
