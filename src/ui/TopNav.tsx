import type { AppRoute } from '../services/router';
import { LiquidGlassIcon } from './LiquidGlassIcon';
import './TopNav.css';

interface TopNavProps {
  siteTitle: string;
  route: AppRoute;
  focusMode: boolean;
  onNavigate: (next: AppRoute) => void;
  onToggleFocusMode: () => void;
}

export function TopNav({
  siteTitle,
  route,
  focusMode,
  onNavigate,
  onToggleFocusMode,
}: TopNavProps) {
  const isExams = route.name === 'exams' || route.name === 'exam-runner';

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <button
          type="button"
          className="top-nav-brand"
          onClick={() => onNavigate({ name: 'dashboard' })}
        >
          <LiquidGlassIcon name="meadow" tone="meadow" size="sm" shape="circle" />
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
    </header>
  );
}
