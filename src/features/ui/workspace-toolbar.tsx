'use client';

import { cn } from '@dctedu/ui/lib/utils';
import { Maximize2, Minus, Plus, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { History } from '../blocks/blockly-workspace';

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-foreground hover:bg-surface-muted grid size-9 place-items-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-[1.1rem]"
    >
      {children}
    </button>
  );
}

/** One frame of related tools. A column on phones, where the categories take the left; a row from sm up. */
const group =
  'border-border bg-surface/95 flex flex-col items-center gap-0.5 rounded-lg border p-0.5 shadow-[0_8px_24px_-12px_rgb(31_34_40/0.35)] backdrop-blur sm:flex-row';

/**
 * The workspace's own controls, floating over its bottom-right corner: undo and redo, zoom, show
 * every block, and back to the starter blocks. They replace Blockly's grey zoom buttons and bin;
 * blocks are deleted by dragging them back onto the categories, or with the Delete key.
 */
export function WorkspaceToolbar({
  history,
  onUndo,
  onRedo,
  onZoom,
  onFit,
  onRestore,
  className,
}: {
  history: History;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (steps: number) => void;
  onFit: () => void;
  onRestore: () => void;
  className?: string;
}) {
  const t = useTranslations('Sim.tools');
  return (
    <div
      className={cn('z-[80] flex flex-col items-end gap-2 sm:flex-row sm:items-center', className)}
    >
      <div role="toolbar" aria-label={t('history')} className={group}>
        <ToolButton label={t('undo')} onClick={onUndo} disabled={!history.undo}>
          <Undo2 aria-hidden />
        </ToolButton>
        <ToolButton label={t('redo')} onClick={onRedo} disabled={!history.redo}>
          <Redo2 aria-hidden />
        </ToolButton>
      </div>
      <div role="toolbar" aria-label={t('view')} className={group}>
        <ToolButton label={t('zoomIn')} onClick={() => onZoom(1)}>
          <Plus aria-hidden />
        </ToolButton>
        <ToolButton label={t('zoomOut')} onClick={() => onZoom(-1)}>
          <Minus aria-hidden />
        </ToolButton>
        <ToolButton label={t('fit')} onClick={onFit}>
          <Maximize2 aria-hidden />
        </ToolButton>
      </div>
      <div className={group}>
        <button
          type="button"
          title={t('restore')}
          onClick={onRestore}
          className="text-foreground hover:bg-surface-muted inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md text-sm font-bold transition-colors sm:px-2.5 [&_svg]:size-4"
        >
          <RotateCcw aria-hidden />
          <span className="max-sm:sr-only">{t('restore')}</span>
        </button>
      </div>
    </div>
  );
}
