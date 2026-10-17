import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { space } from '@/design/tokens';
import type { Palette } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { alertsService, budgetService, categoryService, ledgerService } from '@/services';
import { dataEvents } from '@/services/events';
import { MonthlyBudgetView } from '@/services/budget';
import { getSetting, setSetting } from '@/services/settings';
import { haptic } from '@/utils/haptics';
import { useScreenData } from '@/hooks/useScreenData';
import { amountToInput, formatCompactINR, formatINR, parseAmount, sanitizeAmountInput } from '@/utils/format';
import { CategoryGrid } from '@/components/Pickers';
import {
  Button,
  Card,
  CategoryAvatar,
  EmptyState,
  Icon,
  IconButton,
  LoadingView,
  ProgressBar,
  ScreenHeader,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';

async function fetchBudgets() {
  const month = ledgerService.monthBounds();
  const [budgets, categories, overall, spent] = await Promise.all([
    budgetService.getMonthlyBudgets(),
    categoryService.getAll(),
    getSetting('overallBudgetPaise'),
    ledgerService.sumBetween(month.start, month.end),
  ]);
  return { budgets, categories: categories.filter((c) => c.kind === 'EXPENSE'), overall, monthSpent: spent.total };
}

function statusColor(b: MonthlyBudgetView, colors: Palette): string {
  if (b.status === 'EXCEEDED') return colors.negative;
  if (b.status === 'WARNING') return colors.warning;
  return colors.positive;
}

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { data, reload } = useScreenData(fetchBudgets);
  const [editor, setEditor] = useState<{ budgetId: string | null; categoryId: string | null; amount: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [overallDraft, setOverallDraft] = useState<string | null>(null);

  const openNew = useCallback(() => {
    setError(null);
    setEditor({ budgetId: null, categoryId: null, amount: '' });
  }, []);

  if (!data) return <LoadingView />;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const hasOverall = data.overall > 0;
  const totalLimit = hasOverall ? data.overall : data.budgets.reduce((s, b) => s + b.budget.amountPaise, 0);
  const totalSpent = hasOverall ? data.monthSpent : data.budgets.reduce((s, b) => s + b.spentPaise, 0);
  const budgetedIds = new Set(data.budgets.map((b) => b.budget.categoryId));
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });

  const editing = editor?.budgetId ? data.budgets.find((b) => b.budget.id === editor.budgetId) : null;
  const pickable = editing
    ? data.categories.filter((c) => c.id === editing.budget.categoryId)
    : data.categories.filter((c) => !budgetedIds.has(c.id));

  const save = async () => {
    if (!editor) return;
    const amountPaise = parseAmount(editor.amount);
    if (!editor.categoryId) return setError('Choose a category');
    if (!amountPaise) return setError('Enter a monthly amount');
    setSaving(true);
    const result = await budgetService.upsertMonthlyBudget(editor.categoryId, amountPaise);
    setSaving(false);
    if (!result.success) return setError(result.error ?? 'Could not save budget');
    setEditor(null);
    haptic.success();
    dataEvents.emit();
    reload();
    void alertsService.checkBudgetAlerts();
    toast.show(editing ? 'Budget updated' : 'Budget created');
  };

  const remove = async () => {
    if (!editing) return;
    const { categoryId, amountPaise } = editing.budget;
    await budgetService.deleteBudget(editing.budget.id);
    setEditor(null);
    haptic.warning();
    dataEvents.emit();
    reload();
    toast.show('Budget removed', 'info', {
      label: 'Undo',
      onPress: () =>
        void budgetService.upsertMonthlyBudget(categoryId, amountPaise).then(() => {
          dataEvents.emit();
          reload();
        }),
    });
  };

  const saveOverall = async (remove = false) => {
    const paise = remove ? 0 : parseAmount(overallDraft ?? '') ?? 0;
    if (!remove && paise <= 0) return setError('Enter a monthly amount');
    const previous = data.overall;
    await setSetting('overallBudgetPaise', paise);
    setOverallDraft(null);
    haptic[remove ? 'warning' : 'success']();
    dataEvents.emit();
    reload();
    if (!remove) void alertsService.checkBudgetAlerts();
    toast.show(
      remove ? 'Monthly budget removed' : 'Monthly budget saved',
      remove ? 'info' : 'success',
      remove
        ? {
            label: 'Undo',
            onPress: () => void setSetting('overallBudgetPaise', previous).then(() => reload()),
          }
        : undefined
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Budgets" back right={<IconButton icon="plus" accessibilityLabel="Add budget" onPress={openNew} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!hasOverall ? (
          <Card
            style={{ marginBottom: space.lg }}
            onPress={() => {
              setError(null);
              setOverallDraft('');
            }}
          >
            <View style={styles.budgetTop}>
              <View style={styles.overallIcon}>
                <Icon name="wallet" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Set a monthly spending budget</Text>
                <Text variant="caption">One limit for everything you spend in a month.</Text>
              </View>
              <Icon name="plus" size={18} color={colors.brand} />
            </View>
          </Card>
        ) : null}

        {data.budgets.length === 0 && !hasOverall ? (
          <Card>
            <EmptyState
              compact
              icon="target"
              title="Budget by category"
              message="Pick a category and a monthly limit. Budgets reset automatically every month."
              actionLabel="Create budget"
              onAction={openNew}
            />
          </Card>
        ) : (
          <>
            <Card
              style={styles.summary}
              onPress={
                hasOverall
                  ? () => {
                      setError(null);
                      setOverallDraft(amountToInput(data.overall));
                    }
                  : undefined
              }
            >
              <Text variant="overline">
                {hasOverall ? 'Monthly budget' : 'Category budgets'} · {monthName} · {daysLeft} days left
              </Text>
              <View style={styles.summaryRow}>
                <Text variant="title" numeric>
                  {formatINR(totalSpent, { decimals: 'never' })}
                </Text>
                <Text variant="label" numeric>
                  of {formatINR(totalLimit, { decimals: 'never' })}
                </Text>
              </View>
              <ProgressBar
                value={totalLimit ? totalSpent / totalLimit : 0}
                color={totalSpent > totalLimit ? colors.negative : colors.brand}
                height={10}
              />
              <Text variant="caption" style={{ marginTop: space.xs }}>
                {totalSpent > totalLimit
                  ? `${formatINR(totalSpent - totalLimit)} over your ${hasOverall ? 'monthly' : 'combined'} budget`
                  : `${formatINR(totalLimit - totalSpent)} left · about ${formatCompactINR(Math.round((totalLimit - totalSpent) / daysLeft))} a day`}
              </Text>
            </Card>

            {hasOverall && data.budgets.length === 0 ? (
              <Button title="Add a category budget" icon="plus" variant="secondary" fullWidth onPress={openNew} style={{ marginTop: space.lg }} />
            ) : null}

            <View style={{ gap: space.sm, marginTop: space.lg }}>
              {data.budgets.map((b) => {
                const over = b.spentPaise > b.budget.amountPaise;
                return (
                  <Card
                    key={b.budget.id}
                    onPress={() => {
                      setError(null);
                      setEditor({ budgetId: b.budget.id, categoryId: b.budget.categoryId, amount: amountToInput(b.budget.amountPaise) });
                    }}
                  >
                    <View style={styles.budgetTop}>
                      <CategoryAvatar icon={b.category?.icon} color={b.category?.color} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{b.category?.name ?? b.budget.name}</Text>
                        <Text variant="caption" numeric>
                          {formatINR(b.spentPaise, { decimals: 'never' })} of {formatINR(b.budget.amountPaise, { decimals: 'never' })}
                        </Text>
                      </View>
                      <Text variant="labelStrong" color={statusColor(b, colors)} numeric>
                        {b.percentageUsed}%
                      </Text>
                    </View>
                    <ProgressBar value={b.spentPaise / b.budget.amountPaise} color={statusColor(b, colors)} />
                    <Text variant="caption" color={over ? colors.negative : colors.textTertiary} style={{ marginTop: space.xs }}>
                      {over ? `${formatINR(-b.remainingPaise)} over` : `${formatINR(b.remainingPaise)} left`}
                    </Text>
                  </Card>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Sheet
        visible={editor !== null}
        onClose={() => setEditor(null)}
        title={editing ? 'Edit budget' : 'New budget'}
        subtitle="Resets at the start of every month"
        footer={
          <View style={{ gap: space.xs }}>
            <Button title={editing ? 'Save budget' : 'Create budget'} size="lg" fullWidth loading={saving} onPress={save} />
            {editing ? <Button title="Remove budget" variant="ghost" fullWidth onPress={() => void remove()} /> : null}
          </View>
        }
      >
        {editor ? (
          <>
            <TextField
              label="Monthly limit"
              value={editor.amount}
              onChangeText={(t) => setEditor({ ...editor, amount: sanitizeAmountInput(t) })}
              keyboardType="decimal-pad"
              placeholder="5000"
              right={<Text variant="label">₹ / month</Text>}
            />
            <Text variant="labelStrong" color={colors.textSecondary} style={styles.sheetLabel}>
              Category
            </Text>
            {pickable.length === 0 ? (
              <Text variant="label">Every category already has a budget.</Text>
            ) : (
              <CategoryGrid
                categories={pickable}
                value={editor.categoryId}
                onChange={(id) => (editing ? undefined : setEditor({ ...editor, categoryId: id }))}
              />
            )}
            {error ? (
              <Text variant="label" color={colors.negative} style={{ marginTop: space.sm }}>
                {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={overallDraft !== null}
        onClose={() => setOverallDraft(null)}
        title="Monthly budget"
        subtitle="Covers all spending and resets every month"
        footer={
          <View style={{ gap: space.xs }}>
            <Button title="Save" size="lg" fullWidth onPress={() => void saveOverall()} />
            {hasOverall ? <Button title="Remove monthly budget" variant="ghost" fullWidth onPress={() => void saveOverall(true)} /> : null}
          </View>
        }
      >
        {overallDraft !== null ? (
          <>
            <TextField
              label="Monthly limit"
              value={overallDraft}
              onChangeText={(t) => {
                setError(null);
                setOverallDraft(sanitizeAmountInput(t));
              }}
              keyboardType="decimal-pad"
              placeholder="30000"
              right={<Text variant="label">₹ / month</Text>}
              error={error}
              autoFocus
            />
            <Text variant="caption" style={{ marginTop: space.sm }}>
              You'll get an alert at 80% and when it's used up.
            </Text>
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxxl,
  },
  summary: {
    padding: space.lg,
    gap: space.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    marginBottom: space.xxs,
  },
  budgetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  overallIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetLabel: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
}));
