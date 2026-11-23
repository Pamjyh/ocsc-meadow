import { describe, expect, it } from 'vitest';
import {
  addWidget,
  compactVerticalLayout,
  createDefaultWidgetLayout,
  moveWidget,
  reconcileLayout,
  rectsOverlap,
  removeWidget,
  toggleWidgetSize,
  updateWidgetGrid,
} from '../widgetStore';
import type { WidgetItem } from '../widgetTypes';

describe('reconcileLayout (v1 -> v2 migration & recovery)', () => {
  it('falls back to defaults on null or corrupt payload (F11)', () => {
    const fromNull = reconcileLayout(null);
    expect(fromNull.version).toBe(2);
    expect(fromNull.items.length).toBeGreaterThanOrEqual(4);

    const fromBad = reconcileLayout({ version: 99, items: 'corrupt' });
    expect(fromBad.items.map((i) => i.type)).toEqual(
      createDefaultWidgetLayout().items.map((i) => i.type),
    );
  });

  it('migrates v1 layout to v2 12-col grid without losing sticky note content', () => {
    const savedV1 = {
      version: 1,
      items: [
        { id: 'core_welcome', type: 'core_welcome', visible: false, size: 'half', config: {} },
        {
          id: 'sticky_1',
          type: 'sticky_note',
          visible: true,
          size: 'full',
          config: { title: 'สูตรสำคัญ', text: 'x < 5', color: 'mint' },
        },
        { id: 'bad_1', type: 'unknown_widget', visible: true, size: 'half', config: {} },
      ],
    };
    const res = reconcileLayout(savedV1);
    expect(res.version).toBe(2);
    expect(res.items.find((i) => i.id === 'bad_1')).toBeUndefined();
    expect(res.items.find((i) => i.type === 'core_welcome')?.visible).toBe(false);

    const note = res.items.find((i) => i.id === 'sticky_1');
    expect(note?.grid.w).toBe(12);
    expect(note?.config.title).toBe('สูตรสำคัญ');
    expect(note?.config.text).toBe('x < 5');
    expect(res.items.find((i) => i.type === 'core_countdown')?.visible).toBe(true);
  });
});

describe('12-col freeform grid physics (F38, F42)', () => {
  it('resolves overlapping widgets vertically without leaving any overlap', () => {
    const items: WidgetItem[] = [
      {
        id: 'a',
        type: 'sticky_note',
        visible: true,
        size: 'half',
        grid: { x: 0, y: 0, w: 6, h: 5 },
        config: {},
      },
      {
        id: 'b',
        type: 'aesthetic_clock',
        visible: true,
        size: 'half',
        grid: { x: 2, y: 1, w: 6, h: 4 },
        config: {},
      },
    ];
    const compacted = compactVerticalLayout(items, 'a');
    const a = compacted.find((i) => i.id === 'a')!;
    const b = compacted.find((i) => i.id === 'b')!;
    expect(rectsOverlap(a.grid, b.grid)).toBe(false);
    expect(a.grid.y).toBe(0);
    expect(b.grid.y).toBe(5);
  });

  it('clamps resized widget to minW, minH, and 12-col right boundary', () => {
    const base = createDefaultWidgetLayout().items;
    const shrunk = updateWidgetGrid(base, 'sticky_note_default_1', {
      x: 10,
      y: 0,
      w: 1,
      h: 1,
    });
    const note = shrunk.find((i) => i.id === 'sticky_note_default_1')!;
    expect(note.grid.w).toBe(3); // sticky_note minW = 3
    expect(note.grid.h).toBe(4); // sticky_note minH = 4
    expect(note.grid.x + note.grid.w).toBeLessThanOrEqual(12);
  });
});

describe('moveWidget, addWidget, removeWidget & toggleWidgetSize', () => {
  it('skips hidden widgets so 1 click always moves 1 visible slot (F13)', () => {
    const items: WidgetItem[] = [
      {
        id: 'a',
        type: 'core_welcome',
        visible: true,
        size: 'half',
        grid: { x: 0, y: 0, w: 6, h: 5 },
        config: {},
      },
      {
        id: 'b',
        type: 'core_countdown',
        visible: false,
        size: 'half',
        grid: { x: 6, y: 0, w: 6, h: 5 },
        config: {},
      },
      {
        id: 'c',
        type: 'ytm_player',
        visible: true,
        size: 'half',
        grid: { x: 0, y: 5, w: 6, h: 7 },
        config: {},
      },
    ];
    const movedUp = moveWidget(items, 'c', -1);
    expect(movedUp.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });

  it('hides core widgets, deletes dynamic widgets, and allows multi sticky notes', () => {
    const base = createDefaultWidgetLayout().items;
    const hiddenCore = removeWidget(base, 'core_countdown');
    expect(hiddenCore.find((i) => i.id === 'core_countdown')?.visible).toBe(false);

    const reShown = addWidget(hiddenCore, 'core_countdown');
    expect(reShown.find((i) => i.id === 'core_countdown')?.visible).toBe(true);

    const removedDynamic = removeWidget(base, 'ytm_player');
    expect(removedDynamic.find((i) => i.id === 'ytm_player')).toBeUndefined();

    const withExtra = addWidget(base, 'sticky_note');
    const notes = withExtra.filter((i) => i.type === 'sticky_note');
    expect(notes.length).toBe(2);
    expect(notes[0]?.id).not.toBe(notes[1]?.id);

    const toggled = toggleWidgetSize(base, 'core_welcome');
    expect(toggled.find((i) => i.id === 'core_welcome')?.grid.w).toBe(12);
  });
});
