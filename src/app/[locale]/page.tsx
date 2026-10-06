import { Suspense } from 'react';
import { SimApp } from '@/features/ui/sim-app';
import { resolveLocale } from '@/lib/locale';

export default async function SimulatorPage({ params }: { params: Promise<{ locale: string }> }) {
  await resolveLocale(params);
  return (
    <Suspense fallback={<div aria-busy className="min-h-dvh" />}>
      <SimApp />
    </Suspense>
  );
}
