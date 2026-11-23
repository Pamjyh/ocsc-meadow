import type { ReactNode } from 'react';
import { WIDGET_CATALOG_MAP, type WidgetItem } from './widgetTypes';

interface WidgetShellProps {
  item: WidgetItem;
  editMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleSize: (id: string) => void;
  onRemove: (id: string) => void;
  children: ReactNode;
}

/**
 * Transparent Bento Grid shell (F22): never adds `.glass-card` so inner cards
 * keep single-layer Liquid Glass without double-blur nesting.
 */
export function WidgetShell({
  item,
  editMode,
  canMoveUp,
  canMoveDown,
  onMove,
  onToggleSize,
  onRemove,
  children,
}: WidgetShellProps) {
  const meta = WIDGET_CATALOG_MAP[item.type];
  const isFull = item.size === 'full';

  return (
    <div
      className={`widget-shell${isFull ? ' widget-shell--full' : ''}${
        editMode ? ' widget-shell--editing' : ''
      }`}
      data-widget-id={item.id}
      data-widget-type={item.type}
    >
      {editMode && (
        <div className="widget-edit-bar" role="toolbar" aria-label={`จัดการ ${meta.title}`}>
          <span className="widget-edit-label">
            <span aria-hidden="true">{meta.emoji}</span> {meta.title}
          </span>
          <div className="widget-edit-actions">
            <button
              type="button"
              className="widget-edit-btn"
              disabled={!canMoveUp}
              onClick={() => onMove(item.id, -1)}
              title="เลื่อนขึ้น"
              aria-label={`เลื่อน ${meta.title} ขึ้น`}
            >
              ↑
            </button>
            <button
              type="button"
              className="widget-edit-btn"
              disabled={!canMoveDown}
              onClick={() => onMove(item.id, 1)}
              title="เลื่อนลง"
              aria-label={`เลื่อน ${meta.title} ลง`}
            >
              ↓
            </button>
            <button
              type="button"
              className="widget-edit-btn widget-btn-resize"
              onClick={() => onToggleSize(item.id)}
              title={isFull ? 'ปรับเป็นครึ่งแถว' : 'ขยายเต็มแถว'}
            >
              {isFull ? 'ครึ่งแถว' : 'เต็มแถว'}
            </button>
            <button
              type="button"
              className="widget-edit-btn widget-edit-btn--danger"
              onClick={() => onRemove(item.id)}
              title={meta.isCore ? 'ซ่อนหน้าต่างนี้' : 'ลบหน้าต่างนี้'}
              aria-label={`${meta.isCore ? 'ซ่อน' : 'ลบ'} ${meta.title}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="widget-shell-body">{children}</div>
    </div>
  );
}
