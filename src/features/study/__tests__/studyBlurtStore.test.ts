import { describe, expect, it } from 'vitest';
import { saveBlurtNote, type StudyBlurtMap } from '../studyBlurtStore';

describe('studyBlurtStore', () => {
  it('saves blurt notes per docId and removes entry when cleared', () => {
    const m1 = saveBlurtNote({}, 'doc_law', 'หลักนิติธรรมมี 3 ประเด็น', '2026-11-24T00:00:00Z');
    expect(m1.doc_law?.text).toBe('หลักนิติธรรมมี 3 ประเด็น');

    const m2 = saveBlurtNote(m1, 'doc_law', '   ');
    expect(m2.doc_law).toBeUndefined();
  });

  it('enforces max character limit cleanly', () => {
    const longText = 'ก'.repeat(4500);
    const map: StudyBlurtMap = saveBlurtNote({}, 'doc_math', longText);
    expect(map.doc_math?.text.length).toBe(4000);
  });
});
