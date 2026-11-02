import { missionStep, type SimMissionInfo, type SimTrack } from '@dctedu/catalog';
import { Star } from 'lucide-react';

/** Each track's own colour: on its switch, its chip, and the current mission's marker. */
export const TRACK_FILL: Record<SimTrack, string> = {
  algo: 'bg-[#47556b] text-white border-[#47556b] dark:bg-[#9aa9c0] dark:text-[#101318] dark:border-[#9aa9c0]',
  ciko: 'bg-robot-ciko text-white border-robot-ciko',
  momo: 'bg-robot-momo text-black border-robot-momo',
};

/** The switch order: the general algorithm practice first, then each robot. */
export const TRACKS: readonly SimTrack[] = ['algo', 'ciko', 'momo'];

/** Extra robot challenges carry a star instead of a step number. */
export const EXTRA = {
  icon: Star,
  tone: 'border-[#ffb020] text-[#b07400] dark:text-[#ffb020]',
};

/**
 * A mission's number in its own list: the step on the robot's learning path, or the exercise
 * within its school level. Extra challenges have none.
 */
export function missionNumber(
  entry: SimMissionInfo,
  list: readonly SimMissionInfo[],
): { n: number; total: number } | undefined {
  if (entry.track === 'algo') {
    const level = list.filter((other) => other.track === 'algo' && other.level === entry.level);
    return { n: level.indexOf(entry) + 1, total: level.length };
  }
  const step = missionStep(entry.id);
  return step ? { n: step.number, total: step.total } : undefined;
}
