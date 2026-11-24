import { describe, expect, it, vi } from 'vitest';
import { showToast, subscribeToasts } from '../toast';

describe('toast pub-sub service', () => {
  it('delivers toast payloads to active subscribers and supports unsubscribe', () => {
    const received: string[] = [];
    const unsub = subscribeToasts((item) => {
      received.push(`${item.tone}:${item.message}`);
    });

    showToast({ message: 'เช็กอินแล้ว', tone: 'success' });
    showToast({ message: 'ผ่านเกณฑ์!', tone: 'celebrate' });
    expect(received).toEqual(['success:เช็กอินแล้ว', 'celebrate:ผ่านเกณฑ์!']);

    unsub();
    showToast({ message: 'ไม่ควรได้รับ' });
    expect(received).toHaveLength(2);
  });

  it('assigns unique ids and default tone/duration', () => {
    const spy = vi.fn();
    const unsub = subscribeToasts(spy);
    const id1 = showToast({ message: 'A' });
    const id2 = showToast({ message: 'B' });
    unsub();

    expect(id1).not.toBe(id2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      message: 'A',
      tone: 'info',
      durationMs: 3200,
    });
  });
});
