import type { Locale, SimRobot } from '@taksu/catalog';

/** The store site, where every robot's learning path lives. */
export const webUrl = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3103').replace(
  /\/+$/,
  '',
);

/** A step on a robot's learning path, on the store site. */
export function learnStepUrl(locale: Locale, robot: SimRobot, stepId: string): string {
  return `${webUrl}/${locale}/belajar/${robot}#${stepId}`;
}
