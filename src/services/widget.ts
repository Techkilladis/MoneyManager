/** Pushes today's and this month's spend to the Android home-screen widget. */
import { Platform } from 'react-native';
import { notificationDetectionService } from './notificationDetection';
import { monthBounds, sumBetween } from './ledger';
import { formatINR } from '../utils/format';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function syncWidget(): Promise<void> {
  if (Platform.OS !== 'android' || !notificationDetectionService.isAvailable()) return;
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const month = monthBounds(now);
    const [today, monthAgg] = await Promise.all([sumBetween(todayStart, todayStart + DAY_MS), sumBetween(month.start, month.end)]);
    const p = (n: number) => String(n).padStart(2, '0');
    await notificationDetectionService.updateWidget({
      today: formatINR(today.total, { decimals: 'never' }),
      month: formatINR(monthAgg.total, { decimals: 'never' }),
      dayKey: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
      monthKey: `${now.getFullYear()}-${p(now.getMonth() + 1)}`,
    });
  } catch (error) {
    console.warn('[widget] sync failed', error);
  }
}
