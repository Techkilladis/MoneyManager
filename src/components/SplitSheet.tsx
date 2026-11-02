// "Split with…" editor: pick people, split equally (with or without you) or
// enter each share. Your share is whatever is left of the amount.
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Member } from '@/database/schema';
import { equalShares, SELF_MEMBER_ID, SplitShare, validateShares } from '@/services/splits';
import { amountToInput, formatINR, parseAmount, sanitizeAmountInput } from '@/utils/format';
import { Button, Chip, MemberAvatar, SegmentedControl, Sheet, Switch, Text, TextField } from './ui';

interface Props {
  visible: boolean;
  onClose: () => void;
  amountPaise: number;
  members: Member[];
  initial: SplitShare[];
  onSave: (shares: SplitShare[]) => Promise<void>;
  onManagePeople: () => void;
}

export function SplitSheet(props: Props) {
  // Remount per opening so the editor re-seeds from the saved split.
  if (!props.visible) return null;
  return <SplitEditor {...props} />;
}

function SplitEditor({ visible, onClose, amountPaise, members, initial, onSave, onManagePeople }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const people = members.filter((m) => m.id !== SELF_MEMBER_ID);
  const initialIsEqual = useMemo(() => {
    if (initial.length === 0) return true;
    const ids = initial.map((s) => s.memberId);
    const asEqual = equalShares(amountPaise, ids, true);
    return asEqual.every((s, i) => s.sharePaise === initial[i]?.sharePaise);
  }, [initial, amountPaise]);

  const [selected, setSelected] = useState<string[]>(initial.map((s) => s.memberId));
  const [mode, setMode] = useState<'equal' | 'custom'>(initialIsEqual ? 'equal' : 'custom');
  const [includeMe, setIncludeMe] = useState(true);
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((s) => [s.memberId, amountToInput(s.sharePaise)]))
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const shares: SplitShare[] =
    mode === 'equal'
      ? equalShares(amountPaise, selected, includeMe)
      : selected.map((id) => ({ memberId: id, sharePaise: parseAmount(custom[id] ?? '') ?? 0 }));
  const othersTotal = shares.reduce((s, x) => s + x.sharePaise, 0);
  const mine = amountPaise - othersTotal;

  const toggle = (id: string) => {
    setError(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    const problem = selected.length === 0 ? null : validateShares(amountPaise, shares);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await onSave(selected.length === 0 ? [] : shares);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Split this expense"
      footer={
        <Button
          title={selected.length === 0 ? (initial.length > 0 ? 'Remove split' : 'Done') : 'Save split'}
          size="lg"
          fullWidth
          loading={saving}
          onPress={save}
        />
      }
    >
      <Text variant="label">
        Total {formatINR(amountPaise)}. Only your share counts towards your spending; the rest is owed to you.
      </Text>

      <Text variant="label" style={styles.label}>
        Split with
      </Text>
      {people.length === 0 ? (
        <Button title="Add people first" variant="secondary" icon="users" onPress={onManagePeople} />
      ) : (
        <View style={styles.wrap}>
          {people.map((m) => (
            <Chip key={m.id} label={m.name} color={m.color} selected={selected.includes(m.id)} onPress={() => toggle(m.id)} />
          ))}
          <Chip label="Add person" icon="plus" onPress={onManagePeople} />
        </View>
      )}

      {selected.length > 0 ? (
        <>
          <SegmentedControl
            options={[
              { value: 'equal' as const, label: 'Equally' },
              { value: 'custom' as const, label: 'Custom amounts' },
            ]}
            value={mode}
            onChange={(m) => {
              setError(null);
              if (m === 'custom') {
                // Start custom amounts from the equal split.
                const eq = equalShares(amountPaise, selected, includeMe);
                setCustom(Object.fromEntries(eq.map((s) => [s.memberId, amountToInput(s.sharePaise)])));
              }
              setMode(m);
            }}
            style={{ marginTop: space.lg }}
          />

          {mode === 'equal' ? (
            <View style={styles.meRow}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Include me</Text>
                <Text variant="caption">Turn off if you paid entirely for others.</Text>
              </View>
              <Switch value={includeMe} onValueChange={setIncludeMe} />
            </View>
          ) : null}

          <View style={{ marginTop: space.md, gap: space.sm }}>
            {selected.map((id) => {
              const m = members.find((x) => x.id === id);
              if (!m) return null;
              const share = shares.find((s) => s.memberId === id)?.sharePaise ?? 0;
              return (
                <View key={id} style={styles.personRow}>
                  <MemberAvatar name={m.name} color={m.color} size={32} />
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {m.name}
                  </Text>
                  {mode === 'equal' ? (
                    <Text variant="bodyStrong" numeric>
                      {formatINR(share)}
                    </Text>
                  ) : (
                    <TextField
                      value={custom[id] ?? ''}
                      onChangeText={(t) => {
                        setError(null);
                        setCustom((c) => ({ ...c, [id]: sanitizeAmountInput(t) }));
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      containerStyle={{ width: 120 }}
                      accessibilityLabel={`${m.name}'s share`}
                    />
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.mine}>
            <Text variant="label">Your share</Text>
            <Text variant="heading" numeric color={mine < 0 ? colors.negative : colors.text}>
              {formatINR(Math.max(0, mine))}
            </Text>
          </View>
        </>
      ) : null}

      {error ? (
        <Text variant="label" color={colors.negative} style={{ marginTop: space.sm }}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => ({
  label: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  meRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.md,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
  },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
}));
