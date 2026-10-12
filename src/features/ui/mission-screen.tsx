'use client';

import { type Locale, pick, type SimMissionInfo } from '@taksu/content';
import { Badge } from '@taksu/ui/components/badge';
import { Button } from '@taksu/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@taksu/ui/components/dialog';
import { cn } from '@taksu/ui/lib/utils';
import { CheckCircle2, Circle, Play, RotateCcw, Square, Undo2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMessages, useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import type { WorkspaceApi } from '../blocks/blockly-workspace';
import type { CompileResult } from '../blocks/compile';
import type { Mission, Outcome } from '../engine/types';
import { ArenaCanvas } from './arena-canvas';
import { CodePanel } from './code-panel';
import { SensorPanel } from './sensor-panel';
import { useSimulation } from './use-simulation';

const BlocklyWorkspace = dynamic(() => import('../blocks/blockly-workspace'), {
  ssr: false,
  loading: () => <div aria-busy className="bg-surface-muted h-full w-full animate-pulse" />,
});

const SPEEDS = [1, 2, 4] as const;

export function MissionScreen({
  mission,
  info,
  locale,
  dark,
  hasNext,
  onNext,
}: {
  mission: Mission;
  info: SimMissionInfo;
  locale: Locale;
  dark: boolean;
  hasNext: boolean;
  onNext: () => void;
}) {
  const t = useTranslations('Sim');
  const blockMessages = useMessages().Blocks as Record<string, string>;
  const apiRef = useRef<WorkspaceApi | null>(null);
  const [program, setProgram] = useState<CompileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const sim = useSimulation(mission, {
    onFinish: (outcome) => {
      if (!mission.free) setResult(outcome);
    },
    onActiveBlock: (blockId) => apiRef.current?.highlight(blockId),
  });

  const run = useCallback(() => {
    const compiled = apiRef.current?.compile();
    if (!compiled?.ok) {
      setError(t('errors.noStart'));
      return;
    }
    setError(null);
    setResult(null);
    sim.start(compiled.program);
  }, [sim, t]);

  const status = sim.running
    ? t('status.running', { time: sim.panel.time.toFixed(1) })
    : sim.panel.programDone
      ? t('status.done')
      : mission.free
        ? t('status.free')
        : t('status.idle');
  const outcomeKey =
    result && result.status !== 'running'
      ? result.status === 'success'
        ? 'success'
        : result.reason
      : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="border-border h-[60vh] min-h-[26rem] overflow-hidden rounded-xl border xl:sticky xl:top-4 xl:h-[calc(100dvh-7rem)]">
        <BlocklyWorkspace
          robot={mission.robot}
          locale={locale}
          dark={dark}
          messages={blockMessages}
          storageKey={`taksu-sim:${mission.id}`}
          starter={mission.starter}
          apiRef={apiRef}
          onProgramChange={setProgram}
          label={t('workspaceLabel')}
        />
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <section className="border-border bg-surface rounded-xl border p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={mission.robot}>{t('module', { n: info.module })}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold [font-stretch:90%]">{pick(info.title, locale)}</h1>
          <p className="text-muted-foreground mt-1">{pick(info.brief, locale)}</p>
          {mission.goals.length > 0 ? (
            <>
              <h2 className="text-muted-foreground mt-4 text-sm font-semibold">{t('goals')}</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {mission.goals.map((goal) => {
                  const met = sim.panel.met.includes(goal.id);
                  return (
                    <li
                      key={goal.id}
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        met && 'text-primary font-semibold',
                      )}
                    >
                      {met ? (
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                      ) : (
                        <Circle className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      )}
                      {pick(goal.label, locale)}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">{t('hint')}</summary>
            <p className="text-muted-foreground mt-2">{pick(mission.hint, locale)}</p>
          </details>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {sim.running ? (
            <Button size="lg" variant="outline" onClick={sim.stop}>
              <Square aria-hidden />
              {t('stop')}
            </Button>
          ) : (
            <Button size="lg" onClick={run}>
              <Play aria-hidden />
              {t('run')}
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={sim.reset}>
            <RotateCcw aria-hidden />
            {t('reset')}
          </Button>
          <fieldset
            aria-label={t('speed')}
            className="border-border flex overflow-hidden rounded-md border"
          >
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={speed === value}
                onClick={() => {
                  setSpeed(value);
                  sim.setSpeed(value);
                }}
                className={cn(
                  'px-3 py-2 text-sm font-semibold',
                  speed === value ? 'bg-primary text-primary-foreground' : 'bg-surface',
                )}
              >
                {value}×
              </button>
            ))}
          </fieldset>
          <Button size="sm" variant="ghost" onClick={() => apiRef.current?.load(mission.starter)}>
            <Undo2 aria-hidden />
            {t('restore')}
          </Button>
          <p
            aria-live="polite"
            className="text-muted-foreground ml-auto text-sm font-semibold tabular-nums"
          >
            {status}
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-danger text-sm font-semibold">
            {error}
          </p>
        ) : null}

        <ArenaCanvas
          simulation={sim.simulation}
          drawRef={sim.draw}
          dark={dark}
          label={t('arenaLabel')}
        />
        <SensorPanel
          robot={mission.robot}
          panel={sim.panel}
          free={Boolean(mission.free)}
          onClap={sim.clap}
          onEnvironment={sim.setEnvironment}
        />
        <CodePanel result={program} robot={mission.robot} />
      </div>

      <Dialog open={outcomeKey !== null} onOpenChange={(open) => (open ? null : setResult(null))}>
        <DialogContent closeLabel={t('close')}>
          {outcomeKey ? (
            <>
              <DialogHeader>
                <DialogTitle>{t(`results.${outcomeKey}.title`)}</DialogTitle>
                <DialogDescription>{t(`results.${outcomeKey}.body`)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResult(null);
                    sim.reset();
                  }}
                >
                  {t('tryAgain')}
                </Button>
                {outcomeKey === 'success' && hasNext ? (
                  <Button onClick={onNext}>{t('nextMission')}</Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
