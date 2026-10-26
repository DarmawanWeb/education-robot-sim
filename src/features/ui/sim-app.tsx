'use client';

import {
  brand,
  getRobot,
  type Locale,
  missionStep,
  pick,
  type SimRobot,
  simMissions,
} from '@dctedu/catalog';
import { ThemeToggle } from '@dctedu/ui/brand/theme-toggle';
import { Wordmark } from '@dctedu/ui/brand/wordmark';
import { cn } from '@dctedu/ui/lib/utils';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { useRouter } from '@/i18n/navigation';
import { webUrl } from '@/lib/links';
import { getMission } from '../engine/missions';
import { MissionScreen } from './mission-screen';
import { useFinishedMissions } from './progress';
import { segmentClass, segmentGroupClass } from './styles';

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** Blockly needs to know the theme to pick its palette. */
function useDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
}

const ROBOTS: readonly SimRobot[] = ['ciko', 'momo'];

/** Each robot's own colour on its switch: Ciko red, Momo yellow. */
const ROBOT_FILL: Record<SimRobot, string> = {
  ciko: 'bg-robot-ciko text-white',
  momo: 'bg-robot-momo text-black',
};

export function SimApp() {
  const t = useTranslations('Sim');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const dark = useDarkMode();
  const finished = useFinishedMissions();

  const requested = getMission(searchParams.get('mission') ?? '');
  const robot: SimRobot =
    requested?.robot ?? (searchParams.get('robot') === 'momo' ? 'momo' : 'ciko');
  const list = simMissions.filter((entry) => entry.robot === robot);
  const info = (requested && list.find((entry) => entry.id === requested.id)) ?? list[0];
  const mission = info ? getMission(info.id) : undefined;
  const index = info ? list.indexOf(info) : -1;
  const next = list[index + 1];

  const open = (target: { robot: SimRobot; mission?: string }, nextLocale: Locale = locale) => {
    const query: Record<string, string> = { robot: target.robot };
    if (target.mission) query.mission = target.mission;
    router.replace({ pathname: '/', query }, { locale: nextLocale, scroll: false });
  };

  if (!info || !mission) return null;

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border bg-background/95 sticky top-0 z-20 border-b backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <a
            href={`${webUrl}/${locale}`}
            aria-label={t('backToSite', { brand: brand.name })}
            className="group flex shrink-0 items-baseline gap-2 rounded-sm"
          >
            <Wordmark title="" className="h-6 translate-y-0.5" />
            <span className="type-display text-muted-foreground text-lg">{t('title')}</span>
          </a>
          {/* Robot and mission take their own row until there is room for everything. */}
          <div className="order-last flex min-w-0 basis-full items-center gap-3 xl:order-none xl:basis-auto">
            <fieldset aria-label={t('robot')} className={segmentGroupClass}>
              {ROBOTS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={robot === id}
                  onClick={() => open({ robot: id })}
                  className={segmentClass(robot === id, ROBOT_FILL[id])}
                >
                  {getRobot(id)?.name}
                </button>
              ))}
            </fieldset>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold sm:flex-none">
              <span className="sr-only sm:not-sr-only">{t('mission')}</span>
              <select
                value={info.id}
                onChange={(event) => open({ robot, mission: event.target.value })}
                className="border-border bg-surface h-10 min-w-0 flex-1 rounded-md border px-3 font-semibold"
              >
                {list.map((entry) => {
                  const title = t('stepOption', {
                    n: missionStep(entry.id)?.number ?? 0,
                    title: pick(entry.title, locale),
                  });
                  return (
                    <option key={entry.id} value={entry.id}>
                      {finished.has(entry.id) ? t('finishedOption', { title }) : title}
                    </option>
                  );
                })}
              </select>
            </label>
            <span className="text-muted-foreground hidden text-sm font-semibold whitespace-nowrap tabular-nums md:inline">
              {t('progress', {
                done: list.filter((entry) => finished.has(entry.id)).length,
                total: list.length,
              })}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <fieldset aria-label={t('language')} className={segmentGroupClass}>
              {(['id', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  onClick={() => open({ robot, mission: info.id }, code)}
                  lang={code}
                  className={cn(segmentClass(locale === code), 'uppercase')}
                >
                  {code}
                </button>
              ))}
            </fieldset>
            <ThemeToggle label={t('theme')} />
          </div>
        </div>
      </header>
      <main className="p-4 sm:p-6">
        <MissionScreen
          key={mission.id}
          mission={mission}
          info={info}
          locale={locale}
          dark={dark}
          hasNext={Boolean(next)}
          onNext={() => (next ? open({ robot, mission: next.id }) : undefined)}
        />
      </main>
    </div>
  );
}
