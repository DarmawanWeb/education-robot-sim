'use client';

import {
  type Locale,
  type Localized,
  missionPlace,
  names,
  pick,
  type SimMissionInfo,
  type SimRobot,
  simMissions,
} from '@taksu/content';
import { EduWordmark } from '@taksu/ui/brand/edu-wordmark';
import { ThemeToggle } from '@taksu/ui/brand/theme-toggle';
import { cn } from '@taksu/ui/lib/utils';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { useRouter } from '@/i18n/navigation';
import { eduUrl } from '@/lib/links';
import { getMission } from '../engine/missions';
import { MissionScreen } from './mission-screen';
import { useFinishedMissions } from './progress';

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

/** Missions under their syllabus module, for the picker. */
function groupByModule(list: readonly SimMissionInfo[]) {
  const groups: { module: number; title: Localized; missions: SimMissionInfo[] }[] = [];
  for (const entry of list) {
    const place = missionPlace(entry);
    if (!place) continue;
    const group = groups.find((item) => item.module === place.module);
    if (group) group.missions.push(entry);
    else groups.push({ module: place.module, title: place.moduleTitle, missions: [entry] });
  }
  return groups;
}

export function SimApp() {
  const t = useTranslations('Sim');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const dark = useDarkMode();
  const finished = useFinishedMissions();

  const requested = getMission(searchParams.get('mission') ?? '');
  const robot: SimRobot = requested?.robot ?? (searchParams.get('robot') === 'smp' ? 'smp' : 'sd');
  const list = simMissions.filter((entry) => entry.robot === robot);
  const info = (requested && list.find((entry) => entry.id === requested.id)) ?? list[0];
  const mission = info ? getMission(info.id) : undefined;
  const index = info ? list.indexOf(info) : -1;
  const next = list[index + 1];
  const groups = groupByModule(list);

  const open = (target: { robot: SimRobot; mission?: string }, nextLocale: Locale = locale) => {
    const query: Record<string, string> = { robot: target.robot };
    if (target.mission) query.mission = target.mission;
    router.replace({ pathname: '/', query }, { locale: nextLocale, scroll: false });
  };

  if (!info || !mission) return null;

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <a
            href={`${eduUrl}/${locale}/simulator`}
            aria-label={t('backToSite', { brand: names.edu })}
            className="shrink-0 rounded-sm"
          >
            <EduWordmark name={names.edu} />
          </a>
          <span className="text-muted-foreground hidden text-lg font-bold 2xl:inline">
            {t('title')}
          </span>
          {/* Robot and mission take their own row until there is room for everything. */}
          <div className="order-last flex min-w-0 basis-full items-center gap-3 xl:order-none xl:basis-auto">
            <fieldset
              aria-label={t('robot')}
              className="border-border flex shrink-0 overflow-hidden rounded-md border"
            >
              {(['sd', 'smp'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={robot === id}
                  onClick={() => open({ robot: id })}
                  className={cn(
                    'px-3 py-2 text-sm font-semibold whitespace-nowrap',
                    robot === id ? 'bg-primary text-primary-foreground' : 'bg-surface',
                  )}
                >
                  {id === 'sd' ? t('robotSd') : t('robotSmp')}
                </button>
              ))}
            </fieldset>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold sm:flex-none">
              <span className="sr-only sm:not-sr-only">{t('mission')}</span>
              <select
                value={info.id}
                onChange={(event) => open({ robot, mission: event.target.value })}
                className="border-border bg-surface h-10 min-w-0 flex-1 rounded-md border px-3"
              >
                {groups.map((group) => (
                  <optgroup
                    key={group.module}
                    label={`${t('module', { n: group.module })}: ${pick(group.title, locale)}`}
                  >
                    {group.missions.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {finished.has(entry.id)
                          ? t('finishedOption', { title: pick(entry.title, locale) })
                          : pick(entry.title, locale)}
                      </option>
                    ))}
                  </optgroup>
                ))}
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
            <fieldset
              aria-label={t('language')}
              className="border-border flex overflow-hidden rounded-md border text-sm font-semibold"
            >
              {(['id', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  onClick={() => open({ robot, mission: info.id }, code)}
                  className={cn(
                    'px-3 py-2 uppercase',
                    locale === code ? 'bg-primary text-primary-foreground' : 'bg-surface',
                  )}
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
