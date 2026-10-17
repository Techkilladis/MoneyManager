import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { memberService, recurringService, splitService, transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { CADENCE_LABEL, nextDueDate } from '@/services/recurring';
import { SplitShare } from '@/services/splits';
import { formatDayLabel, formatFullDate, formatINR, formatSourceApp, formatTime, splitINR } from '@/utils/format';
import { haptic } from '@/utils/haptics';
import { requestMoney } from '@/utils/requestMoney';
import { SplitSheet } from '@/components/SplitSheet';
import {
  Button,
  Card,
  CategoryAvatar,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  LoadingView,
  MemberAvatar,
  ScreenHeader,
  Text,
  UncategorizedAvatar,
  useToast,
} from '@/components/ui';

export default function TransactionDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const fetcher = useCallback(async () => {
    const tx = await transactionService.getFormattedTransaction(id);
    if (!tx) return { tx: null, splits: [], members: [], recurring: null };
    const [splits, members, recurring] = await Promise.all([
      splitService.getSplits(tx.id),
      memberService.getAll(),
      tx.kind === 'EXPENSE' ? recurringService.findRecurringForMerchant(tx.merchant) : Promise.resolve(null),
    ]);
    return { tx, splits, members, recurring };
  }, [id]);
  const { data, loading, reload } = useScreenData(fetcher);
  const tx = data?.tx;

  if (loading) return <LoadingView />;
  if (!tx || !data) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Transaction" back />
        <EmptyState icon="alert" title="Not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      </View>
    );
  }

  const income = tx.kind === 'INCOME';
  const isPending = tx.status === 'PENDING' && tx.is_pending_capture === 1 && tx.is_dismissed === 0;
  const [whole, fraction] = splitINR(tx.amountPaise);
  const source =
    tx.sourceType === 'UPI_NOTIFICATION'
      ? `Auto-captured from ${formatSourceApp(tx.sourceApp) ?? 'UPI'}`
      : tx.sourceType === 'SEED_DATA'
        ? 'Sample data'
        : 'Added manually';
  const canSplit = !income && !isPending;
  const owedOpen = data.splits.filter((s) => !s.settledAt).reduce((sum, s) => sum + s.sharePaise, 0);

  const remove = () => {
    setBusy(true);
    transactionService
      .deleteWithUndo(tx.id)
      .then((result) => {
        if (!result.success || !result.snapshot) throw new Error(result.error);
        const snapshot = result.snapshot;
        dataEvents.emit();
        haptic.warning();
        toast.show(income ? 'Income deleted' : 'Expense deleted', 'info', {
          label: 'Undo',
          onPress: () => {
            void transactionService.restoreTransaction(snapshot).then(() => {
              dataEvents.emit();
              toast.show('Restored');
            });
          },
        });
        router.back();
      })
      .catch(() => {
        setBusy(false);
        toast.show('Could not delete', 'error');
      });
  };

  const dismiss = () => {
    setBusy(true);
    transactionService
      .dismissTransaction(tx.id)
      .then((r) => {
        if (!r.success) throw new Error(r.error);
        dataEvents.emit();
        toast.show('Payment ignored', 'info');
        router.back();
      })
      .catch(() => {
        setBusy(false);
        toast.show('Could not dismiss', 'error');
      });
  };

  const saveSplit = async (shares: SplitShare[]) => {
    const result = await splitService.setSplits(tx.id, shares);
    if (!result.success) {
      toast.show(result.error ?? 'Could not save split', 'error');
      return;
    }
    setSplitOpen(false);
    haptic.success();
    dataEvents.emit();
    reload();
    toast.show(shares.length > 0 ? 'Split saved' : 'Split removed');
  };

  const toggleSettled = (splitId: string, settled: boolean) => {
    haptic.select();
    void splitService.setSplitSettled(splitId, settled).then(() => {
      dataEvents.emit();
      reload();
    });
  };

  const request = (name: string, amountPaise: number) => {
    void requestMoney({ name, amountPaise, forWhat: tx.merchant }).then((r) => {
      if (r === 'missing-upi') {
        Alert.alert('Add your UPI ID', 'Save your UPI ID once so friends can pay you back with one tap.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Add UPI ID', onPress: () => router.push('/members') },
        ]);
      }
    });
  };

  const recurringNext = data.recurring ? nextDueDate(data.recurring, tx.timestamp) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title=""
        back
        right={
          !isPending ? (
            <IconButton icon="pencil" accessibilityLabel="Edit" onPress={() => router.push(`/transactions/edit/${tx.id}`)} />
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {tx.category ? <CategoryAvatar icon={tx.category.icon} color={tx.category.color} size={72} /> : <UncategorizedAvatar size={72} />}
          <Text variant="heading" align="center" style={{ marginTop: space.md }}>
            {tx.merchant}
          </Text>
          <View style={styles.amountRow}>
            <Text variant="hero" numeric color={income ? colors.positive : undefined}>
              {income ? '+' : ''}
              {whole}
            </Text>
            <Text variant="heading" color={income ? colors.positive : colors.textTertiary} numeric style={{ marginBottom: 4 }}>
              {fraction}
            </Text>
          </View>
          <Text variant="label" align="center">
            {formatFullDate(tx.timestamp)} · {formatTime(tx.timestamp)}
          </Text>
          {isPending ? (
            <View style={[styles.pill, { backgroundColor: colors.warningSoft }]}>
              <Text variant="caption" color={colors.warning} style={{ fontWeight: '600' }}>
                Waiting for your review
              </Text>
            </View>
          ) : income ? (
            <View style={[styles.pill, { backgroundColor: colors.positiveSoft }]}>
              <Text variant="caption" color={colors.positive} style={{ fontWeight: '600' }}>
                Money received
              </Text>
            </View>
          ) : tx.sharedPaise > 0 ? (
            <View style={[styles.pill, { backgroundColor: colors.brandSoft }]}>
              <Text variant="caption" color={colors.brand} style={{ fontWeight: '600' }}>
                Your share {formatINR(tx.amountPaise - tx.sharedPaise)}
              </Text>
            </View>
          ) : null}
        </View>

        <Card padded={false}>
          <DetailRow label="Category">
            <Text variant="bodyStrong" color={tx.category ? colors.text : colors.textTertiary}>
              {tx.category?.name ?? 'Uncategorized'}
            </Text>
          </DetailRow>
          {!income ? (
            <>
              <Divider inset={space.md} />
              <DetailRow label="Spent on">
                {tx.member ? (
                  <View style={styles.inline}>
                    <MemberAvatar name={tx.member.name} color={tx.member.color} size={24} />
                    <Text variant="bodyStrong">{tx.member.name}</Text>
                  </View>
                ) : (
                  <Text variant="bodyStrong" color={colors.textTertiary}>
                    Not set
                  </Text>
                )}
              </DetailRow>
            </>
          ) : null}
          {tx.note ? (
            <>
              <Divider inset={space.md} />
              <DetailRow label="Note">
                <Text variant="body" style={styles.note}>
                  {tx.note}
                </Text>
              </DetailRow>
            </>
          ) : null}
          <Divider inset={space.md} />
          <DetailRow label="Source">
            <Text variant="body" color={colors.textSecondary} style={styles.note}>
              {source}
            </Text>
          </DetailRow>
        </Card>

        {canSplit && data.splits.length > 0 ? (
          <Card padded={false} style={{ marginTop: space.lg }}>
            <View style={styles.cardHead}>
              <Text variant="bodyStrong">Split</Text>
              <Text variant="caption">{owedOpen > 0 ? `${formatINR(owedOpen)} still owed` : 'All paid back'}</Text>
            </View>
            {data.splits.map((s) => (
              <View key={s.id}>
                <Divider inset={space.md} />
                <View style={styles.splitRow}>
                  <Pressable
                    onPress={() => toggleSettled(s.id, !s.settledAt)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!s.settledAt }}
                    accessibilityLabel={`${s.member?.name ?? 'Someone'} paid back`}
                    hitSlop={8}
                    style={[styles.check, s.settledAt ? { backgroundColor: colors.positive, borderColor: colors.positive } : null]}
                  >
                    {s.settledAt ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" color={s.settledAt ? colors.textTertiary : colors.text}>
                      {s.member?.name ?? 'Removed person'}
                    </Text>
                    <Text variant="caption">{s.settledAt ? `Paid back ${formatDayLabel(s.settledAt)}` : 'Owes you'}</Text>
                  </View>
                  <Text variant="bodyStrong" numeric color={s.settledAt ? colors.textTertiary : colors.text}>
                    {formatINR(s.sharePaise)}
                  </Text>
                  {!s.settledAt && s.member ? (
                    <IconButton
                      icon="send"
                      size={36}
                      background={colors.brandSoft}
                      color={colors.brand}
                      accessibilityLabel={`Ask ${s.member.name} to pay back`}
                      onPress={() => request(s.member!.name, s.sharePaise)}
                    />
                  ) : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {data.recurring && recurringNext ? (
          <Card style={{ marginTop: space.lg }} onPress={() => router.push('/recurring')}>
            <View style={styles.inline}>
              <Icon name="repeat" size={18} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{CADENCE_LABEL[data.recurring.cadence]} payment</Text>
                <Text variant="caption">Next one around {formatFullDate(recurringNext)}</Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textDisabled} />
            </View>
          </Card>
        ) : null}

        <View style={styles.actions}>
          {isPending ? (
            <>
              <Button title="Review payment" icon="check" size="lg" fullWidth onPress={() => router.push(`/quick-capture?id=${tx.id}`)} />
              <Button title="Ignore payment" variant="ghost" fullWidth disabled={busy} onPress={dismiss} />
            </>
          ) : (
            <>
              {canSplit ? (
                <View style={styles.actionRow}>
                  <Button
                    title={data.splits.length > 0 ? 'Edit split' : 'Split'}
                    icon="split"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => setSplitOpen(true)}
                  />
                  {!data.recurring ? (
                    <Button
                      title="Recurring"
                      icon="repeat"
                      variant="secondary"
                      style={{ flex: 1 }}
                      onPress={() => router.push(`/recurring?fromTx=${tx.id}`)}
                    />
                  ) : null}
                </View>
              ) : null}
              <Button
                title={income ? 'Edit income' : 'Edit expense'}
                icon="pencil"
                variant="outline"
                size="lg"
                fullWidth
                onPress={() => router.push(`/transactions/edit/${tx.id}`)}
              />
              <Button title="Delete" icon="trash" variant="dangerSoft" size="lg" fullWidth loading={busy} onPress={remove} />
            </>
          )}
        </View>
      </ScrollView>

      <SplitSheet
        visible={splitOpen}
        onClose={() => setSplitOpen(false)}
        amountPaise={tx.amountPaise}
        members={data.members}
        initial={data.splits.map((s) => ({ memberId: s.memberId, sharePaise: s.sharePaise }))}
        onSave={saveSplit}
        onManagePeople={() => {
          setSplitOpen(false);
          router.push('/members');
        }}
      />
    </View>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Text variant="label" color={colors.textTertiary}>
        {label}
      </Text>
      <View style={styles.detailValue}>{children}</View>
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
  hero: {
    alignItems: 'center',
    paddingTop: space.xs,
    paddingBottom: space.xl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: space.xxs,
    marginBottom: space.xxs,
  },
  pill: {
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.md,
  },
  detailValue: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  note: {
    textAlign: 'right',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: space.sm,
    marginTop: space.xl,
  },
  actionRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
}));
