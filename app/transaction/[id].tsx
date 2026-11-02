import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { space } from '@/design/tokens';
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
  IconTile,
  ListRow,
  LoadingView,
  MemberAvatar,
  ScreenHeader,
  SectionTitle,
  StatusChip,
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
          {tx.category ? <CategoryAvatar icon={tx.category.icon} color={tx.category.color} size={64} /> : <UncategorizedAvatar size={64} />}
          <Text variant="title" align="center" style={{ marginTop: space.md }}>
            {tx.merchant}
          </Text>
          <View style={styles.amountRow}>
            <Text variant="hero" numeric color={income ? colors.positive : undefined}>
              {income ? '+' : '−'}
              {whole}
            </Text>
            <Text variant="title" color={income ? colors.positive : colors.textTertiary} numeric>
              {fraction}
            </Text>
          </View>
          <Text variant="label" align="center">
            {formatFullDate(tx.timestamp)} · {formatTime(tx.timestamp)}
          </Text>
          <View style={styles.pill}>
            {isPending ? (
              <StatusChip tone="warn" icon="clock" label="Waiting for your review" />
            ) : income ? (
              <StatusChip tone="good" icon="arrowDownLeft" label="Money received" />
            ) : tx.sharedPaise > 0 ? (
              <StatusChip tone="good" icon="split" label={`Your share ${formatINR(tx.amountPaise - tx.sharedPaise)}`} />
            ) : null}
          </View>
        </View>

        <Card padded={false}>
          <DetailRow label="Category">
            <View style={styles.inline}>
              {tx.category ? <CategoryAvatar icon={tx.category.icon} color={tx.category.color} size={28} /> : null}
              <Text variant="body" color={tx.category ? colors.text : colors.textTertiary}>
                {tx.category?.name ?? 'Uncategorized'}
              </Text>
            </View>
          </DetailRow>
          {!income ? (
            <>
              <Divider />
              <DetailRow label="For">
                {tx.member ? (
                  <View style={styles.inline}>
                    <MemberAvatar name={tx.member.name} color={tx.member.color} size={28} />
                    <Text variant="body">{tx.member.name}</Text>
                  </View>
                ) : (
                  <Text variant="body" color={colors.textTertiary}>
                    Not set
                  </Text>
                )}
              </DetailRow>
            </>
          ) : null}
          {tx.note ? (
            <>
              <Divider />
              <DetailRow label="Note">
                <Text variant="body" style={styles.note}>
                  {tx.note}
                </Text>
              </DetailRow>
            </>
          ) : null}
          <Divider />
          <DetailRow label="Source">
            <Text variant="body" color={colors.textSecondary} style={styles.note}>
              {source}
            </Text>
          </DetailRow>
        </Card>

        {canSplit && data.splits.length > 0 ? (
          <View style={styles.section}>
            <SectionTitle
              title="Split"
              right={
                <Text variant="labelStrong" numeric color={owedOpen > 0 ? colors.positive : colors.textTertiary}>
                  {owedOpen > 0 ? `${formatINR(owedOpen)} still owed` : 'All paid back'}
                </Text>
              }
            />
          <Card padded={false}>
            {data.splits.map((s, i) => (
              <View key={s.id}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.splitRow}>
                  <Pressable
                    onPress={() => toggleSettled(s.id, !s.settledAt)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!s.settledAt }}
                    accessibilityLabel={`${s.member?.name ?? 'Someone'} paid back`}
                    hitSlop={8}
                    style={[styles.check, s.settledAt ? { backgroundColor: colors.positive, borderColor: colors.positive } : null]}
                  >
                    {s.settledAt ? <Icon name="check" size={14} color={colors.textOnBrand} strokeWidth={3} /> : null}
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
                      size={40}
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
          </View>
        ) : null}

        {data.recurring && recurringNext ? (
          <Card padded={false} style={styles.section}>
            <ListRow
              title={`${CADENCE_LABEL[data.recurring.cadence]} payment`}
              subtitle={`Next one around ${formatFullDate(recurringNext)}`}
              left={<IconTile icon="repeat" />}
              chevron
              onPress={() => router.push('/recurring')}
            />
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
              {!canSplit ? (
                <Button
                  title={income ? 'Edit income' : 'Edit expense'}
                  icon="pencil"
                  variant="secondary"
                  fullWidth
                  onPress={() => router.push(`/transactions/edit/${tx.id}`)}
                />
              ) : null}
              <Button title={income ? 'Delete income' : 'Delete expense'} icon="trash" variant="dangerSoft" fullWidth loading={busy} onPress={remove} />
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
    paddingBottom: space.xxl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: space.xs,
    marginBottom: space.xxs,
  },
  pill: {
    marginTop: space.sm,
  },
  section: {
    marginTop: space.xxl,
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
    flex: 1,
    minWidth: 0,
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
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: space.sm,
    marginTop: space.xxl,
  },
  actionRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
}));
