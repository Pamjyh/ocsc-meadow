import { describe, expect, it } from 'vitest';
import {
  addWidget,
  createDefaultWidgetLayout,
  moveWidget,
  reconcileLayout,
  removeWidget,
  toggleWidgetSize,
} from '../widgetStore';
import type { WidgetItem } from '../widgetTypes';

describe('reconcileLayout', () => {
  it('falls back to defaults on null or corrupt payload (F11)', () => {
    const fromNull = reconcileLayout(null);
    expect(fromNull.version).toBe(1);
    expect(fromNull.items.length).toBeGreaterThanOrEqual(4);

    const fromBad = reconcileLayout({ version: 99, items: 'corrupt' });
    expect(fromBad.items.map((i) => i.type)).toEqual(
      createDefaultWidgetLayout().items.map((i) => i.type),
    );
  });

  it('drops unknown types and auto-appends missing core widgets', () => {
    const saved = {
      version: 1,
      items: [
        { id: 'core_welcome', type: 'core_welcome', visible: false, size: 'half', config: {} },
        { id: 'bad_1', type: 'unknown_widget', visible: true, size: 'half', config: {} },
      ],
    };
    const res = reconcileLayout(saved);
    expect(res.items.find((i) => i.id === 'bad_1')).toBeUndefined();
    expect(res.items.find((i) => i.type === 'core_welcome')?.visible).toBe(false);
    expect(res.items.find((i) => i.type === 'core_countdown')?.visible).toBe(true);
    expect(res.items.find((i) => i.type === 'core_pass_rollup')?.visible).toBe(true);
    expect(res.items.find((i) => i.type === 'core_subjects')?.visible).toBe(true);
  });
});

describe('moveWidget (visible-only swap — F13)', () => {
  it('skips hidden widgets so 1 click always moves 1 visible slot', () => {
    const items: WidgetItem[] = [
      { id: 'a', type: 'core_welcome', visible: true, size: 'half', config: {} },
      { id: 'b', type: 'core_countdown', visible: false, size: 'half', config: {} },
      { id: 'c', type: 'ytm_player', visible: true, size: 'half', config: {} },
    ];
    const movedUp = moveWidget(items, 'c', -1);
    expect(movedUp.map((i) => i.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('addWidget, removeWidget & toggleWidgetSize', () => {
  it('hides core widgets instead of deleting, and deletes dynamic widgets', () => {
    const base = createDefaultWidgetLayout().items;
    const hiddenCore = removeWidget(base, 'core_countdown');
    expect(hiddenCore.find((i) => i.id === 'core_countdown')?.visible).toBe(false);

    const reShown = addWidget(hiddenCore, 'core_countdown');
    expect(reShown.find((i) => i.id === 'core_countdown')?.visible).toBe(true);

    const removedDynamic = removeWidget(base, 'ytm_player');
    expect(removedDynamic.find((i) => i.id === 'ytm_player')).toBeUndefined();
  });

  it('allows multiple sticky_note instances with unique IDs', () => {
    const base = createDefaultWidgetLayout().items;
    const withExtra = addWidget(base, 'sticky_note');
    const notes = withExtra.filter((i) => i.type === 'sticky_note');
    expect(notes.length).toBe(2);
    expect(notes[0]?.id).toBeDefined();
    expect(notes[0]?.id).not.toBe(notes[1]?.id);
  });

  it('toggles widget size between half and full', () => {
    const base = createDefaultWidgetLayout().items;
    const toggled = toggleWidgetSize(base, 'core_welcome');
    expect(toggled.find((i) => i.id === 'core_welcome')?.size).toBe('full');
  });
});
