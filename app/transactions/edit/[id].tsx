import React, { useCallback } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { TransactionForm } from '@/components/TransactionForm';
import { EmptyState, LoadingView, ScreenHeader, useToast } from '@/components/ui';
import { colors } from '@/design/tokens';
import { amountToInput } from '@/utils/format';

export default function EditTransactionScreen() {
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
        <ScreenHeader title="Edit expense" back />
        <EmptyState icon="alert" title="Expense not found" message="It may have been deleted." actionLabel="Go back" onAction={() => router.back()} />
      </View>
    );
  }

  return (
    <TransactionForm
      // Remount when switching between transactions so the form re-seeds.
      key={tx.id}
      title="Edit expense"
      submitLabel="Save changes"
      initial={{
        amountText: amountToInput(tx.amountPaise),
        merchant: tx.merchant,
        categoryId: tx.category?.id ?? null,
        memberId: tx.member?.id ?? null,
        note: tx.note,
        transactionTimestamp: tx.timestamp,
      }}
      onSubmit={async (values) => {
        await transactionService.editTransaction(tx.id, values);
        dataEvents.emit();
        toast.show('Changes saved');
        router.back();
      }}
    />
  );
}
