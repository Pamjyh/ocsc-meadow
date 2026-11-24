import { useCallback, useEffect, useRef, useState } from 'react';
import './ExamScratchpad.css';

export interface ScratchPoint {
  /** Normalized X coordinate [0, 1] relative to canvas width */
  x: number;
  /** Normalized Y coordinate [0, 1] relative to canvas height */
  y: number;
}

export interface ScratchStroke {
  tool: 'pen' | 'eraser';
  color: string;
  width: number;
  points: ScratchPoint[];
}

interface ExamScratchpadProps {
  questionOrder: number;
  strokes: ScratchStroke[];
  noteText: string;
  onChangeStrokes: (next: ScratchStroke[]) => void;
  onChangeNote: (next: string) => void;
  onClose: () => void;
}

const INK_COLORS = [
  { id: 'blue', label: 'น้ำเงิน', hex: '#2563eb' },
  { id: 'red', label: 'แดง', hex: '#dc2626' },
  { id: 'teal', label: 'เขียว', hex: '#0d9488' },
  { id: 'amber', label: 'ส้ม', hex: '#d97706' },
] as const;

export function ExamScratchpad({
  questionOrder,
  strokes,
  noteText,
  onChangeStrokes,
  onChangeNote,
  onClose,
}: ExamScratchpadProps) {
  const [padTab, setPadTab] = useState<'draw' | 'type'>('draw');
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState<string>(INK_COLORS[0].hex);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<ScratchStroke[]>(strokes);
  strokesRef.current = strokes;

  const activeStrokeRef = useRef<ScratchStroke | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const redraw = useCallback((list: ScratchStroke[], liveStroke?: ScratchStroke | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;

    const targetW = Math.floor(cssW * dpr);
    const targetH = Math.floor(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const allStrokes = liveStroke ? [...list, liveStroke] : list;
    for (const s of allStrokes) {
      if (s.points.length === 0) continue;
      ctx.save();
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = s.width;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
      }

      ctx.beginPath();
      const p0 = s.points[0]!;
      ctx.moveTo(p0.x * cssW, p0.y * cssH);
      if (s.points.length === 1) {
        ctx.lineTo(p0.x * cssW + 0.1, p0.y * cssH + 0.1);
      } else {
        for (let i = 1; i < s.points.length; i += 1) {
          const pt = s.points[i]!;
          ctx.lineTo(pt.x * cssW, pt.y * cssH);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    if (padTab !== 'draw') return;
    redraw(strokes);
    const onResize = () => redraw(strokesRef.current, activeStrokeRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [padTab, strokes, redraw]);

  const getNormalizedPoint = (e: React.PointerEvent<HTMLCanvasElement>): ScratchPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== null) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerIdRef.current = e.pointerId;
    const stroke: ScratchStroke = {
      tool,
      color,
      width: tool === 'eraser' ? 18 : 2.6,
      points: [pt],
    };
    activeStrokeRef.current = stroke;
    redraw(strokesRef.current, stroke);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId || !activeStrokeRef.current) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    activeStrokeRef.current.points.push(pt);
    redraw(strokesRef.current, activeStrokeRef.current);
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = null;
    if (finished && finished.points.length > 0) {
      onChangeStrokes([...strokesRef.current, finished]);
    }
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    onChangeStrokes(strokes.slice(0, -1));
  };

  const handleClear = () => {
    if (padTab === 'draw') {
      onChangeStrokes([]);
    } else {
      onChangeNote('');
    }
  };

  return (
    <section
      className="scratchpad-card"
      aria-label={`กระดานทดเลข ข้อที่ ${questionOrder}`}
    >
      <div className="scratchpad-head">
        <div className="scratchpad-title-row">
          <strong className="scratchpad-title">
            ✏️ กระดานทดเลข · ข้อ {questionOrder}
          </strong>
          <div className="scratchpad-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={padTab === 'draw'}
              className={`scratchpad-tab${padTab === 'draw' ? ' scratchpad-tab--active' : ''}`}
              onClick={() => setPadTab('draw')}
            >
              วาดเขียน
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={padTab === 'type'}
              className={`scratchpad-tab${padTab === 'type' ? ' scratchpad-tab--active' : ''}`}
              onClick={() => setPadTab('type')}
            >
              พิมพ์ทด
            </button>
          </div>
        </div>

        <div className="scratchpad-tools">
          {padTab === 'draw' && (
            <>
              <div className="scratchpad-colors" role="group" aria-label="เลือกสีปากกา">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`scratchpad-color-dot${
                      tool === 'pen' && color === c.hex ? ' scratchpad-color-dot--active' : ''
                    }`}
                    style={{ background: c.hex }}
                    aria-label={`ปากกาสี${c.label}`}
                    title={`ปากกาสี${c.label}`}
                    onClick={() => {
                      setTool('pen');
                      setColor(c.hex);
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                className={`scratchpad-tool-btn${
                  tool === 'eraser' ? ' scratchpad-tool-btn--active' : ''
                }`}
                onClick={() => setTool((t) => (t === 'eraser' ? 'pen' : 'eraser'))}
              >
                ยางลบ
              </button>
              <button
                type="button"
                className="scratchpad-tool-btn"
                disabled={strokes.length === 0}
                onClick={handleUndo}
              >
                ↩ ย้อนกลับ
              </button>
            </>
          )}
          <button
            type="button"
            className="scratchpad-tool-btn"
            onClick={handleClear}
          >
            ล้าง
          </button>
          <button
            type="button"
            className="scratchpad-tool-btn"
            onClick={onClose}
            aria-label="ซ่อนกระดานทดเลข"
          >
            ซ่อน
          </button>
        </div>
      </div>

      {padTab === 'draw' ? (
        <div className="scratchpad-canvas-wrap">
          <canvas
            ref={canvasRef}
            className={`scratchpad-canvas${
              tool === 'eraser' ? ' scratchpad-canvas--eraser' : ''
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
          />
          {strokes.length === 0 && (
            <span className="scratchpad-placeholder" aria-hidden="true">
              วาดทดอนุกรม เงื่อนไขสัญลักษณ์ หรือสมการด้วยเมาส์ / ปากกา / นิ้วได้เลย (จำแยกแต่ละข้อ)
            </span>
          )}
        </div>
      ) : (
        <textarea
          className="scratchpad-textarea"
          value={noteText}
          onChange={(e) => onChangeNote(e.target.value)}
          placeholder="พิมพ์ทดเลขหรือเชื่อมเงื่อนไข เช่น A > B >= C ..."
        />
      )}
    </section>
  );
}
