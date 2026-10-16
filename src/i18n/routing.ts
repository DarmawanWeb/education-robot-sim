import { defaultLocale, locales } from '@taksu/catalog';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
