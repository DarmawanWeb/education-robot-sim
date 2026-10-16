import { cn } from '@taksu/ui/lib/utils';

/**
 * The simulator dresses like the store: white panels with a hairline border on the chalk
 * background, and one red action, Run, that drives the robot.
 */

/** A panel on the bench: workspace, mission card, arena, readouts. */
export const panelClass = 'border-border bg-surface rounded-lg border';

const actionBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-4 text-base font-bold transition-colors [&_svg]:size-5 [&_svg]:shrink-0';

export function actionClass(variant: 'signal' | 'plain' | 'quiet', className?: string) {
  return cn(
    actionBase,
    variant === 'signal' &&
      'bg-primary text-primary-foreground hover:bg-primary-strong border-transparent',
    variant === 'plain' && 'border-border bg-surface text-foreground hover:bg-surface-muted',
    variant === 'quiet' && 'text-foreground hover:bg-surface-muted border-transparent',
    className,
  );
}

/** A row of switches (robot, language, speed) in one frame. */
export const segmentGroupClass = 'border-border bg-surface flex shrink-0 rounded-md border p-0.5';

export function segmentClass(pressed: boolean, pressedFill = 'bg-ink text-ink-foreground') {
  return cn(
    'h-8 min-w-9 rounded-sm px-2.5 text-sm font-bold whitespace-nowrap transition-colors',
    pressed ? pressedFill : 'hover:bg-surface-muted',
  );
}
