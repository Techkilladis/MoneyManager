import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, space, swatches, tint } from '@/design/tokens';
import { Category } from '@/database/schema';
import { categoryService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { categoryEmojiChoices, categoryGlyph } from '@/domain/glyphs';
import {
  Button,
  Card,
  CategoryAvatar,
  Divider,
  Icon,
  IconButton,
  ListRow,
  LoadingView,
  ScreenHeader,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';

interface Draft {
  id: string | null;
  name: string;
  icon: string;
  color: string;
}

const fetchCategories = () => categoryService.getAll();

export default function CategoriesScreen() {
  const toast = useToast();
  const { data, reload } = useScreenData(fetchCategories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!data) return <LoadingView />;

  const open = (c?: Category) => {
    setError(null);
    setDraft(
      c
        ? { id: c.id, name: c.name, icon: categoryGlyph(c.icon), color: c.color ?? swatches[0] }
        : { id: null, name: '', icon: categoryEmojiChoices[0], color: swatches[data.length % (swatches.length - 1)] }
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const input = { name: draft.name, icon: draft.icon, color: draft.color };
    const result = draft.id ? await categoryService.update(draft.id, input) : await categoryService.create(input);
    setSaving(false);
    if (!result.success) return setError(result.error ?? 'Could not save');
    setDraft(null);
    dataEvents.emit();
    reload();
    toast.show(draft.id ? 'Category updated' : 'Category added');
  };

  const remove = () => {
    if (!draft?.id) return;
    const id = draft.id;
    Alert.alert('Delete category?', `"${draft.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await categoryService.delete(id);
          if (!result.success) {
            setError(result.error ?? 'Could not delete');
            return;
          }
          setDraft(null);
          dataEvents.emit();
          reload();
          toast.show('Category deleted', 'info');
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Categories" back right={<IconButton icon="plus" accessibilityLabel="Add category" onPress={() => open()} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {data.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider inset={72} /> : null}
              <ListRow title={c.name} left={<CategoryAvatar icon={c.icon} color={c.color} size={40} />} chevron onPress={() => open(c)} />
            </View>
          ))}
        </Card>
        <Button title="Add category" icon="plus" variant="secondary" fullWidth onPress={() => open()} style={{ marginTop: space.lg }} />
      </ScrollView>

      <Sheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit category' : 'New category'}
        footer={
          <View style={{ gap: space.xs }}>
            <Button title="Save" size="lg" fullWidth loading={saving} onPress={save} />
            {draft?.id ? <Button title="Delete category" variant="ghost" fullWidth onPress={remove} /> : null}
          </View>
        }
      >
        {draft ? (
          <>
            <View style={styles.preview}>
              <CategoryAvatar icon={draft.icon} color={draft.color} size={64} />
            </View>
            <TextField
              label="Name"
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder="e.g. Groceries"
              autoCapitalize="words"
              maxLength={24}
              error={error}
            />
            <Text variant="labelStrong" color={colors.textSecondary} style={styles.label}>
              Icon
            </Text>
            <View style={styles.wrap}>
              {categoryEmojiChoices.map((e) => {
                const selected = draft.icon === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => setDraft({ ...draft, icon: e })}
                    style={[styles.emoji, selected && { backgroundColor: tint(draft.color, 0.2), borderColor: draft.color }]}
                    accessibilityLabel={`Icon ${e}`}
                  >
                    <Text style={{ fontSize: 22, lineHeight: 28 }}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>
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
  emoji: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
