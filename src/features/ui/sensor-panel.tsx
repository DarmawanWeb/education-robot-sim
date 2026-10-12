'use client';

import { cn } from '@taksu/ui/lib/utils';
import { Bell, Hand } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { RobotId } from '../engine/types';
import { RobotFront } from './robot-front';
import type { PanelState } from './use-simulation';

const ON_LINE = 500;

function Readout({
  label,
  part,
  value,
  className,
}: {
  label: string;
  /** The module on the real robot that gives this reading. */
  part?: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface-muted rounded-md px-3 py-2', className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
      {part ? <dd className="text-muted-foreground text-xs font-semibold">{part}</dd> : null}
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
  const seen = panel.lineValues.map((value) => value > ON_LINE);

  return (
    <section aria-label={t('title')} className="border-border bg-surface rounded-xl border p-4">
      <h2 className="text-muted-foreground mb-3 text-sm font-semibold">{t('title')}</h2>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <p className="text-muted-foreground mb-1 text-xs">
            {robot === 'sd' ? t('front') : t('oled')}
          </p>
          <div className="mx-auto max-w-[14rem] sm:max-w-none">
            <RobotFront
              robot={robot}
              face={panel.face}
              oled={panel.oled}
              lineSeen={seen}
              label={t('frontLabel')}
            />
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
        <dl className="grid content-start grid-cols-2 gap-2 lg:grid-cols-3">
          {robot === 'sd' ? (
            <>
              <Readout label={t('lineLeft')} part="IR" value={yesNo(seen[0] ?? false)} />
              <Readout label={t('lineRight')} part="IR" value={yesNo(seen[1] ?? false)} />
              <Readout
                label={t('distance')}
                part={t('ultrasonic')}
                value={`${panel.distance.toFixed(1)} cm`}
              />
            </>
          ) : (
            <>
              <div className="bg-surface-muted col-span-2 rounded-md px-3 py-2 lg:col-span-3">
                <dt className="text-muted-foreground flex items-baseline justify-between gap-2 text-xs">
                  <span>{t('lineSensors')}</span>
                  <span className="font-semibold opacity-80">IR 5-in-1</span>
                </dt>
                <dd className="mt-1 flex h-10 items-end gap-1.5">
                  {panel.lineValues.map((value, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: the index is the sensor position
                      key={index}
                      className={cn(
                        'flex-1 rounded-t',
                        value > ON_LINE ? 'bg-[#e0352b]' : 'bg-primary',
                      )}
                      style={{ height: `${Math.max(8, (value / 1000) * 100)}%` }}
                      title={String(Math.round(value))}
                    />
                  ))}
                </dd>
              </div>
              <Readout label={t('linePosition')} value={String(Math.round(panel.linePosition))} />
              <Readout
                label={t('distance')}
                part="HC-SR04"
                value={`${panel.distance.toFixed(1)} cm`}
              />
              <Readout label={t('servo')} value={`${Math.round(panel.servoAngle)}°`} />
              <Readout
                label={t('temperature')}
                part="AHT10"
                value={`${panel.env.temperature} °C`}
              />
              <Readout label={t('humidity')} part="AHT10" value={`${panel.env.humidity} %`} />
              <Readout label={t('sound')} part={t('microphone')} value={`${panel.env.sound} dB`} />
            </>
          )}
          <Readout
            label={t('motors')}
            part={robot === 'smp' ? 'TB6612FNG' : undefined}
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
