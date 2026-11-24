import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeToasts, type ToastItem } from '../services/toast';
import './ToastHost.css';

const MAX_VISIBLE_TOASTS = 3;

const TONE_ICON: Record<ToastItem['tone'], string> = {
  info: '✨',
  success: '✓',
  celebrate: '🎉',
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToasts((item) => {
      setToasts((prev) => {
        const next = [...prev, item];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const evicted = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
          evicted.forEach((old) => {
            const t = timersRef.current.get(old.id);
            if (t !== undefined) {
              window.clearTimeout(t);
              timersRef.current.delete(old.id);
            }
          });
          return next.slice(next.length - MAX_VISIBLE_TOASTS);
        }
        return next;
      });

      const timer = window.setTimeout(() => {
        dismiss(item.id);
      }, item.durationMs);
      timersRef.current.set(item.id, timer);
    });

    return () => {
      unsubscribe();
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-host"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast-pill toast-pill--${toast.tone}`}
          onClick={() => dismiss(toast.id)}
          title="แตะเพื่อปิดการแจ้งเตือน"
        >
          <span className="toast-icon" aria-hidden="true">
            {TONE_ICON[toast.tone]}
          </span>
          <span className="toast-copy">
            <span className="toast-msg">{toast.message}</span>
            {toast.detail && <span className="toast-detail">{toast.detail}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
