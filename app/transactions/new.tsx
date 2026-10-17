import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { TransactionForm } from '@/components/TransactionForm';
import { useToast } from '@/components/ui';
import { formatINR } from '@/utils/format';
import { haptic } from '@/utils/haptics';

export default function NewTransactionScreen() {
  const toast = useToast();
  const { kind } = useLocalSearchParams<{ kind?: string }>();

  return (
    <TransactionForm
      title="Add transaction"
      submitLabel="Save"
      autoFocusAmount
      smartDefaults
      initial={{ kind: kind === 'income' ? 'INCOME' : 'EXPENSE' }}
      onSubmit={async (values) => {
        await transactionService.createManualTransaction(values);
        dataEvents.emit();
        haptic.success();
        toast.show(
          values.kind === 'INCOME'
            ? `${formatINR(values.amountPaise)} from ${values.merchant} saved`
            : `${formatINR(values.amountPaise)} to ${values.merchant} saved`
        );
        router.back();
      }}
    />
  );
}
