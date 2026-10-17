import React from 'react';
import { router } from 'expo-router';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { TransactionForm } from '@/components/TransactionForm';
import { useToast } from '@/components/ui';
import { formatINR } from '@/utils/format';

export default function NewTransactionScreen() {
  const toast = useToast();

  return (
    <TransactionForm
      title="Add expense"
      submitLabel="Save expense"
      autoFocusAmount
      smartDefaults
      onSubmit={async (values) => {
        await transactionService.createManualTransaction(values);
        dataEvents.emit();
        toast.show(`${formatINR(values.amountPaise)} to ${values.merchant} saved`);
        router.back();
      }}
    />
  );
}
