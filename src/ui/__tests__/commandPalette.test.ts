import { describe, expect, it } from 'vitest';
import { filterCommandItems, type CommandItem } from '../commandPaletteItems';

const noop = () => {};

const SAMPLE_ITEMS: CommandItem[] = [
  { id: 'nav_dash', group: 'นำทาง', icon: '🏠', title: 'หน้าแรก', run: noop },
  { id: 'ctrl_zen', group: 'ควบคุมเร็ว', icon: '⛶', title: 'เข้าสู่โหมด Zen เต็มจอ', keywords: 'zen focus fullscreen', run: noop },
  { id: 'study_1', group: 'คลังเนื้อหา', icon: '📖', title: 'อนุกรมเลขคณิต', subtitle: 'คณิตศาสตร์', run: noop },
  { id: 'study_2', group: 'คลังเนื้อหา', icon: '📖', title: 'พ.ร.บ. ระเบียบบริหารราชการแผ่นดิน', subtitle: 'กฎหมาย ก.พ.', run: noop },
  { id: 'exam_1', group: 'ชุดข้อสอบ', icon: '📝', title: 'ข้อสอบกฎหมาย ชุดที่ 1', run: noop },
];

describe('commandPaletteItems', () => {
  it('returns core navigation, controls, and preview items on empty query', () => {
    const res = filterCommandItems(SAMPLE_ITEMS, '');
    expect(res.map((i) => i.id)).toEqual([
      'nav_dash',
      'ctrl_zen',
      'study_1',
      'study_2',
      'exam_1',
    ]);
  });

  it('matches Thai titles, subtitles, and English keywords case-insensitively', () => {
    expect(filterCommandItems(SAMPLE_ITEMS, 'ZEN').map((i) => i.id)).toEqual(['ctrl_zen']);
    expect(filterCommandItems(SAMPLE_ITEMS, 'กฎหมาย').map((i) => i.id)).toEqual([
      'study_2',
      'exam_1',
    ]);
  });

  it('supports multi-term AND filtering', () => {
    expect(filterCommandItems(SAMPLE_ITEMS, 'กฎหมาย ข้อสอบ').map((i) => i.id)).toEqual([
      'exam_1',
    ]);
    expect(filterCommandItems(SAMPLE_ITEMS, 'ไม่มีคำนี้')).toEqual([]);
  });
});
