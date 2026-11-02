import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { radius, space, swatches } from '@/design/tokens';
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
  BottomBar,
  Button,
  Card,
  Divider,
  Icon,
  IconTile,
  KeyFigure,
  ListRow,
  LoadingView,
  MemberAvatar,
  ScreenHeader,
  SectionTitle,
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

  const openUpi = () => {
    setUpiError(null);
    setUpiDraft({ id: loaded.upi.upiId, name: loaded.upi.upiName });
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="People & splits" subtitle="Who an expense was for, and who owes you" back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loaded.balances.length > 0 ? (
          <>
            <KeyFigure
              label="Owed to you"
              value={formatINR(totalOwed, { decimals: 'never' })}
              color={colors.positive}
              style={styles.figure}
            >
              <Text variant="caption" style={{ marginTop: space.xxs }}>
                From {pluralize(loaded.balances.reduce((s, b) => s + b.items.length, 0), 'split expense')}
              </Text>
            </KeyFigure>
            <Card padded={false} style={styles.section}>
              {loaded.balances.map((b, i) => (
                <View key={b.member.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.owedRow}>
                    <View style={styles.inline}>
                      <MemberAvatar name={b.member.name} color={b.member.color} />
                      <View style={{ flex: 1 }}>
                        <Text variant="body">{b.member.name}</Text>
                        <Text variant="caption" numberOfLines={1}>
                          {b.items.slice(0, 2).map((x) => x.merchant).join(', ')}
                          {b.items.length > 2 ? ` +${b.items.length - 2}` : ''}
                        </Text>
                      </View>
                      <Text variant="bodyStrong" numeric>
                        {formatINR(b.owedPaise, { decimals: 'never' })}
                      </Text>
                    </View>
                    <View style={styles.owedActions}>
                      <Button title="Request" icon="send" size="sm" onPress={() => request(b)} />
                      <Button title="Settled" icon="check" variant="secondary" size="sm" onPress={() => void settle(b)} />
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <View style={loaded.balances.length > 0 ? styles.section : styles.firstSection}>
          <SectionTitle title="People" />
          <Card padded={false}>
            {data.map((m, i) => {
              const owed = owedById.get(m.id);
              return (
                <View key={m.id}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow
                    title={m.name}
                    left={<MemberAvatar name={m.name} color={m.color} />}
                    value={owed ? `owes ${formatINR(owed.owedPaise, { decimals: 'never' })}` : undefined}
                    chevron
                    onPress={() => open(m)}
                  />
                </View>
              );
            })}
          </Card>
          <Text variant="caption" style={{ marginTop: space.sm }}>
            Split any expense from its detail screen.
          </Text>
        </View>

        <Card padded={false} style={styles.section}>
          <ListRow
            title="Your UPI ID"
            subtitle={loaded.upi.upiId ? `${loaded.upi.upiId} · used in requests` : 'Add it so friends can pay you back in one tap'}
            left={<IconTile icon="qrCode" />}
            chevron
            onPress={openUpi}
          />
        </Card>
      </ScrollView>

      <BottomBar>
        <Button title="Add person" icon="plus" size="lg" fullWidth onPress={() => open()} />
      </BottomBar>

      <Sheet
        visible={upiDraft !== null}
        onClose={() => setUpiDraft(null)}
        title="Your UPI ID"
        footer={<Button title="Save" size="lg" fullWidth onPress={() => void saveUpi()} />}
      >
        {upiDraft ? (
          <>
            <Text variant="label" style={{ marginBottom: space.md }}>
              Used in &quot;pay me back&quot; requests. It&apos;s only shared when you send one.
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
            {draft?.id ? <Button title="Remove person" variant="dangerSoft" fullWidth onPress={remove} /> : null}
          </View>
        }
      >
        {draft ? (
          <>
            <View style={styles.preview}>
              <MemberAvatar name={draft.name || '?'} color={draft.color} size={64} />
              <TextField
                label="Name"
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                placeholder="e.g. Sister"
                autoCapitalize="words"
                maxLength={24}
                error={error}
                containerStyle={{ flex: 1 }}
              />
            </View>
            <Text variant="label" style={styles.label}>
              Colour
            </Text>
            <View style={styles.wrap}>
              {swatches.map((s) => {
                const selected = draft.color === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setDraft({ ...draft, color: s })}
                    style={[styles.swatchRing, selected && { borderColor: s }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Colour ${s}`}
                  >
                    <View style={[styles.swatch, { backgroundColor: s }]}>
                      {selected ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </Pressable>
                );
              })}
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
    paddingBottom: space.xxxl,
  },
  figure: {
    paddingTop: space.xl,
  },
  section: {
    marginTop: space.xxl,
  },
  firstSection: {
    marginTop: space.lg,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  owedRow: {
    padding: space.md,
  },
  owedActions: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.sm,
    marginLeft: 52,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  label: {
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  swatchRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  swatch: {
    flex: 1,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
