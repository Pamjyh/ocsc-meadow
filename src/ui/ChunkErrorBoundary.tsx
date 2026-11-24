import { Component, type ReactNode } from 'react';

interface ChunkErrorBoundaryProps {
  children: ReactNode;
  silent?: boolean;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches dynamic import / lazy chunk failures (e.g. offline or stale deployment hash)
 * so the app never crashes to a blank screen (F101).
 */
export class ChunkErrorBoundary extends Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.silent) return null;
      return (
        <div
          className="glass-card"
          style={{
            padding: '28px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <p style={{ fontWeight: 700, margin: 0 }}>
            ไม่สามารถโหลดหน้านี้ได้ (อาจออฟไลน์หรือมีเวอร์ชันใหม่)
          </p>
          <button
            type="button"
            className="dash-btn-primary"
            onClick={() => window.location.reload()}
          >
            รีเฟรชเพื่อโหลดใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
