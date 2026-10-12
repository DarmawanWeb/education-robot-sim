import type { Locale, SimRobot } from '@taksu/content';

/** The education site, where the simulator is introduced and the syllabus lives. */
export const eduUrl = (process.env.NEXT_PUBLIC_EDU_URL ?? 'http://localhost:3003').replace(
  /\/+$/,
  '',
);

/** A module on the kit's syllabus page. */
export function syllabusUrl(locale: Locale, robot: SimRobot, moduleId: string): string {
  return `${eduUrl}/${locale}/curriculum/${robot}#${moduleId}`;
}
