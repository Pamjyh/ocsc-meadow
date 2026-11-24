import { useEffect, useRef, useState } from 'react';
import {
  getSceneOption,
  SCENE_CATALOG,
  type SceneId,
} from '../features/meadow/sceneCatalog';
import type { AppRoute } from '../services/router';
import { LiquidGlassIcon } from './LiquidGlassIcon';
import './TopNav.css';

interface TopNavProps {
  siteTitle: string;
  route: AppRoute;
  focusMode: boolean;
  sceneId: SceneId;
  sfxEnabled: boolean;
  onNavigate: (next: AppRoute) => void;
  onToggleFocusMode: () => void;
  onSelectScene: (sceneId: SceneId) => void;
  onEnterZen: () => void;
  onToggleSfx: () => void;
  onOpenCommandPalette: () => void;
}

export function TopNav({
  siteTitle,
  route,
  focusMode,
  sceneId,
  sfxEnabled,
  onNavigate,
  onToggleFocusMode,
  onSelectScene,
  onEnterZen,
  onToggleSfx,
  onOpenCommandPalette,
}: TopNavProps) {
  const isExams = route.name === 'exams' || route.name === 'exam-runner';
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);
  const activeScene = getSceneOption(sceneId);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        pickerWrapRef.current &&
        !pickerWrapRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <button
          type="button"
          className="top-nav-brand"
          onClick={() => onNavigate({ name: 'dashboard' })}
        >
          <span className="top-nav-avatar-wrap">
            <img
              src="./app-icon.jpg"
              alt={siteTitle}
              className="top-nav-avatar"
              width={32}
              height={32}
            />
          </span>
          <span>{siteTitle}</span>
        </button>

        <nav className="top-nav-links" aria-label="เมนูหลัก">
          <button
            type="button"
            className={`top-nav-link${route.name === 'dashboard' ? ' top-nav-link--active' : ''}`}
            onClick={() => onNavigate({ name: 'dashboard' })}
          >
            <LiquidGlassIcon name="home" tone="sky" size="sm" shape="circle" />
            <span>หน้าแรก</span>
          </button>
          <button
            type="button"
            className={`top-nav-link${route.name === 'study' ? ' top-nav-link--active' : ''}`}
            onClick={() => onNavigate({ name: 'study', docId: null })}
          >
            <LiquidGlassIcon name="book" tone="meadow" size="sm" shape="circle" />
            <span>คลังเนื้อหา</span>
          </button>
          <button
            type="button"
            className={`top-nav-link${isExams ? ' top-nav-link--active' : ''}`}
            onClick={() => onNavigate({ name: 'exams', tab: 'interactive' })}
          >
            <LiquidGlassIcon name="exam" tone="amber" size="sm" shape="circle" />
            <span>คลังข้อสอบ</span>
          </button>
        </nav>

        <div className="top-nav-actions">
          <button
            type="button"
            className="top-nav-cmdk-btn"
            onClick={onOpenCommandPalette}
            aria-label="เปิดหน้าต่างค้นหาและคำสั่งด่วน (⌘K)"
            title="ค้นหาบทเรียนและคำสั่งด่วน (⌘K / Ctrl+K)"
          >
            <span aria-hidden="true">🔍</span>
            <kbd className="cmdk-nav-kbd">⌘K</kbd>
          </button>

          <div className="scene-picker-wrap" ref={pickerWrapRef}>
            <button
              type="button"
              className={`top-nav-scene-btn${pickerOpen ? ' top-nav-scene-btn--open' : ''}`}
              onClick={() => setPickerOpen((prev) => !prev)}
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
              aria-label="เปลี่ยนภาพพื้นหลัง"
              title="เปลี่ยนภาพพื้นหลัง"
            >
              <span className="scene-btn-thumb-wrap" aria-hidden="true">
                <img
                  src={activeScene.previewUrl}
                  alt=""
                  className="scene-btn-thumb"
                />
              </span>
              <span className="scene-btn-label">พื้นหลัง</span>
            </button>

            {pickerOpen && (
              <div
                className="scene-picker-popover"
                role="dialog"
                aria-label="เลือกภาพพื้นหลัง"
              >
                <div className="scene-picker-grid">
                  {SCENE_CATALOG.map((scene) => {
                    const isSelected = scene.id === sceneId;
                    return (
                      <button
                        key={scene.id}
                        type="button"
                        className={`scene-picker-item${
                          isSelected ? ' scene-picker-item--active' : ''
                        }`}
                        aria-label={scene.ariaLabel}
                        aria-pressed={isSelected}
                        onClick={() => {
                          onSelectScene(scene.id);
                          setPickerOpen(false);
                        }}
                      >
                        <span className="scene-item-preview">
                          <img
                            src={scene.previewUrl}
                            alt=""
                            className="scene-item-img"
                            loading="lazy"
                          />
                          {isSelected && (
                            <span className="scene-item-check" aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`top-nav-sfx-btn${sfxEnabled ? '' : ' top-nav-sfx-btn--muted'}`}
            onClick={onToggleSfx}
            aria-pressed={sfxEnabled}
            aria-label={sfxEnabled ? 'ปิดเสียงเอฟเฟกต์ปุ่มกด' : 'เปิดเสียงเอฟเฟกต์ปุ่มกด'}
            title={sfxEnabled ? 'เสียงเอฟเฟกต์ปุ่มกด: เปิด' : 'เสียงเอฟเฟกต์ปุ่มกด: ปิด'}
          >
            <span aria-hidden="true">{sfxEnabled ? '🔊' : '🔇'}</span>
          </button>

          <button
            type="button"
            className="top-nav-zen-btn"
            onClick={onEnterZen}
            aria-label="เข้าสู่โหมด Zen เต็มจอ"
            title="โหมด Zen เต็มจอ (ซ่อนหน้าต่างเพื่อโฟกัส)"
          >
            <span className="zen-btn-icon" aria-hidden="true">⛶</span>
            <span className="zen-btn-label">Zen</span>
          </button>

          <button
            type="button"
            className={`top-nav-focus-btn${focusMode ? ' top-nav-focus-btn--on' : ''}`}
            onClick={onToggleFocusMode}
            aria-pressed={focusMode}
            title="หยุดภาพเคลื่อนไหวเพื่อลดการรบกวนสายตา"
          >
            <LiquidGlassIcon
              name="focus"
              tone={focusMode ? 'meadow' : 'neutral'}
              size="sm"
              shape="circle"
            />
            <span>{focusMode ? 'โหมดนิ่ง: เปิด' : 'โหมดนิ่ง'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
