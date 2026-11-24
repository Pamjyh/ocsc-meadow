import { useEffect, useMemo, useRef, useState } from 'react';
import { filterCommandItems, type CommandGroup, type CommandItem } from './commandPaletteItems';
import './CommandPalette.css';

interface CommandPaletteProps {
  open: boolean;
  items: readonly CommandItem[];
  onClose: () => void;
}

const GROUP_ORDER: readonly CommandGroup[] = [
  'นำทาง',
  'ควบคุมเร็ว',
  'คลังเนื้อหา',
  'ชุดข้อสอบ',
];

export function CommandPalette({ open, items, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const { sections, flatOrdered } = useMemo(() => {
    const filtered = filterCommandItems(items, query);
    const ordered: CommandItem[] = [];
    const grouped: { group: CommandGroup; rows: { item: CommandItem; flatIdx: number }[] }[] = [];

    for (const group of GROUP_ORDER) {
      const matches = filtered.filter((item) => item.group === group);
      if (matches.length === 0) continue;
      const rows = matches.map((item) => {
        const flatIdx = ordered.length;
        ordered.push(item);
        return { item, flatIdx };
      });
      grouped.push({ group, rows });
    }
    return { sections: grouped, flatOrdered: ordered };
  }, [items, query]);

  // Reset search & focus input immediately (zero animation lag) on open
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  // Keep activeIndex in bounds when filter results shrink
  useEffect(() => {
    if (activeIndex >= flatOrdered.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, flatOrdered.length]);

  // Keep active row scrolled into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex}"]`,
    );
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  if (!open) return null;

  const executeItem = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatOrdered.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatOrdered.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatOrdered.length > 0) {
        setActiveIndex((prev) => (prev - 1 + flatOrdered.length) % flatOrdered.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(flatOrdered[activeIndex]);
    }
  };

  return (
    <div
      className="cmdk-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="ค้นหาและคำสั่งด่วน"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="cmdk-modal">
        <div className="cmdk-input-row">
          <span className="cmdk-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            className="cmdk-input"
            placeholder="พิมพ์ค้นหาบทเรียน ชุดข้อสอบ หรือคำสั่ง... (เช่น กฎหมาย, Zen, Lo-fi)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            aria-label="ค้นหาคำสั่งหรือบทเรียน"
          />
          <button
            type="button"
            className="cmdk-esc-btn"
            onClick={onClose}
            aria-label="ปิดหน้าต่างคำสั่ง"
          >
            Esc
          </button>
        </div>

        <div className="cmdk-list" ref={listRef} role="listbox">
          {sections.length === 0 ? (
            <div className="cmdk-empty">ไม่พบคำสั่งหรือบทเรียนที่ตรงกับ &ldquo;{query}&rdquo;</div>
          ) : (
            sections.map((section) => (
              <div key={section.group} className="cmdk-group">
                <div className="cmdk-group-title">{section.group}</div>
                {section.rows.map(({ item, flatIdx }) => {
                  const isActive = flatIdx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      data-cmd-index={flatIdx}
                      className={`cmdk-row${isActive ? ' cmdk-row--active' : ''}`}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={() => executeItem(flatOrdered[flatIdx])}
                    >
                      <span className="cmdk-row-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="cmdk-row-copy">
                        <span className="cmdk-row-title">{item.title}</span>
                        {item.subtitle && (
                          <span className="cmdk-row-sub">{item.subtitle}</span>
                        )}
                      </span>
                      {item.shortcut && (
                        <kbd className="cmdk-kbd">{item.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-footer">
          <span>↑↓ เลือก · Enter เปิด</span>
          <span>⌘K / Ctrl+K เปิด-ปิดได้ทุกหน้า</span>
        </div>
      </div>
    </div>
  );
}
