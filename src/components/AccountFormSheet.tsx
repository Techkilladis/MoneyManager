import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { radius, space, swatches } from '@/design/tokens';
import { makeStyles } from '@/design/theme';
import { Account, AccountType } from '@/database/schema';
import { accountIcon } from '@/domain/account';
import { accountBackfillService, accountService, transactionService } from '@/services';
import { haptic } from '@/utils/haptics';
import { Button, SegmentedControl, Sheet, Text, TextField, useToast } from '@/components/ui';

export interface AccountDraft {
  id: string | null;
  name: string;
  bankName: string;
  mask: string;
  type: AccountType;
  color: string;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CURRENT', label: 'Current' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'CASH', label: 'Cash' },
];

export interface AccountFormSheetProps {
  draft: AccountDraft | null;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void;
}

function AccountFormContent({
  initialDraft,
  accounts,
  onClose,
  onChanged,
}: {
  initialDraft: AccountDraft;
  accounts: Account[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const styles = useStyles();
  const toast = useToast();
  const [draft, setDraft] = useState<AccountDraft>(() => initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Please enter an account name');
      return;
    }

    setSaving(true);
    try {
      const bankName = draft.type === 'CASH' ? null : draft.bankName.trim() || null;
      const mask = draft.type === 'CASH' ? null : draft.mask.trim() || null;

      if (draft.id) {
        await accountService.update(draft.id, {
          name,
          bankName,
          mask,
          type: draft.type,
          color: draft.color,
          icon: accountIcon(draft.type),
        });
        if (mask) {
          await accountBackfillService.completeBackfillForAccount(bankName || undefined, mask, draft.id);
          await transactionService.assignAccountToPending(bankName || undefined, mask, draft.id);
        }
        toast.show('Account updated');
      } else {
        const created = await accountService.create({
          name,
          bankName,
          mask,
          type: draft.type,
          color: draft.color,
          icon: accountIcon(draft.type),
        });
        if (mask) {
          await accountBackfillService.completeBackfillForAccount(bankName || undefined, mask, created.id);
          await transactionService.assignAccountToPending(bankName || undefined, mask, created.id);
        }
        toast.show('Account added');
      }
      haptic.success();
      onClose();
      onChanged();
    } catch {
      setError('Could not save account');
    } finally {
      setSaving(false);
    }
  };

  const remove = (acc: Account) => {
    if (acc.isDefault || acc.type === 'CASH') {
      toast.show('The default cash account cannot be deleted');
      return;
    }

    Alert.alert(
      'Delete Account',
      `Are you sure you want to delete ${acc.name}? Existing transactions linked to this account will remain.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await accountService.delete(acc.id);
            haptic.warning();
            toast.show('Account deleted');
            onClose();
            onChanged();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.form}>
      <View style={{ marginBottom: space.sm }}>
        <Text variant="caption" style={{ marginBottom: space.xs }}>
          Account Type
        </Text>
        <SegmentedControl
          options={ACCOUNT_TYPES}
          value={draft.type}
          onChange={(t) => {
            setDraft((d) => ({ ...d, type: t as AccountType }));
          }}
        />
      </View>

      <TextField
        label="Account Name"
        placeholder={draft.type === 'CASH' ? 'Cash' : 'e.g. Salary Account or ICICI Bank ••172'}
        value={draft.name}
        onChangeText={(text) => {
          setError(null);
          setDraft((d) => ({ ...d, name: text }));
        }}
        error={error ?? undefined}
      />

      {draft.type !== 'CASH' && (
        <>
          <TextField
            label="Bank Name (optional)"
            placeholder="e.g. ICICI Bank, Indian Bank, HDFC"
            value={draft.bankName}
            onChangeText={(text) => {
              setDraft((d) => ({ ...d, bankName: text }));
            }}
          />

          <TextField
            label="Last digits / Mask (optional)"
            placeholder="e.g. 172 or 1224"
            value={draft.mask}
            keyboardType="numeric"
            onChangeText={(text) => {
              setDraft((d) => ({ ...d, mask: text.replace(/\D/g, '') }));
            }}
          />
        </>
      )}

      <View style={styles.colorSection}>
        <Text variant="caption" style={{ marginBottom: space.xs }}>
          Color
        </Text>
        <View style={styles.swatchRow}>
          {swatches.map((swatch) => {
            const selected = draft.color === swatch;
            return (
              <Pressable
                key={swatch}
                onPress={() => setDraft((d) => ({ ...d, color: swatch }))}
                style={[styles.swatch, { backgroundColor: swatch }, selected && styles.swatchSelected]}
              />
            );
          })}
        </View>
      </View>

      <Button
        title={draft.id ? 'Save changes' : 'Add account'}
        loading={saving}
        onPress={save}
        style={{ marginTop: space.sm }}
      />

      {draft.id && draft.type !== 'CASH' && (
        <Button
          title="Delete account"
          variant="ghost"
          onPress={() => {
            const acc = accounts.find((a) => a.id === draft.id);
            if (acc) remove(acc);
          }}
          style={{ marginTop: space.xs }}
        />
      )}
    </View>
  );
}

/** Add/Edit account bottom sheet with keyed form state. */
export function AccountFormSheet({ draft, accounts, onClose, onChanged }: AccountFormSheetProps) {
  return (
    <Sheet visible={draft !== null} onClose={onClose} title={draft?.id ? 'Edit account' : 'New account'}>
      {draft && (
        <AccountFormContent
          key={`${draft.id ?? 'new'}:${draft.bankName}:${draft.mask}`}
          initialDraft={draft}
          accounts={accounts}
          onClose={onClose}
          onChanged={onChanged}
        />
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  form: {
    gap: space.md,
    paddingBottom: space.lg,
  },
  colorSection: {
    marginTop: space.xs,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: colors.surface,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
}));
