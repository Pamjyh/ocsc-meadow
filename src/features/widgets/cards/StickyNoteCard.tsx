import { useEffect, useRef, useState } from 'react';
import type { StickyColor } from '../widgetTypes';

interface StickyNoteCardProps {
  config: Record<string, unknown>;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

const STICKY_COLORS: readonly { key: StickyColor; label: string }[] = [
  { key: 'yellow', label: 'เหลืองพาสเทล' },
  { key: 'peach', label: 'พีชพาสเทล' },
  { key: 'mint', label: 'มินต์พาสเทล' },
  { key: 'lavender', label: 'ลาเวนเดอร์' },
] as const;

function parseColor(raw: unknown): StickyColor {
  if (raw === 'peach' || raw === 'mint' || raw === 'lavender') return raw;
  return 'yellow';
}

export function StickyNoteCard({ config, onUpdateConfig }: StickyNoteCardProps) {
  const initialTitle = typeof config.title === 'string' ? config.title : 'โพสอิท';
  const initialText = typeof config.text === 'string' ? config.text : '';
  const color = parseColor(config.color);

  const [title, setTitle] = useState(initialTitle);
  const [text, setText] = useState(initialText);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ title: initialTitle, text: initialText });
  const draftRef = useRef({ title, text });
  const onUpdateRef = useRef(onUpdateConfig);

  draftRef.current = { title, text };
  onUpdateRef.current = onUpdateConfig;

  // F31: Only sync external prop changes (e.g. Reset Defaults), never overwrite active typing
  useEffect(() => {
    if (initialTitle !== lastSavedRef.current.title) {
      lastSavedRef.current.title = initialTitle;
      setTitle(initialTitle);
    }
  }, [initialTitle]);

  useEffect(() => {
    if (initialText !== lastSavedRef.current.text) {
      lastSavedRef.current.text = initialText;
      setText(initialText);
    }
  }, [initialText]);

  // F31: Flush any pending debounced edit on unmount so last keystrokes are never dropped
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const { title: pendingTitle, text: pendingText } = draftRef.current;
        if (
          pendingTitle !== lastSavedRef.current.title ||
          pendingText !== lastSavedRef.current.text
        ) {
          lastSavedRef.current = { title: pendingTitle, text: pendingText };
          onUpdateRef.current({ title: pendingTitle, text: pendingText });
        }
      }
    };
  }, []);

  const commitSave = (nextTitle: string, nextText: string) => {
    if (
      nextTitle === lastSavedRef.current.title &&
      nextText === lastSavedRef.current.text
    ) {
      return;
    }
    lastSavedRef.current = { title: nextTitle, text: nextText };
    onUpdateConfig({ title: nextTitle, text: nextText });
  };

  const scheduleSave = (nextTitle: string, nextText: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commitSave(nextTitle, nextText);
    }, 300);
  };

  const flushSave = (nextTitle: string, nextText: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    commitSave(nextTitle, nextText);
  };

  return (
    <div className={`glass-card widget-card sticky-note sticky-note--${color}`}>
      <div className="sticky-head">
        <input
          type="text"
          className="sticky-title-input"
          value={title}
          onChange={(e) => {
            const v = e.target.value;
            setTitle(v);
            scheduleSave(v, text);
          }}
          onBlur={() => flushSave(title, text)}
          placeholder="หัวข้อโพสอิท..."
          maxLength={60}
          aria-label="หัวข้อโพสอิท"
        />
        <div className="sticky-palette" role="radiogroup" aria-label="เลือกสีโพสอิท">
          {STICKY_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={color === c.key}
              aria-label={c.label}
              title={c.label}
              className={`sticky-dot sticky-dot--${c.key}${
                color === c.key ? ' sticky-dot--active' : ''
              }`}
              onClick={() => onUpdateConfig({ color: c.key })}
            />
          ))}
        </div>
      </div>

      <textarea
        className="sticky-body-input"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          scheduleSave(title, v);
        }}
        onBlur={() => flushSave(title, text)}
        placeholder="จดคำให้กำลังใจ สูตรคณิต หรือข้อความเตือนตัวเอง..."
        rows={5}
        aria-label="ข้อความในโพสอิท"
      />
    </div>
  );
}
