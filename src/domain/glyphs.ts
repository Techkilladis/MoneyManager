// Emoji glyphs for categories. Seeded categories store SF-Symbol-style
// identifiers in `icon`; custom categories store the emoji itself.

const symbolGlyphs: Record<string, string> = {
  'fork.knife': '🍔',
  'car.fill': '🚕',
  'bag.fill': '🛍️',
  'doc.text.fill': '🧾',
  'tv.fill': '🎬',
  'cross.case.fill': '💊',
  'book.fill': '📚',
  repeat: '🔁',
  'person.2.fill': '👨‍👩‍👧',
  'person.fill': '🙂',
  'square.grid.2x2': '📦',
};

export const categoryEmojiChoices = [
  '🍔', '☕', '🛒', '🚕', '⛽', '✈️', '🛍️', '👕', '🧾', '💡',
  '📱', '🏠', '🎬', '🎮', '🎵', '💊', '🏋️', '📚', '🎓', '🔁',
  '👨‍👩‍👧', '🐾', '🎁', '💇', '🍻', '🏥', '🚇', '💼', '🔧', '📦',
] as const;

export function categoryGlyph(icon: string | null | undefined): string {
  if (!icon) return '🏷️';
  if (symbolGlyphs[icon]) return symbolGlyphs[icon];
  // Anything that isn't an ASCII identifier is treated as an emoji.
  if (/^[\x20-\x7E]+$/.test(icon)) return '🏷️';
  return icon;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
