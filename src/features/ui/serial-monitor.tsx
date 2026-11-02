'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

/**
 * Where algorithm practice shows its work, like the Arduino IDE's Serial Monitor: one line per
 * print, numbered, scrolled to the newest.
 */
export function SerialMonitor({ lines }: { lines: readonly string[] }) {
  const t = useTranslations('Sim.serial');
  const bottom = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the newest line.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [lines.length]);

  return (
    <div className="flex h-[min(26rem,60vh)] flex-col bg-[#0f1115] text-[#e8eaee]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs font-bold text-white/55">
        <span>{t('title')}</span>
        <span className="tabular-nums">
          {lines.length > 0 ? t('lines', { count: lines.length }) : t('baud')}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="m-auto max-w-[32ch] px-6 text-center text-sm text-white/55">{t('empty')}</p>
      ) : (
        <div className="flex-1 overflow-y-auto py-2" role="log" aria-label={t('label')}>
          <ol className="font-mono text-[0.9rem] leading-relaxed">
            {lines.map((line, index) => (
              // Lines never move once printed, so their position is a stable key.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above.
              <li key={index} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3 px-4">
                <span className="text-right text-white/30 tabular-nums select-none">
                  {index + 1}
                </span>
                <span className="break-words whitespace-pre-wrap">{line}</span>
              </li>
            ))}
          </ol>
          <div ref={bottom} />
        </div>
      )}
    </div>
  );
}
