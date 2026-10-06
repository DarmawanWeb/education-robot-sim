import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/bricolage-grotesque/standard.css';
import '@fontsource/noto-serif-balinese/balinese-400.css';
import '../globals.css';

import { ThemeProvider } from '@taksu/ui/brand/theme-provider';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';
import { localeFromParams, resolveLocale } from '@/lib/locale';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const t = await getTranslations({ locale, namespace: 'Meta' });
  return { title: t('title'), description: t('description') };
}

export default async function LocaleLayout({ children, params }: Props) {
  const locale = await resolveLocale(params);
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
