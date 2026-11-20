import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { radius, space, swatches } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Account, AccountType } from '@/database/schema';
import { accountService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { haptic } from '@/utils/haptics';
import {
  BottomBar,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  IconName,
  IconTile,
  ListRow,
  LoadingView,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';

interface Draft {
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

function accountIcon(type: AccountType): IconName {
  switch (type) {
    case 'CREDIT_CARD':
      return 'creditCard';
    case 'CASH':
      return 'wallet';
    case 'SAVINGS':
    case 'CURRENT':
    default:
      return 'landmark';
  }
}

function formatAccountType(type: AccountType): string {
  switch (type) {
    case 'SAVINGS':
      return 'Savings Account';
    case 'CURRENT':
      return 'Current Account';
    case 'CREDIT_CARD':
      return 'Credit Card';
    case 'CASH':
      return 'Cash';
  }
}

export default function AccountsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { data: accounts, reload } = useScreenData(() => accountService.getAll());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!accounts) return <LoadingView />;

  const open = (acc?: Account) => {
    setError(null);
    if (acc) {
      setDraft({
        id: acc.id,
        name: acc.name,
        bankName: acc.bankName ?? '',
        mask: acc.mask ?? '',
        type: acc.type,
        color: acc.color ?? swatches[0],
      });
    } else {
      setDraft({
        id: null,
        name: '',
        bankName: '',
        mask: '',
        type: 'SAVINGS',
        color: swatches[accounts.length % (swatches.length - 1)],
      });
    }
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setError('Please enter an account name');
      return;
    }

    setSaving(true);
    try {
      if (draft.id) {
        await accountService.update(draft.id, {
          name,
          bankName: draft.type === 'CASH' ? null : draft.bankName.trim() || null,
          mask: draft.type === 'CASH' ? null : draft.mask.trim() || null,
          type: draft.type,
          color: draft.color,
          icon: accountIcon(draft.type),
        });
        toast.show('Account updated');
      } else {
        await accountService.create({
          name,
          bankName: draft.type === 'CASH' ? null : draft.bankName.trim() || null,
          mask: draft.type === 'CASH' ? null : draft.mask.trim() || null,
          type: draft.type,
          color: draft.color,
          icon: accountIcon(draft.type),
        });
        toast.show('Account added');
      }
      haptic.success();
      setDraft(null);
      reload();
    } catch (err) {
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
            setDraft(null);
            reload();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Accounts" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" style={styles.intro}>
          Accounts represent your bank accounts, credit cards, and cash funding sources.
        </Text>

        <Card padded={false}>
          {accounts.map((acc, index) => {
            const icon = accountIcon(acc.type);
            const subtitle = acc.type === 'CASH'
              ? 'Physical Cash'
              : `${formatAccountType(acc.type)}${acc.bankName ? ` • ${acc.bankName}` : ''}${acc.mask ? ` ••${acc.mask}` : ''}`;

            return (
              <React.Fragment key={acc.id}>
                {index > 0 && <Divider />}
                <ListRow
                  title={acc.name}
                  subtitle={subtitle}
                  left={<IconTile icon={icon} color={acc.color ?? colors.brand} />}
                  right={
                    acc.mask ? (
                      <Chip label={`••${acc.mask}`} />
                    ) : undefined
                  }
                  chevron
                  onPress={() => open(acc)}
                />
              </React.Fragment>
            );
          })}
        </Card>
      </ScrollView>

      <BottomBar>
        <Button title="Add account" icon="plus" onPress={() => open()} />
      </BottomBar>

      <Sheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit account' : 'New account'}
      >
        {draft && (
          <View style={styles.form}>
            <View style={{ marginBottom: space.sm }}>
              <Text variant="caption" style={{ marginBottom: space.xs }}>
                Account Type
              </Text>
              <SegmentedControl
                options={ACCOUNT_TYPES}
                value={draft.type}
                onChange={(t) => {
                  setDraft((d) => (d ? { ...d, type: t as AccountType } : null));
                }}
              />
            </View>

            <TextField
              label="Account Name"
              placeholder={draft.type === 'CASH' ? 'Cash' : 'e.g. Salary Account or ICICI Bank ••172'}
              value={draft.name}
              onChangeText={(text) => {
                setError(null);
                setDraft((d) => (d ? { ...d, name: text } : null));
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
                    setDraft((d) => (d ? { ...d, bankName: text } : null));
                  }}
                />

                <TextField
                  label="Last digits / Mask (optional)"
                  placeholder="e.g. 172 or 1224"
                  value={draft.mask}
                  keyboardType="numeric"
                  onChangeText={(text) => {
                    setDraft((d) => (d ? { ...d, mask: text.replace(/\D/g, '') } : null));
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
                      onPress={() => setDraft((d) => (d ? { ...d, color: swatch } : null))}
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
        )}
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: space.lg,
    paddingBottom: 100,
  },
  intro: {
    color: colors.textSecondary,
    marginBottom: space.md,
  },
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
