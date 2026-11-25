/**
 * Base dos erros da aplicação. O filtro global (CARD-004) traduz subclasses para HTTP.
 *
 * Regra: `message` nunca contém valores de configuração nem dados pessoais.
 */
export abstract class AppError extends Error {
  /** Código estável e legível por máquina (ex.: `ENV_INVALID`). */
  abstract readonly code: string;

  protected constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
