import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { startApi, type ApiProcess } from './support/api-process.js';
import { freePort } from './support/free-port.js';
import {
  createTempDir,
  openRaw,
  removeTempDir,
} from './support/temp-database.js';

const isRoot = process.getuid?.() === 0;

describe('Subida da API (processo real, dist/main.js)', () => {
  let cwd: string;
  let dbDir: string;
  let dbPath: string;
  let port: number;
  let api: ApiProcess | undefined;

  beforeEach(async () => {
    cwd = createTempDir();
    dbDir = createTempDir();
    dbPath = join(dbDir, 'contato.sqlite');
    port = await freePort();
  });

  afterEach(async () => {
    await api?.stop();
    api = undefined;
    chmodSync(dbDir, 0o700);
    removeTempDir(cwd);
    removeTempDir(dbDir);
  });

  const bancos = (dir: string): string[] =>
    readdirSync(dir).filter((f) => /\.(sqlite|db)$/.test(f));

  it('API sobe usando o caminho do banco vindo do ambiente', async () => {
    api = await startApi(
      { SQLITE_PATH: dbPath, PORT: String(port), SEED: 'true' },
      { cwd },
    );

    expect(api.ready).toBe(true);
    expect(api.elapsedMs).toBeLessThan(5000);
    expect(existsSync(dbPath)).toBe(true);
    expect(bancos(dbDir)).toEqual(['contato.sqlite']);
    expect(readdirSync(cwd)).toEqual([]);

    const resposta = await fetch(`http://127.0.0.1:${port}/api/qualquer`);
    expect(resposta.status).toBe(404);

    const fim = await api.stop();
    expect(fim.code === 0 || fim.signal === 'SIGTERM').toBe(true);
    expect(readdirSync(dbDir)).toEqual(['contato.sqlite']);
  });

  it.each([
    ['ausente', {}],
    ['vazio', { SQLITE_PATH: '' }],
  ])(
    'Caminho do banco não configurado (%s)',
    async (_caso, extra: Record<string, string>) => {
      api = await startApi({ PORT: String(port), ...extra }, { cwd });

      expect(api.ready).toBe(false);
      expect((await api.exited()).code).not.toBe(0);
      expect(api.stderr()).toContain(
        '[api] Falha na subida (config): variável SQLITE_PATH ausente.',
      );
      expect(readdirSync(cwd)).toEqual([]);
      expect(readdirSync(dbDir)).toEqual([]);
    },
  );

  it('PORT ausente também impede a subida', async () => {
    api = await startApi({ SQLITE_PATH: dbPath }, { cwd });

    expect(api.ready).toBe(false);
    expect((await api.exited()).code).not.toBe(0);
    expect(api.stderr()).toContain('variável PORT ausente');
    expect(existsSync(dbPath)).toBe(false);
  });

  it('Diretório do banco inexistente', async () => {
    const caminho = join(dbDir, 'nao-existe', 'contato.sqlite');
    api = await startApi({ SQLITE_PATH: caminho, PORT: String(port) }, { cwd });

    expect(api.ready).toBe(false);
    expect((await api.exited()).code).not.toBe(0);
    expect(api.stderr()).toContain('[api] Falha na subida (banco):');
    expect(api.stderr()).not.toContain(dbDir);
  });

  it.skipIf(isRoot)('Diretório do banco sem permissão de escrita', async () => {
    const somenteLeitura = join(dbDir, 'ro');
    mkdirSync(somenteLeitura);
    chmodSync(somenteLeitura, 0o500);
    try {
      api = await startApi(
        {
          SQLITE_PATH: join(somenteLeitura, 'contato.sqlite'),
          PORT: String(port),
        },
        { cwd },
      );

      expect(api.ready).toBe(false);
      expect((await api.exited()).code).not.toBe(0);
      expect(api.stderr()).toContain('[api] Falha na subida (banco):');
      expect(api.stderr()).toContain('SQLITE_CANTOPEN');
      expect(api.stderr()).not.toContain(dbDir);
    } finally {
      chmodSync(somenteLeitura, 0o700);
    }
  });

  it('Falha de migration impede a subida e preserva o arquivo', async () => {
    const conteudo = Buffer.from('isto não é um banco SQLite\n'.repeat(40));
    writeFileSync(dbPath, conteudo);

    api = await startApi({ SQLITE_PATH: dbPath, PORT: String(port) }, { cwd });

    expect(api.ready).toBe(false);
    expect((await api.exited()).code).not.toBe(0);
    expect(api.stderr()).toContain(
      '[api] Falha na subida (migrations): falha ao aplicar as migrations (SQLITE_NOTADB).',
    );
    expect(readFileSync(dbPath).equals(conteudo)).toBe(true);
  });

  it('Acentos independem da locale do sistema', async () => {
    api = await startApi(
      {
        SQLITE_PATH: dbPath,
        PORT: String(port),
        SEED: 'true',
        LANG: 'C',
        LC_ALL: 'C',
      },
      { cwd },
    );
    expect(api.ready).toBe(true);
    await api.stop();

    const raw = openRaw(dbPath);
    try {
      const linha = raw
        .prepare<[string], { nome: string }>(
          'SELECT nome FROM contato WHERE nome = ?',
        )
        .get('João Pedro Araújo');
      expect(
        Buffer.from(linha?.nome ?? '', 'utf8').equals(
          Buffer.from('João Pedro Araújo', 'utf8'),
        ),
      ).toBe(true);
    } finally {
      raw.close();
    }
  });
});
