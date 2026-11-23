import { useEffect } from 'react';
import {
  WIDGET_CATALOG,
  type WidgetGroup,
  type WidgetItem,
  type WidgetType,
} from './widgetTypes';

interface WidgetGalleryModalProps {
  open: boolean;
  items: WidgetItem[];
  onAdd: (type: WidgetType) => void;
  onRemoveByType: (type: WidgetType) => void;
  onClose: () => void;
}

const GROUP_LABELS: Record<WidgetGroup, string> = {
  cozy: 'สายสบายตา & บรรยากาศ',
  study: 'เตรียมสอบเบาๆ',
  core: 'ส่วนหลักของหน้าแรก',
};

const GROUP_ORDER: WidgetGroup[] = ['cozy', 'study', 'core'];

export function WidgetGalleryModal({
  open,
  items,
  onAdd,
  onRemoveByType,
  onClose,
}: WidgetGalleryModalProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="widget-gallery-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="เพิ่มหรือซ่อน Widget หน้าแรก"
      onClick={onClose}
    >
      <div
        className="glass-card widget-gallery-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="widget-gallery-head">
          <div>
            <h2 className="widget-gallery-title">คลัง Widget หน้าแรก</h2>
            <p className="widget-gallery-sub">
              เลือกเพิ่มหรือซ่อนหน้าต่างตามสไตล์ที่อยากเห็นวันนี้
            </p>
          </div>
          <button
            type="button"
            className="widget-pill-btn"
            onClick={onClose}
            aria-label="ปิดคลัง Widget"
          >
            ปิด
          </button>
        </div>

        <div className="widget-gallery-scroll">
          {GROUP_ORDER.map((group) => {
            const entries = WIDGET_CATALOG.filter((w) => w.group === group);
            return (
              <section key={group} className="widget-gallery-section">
                <h3 className="widget-gallery-group-title">{GROUP_LABELS[group]}</h3>
                <div className="widget-gallery-grid">
                  {entries.map((meta) => {
                    const activeCount = items.filter(
                      (i) => i.type === meta.type && i.visible,
                    ).length;
                    const isAddedSingleton = !meta.multiInstance && activeCount > 0;

                    return (
                      <div key={meta.type} className="widget-gallery-card">
                        <div className="widget-gallery-card-top">
                          <span className="widget-gallery-emoji" aria-hidden="true">
                            {meta.emoji}
                          </span>
                          <div className="widget-gallery-card-text">
                            <div className="widget-gallery-card-name">
                              {meta.title}
                              {meta.multiInstance && activeCount > 0 && (
                                <span className="widget-count-badge">
                                  เปิดอยู่ {activeCount} ใบ
                                </span>
                              )}
                            </div>
                            <p className="widget-gallery-card-desc">{meta.description}</p>
                          </div>
                        </div>

                        <div className="widget-gallery-card-actions">
                          {isAddedSingleton ? (
                            <button
                              type="button"
                              className="widget-gallery-btn widget-gallery-btn--active"
                              onClick={() => onRemoveByType(meta.type)}
                            >
                              ✓ เปิดอยู่ (แตะเพื่อซ่อน)
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="widget-gallery-btn widget-gallery-btn--add"
                              onClick={() => onAdd(meta.type)}
                            >
                              + {meta.multiInstance ? 'เพิ่มใบใหม่' : 'เพิ่มลงหน้าแรก'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
