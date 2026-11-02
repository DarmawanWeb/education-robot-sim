'use client';

import {
  getRobot,
  type Locale,
  missionStep,
  pick,
  type SimMissionInfo,
  type SimRobot,
} from '@dctedu/catalog';
import { Popover, PopoverContent, PopoverTrigger } from '@dctedu/ui/components/popover';
import { cn } from '@dctedu/ui/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useState } from 'react';

/** The robot's colour on the current mission's marker, like on its switch. */
const CURRENT: Record<SimRobot, string> = {
  ciko: 'bg-robot-ciko text-white border-robot-ciko',
  momo: 'bg-robot-momo text-black border-robot-momo',
};

/**
 * Which mission is open, and every other one on this robot's path: its step number, its title,
 * and a check once it has been finished in this browser.
 */
export function MissionPicker({
  robot,
  list,
  current,
  finished,
  locale,
  onPick,
}: {
  robot: SimRobot;
  list: readonly SimMissionInfo[];
  current: SimMissionInfo;
  finished: ReadonlySet<string>;
  locale: Locale;
  onPick: (id: string) => void;
}) {
  const t = useTranslations('Sim');
  const [open, setOpen] = useState(false);
  const done = list.filter((entry) => finished.has(entry.id)).length;
  const stepOf = (entry: SimMissionInfo) =>
    missionStep(entry.id)?.number ?? list.indexOf(entry) + 1;

  // Up and down move between missions, like in a list box.
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
    items[next]?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('pickMission')}
          className="border-border bg-surface hover:bg-surface-muted data-[state=open]:border-foreground flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md border pr-2.5 pl-1.5 text-left transition-colors sm:max-w-[22rem]"
        >
          <span
            className={cn(
              'type-number grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs',
              CURRENT[robot],
            )}
          >
            {stepOf(current)}
          </span>
          <span className="min-w-0 flex-1 truncate font-bold">{pick(current.title, locale)}</span>
          <span className="text-muted-foreground shrink-0 text-xs font-bold tabular-nums">
            {done}/{list.length}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="border-border border-b px-4 pt-3.5 pb-3">
          <p className="text-sm font-bold">
            {t('missionsOf', { robot: getRobot(robot)?.name ?? '' })}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="bg-surface-muted h-1.5 flex-1 overflow-hidden rounded-full"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={list.length}
              aria-valuenow={done}
              aria-label={t('progress', { done, total: list.length })}
            >
              <div
                className="bg-success h-full rounded-full transition-[width]"
                style={{ width: `${(done / Math.max(1, list.length)) * 100}%` }}
              />
            </div>
            <span className="text-muted-foreground text-xs font-bold whitespace-nowrap tabular-nums">
              {t('progress', { done, total: list.length })}
            </span>
          </div>
        </div>
        <ul className="max-h-[min(28rem,65vh)] overflow-y-auto p-1.5" onKeyDown={onKeyDown}>
          {list.map((entry) => {
            const active = entry.id === current.id;
            const isDone = finished.has(entry.id);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => {
                    setOpen(false);
                    if (!active) onPick(entry.id);
                  }}
                  className={cn(
                    'focus-visible:bg-surface-muted flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none',
                    active ? 'bg-surface-muted' : 'hover:bg-surface-muted',
                  )}
                >
                  <span
                    className={cn(
                      'type-number grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs',
                      active
                        ? CURRENT[robot]
                        : isDone
                          ? 'border-success bg-success text-white'
                          : 'border-border text-muted-foreground',
                    )}
                  >
                    {isDone && !active ? (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    ) : (
                      stepOf(entry)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', active ? 'font-bold' : 'font-semibold')}>
                      {pick(entry.title, locale)}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {pick(entry.brief, locale)}
                    </span>
                  </span>
                  {isDone ? <span className="sr-only">{t('finished')}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
