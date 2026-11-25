/** Janela de uma consulta paginada por offset (ADR-014). */
export interface ParametrosPaginacao {
  /** Inteiro de 1 a 100. */
  readonly limite: number;
  /** Inteiro maior ou igual a 0. */
  readonly deslocamento: number;
}

/** Uma página de resultados com o total de registros. */
export interface Pagina<T> {
  readonly itens: T[];
  readonly total: number;
}

export const LIMITE_MAXIMO_PAGINA = 100;

/** Lança `RangeError` se `limite` ou `deslocamento` forem inválidos. */
export function assertParametrosPaginacao(p: ParametrosPaginacao): void {
  if (
    !Number.isSafeInteger(p.limite) ||
    p.limite < 1 ||
    p.limite > LIMITE_MAXIMO_PAGINA
  ) {
    throw new RangeError(
      `limite deve ser inteiro entre 1 e ${LIMITE_MAXIMO_PAGINA}`,
    );
  }
  if (!Number.isSafeInteger(p.deslocamento) || p.deslocamento < 0) {
    throw new RangeError('deslocamento deve ser inteiro maior ou igual a 0');
  }
}
