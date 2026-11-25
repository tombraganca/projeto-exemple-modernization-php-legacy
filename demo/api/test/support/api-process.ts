import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { API_ROOT } from './source-files.js';

export const READY_LINE = 'API no ar na porta';
const MAIN_JS = join(API_ROOT, 'dist', 'main.js');

export interface ApiProcess {
  readonly child: ChildProcess;
  /** `true` se a API ficou no ar; `false` se o processo saiu antes. */
  readonly ready: boolean;
  /** Tempo até ficar no ar ou sair, em ms. */
  readonly elapsedMs: number;
  stdout(): string;
  stderr(): string;
  /** Espera o processo terminar e devolve código e sinal. */
  exited(): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** Envia SIGTERM e espera o fim. */
  stop(): Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
}

/**
 * Sobe `node dist/main.js` (precisa do build) com um ambiente mínimo: só `PATH` e o que for passado,
 * sem herdar `SQLITE_PATH`, `PORT` nem `SEED` de quem roda o teste.
 */
export async function startApi(
  env: Record<string, string>,
  options: { cwd: string; timeoutMs?: number },
): Promise<ApiProcess> {
  const inicio = Date.now();
  const child = spawn(process.execPath, [MAIN_JS], {
    cwd: options.cwd,
    env: { PATH: process.env.PATH ?? '', NO_COLOR: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stdout?.setEncoding('utf8').on('data', (d: string) => (out += d));
  child.stderr?.setEncoding('utf8').on('data', (d: string) => (err += d));

  const exitedPromise = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

  const ready = await new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        new Error(
          `a API não subiu nem saiu em ${options.timeoutMs ?? 10_000} ms`,
        ),
      );
    }, options.timeoutMs ?? 10_000);
    child.stdout?.on('data', () => {
      if (out.includes(READY_LINE)) {
        clearTimeout(timer);
        resolve(true);
      }
    });
    void exitedPromise.then(() => {
      clearTimeout(timer);
      resolve(false);
    });
  });

  return {
    child,
    ready,
    elapsedMs: Date.now() - inicio,
    stdout: () => out,
    stderr: () => err,
    exited: () => exitedPromise,
    stop: () => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill('SIGTERM');
      return exitedPromise;
    },
  };
}
