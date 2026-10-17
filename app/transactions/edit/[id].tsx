import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { TransactionForm } from '@/components/TransactionForm';
import { EmptyState, LoadingView, ScreenHeader, useToast } from '@/components/ui';
import { useTheme } from '@/design/theme';
import { amountToInput } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function EditTransactionScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  // Wrapped so a missing transaction (null) still counts as loaded.
  const fetcher = useCallback(async () => ({ tx: await transactionService.getFormattedTransaction(id) }), [id]);
  const { data, loading } = useScreenData(fetcher);
  const tx = data?.tx;

  if (loading) return <LoadingView />;
  if (!tx) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Edit transaction" back />
        <EmptyState icon="alert" title="Expense not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      </View>
    );
  }

  return (
    <TransactionForm
      // Remount when switching between transactions so the form re-seeds.
      key={tx.id}
      title={tx.kind === 'INCOME' ? 'Edit income' : 'Edit expense'}
      submitLabel="Save changes"
      initial={{
        amountText: amountToInput(tx.amountPaise),
        merchant: tx.merchant,
        categoryId: tx.category?.id ?? null,
        memberId: tx.member?.id ?? null,
        note: tx.note,
        transactionTimestamp: tx.timestamp,
        kind: tx.kind,
      }}
      onSubmit={async (values) => {
        await transactionService.editTransaction(tx.id, values);
        dataEvents.emit();
        haptic.success();
        toast.show('Changes saved');
        router.back();
      }}
    />
  );
}
