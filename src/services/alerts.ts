/**
 * Local notifications: budget alerts (80% / 100% of a monthly budget), the
 * monthly recap on the 1st, and reminders the day before a recurring bill.
 * Nothing here talks to a server; everything is scheduled on the device.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getMonthlyBudgets } from './budget';
import { monthBounds, sumBetween } from './ledger';
import { listRecurring } from './recurring';
import { getSetting, getSettings, setSetting } from './settings';
import { formatINR } from '../utils/format';

const CHANNEL_BUDGET = 'budget-alerts';
const CHANNEL_REMINDERS = 'reminders';
const RECAP_ID = 'mm-recap';
const BILL_PREFIX = 'mm-bill-';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Promise.all([
      Notifications.setNotificationChannelAsync(CHANNEL_BUDGET, {
        name: 'Budget alerts',
        description: 'When a budget is nearly or fully used',
        importance: Notifications.AndroidImportance.HIGH,
      }),
      Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
        name: 'Reminders and recaps',
        description: 'Upcoming bills and your monthly recap',
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    ]).catch((e) => console.warn('[alerts] channel setup failed', e));
  }
}

export async function getPermission(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionState;
  } catch {
    return 'undetermined';
  }
}

export async function requestPermission(): Promise<boolean> {
  await initNotifications();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    const granted = next.status === 'granted';
    if (granted) void refreshScheduledNotifications();
    return granted;
  } catch {
    return false;
  }
}

function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export interface BudgetAlert {
  budgetId: string;
  categoryName: string;
  threshold: 80 | 100;
  spentPaise: number;
  limitPaise: number;
}

/**
 * Checks monthly budgets and notifies once per threshold per month. Call it
 * after anything that changes spending. Returns the alerts that fired.
 */
export async function checkBudgetAlerts(): Promise<BudgetAlert[]> {
  try {
    const { budgetAlertsEnabled, budgetAlertsSent, overallBudgetPaise } = await getSettings([
      'budgetAlertsEnabled',
      'budgetAlertsSent',
      'overallBudgetPaise',
    ]);
    if (!budgetAlertsEnabled) return [];
    const now = new Date();
    const mk = monthKey(now);
    const budgets: { budget: { id: string; name: string; amountPaise: number }; spentPaise: number; category: { name: string } | null }[] =
      await getMonthlyBudgets(now);
    if (overallBudgetPaise > 0) {
      const month = monthBounds(now);
      const spent = await sumBetween(month.start, month.end);
      budgets.unshift({
        budget: { id: 'overall', name: 'monthly', amountPaise: overallBudgetPaise },
        spentPaise: spent.total,
        category: { name: 'monthly' },
      });
    }
    // Only this month's bookkeeping matters; older keys are dropped.
    const sent: Record<string, number> = {};
    for (const [k, v] of Object.entries(budgetAlertsSent)) if (k.endsWith(`:${mk}`)) sent[k] = v;

    const fired: BudgetAlert[] = [];
    for (const b of budgets) {
      const key = `${b.budget.id}:${mk}`;
      const ratio = b.budget.amountPaise > 0 ? b.spentPaise / b.budget.amountPaise : 0;
      const threshold: 80 | 100 | null = ratio >= 1 ? 100 : ratio >= 0.8 ? 80 : null;
      if (threshold && (sent[key] ?? 0) < threshold) {
        sent[key] = threshold;
        fired.push({
          budgetId: b.budget.id,
          categoryName: b.category?.name ?? b.budget.name,
          threshold,
          spentPaise: b.spentPaise,
          limitPaise: b.budget.amountPaise,
        });
      } else if (!threshold && sent[key]) {
        // Spending dropped back (e.g. an expense was deleted): allow re-alerting.
        delete sent[key];
      }
    }
    await setSetting('budgetAlertsSent', sent);

    if (fired.length > 0 && (await getPermission()) === 'granted') {
      await initNotifications();
      for (const a of fired) {
        const over = a.spentPaise - a.limitPaise;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: a.threshold === 100 ? `${a.categoryName.charAt(0).toUpperCase()}${a.categoryName.slice(1)} budget used up` : `80% of your ${a.categoryName} budget used`,
            body:
              a.threshold === 100
                ? over > 0
                  ? `You're ${formatINR(over, { decimals: 'never' })} over your ${formatINR(a.limitPaise, { decimals: 'never' })} budget this month.`
                  : `You've spent your full ${formatINR(a.limitPaise, { decimals: 'never' })} for this month.`
                : `${formatINR(a.limitPaise - a.spentPaise, { decimals: 'never' })} left for the rest of the month.`,
            data: { url: '/budgets' },
          },
          trigger: Platform.OS === 'android' ? { channelId: CHANNEL_BUDGET } : null,
        });
      }
    }
    return fired;
  } catch (error) {
    console.warn('[alerts] budget check failed', error);
    return [];
  }
}

function at9am(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0);
}

async function scheduleRecap(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(RECAP_ID).catch(() => undefined);
  if (!(await getSetting('recapEnabled'))) return;
  const now = new Date();
  const fireAt = at9am(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });
  await Notifications.scheduleNotificationAsync({
    identifier: RECAP_ID,
    content: {
      title: `Your ${monthName} recap is ready`,
      body: 'See where your money went last month and how it compares.',
      data: { url: `/recap?month=${monthKey(now)}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: CHANNEL_REMINDERS,
    },
  });
}

async function scheduleBillReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(BILL_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined))
  );
  if (!(await getSetting('billRemindersEnabled'))) return;

  const now = Date.now();
  const items = await listRecurring();
  for (const r of items) {
    if (!r.remind || r.paidThisPeriod || r.daysUntilDue < 0 || r.daysUntilDue > 35) continue;
    const due = new Date(r.nextDueAt);
    const dayBefore = at9am(new Date(due.getFullYear(), due.getMonth(), due.getDate() - 1));
    const fireAt = dayBefore.getTime() > now ? dayBefore : at9am(due);
    if (fireAt.getTime() <= now) continue;
    const tomorrow = fireAt === dayBefore;
    await Notifications.scheduleNotificationAsync({
      identifier: `${BILL_PREFIX}${r.id}`,
      content: {
        title: `${r.name} is due ${tomorrow ? 'tomorrow' : 'today'}`,
        body: `${formatINR(r.amountPaise)} · ${r.category?.name ?? 'Recurring payment'}`,
        data: { url: '/recurring' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: CHANNEL_REMINDERS,
      },
    });
  }
}

/** Re-plans the recap and bill reminders. Safe to call often. */
export async function refreshScheduledNotifications(): Promise<void> {
  try {
    if ((await getPermission()) !== 'granted') return;
    await initNotifications();
    await scheduleRecap();
    await scheduleBillReminders();
  } catch (error) {
    console.warn('[alerts] scheduling failed', error);
  }
}

/** Route stored on a notification, if any. */
export function urlFromResponse(response: Notifications.NotificationResponse | null | undefined): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}
