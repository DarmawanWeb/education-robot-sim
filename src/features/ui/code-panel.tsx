'use client';

import { Button } from '@taksu/ui/components/button';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { CompileResult } from '../blocks/compile';
import { toCpp } from '../codegen/cpp';
import type { RobotId } from '../engine/types';

export function CodePanel({ result, robot }: { result: CompileResult | null; robot: RobotId }) {
  const t = useTranslations('Sim.code');
  const [copied, setCopied] = useState(false);
  const code = useMemo(
    () => (result?.ok && result.program.body.length > 0 ? toCpp(result.program, robot) : null),
    [result, robot],
  );

  return (
    <details open={robot === 'smp'} className="border-border bg-surface rounded-xl border">
      <summary className="cursor-pointer px-4 py-3 font-semibold">{t('title')}</summary>
      <div className="border-border border-t p-4">
        <p className="text-muted-foreground mb-3 text-sm">{t('note')}</p>
        {code ? (
          <>
            <pre className="max-h-80 overflow-auto rounded-md bg-[#0b1226] p-4 font-mono text-xs leading-relaxed text-[#dbe4ff]">
              <code>{code}</code>
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                void navigator.clipboard?.writeText(code).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? t('copied') : t('copy')}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        )}
      </div>
    </details>
  );
}
