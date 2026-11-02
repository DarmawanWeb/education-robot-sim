'use client';

import { getRobot, type Locale, missionStep, pick, type SimMissionInfo } from '@dctedu/catalog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@dctedu/ui/components/dialog';
import { cn } from '@dctedu/ui/lib/utils';
import { CheckCircle2, Circle, Play, RotateCcw, ScanSearch, Square } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useMessages, useTranslations } from 'next-intl';
import { useCallback, useRef, useState } from 'react';
import { learnStepUrl } from '@/lib/links';
import type { History, WorkspaceApi } from '../blocks/blockly-workspace';
import type { CompileResult } from '../blocks/compile';
import type { Mission, Outcome } from '../engine/types';
import { ArenaCanvas } from './arena-canvas';
import { CodePanel } from './code-panel';
import { DashboardPanel } from './dashboard-panel';
import { GROUPS } from './groups';
import { markFinished } from './progress';
import { SensorPanel } from './sensor-panel';
import { SerialMonitor } from './serial-monitor';
import { actionClass, panelClass } from './styles';
import { useSimulation } from './use-simulation';
import { WorkspaceToolbar } from './workspace-toolbar';

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
  const [history, setHistory] = useState<History>({ undo: false, redo: false });
  const [follow, setFollow] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const binRef = useRef<HTMLButtonElement>(null);

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
    ? t('status.running')
    : sim.panel.programDone
      ? t('status.done')
      : mission.free
        ? t('status.free')
        : t('status.idle');
  const metCount = mission.goals.filter((goal) => sim.panel.met.includes(goal.id)).length;
  const place = missionStep(info.id);
  const group = info.group ? GROUPS[info.group] : undefined;
  const serialView = mission.view === 'serial';
  const robotName = getRobot(mission.robot)?.name ?? '';
  const outcomeKey =
    result && result.status !== 'running'
      ? result.status === 'success'
        ? 'success'
        : // Algorithm practice has no robot to blame: talk about the printed lines instead.
          serialView && result.reason !== 'bump'
          ? result.reason === 'time'
            ? 'outputTime'
            : 'output'
          : result.reason
      : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* isolate keeps Blockly's own layers (toolbox, toolbar) under the header and popovers. */}
      <section className="border-border relative isolate h-[62vh] min-h-[26rem] overflow-hidden rounded-xl border xl:sticky xl:top-[5.25rem] xl:h-[calc(100dvh-6.75rem)]">
        <BlocklyWorkspace
          robot={mission.robot}
          locale={locale}
          dark={dark}
          messages={blockMessages}
          storageKey={`dctedu-sim:${mission.id}`}
          starter={mission.starter}
          apiRef={apiRef}
          onProgramChange={setProgram}
          onHistory={setHistory}
          binRef={binRef}
          onSelection={setCanDelete}
          label={t('workspaceLabel')}
        />
        <WorkspaceToolbar
          className="absolute right-3 bottom-3"
          history={history}
          canDelete={canDelete}
          binRef={binRef}
          onDelete={() => apiRef.current?.deleteSelected()}
          onUndo={() => apiRef.current?.undo()}
          onRedo={() => apiRef.current?.redo()}
          onZoom={(steps) => apiRef.current?.zoom(steps)}
          onFit={() => apiRef.current?.fit()}
          onRestore={() => apiRef.current?.load(mission.starter)}
        />
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <section className={cn(panelClass, 'rounded-xl p-5')}>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-bold">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5',
                mission.robot === 'ciko' ? 'bg-robot-ciko text-white' : 'bg-robot-momo text-black',
              )}
            >
              {robotName}
            </span>
            {place ? (
              <span className="text-muted-foreground">
                {t('step', { n: place.number, total: place.total })}
              </span>
            ) : group ? (
              <span className={cn('inline-flex items-center gap-1.5', group.tone)}>
                <group.icon className="size-4" strokeWidth={2.5} aria-hidden />
                {t(group.label)}
              </span>
            ) : null}
          </p>
          <h1 className="type-display mt-3 text-[1.75rem]">{pick(info.title, locale)}</h1>
          <p className="text-muted-foreground mt-2">{pick(info.brief, locale)}</p>
          {mission.goals.length > 0 ? (
            <>
              <h2 className="mt-5 flex items-center justify-between text-sm font-bold">
                {t('goals')}
                <span className="text-muted-foreground tabular-nums">
                  {metCount}/{mission.goals.length}
                </span>
              </h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {mission.goals.map((goal) => {
                  const met = sim.panel.met.includes(goal.id);
                  return (
                    <li
                      key={goal.id}
                      className={cn('flex items-center gap-2 text-sm', met && 'font-bold')}
                    >
                      {met ? (
                        <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
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
              href={learnStepUrl(locale, mission.robot, place.step.id)}
              target="_blank"
              rel="noopener"
              className="decoration-primary mt-3 inline-block text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              {t('inPath', { robot: robotName })}
              <span className="sr-only"> {t('newTab')}</span>
            </a>
          ) : null}
        </section>

        <section className="border-border @container overflow-hidden rounded-xl border">
          <div className="asphalt flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
            {sim.running ? (
              <button
                type="button"
                className={actionClass(
                  'plain',
                  'min-w-32 border-white/30 bg-transparent text-white hover:bg-white/10',
                )}
                onClick={sim.stop}
              >
                <Square aria-hidden />
                {t('stop')}
              </button>
            ) : (
              <button type="button" className={actionClass('signal', 'min-w-32')} onClick={run}>
                <Play aria-hidden />
                {t('run')}
              </button>
            )}
            <button
              type="button"
              title={t('reset')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-bold text-white transition-colors hover:bg-white/10 [&_svg]:size-5"
              onClick={sim.reset}
            >
              <RotateCcw aria-hidden />
              <span className="hidden @2xl:inline">{t('reset')}</span>
            </button>
            <fieldset
              aria-label={t('speed')}
              className="flex shrink-0 rounded-md border border-white/15 bg-white/5 p-0.5"
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
                    'h-9 min-w-10 rounded-sm px-2 text-sm font-bold tabular-nums transition-colors',
                    speed === value ? 'bg-white text-[#191b20]' : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  {value}×
                </button>
              ))}
            </fieldset>
            <div className="ml-auto flex items-center gap-3">
              <div className="text-right leading-none">
                <p aria-live="polite" className="text-xs font-bold text-white/60">
                  {status}
                </p>
                <p className="type-number mt-1 text-[1.75rem] text-white tabular-nums">
                  {sim.panel.time.toFixed(1)}
                  <span className="ml-1 text-sm text-white/55">
                    {mission.free ? 's' : `/ ${mission.timeLimit} s`}
                  </span>
                </p>
              </div>
              {serialView ? null : (
                <button
                  type="button"
                  aria-pressed={follow}
                  title={t('follow')}
                  onClick={() => setFollow((value) => !value)}
                  className={cn(
                    'grid size-11 place-items-center rounded-md border transition-colors [&_svg]:size-5',
                    follow
                      ? 'border-transparent bg-[#ffb020] text-[#191b20]'
                      : 'border-white/15 text-white hover:bg-white/10',
                  )}
                >
                  <ScanSearch aria-hidden />
                  <span className="sr-only">{t('follow')}</span>
                </button>
              )}
            </div>
          </div>
          {error ? (
            <p role="alert" className="bg-[#c2181f] px-4 py-2 text-sm font-bold text-white">
              {error}
            </p>
          ) : null}
          {serialView ? (
            <SerialMonitor lines={sim.panel.serial} />
          ) : (
            <ArenaCanvas
              simulation={sim.simulation}
              drawRef={sim.draw}
              dark={dark}
              label={t('arenaLabel')}
              follow={follow}
            />
          )}
        </section>
        {serialView && !mission.envTimeline ? null : (
          <SensorPanel
            robot={mission.robot}
            panel={sim.panel}
            free={Boolean(mission.free)}
            onClap={sim.clap}
            onEnvironment={sim.setEnvironment}
          />
        )}
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
        <DialogContent closeLabel={t('close')} className="rounded-lg">
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
                    // Keep the printed lines on screen so they can be compared with the goals.
                    if (!serialView) sim.reset();
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
