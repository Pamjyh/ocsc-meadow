import { readJson, writeJson } from '../../services/storage';
import {
  CORE_WIDGET_TYPES,
  GRID_COLS,
  GRID_MAX_H,
  WIDGET_CATALOG_MAP,
  isWidgetType,
  type WidgetGridRect,
  type WidgetItem,
  type WidgetLayoutState,
  type WidgetSize,
  type WidgetType,
} from './widgetTypes';
import { makeWidgetId } from './widgetUtils';

export const WIDGET_LAYOUT_STORAGE_KEY_V1 = 'ocsc_meadow_widgets_v1';
export const WIDGET_LAYOUT_STORAGE_KEY = 'ocsc_meadow_widgets_v2';

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

export function rectsOverlap(a: WidgetGridRect, b: WidgetGridRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function clampGridRect(
  rect: WidgetGridRect,
  minW: number,
  minH: number,
  cols = GRID_COLS,
): WidgetGridRect {
  const safeMinW = Math.max(1, Math.min(cols, Math.round(minW)));
  const safeMinH = Math.max(2, Math.min(GRID_MAX_H, Math.round(minH)));
  const w = Math.max(safeMinW, Math.min(cols, Math.round(rect.w)));
  const h = Math.max(safeMinH, Math.min(GRID_MAX_H, Math.round(rect.h)));
  const x = Math.max(0, Math.min(cols - w, Math.round(rect.x)));
  const y = Math.max(0, Math.round(rect.y));
  return { x, y, w, h };
}

function getBottomY(items: WidgetItem[]): number {
  let maxY = 0;
  for (const item of items) {
    if (!item.visible) continue;
    maxY = Math.max(maxY, item.grid.y + item.grid.h);
  }
  return maxY;
}

/**
 * Resolves collisions and compacts visible widgets upward (vertical gravity)
 * while keeping `priorityId` anchored at its requested (x, y) position.
 */
export function compactVerticalLayout(
  items: WidgetItem[],
  priorityId?: string,
): WidgetItem[] {
  const visible = items.filter((i) => i.visible);
  const placed: WidgetGridRect[] = [];
  const nextRectMap = new Map<string, WidgetGridRect>();

  // Anchor priority item first so dragged/resized widget stays where user dropped it
  const priorityItem = priorityId
    ? visible.find((i) => i.id === priorityId)
    : undefined;

  if (priorityItem) {
    const meta = WIDGET_CATALOG_MAP[priorityItem.type];
    const clamped = clampGridRect(priorityItem.grid, meta.minW, meta.minH);
    placed.push(clamped);
    nextRectMap.set(priorityItem.id, clamped);
  }

  // Sort remaining visible items top-to-bottom, left-to-right
  const others = visible
    .filter((i) => i.id !== priorityId)
    .sort((a, b) => (a.grid.y !== b.grid.y ? a.grid.y - b.grid.y : a.grid.x - b.grid.x));

  for (const item of others) {
    const meta = WIDGET_CATALOG_MAP[item.type];
    const base = clampGridRect(item.grid, meta.minW, meta.minH);

    // Pull upward as far as possible without colliding with already placed items
    let y = 0;
    while (y < base.y) {
      const probe: WidgetGridRect = { ...base, y };
      if (!placed.some((p) => rectsOverlap(probe, p))) break;
      y += 1;
    }

    let candidate: WidgetGridRect = { ...base, y };
    while (placed.some((p) => rectsOverlap(candidate, p))) {
      candidate = { ...candidate, y: candidate.y + 1 };
    }

    placed.push(candidate);
    nextRectMap.set(item.id, candidate);
  }

  return items.map((item) => {
    const updated = nextRectMap.get(item.id);
    if (!updated) return item;
    return {
      ...item,
      size: updated.w >= 9 ? 'full' : 'half',
      grid: updated,
    };
  });
}

export function createDefaultWidgetLayout(): WidgetLayoutState {
  const defaultOrder: WidgetType[] = [
    'core_welcome',
    'core_countdown',
    'core_pass_rollup',
    'core_subjects',
    'ytm_player',
    'photo_collection',
    'sticky_note',
  ];

  const items: WidgetItem[] = defaultOrder.map((type) => {
    const meta = WIDGET_CATALOG_MAP[type];
    return {
      id: meta.multiInstance ? `${type}_default_1` : type,
      type,
      visible: meta.defaultVisible,
      size: meta.defaultSize,
      grid: { ...meta.defaultGrid },
      config: cloneConfig(meta.defaultConfig),
    };
  });

  return {
    version: 2,
    items: compactVerticalLayout(items),
  };
}

function isValidSize(value: unknown): value is WidgetSize {
  return value === 'half' || value === 'full';
}

function parseSavedGrid(
  raw: unknown,
  fallback: WidgetGridRect,
  minW: number,
  minH: number,
): WidgetGridRect | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.x !== 'number' ||
    typeof r.y !== 'number' ||
    typeof r.w !== 'number' ||
    typeof r.h !== 'number' ||
    !Number.isFinite(r.x) ||
    !Number.isFinite(r.y) ||
    !Number.isFinite(r.w) ||
    !Number.isFinite(r.h)
  ) {
    return null;
  }
  return clampGridRect(
    { x: r.x, y: r.y, w: r.w, h: r.h },
    minW,
    minH,
  ) ?? fallback;
}

/**
 * Reconciles v2 OR migrates v1 localStorage layouts cleanly with zero data loss:
 * - Preserves sticky_note text/colors, daily_goals tasks, and core visibility
 * - Assigns 12-col (x, y, w, h) coordinates for v1 items based on size ('half' -> w:6, 'full' -> w:12)
 * - Auto-appends any missing core widgets and compacts collisions
 */
export function reconcileLayout(saved: unknown): WidgetLayoutState {
  if (!saved || typeof saved !== 'object') {
    return createDefaultWidgetLayout();
  }

  const candidate = saved as { version?: unknown; items?: unknown };
  if (
    (candidate.version !== 1 && candidate.version !== 2) ||
    !Array.isArray(candidate.items)
  ) {
    return createDefaultWidgetLayout();
  }

  const seenSingletons = new Set<WidgetType>();
  const seenIds = new Set<string>();
  const cleaned: WidgetItem[] = [];

  // Running cursor for v1 -> v2 auto-placement
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;

  for (const raw of candidate.items) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    if (!isWidgetType(rec.type)) continue;

    const meta = WIDGET_CATALOG_MAP[rec.type];
    if (!meta.multiInstance && seenSingletons.has(rec.type)) continue;

    const id =
      typeof rec.id === 'string' && rec.id.trim().length > 0 && !seenIds.has(rec.id)
        ? rec.id
        : meta.multiInstance
          ? makeWidgetId(rec.type)
          : rec.type;

    seenIds.add(id);
    if (!meta.multiInstance) seenSingletons.add(rec.type);

    const visible = typeof rec.visible === 'boolean' ? rec.visible : true;
    const size: WidgetSize = isValidSize(rec.size) ? rec.size : meta.defaultSize;
    const rawConfig =
      rec.config && typeof rec.config === 'object' && !Array.isArray(rec.config)
        ? (rec.config as Record<string, unknown>)
        : {};

    let grid = parseSavedGrid(rec.grid, meta.defaultGrid, meta.minW, meta.minH);
    if (!grid) {
      const w = size === 'full' ? 12 : 6;
      const h = meta.defaultGrid.h;
      if (cursorX + w > GRID_COLS) {
        cursorX = 0;
        cursorY += rowMaxH;
        rowMaxH = 0;
      }
      grid = clampGridRect({ x: cursorX, y: cursorY, w, h }, meta.minW, meta.minH);
      if (visible) {
        cursorX += w;
        rowMaxH = Math.max(rowMaxH, h);
        if (cursorX >= GRID_COLS) {
          cursorX = 0;
          cursorY += rowMaxH;
          rowMaxH = 0;
        }
      }
    }

    cleaned.push({
      id,
      type: rec.type,
      visible,
      size: grid.w >= 9 ? 'full' : 'half',
      grid,
      config: {
        ...cloneConfig(meta.defaultConfig),
        ...rawConfig,
      },
    });
  }

  for (const coreType of CORE_WIDGET_TYPES) {
    if (!seenSingletons.has(coreType)) {
      const meta = WIDGET_CATALOG_MAP[coreType];
      const nextY = getBottomY(cleaned);
      cleaned.push({
        id: coreType,
        type: coreType,
        visible: true,
        size: meta.defaultSize,
        grid: { ...meta.defaultGrid, x: 0, y: nextY },
        config: cloneConfig(meta.defaultConfig),
      });
    }
  }

  return {
    version: 2,
    items: compactVerticalLayout(cleaned),
  };
}

export function loadWidgetLayout(): WidgetLayoutState {
  const savedV2 = readJson<unknown>(WIDGET_LAYOUT_STORAGE_KEY);
  if (savedV2) return reconcileLayout(savedV2);
  const savedV1 = readJson<unknown>(WIDGET_LAYOUT_STORAGE_KEY_V1);
  if (savedV1) return reconcileLayout(savedV1);
  return createDefaultWidgetLayout();
}

export function saveWidgetLayout(state: WidgetLayoutState): boolean {
  return writeJson(WIDGET_LAYOUT_STORAGE_KEY, state);
}

/** Moves a visible widget up (-1) or down (+1) in mobile order & updates grid Y cleanly (F13). */
export function moveWidget(
  items: WidgetItem[],
  id: string,
  dir: -1 | 1,
): WidgetItem[] {
  const from = items.findIndex((item) => item.id === id);
  if (from === -1) return items;

  let to = from + dir;
  while (to >= 0 && to < items.length) {
    const candidate = items[to];
    if (candidate && candidate.visible) break;
    to += dir;
  }

  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const fromItem = next[from];
  const toItem = next[to];
  if (!fromItem || !toItem) return items;

  // Swap both array order and grid (x, y) coordinates so desktop & mobile stay in sync
  next[from] = { ...toItem, grid: { ...toItem.grid, x: fromItem.grid.x, y: fromItem.grid.y } };
  next[to] = { ...fromItem, grid: { ...fromItem.grid, x: toItem.grid.x, y: toItem.grid.y } };
  return compactVerticalLayout(next, fromItem.id);
}

export function updateWidgetGrid(
  items: WidgetItem[],
  id: string,
  nextGrid: WidgetGridRect,
): WidgetItem[] {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const meta = WIDGET_CATALOG_MAP[target.type];
  const clamped = clampGridRect(nextGrid, meta.minW, meta.minH);

  const updated = items.map((item) =>
    item.id === id
      ? { ...item, size: (clamped.w >= 9 ? 'full' : 'half') as WidgetSize, grid: clamped }
      : item,
  );

  return compactVerticalLayout(updated, id);
}

export function addWidget(items: WidgetItem[], type: WidgetType): WidgetItem[] {
  const meta = WIDGET_CATALOG_MAP[type];
  if (!meta) return items;

  const bottomY = getBottomY(items);

  if (!meta.multiInstance) {
    const existingIdx = items.findIndex((item) => item.type === type);
    if (existingIdx !== -1) {
      const existing = items[existingIdx];
      if (!existing || existing.visible) return items;
      const shown = items.map((item, idx) =>
        idx === existingIdx
          ? {
              ...item,
              visible: true,
              grid: { ...item.grid, y: bottomY },
            }
          : item,
      );
      return compactVerticalLayout(shown);
    }

    return compactVerticalLayout([
      ...items,
      {
        id: type,
        type,
        visible: true,
        size: meta.defaultSize,
        grid: { ...meta.defaultGrid, x: 0, y: bottomY },
        config: cloneConfig(meta.defaultConfig),
      },
    ]);
  }

  return compactVerticalLayout([
    ...items,
    {
      id: makeWidgetId(type),
      type,
      visible: true,
      size: meta.defaultSize,
      grid: { ...meta.defaultGrid, x: 0, y: bottomY },
      config: cloneConfig(meta.defaultConfig),
    },
  ]);
}

export function removeWidget(items: WidgetItem[], id: string): WidgetItem[] {
  const target = items.find((item) => item.id === id);
  if (!target) return items;

  const meta = WIDGET_CATALOG_MAP[target.type];
  const next = meta.isCore
    ? items.map((item) => (item.id === id ? { ...item, visible: false } : item))
    : items.filter((item) => item.id !== id);

  return compactVerticalLayout(next);
}

export function toggleWidgetSize(items: WidgetItem[], id: string): WidgetItem[] {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const nextW = target.grid.w >= 9 ? 6 : 12;
  const nextX = nextW === 12 ? 0 : Math.min(target.grid.x, GRID_COLS - nextW);
  return updateWidgetGrid(items, id, { ...target.grid, x: nextX, w: nextW });
}

export function updateWidgetConfig(
  items: WidgetItem[],
  id: string,
  patch: Record<string, unknown>,
): WidgetItem[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, config: { ...item.config, ...patch } }
      : item,
  );
}
