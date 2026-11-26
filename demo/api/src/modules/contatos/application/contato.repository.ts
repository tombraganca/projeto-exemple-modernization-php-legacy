import type {
  Pagina,
  ParametrosPaginacao,
} from '../../../shared/domain/pagination.js';
import type { Contato, DadosContato } from '../domain/contato.js';

/**
 * Porta de persistência de contatos (token de DI). Assinatura estável para os CARD-006/008/010/013/015.
 *
 * Não valida nem normaliza dados (isso é do esquema do CARD-002) e não traduz erros do banco:
 * violação de CHECK/NOT NULL sobe como `SqliteError` para o filtro global (CARD-004).
 */
export abstract class ContatoRepository {
  /** Página em `ORDER BY id DESC` + total, numa transação. `RangeError` se limite/deslocamento forem inválidos. */
  abstract listar(params: ParametrosPaginacao): Promise<Pagina<Contato>>;

  /** `null` se não existir ou se o id for inválido (sem consultar o banco). */
  abstract obterPorId(id: number): Promise<Contato | null>;

  /** Insere e devolve o contato gravado com o id gerado. */
  abstract inserir(dados: DadosContato): Promise<Contato>;

  /** Atualiza os cinco campos. `null` se não existir ou se o id for inválido. */
  abstract atualizar(id: number, dados: DadosContato): Promise<Contato | null>;

  /** Exclusão física (RN-020). `true` se removeu; `false` se não existia ou se o id for inválido. */
  abstract excluir(id: number): Promise<boolean>;
}
