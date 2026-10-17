import { amountToInput, formatCompactINR, formatINR, parseAmount, pluralize, sanitizeAmountInput, splitINR, timeAgo } from '../format';

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(12345678)).toBe('₹1,23,456.78');
    expect(formatINR(100000000)).toBe('₹10,00,000');
  });

  it('hides zero paise by default and can force or drop them', () => {
    expect(formatINR(50000)).toBe('₹500');
    expect(formatINR(50000, { decimals: 'always' })).toBe('₹500.00');
    expect(formatINR(50050, { decimals: 'never' })).toBe('₹501');
  });

  it('splits rupees and paise for the hero display', () => {
    expect(splitINR(125050)).toEqual(['₹1,250', '.50']);
  });

  it('abbreviates large amounts', () => {
    expect(formatCompactINR(1250000)).toMatch(/12\.5K/);
    expect(formatCompactINR(15000000)).toMatch(/1\.5L/);
  });
});

describe('amount input', () => {
  it('parses rupees to exact paise', () => {
    expect(parseAmount('125.29')).toBe(12529);
    expect(parseAmount('1,250.5')).toBe(125050);
    expect(parseAmount('0.1')).toBe(10);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('round-trips through the input format', () => {
    expect(parseAmount(amountToInput(64900))).toBe(64900);
    expect(parseAmount(amountToInput(12345))).toBe(12345);
  });

  it('keeps only digits and one decimal point with two places', () => {
    expect(sanitizeAmountInput('12a3.456')).toBe('123.45');
    expect(sanitizeAmountInput('1.2.3')).toBe('1.23');
  });
});

describe('text helpers', () => {
  it('pluralizes', () => {
    expect(pluralize(1, 'expense')).toBe('1 expense');
    expect(pluralize(3, 'expense')).toBe('3 expenses');
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
  });

  it('describes how long ago something happened', () => {
    const now = new Date(2026, 9, 17, 12, 0).getTime();
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 hours ago');
    expect(timeAgo(now - 2 * 86_400_000, now)).toBe('2 days ago');
  });
});
