'use client';

import { brand, getRobot, type Locale, type SimRobot, simMissions } from '@dctedu/catalog';
import { ThemeToggle } from '@dctedu/ui/brand/theme-toggle';
import { Wordmark } from '@dctedu/ui/brand/wordmark';
import { cn } from '@dctedu/ui/lib/utils';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { useRouter } from '@/i18n/navigation';
import { webUrl } from '@/lib/links';
import { getMission } from '../engine/missions';
import { MissionPicker } from './mission-picker';
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
      <header className="border-border bg-background/90 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-2.5 sm:px-6">
          <a
            href={`${webUrl}/${locale}`}
            aria-label={t('backToSite', { brand: brand.name })}
            className="group flex shrink-0 items-baseline gap-2 rounded-sm"
          >
            <Wordmark title="" className="h-5 translate-y-0.5 sm:h-6" />
            <span className="type-display text-muted-foreground hidden text-base min-[440px]:inline sm:text-lg">
              {t('title')}
            </span>
          </a>
          {/* Robot and mission: their own row on phones, next to the brand once there is room. */}
          <div className="order-last flex min-w-0 basis-full items-center gap-2.5 lg:order-none lg:flex-1 lg:basis-auto">
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
            <MissionPicker
              robot={robot}
              list={list}
              current={info}
              finished={finished}
              locale={locale}
              onPick={(id) => open({ robot, mission: id })}
            />
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
