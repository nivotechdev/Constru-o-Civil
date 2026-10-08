// Short messages at the bottom of the screen ("Vaga salva", "Não deu para salvar…"), optionally with
// one action ("Desfazer"). One at a time; a new one replaces the old.

export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; onClick: () => void };
}

let current: Toast | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((fn) => fn());
}

export function subscribeToast(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getToast(): Toast | null {
  return current;
}

export function showToast(
  message: string,
  { tone = 'default', action, duration = 4000 }: Partial<Pick<Toast, 'tone' | 'action'>> & { duration?: number } = {}
): void {
  clearTimeout(timer);
  current = { id: ++seq, message, tone, action };
  emit();
  timer = setTimeout(dismissToast, duration);
}

export function dismissToast(): void {
  clearTimeout(timer);
  current = null;
  emit();
}
