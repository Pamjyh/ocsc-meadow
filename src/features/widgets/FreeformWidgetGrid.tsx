import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { WidgetShell } from './WidgetShell';
import { clampGridRect } from './widgetStore';
import {
  GRID_COLS,
  GRID_GAP,
  GRID_ROW_HEIGHT,
  WIDGET_CATALOG_MAP,
  type WidgetGridRect,
  type WidgetItem,
} from './widgetTypes';

interface FreeformWidgetGridProps {
  items: WidgetItem[];
  editMode: boolean;
  onCommitGrid: (id: string, nextGrid: WidgetGridRect) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleSize: (id: string) => void;
  onRemove: (id: string) => void;
  renderWidget: (item: WidgetItem) => ReactNode;
}

interface ActiveGesture {
  id: string;
  mode: 'drag' | 'resize';
  startClientX: number;
  startClientY: number;
  originGrid: WidgetGridRect;
  previewGrid: WidgetGridRect;
  minW: number;
  minH: number;
}

/**
 * Native React 19 Pointer-Events 12-Column Freeform Snap Grid (F38, F39):
 * Zero external dependencies, no findDOMNode, smooth live ghost preview,
 * and automatic 1-column fallback on mobile (< 768px).
 */
export function FreeformWidgetGrid({
  items,
  editMode,
  onCommitGrid,
  onMove,
  onToggleSize,
  onRemove,
  renderWidget,
}: FreeformWidgetGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const colStepRef = useRef(96);
  const [gesture, setGesture] = useState<ActiveGesture | null>(null);
  const gestureRef = useRef<ActiveGesture | null>(null);
  gestureRef.current = gesture;

  // Track exact column pixel width via ResizeObserver
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) {
        colStepRef.current = (width + GRID_GAP) / GRID_COLS;
      }
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cancel any in-flight gesture if Edit Mode is turned off
  useEffect(() => {
    if (!editMode && gestureRef.current) {
      setGesture(null);
    }
  }, [editMode]);

  useEffect(() => {
    if (!gesture) return;

    const rowStep = GRID_ROW_HEIGHT + GRID_GAP;

    const onPointerMove = (e: PointerEvent) => {
      const current = gestureRef.current;
      if (!current) return;
      const dx = e.clientX - current.startClientX;
      const dy = e.clientY - current.startClientY;
      const dCols = Math.round(dx / Math.max(24, colStepRef.current));
      const dRows = Math.round(dy / rowStep);

      let nextPreview: WidgetGridRect;
      if (current.mode === 'drag') {
        nextPreview = clampGridRect(
          {
            x: current.originGrid.x + dCols,
            y: Math.max(0, current.originGrid.y + dRows),
            w: current.originGrid.w,
            h: current.originGrid.h,
          },
          current.minW,
          current.minH,
        );
      } else {
        const maxW = GRID_COLS - current.originGrid.x;
        nextPreview = clampGridRect(
          {
            x: current.originGrid.x,
            y: current.originGrid.y,
            w: Math.min(maxW, current.originGrid.w + dCols),
            h: current.originGrid.h + dRows,
          },
          current.minW,
          current.minH,
        );
      }

      const prev = current.previewGrid;
      if (
        prev.x !== nextPreview.x ||
        prev.y !== nextPreview.y ||
        prev.w !== nextPreview.w ||
        prev.h !== nextPreview.h
      ) {
        setGesture((g) => (g ? { ...g, previewGrid: nextPreview } : null));
      }
    };

    const finishGesture = () => {
      const current = gestureRef.current;
      setGesture(null);
      if (!current) return;
      const o = current.originGrid;
      const p = current.previewGrid;
      if (o.x !== p.x || o.y !== p.y || o.w !== p.w || o.h !== p.h) {
        onCommitGrid(current.id, p);
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', finishGesture);
    window.addEventListener('pointercancel', finishGesture);
    document.body.classList.add('widget-gesturing');

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishGesture);
      window.removeEventListener('pointercancel', finishGesture);
      document.body.classList.remove('widget-gesturing');
    };
  }, [Boolean(gesture), onCommitGrid]);

  const startGesture = useCallback(
    (mode: 'drag' | 'resize', id: string, e: ReactPointerEvent<HTMLElement>) => {
      if (!editMode) return;
      // Disable freeform drag/resize on narrow mobile 1-column stack (< 768px)
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      const item = items.find((i) => i.id === id);
      if (!item) return;

      e.preventDefault();
      e.stopPropagation();

      const meta = WIDGET_CATALOG_MAP[item.type];
      setGesture({
        id,
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originGrid: { ...item.grid },
        previewGrid: { ...item.grid },
        minW: meta.minW,
        minH: meta.minH,
      });
    },
    [editMode, items],
  );

  const handleStartDrag = useCallback(
    (id: string, e: ReactPointerEvent<HTMLElement>) => startGesture('drag', id, e),
    [startGesture],
  );

  const handleStartResize = useCallback(
    (id: string, e: ReactPointerEvent<HTMLElement>) => startGesture('resize', id, e),
    [startGesture],
  );

  return (
    <div
      ref={gridRef}
      className={`bento-grid bento-grid--freeform${
        editMode ? ' bento-grid--editing' : ''
      }`}
    >
      {gesture && (
        <div
          className="widget-ghost-preview"
          style={{
            gridColumn: `${gesture.previewGrid.x + 1} / span ${gesture.previewGrid.w}`,
            gridRow: `${gesture.previewGrid.y + 1} / span ${gesture.previewGrid.h}`,
          }}
          aria-hidden="true"
        >
          <span className="widget-ghost-badge">
            {gesture.previewGrid.w}×{gesture.previewGrid.h}
          </span>
        </div>
      )}

      {items.map((item, idx) => {
        const isInteracting = gesture?.id === item.id;
        const displayGrid = isInteracting ? gesture.previewGrid : item.grid;

        return (
          <WidgetShell
            key={item.id}
            item={item}
            displayGrid={displayGrid}
            editMode={editMode}
            isInteracting={isInteracting}
            canMoveUp={idx > 0}
            canMoveDown={idx < items.length - 1}
            onStartDrag={handleStartDrag}
            onStartResize={handleStartResize}
            onMove={onMove}
            onToggleSize={onToggleSize}
            onRemove={onRemove}
          >
            {renderWidget(item)}
          </WidgetShell>
        );
      })}
    </div>
  );
}
