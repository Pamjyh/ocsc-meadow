import { readJson, writeJson } from '../../services/storage';
import {
  CORE_WIDGET_TYPES,
  WIDGET_CATALOG_MAP,
  isWidgetType,
  type WidgetItem,
  type WidgetLayoutState,
  type WidgetSize,
  type WidgetType,
} from './widgetTypes';
import { makeWidgetId } from './widgetUtils';

export const WIDGET_LAYOUT_STORAGE_KEY = 'ocsc_meadow_widgets_v1';

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
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

  return {
    version: 1,
    items: defaultOrder.map((type) => {
      const meta = WIDGET_CATALOG_MAP[type];
      return {
        id: meta.multiInstance ? `${type}_default_1` : type,
        type,
        visible: meta.defaultVisible,
        size: meta.defaultSize,
        config: cloneConfig(meta.defaultConfig),
      };
    }),
  };
}

function isValidSize(value: unknown): value is WidgetSize {
  return value === 'half' || value === 'full';
}

/**
 * Reconciles saved localStorage layout against current WIDGET_CATALOG (F11):
 * - Falls back to defaults on missing/corrupt data or unknown version
 * - Drops unknown widget types & duplicate singletons
 * - Ensures all 4 core widgets exist in items (preserving saved visibility)
 * - Merges missing default config keys
 */
export function reconcileLayout(saved: unknown): WidgetLayoutState {
  if (!saved || typeof saved !== 'object') {
    return createDefaultWidgetLayout();
  }

  const candidate = saved as { version?: unknown; items?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.items)) {
    return createDefaultWidgetLayout();
  }

  const seenSingletons = new Set<WidgetType>();
  const seenIds = new Set<string>();
  const cleaned: WidgetItem[] = [];

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

    const rawConfig =
      rec.config && typeof rec.config === 'object' && !Array.isArray(rec.config)
        ? (rec.config as Record<string, unknown>)
        : {};

    cleaned.push({
      id,
      type: rec.type,
      visible: typeof rec.visible === 'boolean' ? rec.visible : true,
      size: isValidSize(rec.size) ? rec.size : meta.defaultSize,
      config: {
        ...cloneConfig(meta.defaultConfig),
        ...rawConfig,
      },
    });
  }

  // Ensure every core widget exists so future app updates never drop core sections
  for (const coreType of CORE_WIDGET_TYPES) {
    if (!seenSingletons.has(coreType)) {
      const meta = WIDGET_CATALOG_MAP[coreType];
      cleaned.push({
        id: coreType,
        type: coreType,
        visible: true,
        size: meta.defaultSize,
        config: cloneConfig(meta.defaultConfig),
      });
    }
  }

  return {
    version: 1,
    items: cleaned,
  };
}

export function loadWidgetLayout(): WidgetLayoutState {
  const saved = readJson<unknown>(WIDGET_LAYOUT_STORAGE_KEY);
  return reconcileLayout(saved);
}

export function saveWidgetLayout(state: WidgetLayoutState): boolean {
  return writeJson(WIDGET_LAYOUT_STORAGE_KEY, state);
}

/**
 * Moves a visible widget up (-1) or down (+1) by skipping hidden items
 * so 1 click ALWAYS moves 1 visible slot on screen (F13).
 */
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
  next[from] = toItem;
  next[to] = fromItem;
  return next;
}

export function addWidget(items: WidgetItem[], type: WidgetType): WidgetItem[] {
  const meta = WIDGET_CATALOG_MAP[type];
  if (!meta) return items;

  if (!meta.multiInstance) {
    const existingIdx = items.findIndex((item) => item.type === type);
    if (existingIdx !== -1) {
      const existing = items[existingIdx];
      if (!existing || existing.visible) return items;
      // Re-show hidden singleton at its saved position
      return items.map((item, idx) =>
        idx === existingIdx ? { ...item, visible: true } : item,
      );
    }

    return [
      ...items,
      {
        id: type,
        type,
        visible: true,
        size: meta.defaultSize,
        config: cloneConfig(meta.defaultConfig),
      },
    ];
  }

  return [
    ...items,
    {
      id: makeWidgetId(type),
      type,
      visible: true,
      size: meta.defaultSize,
      config: cloneConfig(meta.defaultConfig),
    },
  ];
}

export function removeWidget(items: WidgetItem[], id: string): WidgetItem[] {
  const target = items.find((item) => item.id === id);
  if (!target) return items;

  const meta = WIDGET_CATALOG_MAP[target.type];
  if (meta.isCore) {
    return items.map((item) =>
      item.id === id ? { ...item, visible: false } : item,
    );
  }

  return items.filter((item) => item.id !== id);
}

export function toggleWidgetSize(items: WidgetItem[], id: string): WidgetItem[] {
  return items.map((item) =>
    item.id === id
      ? { ...item, size: item.size === 'full' ? 'half' : 'full' }
      : item,
  );
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
