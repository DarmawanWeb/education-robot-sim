import { Button } from '@taksu/ui/components/button';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-4xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      <Button asChild size="lg">
        <Link href="/">{t('back')}</Link>
      </Button>
    </main>
  );
}
