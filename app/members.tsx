import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { space, swatches } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Member } from '@/database/schema';
import { memberService, splitService } from '@/services';
import { dataEvents } from '@/services/events';
import { getSettings, setSetting } from '@/services/settings';
import { isValidUpiId, MemberBalance } from '@/services/splits';
import { useScreenData } from '@/hooks/useScreenData';
import { formatINR, pluralize } from '@/utils/format';
import { haptic } from '@/utils/haptics';
import { requestMoney } from '@/utils/requestMoney';
import {
  Button,
  Card,
  Divider,
  Icon,
  IconButton,
  ListRow,
  LoadingView,
  MemberAvatar,
  ScreenHeader,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';

interface Draft {
  id: string | null;
  name: string;
  color: string;
}

async function fetchMembers() {
  const [members, balances, upi] = await Promise.all([
    memberService.getAll(),
    splitService.getBalances(),
    getSettings(['upiId', 'upiName']),
  ]);
  return { members, balances, upi };
}

export default function MembersScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { data: loaded, reload } = useScreenData(fetchMembers);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [upiDraft, setUpiDraft] = useState<{ id: string; name: string } | null>(null);
  const [upiError, setUpiError] = useState<string | null>(null);

  if (!loaded) return <LoadingView />;
  const data = loaded.members;
  const owedById = new Map(loaded.balances.map((b) => [b.member.id, b]));
  const totalOwed = loaded.balances.reduce((s, b) => s + b.owedPaise, 0);

  const saveUpi = async () => {
    if (!upiDraft) return;
    const id = upiDraft.id.trim();
    if (id && !isValidUpiId(id)) {
      setUpiError('That doesn\'t look like a UPI ID (for example name@okicici)');
      return;
    }
    await setSetting('upiId', id);
    await setSetting('upiName', upiDraft.name.trim());
    setUpiDraft(null);
    haptic.success();
    reload();
    toast.show(id ? 'UPI ID saved' : 'UPI ID removed');
  };

  const request = (b: MemberBalance) => {
    const forWhat = b.items.length === 1 ? b.items[0].merchant : undefined;
    void requestMoney({ name: b.member.name, amountPaise: b.owedPaise, forWhat }).then((r) => {
      if (r === 'missing-upi') {
        setUpiError(null);
        setUpiDraft({ id: '', name: loaded.upi.upiName });
      }
    });
  };

  const settle = async (b: MemberBalance) => {
    const ids = await splitService.settleMember(b.member.id);
    haptic.success();
    dataEvents.emit();
    reload();
    toast.show(`${b.member.name} is settled up`, 'success', {
      label: 'Undo',
      onPress: () =>
        void splitService.unsettleSplits(ids).then(() => {
          dataEvents.emit();
          reload();
        }),
    });
  };

  const open = (m?: Member) => {
    setError(null);
    setDraft(
      m
        ? { id: m.id, name: m.name, color: m.color ?? swatches[4] }
        : { id: null, name: '', color: swatches[(data.length * 5) % swatches.length] }
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const input = { name: draft.name, color: draft.color };
    const result = draft.id ? await memberService.update(draft.id, input) : await memberService.create(input);
    setSaving(false);
    if (!result.success) return setError(result.error ?? 'Could not save');
    setDraft(null);
    dataEvents.emit();
    reload();
    toast.show(draft.id ? 'Saved' : `${draft.name.trim()} added`);
  };

  const remove = () => {
    if (!draft?.id) return;
    const id = draft.id;
    Alert.alert('Remove person?', `"${draft.name}" will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await memberService.delete(id);
          if (!result.success) {
            setError(result.error ?? 'Could not remove');
            return;
          }
          setDraft(null);
          dataEvents.emit();
          reload();
          toast.show('Removed', 'info');
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="People" back right={<IconButton icon="plus" accessibilityLabel="Add person" onPress={() => open()} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loaded.balances.length > 0 ? (
          <>
            <View style={styles.owedHead}>
              <Text variant="heading">Owed to you</Text>
              <Text variant="bodyStrong" numeric color={colors.positive}>
                {formatINR(totalOwed)}
              </Text>
            </View>
            <Card padded={false} style={{ overflow: 'hidden', marginBottom: space.xl }}>
              {loaded.balances.map((b, i) => (
                <View key={b.member.id}>
                  {i > 0 ? <Divider inset={space.md} /> : null}
                  <View style={styles.owedRow}>
                    <MemberAvatar name={b.member.name} color={b.member.color} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{b.member.name}</Text>
                      <Text variant="caption" numberOfLines={1}>
                        {pluralize(b.items.length, 'expense')} · {b.items.slice(0, 2).map((x) => x.merchant).join(', ')}
                      </Text>
                    </View>
                    <Text variant="bodyStrong" numeric>
                      {formatINR(b.owedPaise)}
                    </Text>
                  </View>
                  <View style={styles.owedActions}>
                    <Button title="Settled" icon="check" variant="ghost" size="sm" onPress={() => void settle(b)} />
                    <Button title="Request" icon="send" variant="secondary" size="sm" onPress={() => request(b)} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <Text variant="label" style={styles.intro}>
          Track who each expense was for, and split bills with friends from any expense.
        </Text>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {data.map((m, i) => {
            const owed = owedById.get(m.id);
            return (
              <View key={m.id}>
                {i > 0 ? <Divider inset={72} /> : null}
                <ListRow
                  title={m.name}
                  subtitle={owed ? `Owes you ${formatINR(owed.owedPaise)}` : undefined}
                  left={<MemberAvatar name={m.name} color={m.color} size={40} />}
                  chevron
                  onPress={() => open(m)}
                />
              </View>
            );
          })}
        </Card>

        <Card style={{ marginTop: space.xl }} onPress={() => {
          setUpiError(null);
          setUpiDraft({ id: loaded.upi.upiId, name: loaded.upi.upiName });
        }}>
          <View style={styles.upiRow}>
            <View style={styles.upiIcon}>
              <Icon name="wallet" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Your UPI ID</Text>
              <Text variant="caption">
                {loaded.upi.upiId ? loaded.upi.upiId : 'Add it so friends can pay you back in one tap'}
              </Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textDisabled} />
          </View>
        </Card>
        <Button title="Add person" icon="plus" variant="secondary" fullWidth onPress={() => open()} style={{ marginTop: space.lg }} />
      </ScrollView>

      <Sheet
        visible={upiDraft !== null}
        onClose={() => setUpiDraft(null)}
        title="Your UPI ID"
        footer={<Button title="Save" size="lg" fullWidth onPress={() => void saveUpi()} />}
      >
        {upiDraft ? (
          <>
            <Text variant="label" style={{ marginBottom: space.md }}>
              Used in "pay me back" requests. It's only shared when you send one.
            </Text>
            <TextField
              label="UPI ID"
              value={upiDraft.id}
              onChangeText={(id) => {
                setUpiError(null);
                setUpiDraft({ ...upiDraft, id });
              }}
              placeholder="yourname@okicici"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={upiError}
            />
            <TextField
              label="Name shown to payers (optional)"
              value={upiDraft.name}
              onChangeText={(name) => setUpiDraft({ ...upiDraft, name })}
              placeholder="Your name"
              autoCapitalize="words"
              containerStyle={{ marginTop: space.md }}
            />
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit person' : 'Add person'}
        footer={
          <View style={{ gap: space.xs }}>
            <Button title="Save" size="lg" fullWidth loading={saving} onPress={save} />
            {draft?.id ? <Button title="Remove" variant="ghost" fullWidth onPress={remove} /> : null}
          </View>
        }
      >
        {draft ? (
          <>
            <View style={styles.preview}>
              <MemberAvatar name={draft.name || '?'} color={draft.color} size={64} />
            </View>
            <TextField
              label="Name"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder="e.g. Sister"
              autoCapitalize="words"
              maxLength={24}
              error={error}
            />
            <Text variant="labelStrong" color={colors.textSecondary} style={styles.label}>
              Colour
            </Text>
            <View style={styles.wrap}>
              {swatches.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setDraft({ ...draft, color: s })}
                  style={[styles.swatch, { backgroundColor: s }]}
                  accessibilityLabel={`Colour ${s}`}
                >
                  {draft.color === s ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} /> : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
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
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxxl,
  },
  intro: {
    marginBottom: space.md,
    marginHorizontal: space.xxs,
  },
  owedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.sm,
    marginHorizontal: space.xxs,
  },
  owedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  owedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  upiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  upiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    alignItems: 'center',
    marginBottom: space.md,
  },
  label: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
