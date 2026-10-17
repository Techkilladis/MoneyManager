import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { colors, space } from '@/design/tokens';
import { budgetService, categoryService } from '@/services';
import { dataEvents } from '@/services/events';
import { MonthlyBudgetView } from '@/services/budget';
import { useScreenData } from '@/hooks/useScreenData';
import { amountToInput, formatCompactINR, formatINR, parseAmount, sanitizeAmountInput } from '@/utils/format';
import { CategoryGrid } from '@/components/Pickers';
import {
  Button,
  Card,
  CategoryAvatar,
  EmptyState,
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
  const [budgets, categories] = await Promise.all([budgetService.getMonthlyBudgets(), categoryService.getAll()]);
  return { budgets, categories };
}

function statusColor(b: MonthlyBudgetView): string {
  if (b.status === 'EXCEEDED') return colors.negative;
  if (b.status === 'WARNING') return colors.warning;
  return colors.positive;
}

export default function BudgetsScreen() {
  const toast = useToast();
  const { data, reload } = useScreenData(fetchBudgets);
  const [editor, setEditor] = useState<{ budgetId: string | null; categoryId: string | null; amount: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openNew = useCallback(() => {
    setError(null);
    setEditor({ budgetId: null, categoryId: null, amount: '' });
  }, []);

  if (!data) return <LoadingView />;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1;
  const totalLimit = data.budgets.reduce((s, b) => s + b.budget.amountPaise, 0);
  const totalSpent = data.budgets.reduce((s, b) => s + b.spentPaise, 0);
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
    dataEvents.emit();
    reload();
    toast.show(editing ? 'Budget updated' : 'Budget created');
  };

  const remove = () => {
    if (!editing) return;
    Alert.alert('Remove budget?', `Stop tracking a monthly limit for ${editing.category?.name ?? 'this category'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await budgetService.deleteBudget(editing.budget.id);
          setEditor(null);
          dataEvents.emit();
          reload();
          toast.show('Budget removed', 'info');
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Budgets" back right={<IconButton icon="plus" accessibilityLabel="Add budget" onPress={openNew} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {data.budgets.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon="target"
              title="Set your first budget"
              message="Pick a category and a monthly limit. Budgets reset automatically every month."
              actionLabel="Create budget"
              onAction={openNew}
            />
          </Card>
        ) : (
          <>
            <Card style={styles.summary}>
              <Text variant="overline">{monthName} · {daysLeft} days left</Text>
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
                  ? `${formatINR(totalSpent - totalLimit)} over your combined budget`
                  : `${formatINR(totalLimit - totalSpent)} left · about ${formatCompactINR(Math.round((totalLimit - totalSpent) / daysLeft))} a day`}
              </Text>
            </Card>

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
                      <Text variant="labelStrong" color={statusColor(b)} numeric>
                        {b.percentageUsed}%
                      </Text>
                    </View>
                    <ProgressBar value={b.spentPaise / b.budget.amountPaise} color={statusColor(b)} />
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
            {editing ? <Button title="Remove budget" variant="ghost" fullWidth onPress={remove} /> : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  sheetLabel: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
});
