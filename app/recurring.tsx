/**
 * Recurring payments: what's due soon, the monthly cost of subscriptions,
 * payments that look recurring (detected from history), and an editor.
 * Opened with `?fromTx=<id>` it starts a new entry from that expense.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { RecurringCadence } from '@/database/schema';
import { categoryService, recurringService, transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { refreshScheduledNotifications } from '@/services/alerts';
import { addCadence, CADENCE_LABEL, monthlyEquivalent, RecurringCandidate, RecurringView } from '@/services/recurring';
import { useScreenData } from '@/hooks/useScreenData';
import { amountToInput, formatFullDate, formatINR, parseAmount, pluralize, sanitizeAmountInput } from '@/utils/format';
import { haptic } from '@/utils/haptics';
import { DateTimeSheet } from '@/components/DateTimeSheet';
import { CategoryGrid } from '@/components/Pickers';
import {
  BottomBar,
  Button,
  Card,
  CategoryAvatar,
  Divider,
  EmptyState,
  Icon,
  KeyFigure,
  LoadingView,
  ScreenHeader,
  SectionTitle,
  SegmentedControl,
  Sheet,
  Switch,
  Text,
  TextField,
  UncategorizedAvatar,
  useToast,
} from '@/components/ui';

const CADENCES: { value: RecurringCadence; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: '3 months' },
  { value: 'YEARLY', label: 'Yearly' },
];

interface Draft {
  id: string | null;
  name: string;
  amount: string;
  cadence: RecurringCadence;
  categoryId: string | null;
  due: Date;
  remind: boolean;
}

async function fetchRecurring() {
  const [items, candidates, categories] = await Promise.all([
    recurringService.listRecurring(),
    recurringService.detectCandidates(),
    categoryService.getAll(),
  ]);
  return { items, candidates, categories: categories.filter((c) => c.kind === 'EXPENSE') };
}

function dueLabel(r: RecurringView): string {
  if (r.paidThisPeriod && r.daysUntilDue > 0) return `Paid · next ${formatFullDate(r.nextDueAt)}`;
  if (r.daysUntilDue < 0) return `Was due ${pluralize(-r.daysUntilDue, 'day')} ago`;
  if (r.daysUntilDue === 0) return 'Due today';
  if (r.daysUntilDue === 1) return 'Due tomorrow';
  if (r.daysUntilDue <= 7) return `Due in ${r.daysUntilDue} days`;
  return `Due ${formatFullDate(r.nextDueAt)}`;
}

export default function RecurringScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { fromTx } = useLocalSearchParams<{ fromTx?: string }>();
  const { data, reload } = useScreenData(fetchRecurring);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const seeded = useRef(false);

  // Prefill from an expense ("Recurring" on the detail screen).
  useEffect(() => {
    if (!fromTx || seeded.current) return;
    seeded.current = true;
    transactionService
      .getFormattedTransaction(fromTx)
      .then((tx) => {
        if (!tx) return;
        setDraft({
          id: null,
          name: tx.merchant,
          amount: amountToInput(tx.amountPaise),
          cadence: 'MONTHLY',
          categoryId: tx.category?.id ?? null,
          due: new Date(addCadence(tx.timestamp, 'MONTHLY')),
          remind: true,
        });
      })
      .catch(() => undefined);
  }, [fromTx]);

  const changed = useCallback(() => {
    dataEvents.emit();
    reload();
    void refreshScheduledNotifications();
  }, [reload]);

  if (!data) return <LoadingView />;

  const monthly = data.items.reduce((sum, r) => sum + monthlyEquivalent(r.amountPaise, r.cadence), 0);
  const dueSoon = data.items.filter((r) => !r.paidThisPeriod && r.daysUntilDue <= 7);

  const openNew = () => {
    setError(null);
    setDraft({ id: null, name: '', amount: '', cadence: 'MONTHLY', categoryId: null, due: new Date(), remind: true });
  };

  const openEdit = (r: RecurringView) => {
    setError(null);
    setDraft({
      id: r.id,
      name: r.name,
      amount: amountToInput(r.amountPaise),
      cadence: r.cadence,
      categoryId: r.categoryId,
      due: new Date(r.nextDueAt),
      remind: r.remind,
    });
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const input = {
      name: draft.name,
      merchant: draft.name,
      amountPaise: parseAmount(draft.amount) ?? 0,
      cadence: draft.cadence,
      categoryId: draft.categoryId,
      anchorDate: draft.due.getTime(),
      remind: draft.remind,
    };
    const result = draft.id ? await recurringService.updateRecurring(draft.id, input) : await recurringService.addRecurring(input);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? 'Could not save');
      return;
    }
    haptic.success();
    setDraft(null);
    changed();
    toast.show(draft.id ? 'Recurring payment updated' : 'Recurring payment added');
  };

  const remove = async () => {
    if (!draft?.id) return;
    const row = await recurringService.deleteRecurring(draft.id);
    setDraft(null);
    changed();
    haptic.warning();
    if (row) {
      toast.show('Recurring payment removed', 'info', {
        label: 'Undo',
        onPress: () => void recurringService.restoreRecurring(row).then(changed),
      });
    }
  };

  const accept = async (c: RecurringCandidate) => {
    const result = await recurringService.acceptCandidate(c);
    if (!result.success) {
      toast.show(result.error ?? 'Could not add', 'error');
      return;
    }
    haptic.success();
    changed();
    toast.show(`${c.name} added`);
  };

  const ignore = async (c: RecurringCandidate) => {
    await recurringService.ignoreCandidate(c.merchantKey);
    reload();
  };

  const categoryFor = (id: string | null) => data.categories.find((c) => c.id === id) ?? null;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Recurring" subtitle="Rent, subscriptions and bills" back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {data.items.length > 0 ? (
          <KeyFigure label="Every month" value={formatINR(monthly, { decimals: 'never' })} style={styles.figure}>
            <Text variant="caption" style={{ marginTop: space.xxs }}>
              {pluralize(data.items.length, 'payment')}
              {dueSoon.length > 0 ? ` · ${dueSoon.length} due this week` : ' · reminders the day before'}
            </Text>
          </KeyFigure>
        ) : null}

        {data.candidates.length > 0 ? (
          <View style={styles.block}>
            <SectionTitle title="Looks recurring" />
            <Card padded={false} style={styles.suggestions}>
              {data.candidates.map((c, i) => {
                const cat = categoryFor(c.categoryId);
                return (
                  <View key={c.merchantKey}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.candidate}>
                      <View style={styles.rowTop}>
                        {cat ? <CategoryAvatar icon={cat.icon} color={cat.color} /> : <UncategorizedAvatar />}
                        <View style={{ flex: 1 }}>
                          <Text variant="body" numberOfLines={1}>
                            {c.name}
                          </Text>
                          <Text variant="caption" numeric>
                            {formatINR(c.amountPaise, { decimals: 'never' })} · {CADENCE_LABEL[c.cadence].toLowerCase()} · paid {c.occurrences} times
                          </Text>
                        </View>
                      </View>
                      <View style={styles.candidateActions}>
                        <Button title="Track it" icon="plus" size="sm" onPress={() => void accept(c)} />
                        <Button title="Not recurring" variant="secondary" size="sm" onPress={() => void ignore(c)} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {data.items.length === 0 && data.candidates.length === 0 ? (
          <EmptyState
            icon="repeat"
            title="No recurring payments yet"
            message="Track rent, subscriptions and recharges to see what's due and get a reminder the day before."
          />
        ) : null}

        {data.items.length > 0 ? (
          <View style={styles.block}>
            <SectionTitle title="Upcoming" />
            <Card padded={false}>
              {data.items.map((r, i) => {
                const soon = !r.paidThisPeriod && r.daysUntilDue <= 3;
                return (
                  <View key={r.id}>
                    {i > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => openEdit(r)}
                      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceMuted }]}
                      accessibilityRole="button"
                    >
                      {r.category ? <CategoryAvatar icon={r.category.icon} color={r.category.color} /> : <UncategorizedAvatar />}
                      <View style={{ flex: 1 }}>
                        <Text variant="body" numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text
                          variant={soon || r.paidThisPeriod ? 'labelStrong' : 'caption'}
                          color={soon ? colors.warning : r.paidThisPeriod ? colors.positive : undefined}
                        >
                          {dueLabel(r)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text variant="bodyStrong" numeric color={r.paidThisPeriod ? colors.textTertiary : colors.text}>
                          {formatINR(r.amountPaise, { decimals: 'never' })}
                        </Text>
                        <Text variant="caption">{CADENCE_LABEL[r.cadence]}</Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </Card>
            <Text variant="caption" style={{ marginTop: space.sm }}>
              Paying one moves it to the next due date automatically.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomBar>
        <Button title="Add recurring payment" icon="plus" size="lg" fullWidth onPress={openNew} />
      </BottomBar>

      <Sheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit recurring payment' : 'New recurring payment'}
        footer={
          <View style={{ gap: space.xs }}>
            <Button title="Save" size="lg" fullWidth loading={saving} onPress={save} />
            {draft?.id ? <Button title="Remove" variant="ghost" fullWidth onPress={() => void remove()} /> : null}
          </View>
        }
      >
        {draft ? (
          <>
            <TextField
              label="Name (as it appears in payments)"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder="Netflix, Rent, Jio recharge…"
              autoCapitalize="words"
              error={error}
            />
            <TextField
              label="Amount"
              value={draft.amount}
              onChangeText={(t) => setDraft({ ...draft, amount: sanitizeAmountInput(t) })}
              keyboardType="decimal-pad"
              placeholder="0"
              icon="wallet"
              containerStyle={{ marginTop: space.md }}
            />
            <Text variant="label" style={styles.label}>
              Repeats
            </Text>
            <SegmentedControl options={CADENCES} value={draft.cadence} onChange={(cadence) => setDraft({ ...draft, cadence })} />
            <Text variant="label" style={styles.label}>
              Next due
            </Text>
            <Pressable
              onPress={() => setShowDate(true)}
              style={({ pressed }) => [styles.dateRow, pressed && { backgroundColor: colors.surfaceMuted }]}
              accessibilityRole="button"
            >
              <Icon name="calendar" size={18} color={colors.textTertiary} />
              <Text variant="body" style={{ flex: 1 }}>
                {formatFullDate(draft.due.getTime())}
              </Text>
              <Text variant="labelStrong" color={colors.brand}>
                Change
              </Text>
            </Pressable>
            <View style={styles.remindRow}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Remind me</Text>
                <Text variant="caption">A notification the day before it's due.</Text>
              </View>
              <Switch value={draft.remind} onValueChange={(remind) => setDraft({ ...draft, remind })} />
            </View>
            <Text variant="label" style={styles.label}>
              Category
            </Text>
            <CategoryGrid categories={data.categories} value={draft.categoryId} onChange={(categoryId) => setDraft({ ...draft, categoryId })} />
          </>
        ) : null}
      </Sheet>

      {draft ? (
        <DateTimeSheet
          visible={showDate}
          value={draft.due}
          maxDate={new Date(new Date().getFullYear() + 2, 11, 31)}
          onClose={() => setShowDate(false)}
          onChange={(due) => setDraft({ ...draft, due })}
        />
      ) : null}
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
    paddingBottom: space.xxxl,
  },
  figure: {
    paddingTop: space.xl,
  },
  block: {
    marginTop: space.xxl,
  },
  // Suggestions sit on a moss wash: they're proposals, not records.
  suggestions: {
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  candidate: {
    padding: space.md,
    gap: space.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  candidateActions: {
    flexDirection: 'row',
    gap: space.xs,
    marginLeft: 52,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  label: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 56,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  remindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
}));
