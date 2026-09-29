/**
 * Diálogo de confirmação da aplicação.
 *
 * Substitui o `confirm()` nativo do navegador — que exibe o mesmo diálogo
 * feio "localhost:3000 diz" com botões OK/Cancelar — por um modal elegante,
 * alinhado à identidade institucional.
 *
 * Uso:
 *   import { confirmDialog } from '../lib/dialog';
 *   if (!(await confirmDialog('Tem certeza que deseja sair do evento?'))) return;
 *   if (!(await confirmDialog({ message: '...', tone: 'danger', confirmLabel: 'Remover' }))) return;
 */

export type ConfirmTone = 'primary' | 'danger';

export interface ConfirmOptions {
  /** Rótulo superior do modal. Padrão: "Confirmação". */
  title?: string;
  /** Pergunta exibida ao usuário. Obrigatória. */
  message: string;
  /** Texto do botão de ação. Padrão depende do tom. */
  confirmLabel?: string;
  /** Texto do botão de cancelamento. Padrão: "Cancelar". */
  cancelLabel?: string;
  /** Tom visual. Se omitido, é inferido pela mensagem. */
  tone?: ConfirmTone;
  /** Ícone Material Symbols. Se omitido, é inferido pelo tom. */
  icon?: string;
  /** Linha de contexto extra exibida em tom secundário. */
  detail?: string;
}

export interface ConfirmRequest {
  id: string;
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
  icon: string;
}

let current: ConfirmRequest | null = null;
let resolver: ((value: boolean) => void) | null = null;
let sequence = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

/** Assina mudanças do diálogo ativo. Retorna a função de cancelamento. */
export const subscribeDialog = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getDialog = (): ConfirmRequest | null => current;

const DESTRUCTIVE_PATTERN =
  /(excluir|excluí|deletar|apagar|remover|retirar|sair|limpar|permanent|cancelar evento|deseja cancelar)/i;

/** Abre o modal de confirmação e resolve com a escolha do usuário. */
export const confirmDialog = (options: ConfirmOptions | string): Promise<boolean> => {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;

  // Se já havia um diálogo aguardando, ele é tratado como cancelado.
  if (resolver) {
    const previous = resolver;
    resolver = null;
    previous(false);
  }

  const tone: ConfirmTone = opts.tone ?? (DESTRUCTIVE_PATTERN.test(`${opts.title ?? ''} ${opts.message}`) ? 'danger' : 'primary');

  current = {
    id: `dialog-${++sequence}`,
    title: opts.title ?? (tone === 'danger' ? 'Confirmar ação' : 'Confirmação'),
    message: opts.message,
    detail: opts.detail,
    confirmLabel: opts.confirmLabel ?? (tone === 'danger' ? 'Sim, continuar' : 'Confirmar'),
    cancelLabel: opts.cancelLabel ?? 'Cancelar',
    tone,
    icon: opts.icon ?? (tone === 'danger' ? 'warning' : 'help'),
  };
  emit();

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
};

/** Fecha o diálogo ativo resolvendo com o valor informado. */
export const resolveDialog = (value: boolean): void => {
  const pending = resolver;
  resolver = null;
  current = null;
  emit();
  pending?.(value);
};

export default confirmDialog;
