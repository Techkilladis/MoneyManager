import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, space, swatches } from '@/design/tokens';
import { Member } from '@/database/schema';
import { memberService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
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

const fetchMembers = () => memberService.getAll();

export default function MembersScreen() {
  const toast = useToast();
  const { data, reload } = useScreenData(fetchMembers);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!data) return <LoadingView />;

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
        <Text variant="label" style={styles.intro}>
          Track who each expense was for — yourself, family or friends you pay for.
        </Text>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {data.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider inset={72} /> : null}
              <ListRow title={m.name} left={<MemberAvatar name={m.name} color={m.color} size={40} />} chevron onPress={() => open(m)} />
            </View>
          ))}
        </Card>
        <Button title="Add person" icon="plus" variant="secondary" fullWidth onPress={() => open()} style={{ marginTop: space.lg }} />
      </ScrollView>

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

const styles = StyleSheet.create({
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
});
