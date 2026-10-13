'use client';

import { type Locale, missionPlace, pick, type SimMissionInfo } from '@taksu/content';
import { Badge } from '@taksu/ui/components/badge';
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
import { syllabusUrl } from '@/lib/links';
import type { WorkspaceApi } from '../blocks/blockly-workspace';
import type { CompileResult } from '../blocks/compile';
import type { Mission, Outcome } from '../engine/types';
import { ArenaCanvas } from './arena-canvas';
import { CodePanel } from './code-panel';
import { DashboardPanel } from './dashboard-panel';
import { markFinished } from './progress';
import { SensorPanel } from './sensor-panel';
import { actionClass, panelClass, segmentClass, segmentGroupClass } from './styles';
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
      if (mission.free) return;
      if (outcome.status === 'success') markFinished(mission.id);
      setResult(outcome);
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
  const place = missionPlace(info);
  const meetingList = place
    ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(place.meetings.map(String))
    : '';
  const outcomeKey =
    result && result.status !== 'running'
      ? result.status === 'success'
        ? 'success'
        : result.reason
      : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="border-edge h-[60vh] min-h-[26rem] overflow-hidden rounded-lg border-2 xl:sticky xl:top-[5.5rem] xl:h-[calc(100dvh-7.5rem)]">
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
        <section className={cn(panelClass, 'p-5')}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge variant={mission.robot}>{t('module', { n: place?.module ?? 0 })}</Badge>
            {place ? (
              <span className="text-muted-foreground text-sm font-semibold">
                {t('meetings', { count: place.meetings.length, list: meetingList })}
              </span>
            ) : null}
          </div>
          <h1 className="type-label mt-3 text-[1.75rem]">{pick(info.title, locale)}</h1>
          <p className="text-muted-foreground mt-2">{pick(info.brief, locale)}</p>
          {mission.goals.length > 0 ? (
            <>
              <h2 className="mt-5 text-sm font-bold">{t('goals')}</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {mission.goals.map((goal) => {
                  const met = sim.panel.met.includes(goal.id);
                  return (
                    <li
                      key={goal.id}
                      className={cn('flex items-center gap-2 text-sm', met && 'font-bold')}
                    >
                      {met ? (
                        <CheckCircle2
                          className="dark:text-level-smp size-4 shrink-0 text-[#0e6b57]"
                          aria-hidden
                        />
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
            <summary className="cursor-pointer font-bold">{t('hint')}</summary>
            <p className="text-muted-foreground mt-2">{pick(mission.hint, locale)}</p>
          </details>
          {place ? (
            <a
              href={syllabusUrl(locale, mission.robot, place.moduleId)}
              target="_blank"
              rel="noopener"
              className="decoration-primary mt-3 inline-block text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              {t('inSyllabus')}
              <span className="sr-only"> {t('newTab')}</span>
            </a>
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {sim.running ? (
            <button type="button" className={actionClass('plain', 'min-w-36')} onClick={sim.stop}>
              <Square aria-hidden />
              {t('stop')}
            </button>
          ) : (
            <button type="button" className={actionClass('signal', 'min-w-36')} onClick={run}>
              <Play aria-hidden />
              {t('run')}
            </button>
          )}
          <button type="button" className={actionClass('quiet')} onClick={sim.reset}>
            <RotateCcw aria-hidden />
            {t('reset')}
          </button>
          <fieldset aria-label={t('speed')} className={segmentGroupClass}>
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={speed === value}
                onClick={() => {
                  setSpeed(value);
                  sim.setSpeed(value);
                }}
                className={segmentClass(speed === value)}
              >
                {value}×
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            className={actionClass('quiet', 'min-h-9 px-3 text-sm [&_svg]:size-4')}
            onClick={() => apiRef.current?.load(mission.starter)}
          >
            <Undo2 aria-hidden />
            {t('restore')}
          </button>
          <p
            aria-live="polite"
            className="text-muted-foreground ml-auto text-sm font-bold tabular-nums"
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
          followLabel={t('follow')}
        />
        <SensorPanel
          robot={mission.robot}
          panel={sim.panel}
          free={Boolean(mission.free)}
          onClap={sim.clap}
          onEnvironment={sim.setEnvironment}
        />
        {mission.wifi || sim.panel.telemetry.length > 0 || sim.panel.dropped > 0 ? (
          <DashboardPanel
            telemetry={sim.panel.telemetry}
            online={sim.panel.online}
            dropped={sim.panel.dropped}
            time={sim.panel.time}
          />
        ) : null}
        <CodePanel result={program} robot={mission.robot} />
      </div>

      <Dialog open={outcomeKey !== null} onOpenChange={(open) => (open ? null : setResult(null))}>
        <DialogContent closeLabel={t('close')} className="border-edge rounded-lg border-2">
          {outcomeKey ? (
            <>
              <DialogHeader>
                <DialogTitle>{t(`results.${outcomeKey}.title`)}</DialogTitle>
                <DialogDescription>{t(`results.${outcomeKey}.body`)}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <button
                  type="button"
                  className={actionClass('plain')}
                  onClick={() => {
                    setResult(null);
                    sim.reset();
                  }}
                >
                  {t('tryAgain')}
                </button>
                {outcomeKey === 'success' && hasNext ? (
                  <button type="button" className={actionClass('signal')} onClick={onNext}>
                    {t('nextMission')}
                  </button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
