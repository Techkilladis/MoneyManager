import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radius, space } from '@/design/tokens';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { formatFullDate, formatINR, formatSourceApp, formatTime, splitINR } from '@/utils/format';
import {
  Button,
  Card,
  CategoryAvatar,
  Divider,
  EmptyState,
  IconButton,
  LoadingView,
  MemberAvatar,
  ScreenHeader,
  Text,
  UncategorizedAvatar,
  useToast,
} from '@/components/ui';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const fetcher = useCallback(async () => ({ tx: await transactionService.getFormattedTransaction(id) }), [id]);
  const { data, loading } = useScreenData(fetcher);
  const tx = data?.tx;

  if (loading) return <LoadingView />;
  if (!tx) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Expense" back />
        <EmptyState icon="alert" title="Expense not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      </View>
    );
  }

  const isPending = tx.status === 'PENDING' && tx.is_pending_capture === 1 && tx.is_dismissed === 0;
  const [whole, fraction] = splitINR(tx.amountPaise);
  const source =
    tx.sourceType === 'UPI_NOTIFICATION'
      ? `Auto-captured from ${formatSourceApp(tx.sourceApp) ?? 'UPI'}`
      : tx.sourceType === 'SEED_DATA'
        ? 'Sample data'
        : 'Added manually';

  const remove = () => {
    Alert.alert('Delete this expense?', `${formatINR(tx.amountPaise)} to ${tx.merchant} will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          transactionService
            .deleteTransaction(tx.id)
            .then(() => {
              dataEvents.emit();
              toast.show('Expense deleted');
              router.back();
            })
            .catch(() => {
              setBusy(false);
              toast.show('Could not delete', 'error');
            });
        },
      },
    ]);
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
            <Text variant="hero" numeric>
              {whole}
            </Text>
            <Text variant="heading" color={colors.textTertiary} numeric style={{ marginBottom: 4 }}>
              {fraction}
            </Text>
          </View>
          <Text variant="label" align="center">
            {formatFullDate(tx.timestamp)} · {formatTime(tx.timestamp)}
          </Text>
          {isPending ? (
            <View style={styles.pendingPill}>
              <Text variant="caption" color={colors.warning} style={{ fontWeight: '600' }}>
                Waiting for your review
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

        <View style={styles.actions}>
          {isPending ? (
            <>
              <Button title="Review payment" icon="check" size="lg" fullWidth onPress={() => router.push(`/quick-capture?id=${tx.id}`)} />
              <Button title="Ignore payment" variant="ghost" fullWidth disabled={busy} onPress={dismiss} />
            </>
          ) : (
            <>
              <Button title="Edit expense" icon="pencil" variant="secondary" size="lg" fullWidth onPress={() => router.push(`/transactions/edit/${tx.id}`)} />
              <Button title="Delete" icon="trash" variant="dangerSoft" size="lg" fullWidth loading={busy} onPress={remove} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="label" color={colors.textTertiary}>
        {label}
      </Text>
      <View style={styles.detailValue}>{children}</View>
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
  pendingPill: {
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
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
    gap: space.xs,
  },
  note: {
    textAlign: 'right',
  },
  actions: {
    gap: space.sm,
    marginTop: space.xl,
  },
});
