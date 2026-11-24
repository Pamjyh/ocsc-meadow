import { describe, expect, it } from 'vitest';
import {
  addStudyHighlight,
  normalizeHighlightText,
  removeStudyHighlight,
  type StudyHighlightsMap,
} from '../studyHighlightsStore';

describe('studyHighlightsStore', () => {
  it('normalizes whitespace and rejects empty or very short clips', () => {
    expect(normalizeHighlightText('  มาตรา   15 \n  พ.ร.บ.  ')).toBe('มาตรา 15 พ.ร.บ.');
    const res = addStudyHighlight({}, 'doc_1', '  ab ', 'yellow');
    expect(res.added).toBeNull();
    expect(res.duplicate).toBe(false);
  });

  it('adds highlights, prevents duplicates in the same doc, and removes cleanly', () => {
    const map: StudyHighlightsMap = {};
    const r1 = addStudyHighlight(
      map,
      'doc_law',
      'หลักนิติธรรมคือการปกครองด้วยกฎหมาย',
      'yellow',
      '2026-11-24T00:00:00Z',
    );
    expect(r1.added).not.toBeNull();
    expect(r1.next.doc_law).toHaveLength(1);

    const dup = addStudyHighlight(
      r1.next,
      'doc_law',
      'หลักนิติธรรมคือการปกครองด้วยกฎหมาย',
      'mint',
    );
    expect(dup.added).toBeNull();
    expect(dup.duplicate).toBe(true);

    const r2 = addStudyHighlight(r1.next, 'doc_law', 'สูตรระยะทาง = ความเร็ว × เวลา', 'mint');
    expect(r2.next.doc_law).toHaveLength(2);
    expect(r2.next.doc_law?.[0]?.color).toBe('mint');

    const afterRemove = removeStudyHighlight(r2.next, 'doc_law', r1.added!.id);
    expect(afterRemove.doc_law).toHaveLength(1);
    const emptyDoc = removeStudyHighlight(afterRemove, 'doc_law', r2.added!.id);
    expect(emptyDoc.doc_law).toBeUndefined();
  });
});
