/**
 * Sistema de avisos (toasts) da aplicação.
 *
 * Substitui os `alert()` nativos do navegador — que exibem o feio diálogo
 * "localhost:3000 diz" — por notificações elegantes, não bloqueantes e
 * alinhadas à identidade institucional (azul corporativo + tons de apoio).
 *
 * Uso:
 *   import { toast } from '../lib/toast';
 *   toast.auto('Participação confirmada com sucesso!'); // tom inferido
 *   toast.success('Evento criado!');
 *   toast.error('Erro ao salvar evento.');
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  duration: number;
}

export const TOAST_TONES: Record<ToastTone, { label: string; icon: string; duration: number }> = {
  success: { label: 'Tudo certo', icon: 'check_circle', duration: 4200 },
  info: { label: 'Informação', icon: 'info', duration: 4800 },
  warning: { label: 'Atenção', icon: 'warning', duration: 6200 },
  error: { label: 'Algo deu errado', icon: 'error', duration: 8000 },
};

const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let sequence = 0;

const emit = () => listeners.forEach((listener) => listener());

/** Assina mudanças da fila de avisos. Retorna a função de cancelamento. */
export const subscribeToasts = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getToasts = (): ToastItem[] => items;

export const dismissToast = (id: string): void => {
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
};

export const clearToasts = (): void => {
  if (items.length === 0) return;
  items = [];
  emit();
};

const push = (tone: ToastTone, message: unknown): string => {
  const text = String(message ?? '').trim();
  if (!text) return '';
  const id = `toast-${++sequence}`;
  items = [...items, { id, tone, message: text, duration: TOAST_TONES[tone].duration }].slice(-MAX_VISIBLE);
  emit();
  return id;
};

/**
 * Infere o tom a partir do texto — a maioria dos avisos nasce de um
 * `alert(mensagem)` e a mensagem já diz se deu certo ou não.
 */
export const inferTone = (message: unknown): ToastTone => {
  const text = String(message ?? '').toLowerCase();
  if (!text) return 'info';

  // Prefixo explícito de aviso/atenção sempre vale como alerta ameno,
  // mesmo que o texto cite "não pode" ou "erro" em seguida.
  if (/^[\s"'`]*(aviso|atenção|atencao)\b/.test(text)) return 'warning';

  if (
    /(erro|falha|não foi possível|nao foi possivel|inválid|invalid|incorret|expirad|negad|sem permissão|não pode|nao pode|não permite|nao permite|não aceita|nao aceita|não possui|nao possui|não há|nao ha|obrigatóri|obrigatori|preencha|selecione|informe|indisponíve|indisponive)/.test(
      text
    )
  ) {
    return 'error';
  }

  if (
    /(atenção|atencao|cuidado|aguarde|pendente|limite|máxim|maxim|já existe|ja existe|em uso|aguardando|não foram|nao foram)/.test(
      text
    )
  ) {
    return 'warning';
  }

  if (
    /(sucesso|concluí|conclui|criad|atualizad|enviad|salv|removid|confirmad|aceit|recusad|agendad|excluí|exclui|deletad|realizad|copiad|reenviad|aprovad|cancelad|disponível|disponivel)/.test(
      text
    )
  ) {
    return 'success';
  }

  return 'info';
};

export const toast = {
  success: (message: unknown) => push('success', message),
  error: (message: unknown) => push('error', message),
  warning: (message: unknown) => push('warning', message),
  info: (message: unknown) => push('info', message),
  /** Tom detectado automaticamente pelo conteúdo da mensagem. */
  auto: (message: unknown) => push(inferTone(message), message),
  dismiss: dismissToast,
  clear: clearToasts,
};

export default toast;
