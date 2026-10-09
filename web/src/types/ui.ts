// Presentation types shared by components and screens (the domain records are in models.ts).
import type { IconName } from '../components/icons/Icon';

/** Icon tone shared by badges, status pills and notifications. */
export type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'inverse';

/** A status shown as a badge (label + icon + tone). */
export interface StatusBadge {
  label: string;
  tone: Tone;
  icon: IconName;
}
