'use client';

import { cn } from '@taksu/ui/lib/utils';
import { Wifi, WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TelemetryPoint } from '../engine/types';
import { panelClass } from './styles';

const WIDTH = 240;
const HEIGHT = 48;

interface Series {
  key: string;
  latest: number | string;
  points: { t: number; value: number }[];
}

function seriesOf(telemetry: readonly TelemetryPoint[]): Series[] {
  const byKey = new Map<string, Series>();
  for (const point of telemetry) {
    const series = byKey.get(point.key) ?? { key: point.key, latest: point.value, points: [] };
    series.latest = point.value;
    if (typeof point.value === 'number') series.points.push({ t: point.t, value: point.value });
    byKey.set(point.key, series);
  }
  return [...byKey.values()];
}

/** A small line chart. A gap of more than 1.5 s breaks the line, so lost data shows as a hole. */
function Sparkline({ points, until }: { points: Series['points']; until: number }) {
  if (points.length === 0) return null;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const end = Math.max(until, 10);
  const x = (t: number) => (t / end) * WIDTH;
  const y = (value: number) => HEIGHT - 4 - ((value - low) / span) * (HEIGHT - 8);
  let path = '';
  points.forEach((point, index) => {
    const previous = points[index - 1];
    const jump = !previous || point.t - previous.t > 1.5;
    path += `${jump ? 'M' : 'L'}${x(point.t).toFixed(1)} ${y(point.value).toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 h-12 w-full" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {points.map((point) => (
        <circle key={point.t} cx={x(point.t)} cy={y(point.value)} r="2.2" fill="currentColor" />
      ))}
    </svg>
  );
}

const show = (value: number | string) =>
  typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : String(value);

/**
 * What the teacher's laptop would see on the class network: every value the robot sent while
 * the Wi-Fi was up. Nothing here leaves the browser.
 */
export function DashboardPanel({
  telemetry,
  online,
  dropped,
  time,
}: {
  telemetry: readonly TelemetryPoint[];
  online: boolean;
  dropped: number;
  time: number;
}) {
  const t = useTranslations('Sim.dashboard');
  const series = seriesOf(telemetry);
  return (
    <section aria-label={t('title')} className={cn(panelClass, 'p-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{t('title')}</h2>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            online ? 'bg-mat text-white' : 'bg-surface-muted text-muted-foreground',
          )}
        >
          {online ? (
            <Wifi className="size-3.5" aria-hidden />
          ) : (
            <WifiOff className="size-3.5" aria-hidden />
          )}
          {online ? t('online') : t('offline')}
        </span>
      </div>
      {series.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">{t('empty')}</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {series.map((entry) => (
            <li key={entry.key} className="bg-surface-muted text-primary rounded-md px-3 py-2">
              <p className="text-muted-foreground text-xs font-semibold">{entry.key}</p>
              <p className="font-display text-foreground text-lg font-semibold tabular-nums">
                {show(entry.latest)}
              </p>
              <Sparkline points={entry.points} until={time} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground mt-3 text-xs" aria-live="polite">
        {t('counts', { received: telemetry.length, dropped })}
      </p>
    </section>
  );
}
