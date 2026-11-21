import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { space } from '@/design/tokens';
import { makeStyles } from '@/design/theme';
import { Account, AccountType } from '@/database/schema';
import { accountIcon } from '@/domain/account';
import { accountBackfillService, accountService, transactionService } from '@/services';
import { Button, SegmentedControl, Sheet, Text, TextField, useToast } from '@/components/ui';

const SWATCHES = [
  '#0A84FF', // blue
  '#30B0C7', // teal
  '#34C759', // green
  '#FF9F0A', // orange
  '#FF375F', // red/pink
  '#AF52DE', // purple
  '#64D2FF', // sky
  '#8E8E93', // slate
];

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'CURRENT', label: 'Current' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
];

export interface DiscoveredAccountData {
  bankName: string;
  mask: string;
}

export interface AccountDiscoveryModalProps {
  visible: boolean;
  initialData: DiscoveredAccountData | null;
  onClose: () => void;
  onSaved: (account: Account) => void;
}

function buildInitialDraft(initialData: DiscoveredAccountData) {
  const bank = initialData.bankName ?? '';
  const mask = initialData.mask ?? '';
  return {
    name: bank ? `${bank}` : `Account ••${mask}`,
    bankName: bank,
    mask,
    type: 'SAVINGS' as AccountType,
    color: SWATCHES[0],
  };
}

function AccountDiscoveryForm({
  initialData,
  onClose,
  onSaved,
}: {
  initialData: DiscoveredAccountData;
  onClose: () => void;
  onSaved: (account: Account) => void;
}) {
  const styles = useStyles();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() => buildInitialDraft(initialData));

  const handleSave = async () => {
    setSaving(true);
    try {
      const created = await accountService.create({
        name: draft.name.trim() || draft.bankName || 'Account',
        bankName: draft.bankName.trim() || undefined,
        mask: draft.mask.trim() || undefined,
        type: draft.type,
        color: draft.color,
        icon: accountIcon(draft.type),
      });

      if (draft.mask.trim()) {
        await accountBackfillService.completeBackfillForAccount(
          draft.bankName.trim() || undefined,
          draft.mask.trim(),
          created.id
        );
      } else {
        await transactionService.assignAccountToPending(
          draft.bankName,
          draft.mask,
          created.id
        );
      }

      toast.show(`${created.name} added`);
      onSaved(created);
      onClose();
    } catch {
      toast.show('Could not save account', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.discoveryForm}>
      <Text variant="caption" style={styles.discoveryIntro}>
        We detected a new account from your SMS notification. Set it up once to automatically assign this and future transactions.
      </Text>

      <View style={{ marginBottom: space.sm }}>
        <Text variant="caption" style={{ marginBottom: space.xs }}>
          Account Type
        </Text>
        <SegmentedControl
          options={ACCOUNT_TYPES}
          value={draft.type}
          onChange={(type) => setDraft((d) => ({ ...d, type }))}
        />
      </View>

      <TextField
        label="Account Name"
        placeholder="e.g. ICICI Salary, Indian Bank Savings"
        value={draft.name}
        onChangeText={(text) => setDraft((d) => ({ ...d, name: text }))}
      />

      <TextField
        label="Bank Name"
        placeholder="e.g. ICICI Bank, Indian Bank"
        value={draft.bankName}
        onChangeText={(text) => setDraft((d) => ({ ...d, bankName: text }))}
      />

      <TextField
        label="Account / Card Mask (last digits)"
        placeholder="e.g. 172 or 1224"
        value={draft.mask}
        keyboardType="numeric"
        onChangeText={(text) => setDraft((d) => ({ ...d, mask: text.replace(/\D/g, '') }))}
      />

      <View style={styles.colorSection}>
        <Text variant="caption" style={{ marginBottom: space.xs }}>
          Color
        </Text>
        <View style={styles.swatchRow}>
          {SWATCHES.map((swatch) => {
            const selected = draft.color === swatch;
            return (
              <Pressable
                key={swatch}
                onPress={() => setDraft((d) => ({ ...d, color: swatch }))}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch },
                  selected && styles.swatchSelected,
                ]}
              />
            );
          })}
        </View>
      </View>

      <Button
        title="Save account"
        loading={saving}
        onPress={handleSave}
        style={{ marginTop: space.md }}
      />
    </View>
  );
}

export function AccountDiscoveryModal({
  visible,
  initialData,
  onClose,
  onSaved,
}: AccountDiscoveryModalProps) {
  return (
    <Sheet visible={visible && !!initialData} onClose={onClose} title="New Account Discovered">
      {initialData && (
        <AccountDiscoveryForm
          key={`${initialData.bankName}-${initialData.mask}`}
          initialData={initialData}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  discoveryForm: {
    paddingBottom: space.lg,
  },
  discoveryIntro: {
    color: colors.textSecondary,
    marginBottom: space.md,
  },
  colorSection: {
    marginTop: space.xs,
    marginBottom: space.sm,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.text,
  },
}));
