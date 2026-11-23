import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { WIDGET_CATALOG_MAP, type WidgetGridRect, type WidgetItem } from './widgetTypes';

interface WidgetShellProps {
  item: WidgetItem;
  displayGrid: WidgetGridRect;
  editMode: boolean;
  isInteracting: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onStartDrag: (id: string, e: ReactPointerEvent<HTMLElement>) => void;
  onStartResize: (id: string, e: ReactPointerEvent<HTMLElement>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleSize: (id: string) => void;
  onRemove: (id: string) => void;
  children: ReactNode;
}

/**
 * Transparent 12-Column Grid shell (F22, F38, F39):
 * - Never adds `.glass-card` (zero glass-on-glass blur nesting)
 * - Dedicated drag handle in `.widget-edit-bar` and bottom-right `↘` resize handle
 *   are active ONLY in Edit Mode.
 */
export function WidgetShell({
  item,
  displayGrid,
  editMode,
  isInteracting,
  canMoveUp,
  canMoveDown,
  onStartDrag,
  onStartResize,
  onMove,
  onToggleSize,
  onRemove,
  children,
}: WidgetShellProps) {
  const meta = WIDGET_CATALOG_MAP[item.type];
  const isWide = displayGrid.w >= 9;

  return (
    <div
      className={`widget-shell${isWide ? ' widget-shell--full' : ''}${
        editMode ? ' widget-shell--editing' : ''
      }${isInteracting ? ' widget-shell--interacting' : ''}`}
      style={{
        gridColumn: `${displayGrid.x + 1} / span ${displayGrid.w}`,
        gridRow: `${displayGrid.y + 1} / span ${displayGrid.h}`,
      }}
      data-widget-id={item.id}
      data-widget-type={item.type}
    >
      {editMode && (
        <div className="widget-edit-bar" role="toolbar" aria-label={`จัดการ ${meta.title}`}>
          <div
            className="widget-drag-handle"
            onPointerDown={(e) => onStartDrag(item.id, e)}
            title="ลากเพื่อย้ายตำแหน่งอิสระ"
            role="button"
            tabIndex={0}
            aria-label={`ลากย้าย ${meta.title}`}
          >
            <span className="widget-drag-grip" aria-hidden="true">
              ⠿
            </span>
            <span className="widget-edit-label">
              <span aria-hidden="true">{meta.emoji}</span> {meta.title}
            </span>
            <span className="widget-size-badge" aria-hidden="true">
              {displayGrid.w}×{displayGrid.h}
            </span>
          </div>

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
              title={isWide ? 'ปรับเป็นครึ่งแถว (6 คอลัมน์)' : 'ขยายเต็มแถว (12 คอลัมน์)'}
            >
              {isWide ? 'ครึ่งแถว' : 'เต็มแถว'}
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

      {editMode && (
        <button
          type="button"
          className="widget-resize-handle"
          onPointerDown={(e) => onStartResize(item.id, e)}
          title="ลากมุมขวาล่างเพื่อปรับขนาดกว้าง×สูงอิสระ"
          aria-label={`ดึงมุมขวาล่างเพื่อปรับขนาด ${meta.title}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12.5 5.5L5.5 12.5M12.5 9.5L9.5 12.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
