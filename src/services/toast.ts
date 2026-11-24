export type ToastTone = 'info' | 'success' | 'celebrate';

export interface ToastPayload {
  message: string;
  detail?: string;
  tone?: ToastTone;
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  detail?: string;
  tone: ToastTone;
  durationMs: number;
}

type ToastListener = (toast: ToastItem) => void;

const listeners = new Set<ToastListener>();
let seq = 0;

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(payload: ToastPayload): string {
  seq += 1;
  const item: ToastItem = {
    id: `toast_${Date.now()}_${seq}`,
    message: payload.message,
    detail: payload.detail,
    tone: payload.tone ?? 'info',
    durationMs: payload.durationMs ?? 3200,
  };
  listeners.forEach((fn) => fn(item));
  return item.id;
}
