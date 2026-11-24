import { describe, expect, it } from 'vitest';
import {
  buildClozeFront,
  isCustomFlashcardId,
} from '../customFlashcardsStore';

describe('customFlashcardsStore', () => {
  it('builds Cloze Deletion prompts natively for space-free Thai text', () => {
    const front = buildClozeFront(
      'พ.ร.บ. วิธีปฏิบัติราชการทางปกครอง มาตรา 30 ให้โอกาสคู่กรณีชี้แจง',
      'มาตรา 30',
    );
    expect(front).toBe(
      'พ.ร.บ. วิธีปฏิบัติราชการทางปกครอง [ ..... ] ให้โอกาสคู่กรณีชี้แจง',
    );
  });

  it('matches case-insensitively for English vocabulary and rejects invalid targets', () => {
    expect(buildClozeFront('The committee reached a unanimous decision.', 'UNANIMOUS')).toBe(
      'The committee reached a [ ..... ] decision.',
    );
    expect(buildClozeFront('ทดสอบข้อความ', 'ไม่มีคำนี้')).toBeNull();
    expect(buildClozeFront('ทดสอบข้อความ', 'ก')).toBeNull();
    expect(isCustomFlashcardId('custom_123')).toBe(true);
    expect(isCustomFlashcardId('fc_law_01')).toBe(false);
  });
});
