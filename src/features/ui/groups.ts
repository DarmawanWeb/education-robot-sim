import type { SimMissionGroup } from '@dctedu/catalog';
import { Braces, type LucideIcon, Star } from 'lucide-react';

/** How a mission off the learning path is marked: its icon, its colour, and its group's name. */
export const GROUPS: Record<
  SimMissionGroup,
  { icon: LucideIcon; tone: string; label: 'extras' | 'algoGroup' }
> = {
  extra: {
    icon: Star,
    tone: 'border-[#ffb020] text-[#b07400] dark:text-[#ffb020]',
    label: 'extras',
  },
  algo: {
    icon: Braces,
    tone: 'border-[#5b6b85] text-[#47556b] dark:border-[#9aa7bd] dark:text-[#b4c0d4]',
    label: 'algoGroup',
  },
};
