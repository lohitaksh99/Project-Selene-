'use client';

import React, { useCallback, useRef } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

interface ResizableInspectorProps {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  widthPx: number;
  onChangeWidthPx: (widthPx: number) => void;
  minWidthPx?: number;
  maxWidthPx?: number;
  defaultWidthPx?: number;
  children: React.ReactNode;
}

export default function ResizableInspector({
  title,
  collapsed,
  onToggleCollapsed,
  widthPx,
  onChangeWidthPx,
  minWidthPx = 280,
  maxWidthPx = 460,
  defaultWidthPx = 340,
  children,
}: ResizableInspectorProps) {
  const dragStartRef = useRef<{ clientX: number; startWidth: number } | null>(null);

  const clampWidth = useCallback(
    (w: number) => Math.max(minWidthPx, Math.min(maxWidthPx, Math.round(w))),
    [minWidthPx, maxWidthPx]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    e.preventDefault();
    dragStartRef.current = { clientX: e.clientX, startWidth: widthPx };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const delta = dragStartRef.current.clientX - moveEvent.clientX;
      onChangeWidthPx(clampWidth(dragStartRef.current.startWidth + delta));
    };

    const handleUp = () => {
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChangeWidthPx(clampWidth(widthPx + 16));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChangeWidthPx(clampWidth(widthPx - 16));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChangeWidthPx(defaultWidthPx);
    }
  };

  if (collapsed) {
    return (
      <div className="shrink-0 flex lg:flex-col items-center justify-between lg:justify-start gap-2 bg-[var(--selene-surface)] border border-[var(--selene-border)] p-2 lg:w-11">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={`Expand ${title}`}
          aria-label={`Expand ${title}`}
          className="p-1.5 bg-[var(--selene-surface-alt)] border border-[var(--selene-border)] text-[var(--selene-accent-earth)] hover:border-[var(--selene-accent-earth)]"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <span className="lg:hidden text-xs font-mono text-[var(--selene-text-secondary)]">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 min-w-0 w-full lg:w-auto">
      {/* Desktop Pointer & Keyboard Resize Handle */}
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label={`Resize ${title}`}
        aria-valuemin={minWidthPx}
        aria-valuemax={maxWidthPx}
        aria-valuenow={widthPx}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => onChangeWidthPx(defaultWidthPx)}
        onKeyDown={handleKeyDown}
        title="Drag to resize inspector (Arrow Left/Right, double-click to reset)"
        className="hidden lg:flex w-2 cursor-col-resize items-center justify-center group hover:bg-[var(--selene-accent-earth)]/20 focus:outline-none focus:bg-[var(--selene-accent-earth)]/30 transition-colors"
      >
        <div className="w-px h-10 bg-[var(--selene-border-strong)] opacity-40 group-hover:opacity-100" />
      </div>

      {/* Inspector Panel Container */}
      <aside
        aria-label={title}
        style={{ '--inspector-width': `${widthPx}px` } as React.CSSProperties}
        className="w-full lg:w-[var(--inspector-width)] shrink-0 bg-[var(--selene-surface)] border border-[var(--selene-border)] flex flex-col min-w-0"
      >
        <div className="px-4 py-3 border-b border-[var(--selene-border)] bg-[var(--selene-surface-alt)] flex items-center justify-between gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--selene-text)] truncate">
            {title}
          </span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={`Collapse ${title}`}
            aria-label={`Collapse ${title}`}
            className="p-1.5 bg-[var(--selene-surface)] border border-[var(--selene-border)] text-[var(--selene-text-secondary)] hover:text-[var(--selene-text)] hover:border-[var(--selene-accent-earth)] shrink-0"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 space-y-5 overflow-y-auto flex-1">{children}</div>
      </aside>
    </div>
  );
}
