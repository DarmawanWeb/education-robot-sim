'use client';

import { cn } from '@dctedu/ui/lib/utils';
import { Maximize2, Minus, Plus, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode, Ref } from 'react';
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
 * every block, back to the starter blocks, and the bin. Drop a block on the bin to throw it away,
 * or select a block and press it.
 */
export function WorkspaceToolbar({
  history,
  canDelete,
  binRef,
  onUndo,
  onRedo,
  onZoom,
  onFit,
  onRestore,
  onDelete,
  className,
}: {
  history: History;
  canDelete: boolean;
  binRef: Ref<HTMLButtonElement>;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (steps: number) => void;
  onFit: () => void;
  onRestore: () => void;
  onDelete: () => void;
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
      {/* While a block is dragged over it, the bin turns red to say "drop to delete". */}
      <button
        ref={binRef}
        type="button"
        title={t('binHint')}
        aria-label={t('bin')}
        onClick={onDelete}
        aria-disabled={!canDelete}
        className={cn(
          group,
          'group/bin size-11 justify-center p-0 transition-[background-color,color,border-color,transform] duration-150',
          'text-foreground hover:bg-surface-muted aria-disabled:text-muted-foreground',
          'data-[over]:scale-110 data-[over]:border-[#c2181f] data-[over]:bg-[#c2181f] data-[over]:text-white',
        )}
      >
        <Trash2
          aria-hidden
          className="size-5 transition-transform group-data-[over]/bin:-rotate-12"
        />
      </button>
    </div>
  );
}
