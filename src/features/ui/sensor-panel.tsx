'use client';

import { cn } from '@taksu/ui/lib/utils';
import { Bell, Hand } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Face, RobotId } from '../engine/types';
import type { PanelState } from './use-simulation';

const PIXEL = '#7ff3ff';

function OledFace({ face }: { face: Face }) {
  const eyes =
    face === 'senang' || face === 'berhasil' ? (
      <g fill="none" stroke={PIXEL} strokeWidth="6" strokeLinecap="round">
        <path d="M30 38q12-18 24 0" />
        <path d="M74 38q12-18 24 0" />
      </g>
    ) : face === 'waspada' ? (
      <g fill={PIXEL}>
        <rect x="32" y="24" width="20" height="22" rx="4" />
        <rect x="76" y="24" width="20" height="22" rx="4" />
        <path d="M28 18l26 6M100 18l-26 6" stroke={PIXEL} strokeWidth="4" strokeLinecap="round" />
      </g>
    ) : face === 'bingung' ? (
      <g fill={PIXEL}>
        <rect x="30" y="20" width="24" height="24" rx="5" />
        <rect x="78" y="28" width="16" height="16" rx="4" />
        <text x="102" y="22" fontSize="16" fontWeight="700" fill={PIXEL}>
          ?
        </text>
      </g>
    ) : (
      <g fill={PIXEL}>
        <rect x="30" y="18" width="24" height="26" rx="6" />
        <rect x="74" y="18" width="24" height="26" rx="6" />
      </g>
    );
  return (
    <svg viewBox="0 0 128 64" className="h-full w-full" aria-hidden>
      {eyes}
      {face === 'berhasil' ? (
        <path
          d="M54 52l7 6 13-12"
          fill="none"
          stroke={PIXEL}
          strokeWidth="4"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function Readout({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface-muted rounded-md px-3 py-2', className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function SensorPanel({
  robot,
  panel,
  free,
  onClap,
  onEnvironment,
}: {
  robot: RobotId;
  panel: PanelState;
  free: boolean;
  onClap: () => void;
  onEnvironment: (patch: { temperature?: number; humidity?: number }) => void;
}) {
  const t = useTranslations('Sim.panel');
  const yesNo = (on: boolean) => (on ? t('yes') : t('no'));
  const hasText = panel.oled.some((line) => line.trim().length > 0);

  return (
    <section aria-label={t('title')} className="border-border bg-surface rounded-xl border p-4">
      <h2 className="text-muted-foreground mb-3 text-sm font-semibold">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-[11rem_1fr]">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">{t('oled')}</p>
          <div className="aspect-[2/1] rounded-md border-4 border-[#1b2333] bg-black p-1.5">
            {hasText ? (
              <pre
                className="h-full overflow-hidden font-mono text-[0.7rem] leading-tight"
                style={{ color: PIXEL }}
              >
                {panel.oled.join('\n')}
              </pre>
            ) : (
              <OledFace face={panel.face} />
            )}
          </div>
          <p
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
              panel.buzzing ? 'bg-accent text-black' : 'bg-surface-muted text-muted-foreground',
            )}
          >
            <Bell className="size-3.5" aria-hidden />
            {t('buzzer')}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {robot === 'sd' ? (
            <>
              <Readout label={t('lineLeft')} value={yesNo((panel.lineValues[0] ?? 0) > 500)} />
              <Readout label={t('lineRight')} value={yesNo((panel.lineValues[1] ?? 0) > 500)} />
              <Readout label={t('distance')} value={`${panel.distance.toFixed(1)} cm`} />
            </>
          ) : (
            <>
              <div className="bg-surface-muted col-span-2 rounded-md px-3 py-2 lg:col-span-3">
                <dt className="text-muted-foreground text-xs">{t('lineSensors')}</dt>
                <dd className="mt-1 flex h-10 items-end gap-1.5">
                  {panel.lineValues.map((value, index) => (
                    <span
                      key={index}
                      className="bg-primary flex-1 rounded-t"
                      style={{ height: `${Math.max(8, (value / 1000) * 100)}%` }}
                      title={String(Math.round(value))}
                    />
                  ))}
                </dd>
              </div>
              <Readout label={t('linePosition')} value={String(Math.round(panel.linePosition))} />
              <Readout label={t('distance')} value={`${panel.distance.toFixed(1)} cm`} />
              <Readout label={t('servo')} value={`${Math.round(panel.servoAngle)}°`} />
              <Readout label={t('temperature')} value={`${panel.env.temperature} °C`} />
              <Readout label={t('humidity')} value={`${panel.env.humidity} %`} />
              <Readout label={t('sound')} value={`${panel.env.sound} dB`} />
            </>
          )}
          <Readout
            label={t('motors')}
            value={`${Math.round(panel.motors.left)} / ${Math.round(panel.motors.right)}`}
            className="col-span-2 lg:col-span-1"
          />
        </dl>
      </div>
      {free ? (
        <div className="border-border mt-4 grid gap-4 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('temperature')}: {panel.env.temperature} °C
            <input
              type="range"
              min={15}
              max={40}
              step={0.5}
              value={panel.env.temperature}
              onChange={(event) => onEnvironment({ temperature: Number(event.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('humidity')}: {panel.env.humidity} %
            <input
              type="range"
              min={20}
              max={95}
              step={1}
              value={panel.env.humidity}
              onChange={(event) => onEnvironment({ humidity: Number(event.target.value) })}
            />
          </label>
          <button
            type="button"
            onClick={onClap}
            className="border-border bg-background hover:border-primary inline-flex h-10 items-center gap-2 rounded-md border px-4 font-semibold"
          >
            <Hand className="size-4" aria-hidden />
            {t('clap')}
          </button>
          <p className="text-muted-foreground text-xs sm:col-span-3">{t('freeNote')}</p>
        </div>
      ) : null}
    </section>
  );
}
