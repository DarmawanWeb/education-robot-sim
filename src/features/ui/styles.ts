import { cn } from '@taksu/ui/lib/utils';

/**
 * The simulator dresses like the education site: inked 2px outlines, bold labels, and the
 * orange action that presses in. Offset shadows stay on the one action that runs the robot.
 */

/** A panel on the bench: workspace, mission card, arena, readouts. */
export const panelClass = 'border-edge bg-surface rounded-lg border-2';

const actionBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 px-4 text-base font-bold transition-[transform,box-shadow,background-color] [&_svg]:size-5 [&_svg]:shrink-0';

export function actionClass(variant: 'signal' | 'plain' | 'quiet', className?: string) {
  return cn(
    actionBase,
    variant === 'signal' &&
      'border-edge bg-primary text-primary-foreground shadow-[3px_3px_0_0_var(--edge)] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_var(--edge)]',
    variant === 'plain' && 'border-edge bg-surface text-foreground hover:bg-surface-muted',
    variant === 'quiet' && 'text-foreground hover:bg-surface-muted border-transparent',
    className,
  );
}

/** A row of switches (robot, language, speed) in one inked frame, like the site's header. */
export const segmentGroupClass = 'border-edge flex shrink-0 rounded-md border-2 p-0.5';

export function segmentClass(pressed: boolean, pressedFill = 'bg-ink text-ink-foreground') {
  return cn(
    'h-8 min-w-9 rounded-sm px-2.5 text-sm font-bold whitespace-nowrap transition-colors',
    pressed ? pressedFill : 'hover:bg-surface-muted',
  );
}
