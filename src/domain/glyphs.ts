// Category icons. Categories store an icon key in `icon`: new and edited
// categories store an Icon name directly; older data holds SF-Symbol-style
// identifiers (seeded categories) or an emoji (custom categories), which are
// mapped to the matching line icon here.
import type { IconName } from '@/components/ui/Icon';

/** Icons offered when creating or editing a category (6 × 6 grid). */
export const categoryIconChoices = [
  'utensils', 'coffee', 'shoppingCart', 'car', 'fuel', 'plane',
  'shoppingBag', 'shirt', 'receiptText', 'lightbulb', 'smartphone', 'home',
  'clapperboard', 'gamepad', 'music', 'pill', 'dumbbell', 'bookOpen',
  'graduationCap', 'repeat', 'users', 'pawPrint', 'gift', 'scissors',
  'wine', 'heartPulse', 'train', 'briefcase', 'wrench', 'package',
  'laptop', 'landmark', 'coins', 'user', 'wallet', 'tag',
] as const satisfies readonly IconName[];

const choiceSet = new Set<string>(categoryIconChoices);

const symbolIcons: Record<string, IconName> = {
  'fork.knife': 'utensils',
  'car.fill': 'car',
  'bag.fill': 'shoppingBag',
  'doc.text.fill': 'receiptText',
  'tv.fill': 'clapperboard',
  'cross.case.fill': 'pill',
  'book.fill': 'bookOpen',
  repeat: 'repeat',
  'person.2.fill': 'users',
  'person.fill': 'user',
  'square.grid.2x2': 'package',
};

// Every emoji the previous picker offered, plus the seeded income ones.
const emojiIcons: Record<string, IconName> = {
  '🍔': 'utensils', '☕': 'coffee', '🛒': 'shoppingCart', '🚕': 'car', '⛽': 'fuel', '✈️': 'plane',
  '🛍️': 'shoppingBag', '👕': 'shirt', '🧾': 'receiptText', '💡': 'lightbulb', '📱': 'smartphone', '🏠': 'home',
  '🎬': 'clapperboard', '🎮': 'gamepad', '🎵': 'music', '💊': 'pill', '🏋️': 'dumbbell', '📚': 'bookOpen',
  '🎓': 'graduationCap', '🔁': 'repeat', '👨‍👩‍👧': 'users', '🐾': 'pawPrint', '🎁': 'gift', '💇': 'scissors',
  '🍻': 'wine', '🏥': 'heartPulse', '🚇': 'train', '💼': 'briefcase', '🔧': 'wrench', '📦': 'package',
  '💻': 'laptop', '↩️': 'undo', '🏦': 'landmark', '💰': 'coins', '🙂': 'user',
};

// Emoji may be stored with or without the variation selector.
const bare = (s: string) => s.replace(/️/g, '');
const emojiByBare = new Map(Object.entries(emojiIcons).map(([emoji, name]) => [bare(emoji), name]));

export function categoryIcon(icon: string | null | undefined): IconName {
  if (!icon) return 'tag';
  if (choiceSet.has(icon) || icon === 'undo') return icon as IconName;
  return symbolIcons[icon] ?? emojiByBare.get(bare(icon)) ?? 'tag';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
