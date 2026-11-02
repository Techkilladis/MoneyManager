import React, { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { inkOf, radius, space, swatches, tint } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Category, TransactionKind } from '@/database/schema';
import { haptic } from '@/utils/haptics';
import { categoryService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { categoryIcon, categoryIconChoices } from '@/domain/glyphs';
import {
  BottomBar,
  Button,
  Card,
  CategoryAvatar,
  Divider,
  Icon,
  IconName,
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
  icon: IconName;
  color: string;
}

const fetchCategories = () => categoryService.getAll();

const GRID_COLUMNS = 6;
const GRID_GAP = space.xs;

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { data, reload } = useScreenData(fetchCategories);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<TransactionKind>('EXPENSE');

  if (!data) return <LoadingView />;
  const visible = data.filter((c) => c.kind === kind);
  const cell = Math.floor((width - space.lg * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

  const open = (c?: Category) => {
    setError(null);
    setDraft(
      c
        ? { id: c.id, name: c.name, icon: categoryIcon(c.icon), color: c.color ?? swatches[0] }
        : { id: null, name: '', icon: categoryIconChoices[0], color: swatches[data.length % (swatches.length - 1)] }
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const input = { name: draft.name, icon: draft.icon, color: draft.color, kind };
    const result = draft.id ? await categoryService.update(draft.id, input) : await categoryService.create(input);
    setSaving(false);
    if (!result.success) return setError(result.error ?? 'Could not save');
    setDraft(null);
    haptic.success();
    dataEvents.emit();
    reload();
    toast.show(draft.id ? 'Category updated' : 'Category added');
  };

  const remove = async () => {
    if (!draft?.id) return;
    const original = data.find((c) => c.id === draft.id);
    const result = await categoryService.delete(draft.id);
    if (!result.success) {
      setError(result.error ?? 'Could not delete');
      return;
    }
    setDraft(null);
    haptic.warning();
    dataEvents.emit();
    reload();
    toast.show('Category deleted', 'info', original
      ? {
          label: 'Undo',
          onPress: () =>
            void categoryService.restore(original).then(() => {
              dataEvents.emit();
              reload();
            }),
        }
      : undefined);
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Categories" subtitle="Tap one to change its name, icon or colour" back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SegmentedControl
          options={[
            { value: 'EXPENSE' as TransactionKind, label: 'Expense' },
            { value: 'INCOME' as TransactionKind, label: 'Income' },
          ]}
          value={kind}
          onChange={setKind}
          style={{ marginBottom: space.lg }}
        />
        <Card padded={false}>
          {visible.map((c, i) => (
            <View key={c.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={c.name} left={<CategoryAvatar icon={c.icon} color={c.color} />} chevron onPress={() => open(c)} />
            </View>
          ))}
        </Card>
      </ScrollView>

      <BottomBar>
        <Button title="Add category" icon="plus" size="lg" fullWidth onPress={() => open()} />
      </BottomBar>

      <Sheet
        visible={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'Edit category' : kind === 'INCOME' ? 'New income category' : 'New category'}
        footer={
          <View style={{ gap: space.xs }}>
            <Button title="Save category" size="lg" fullWidth loading={saving} onPress={save} />
            {draft?.id ? <Button title="Delete category" variant="dangerSoft" fullWidth onPress={() => void remove()} /> : null}
          </View>
        }
      >
        {draft ? (
          <>
            {/* Live preview with the name field beside it */}
            <View style={styles.preview}>
              <CategoryAvatar icon={draft.icon} color={draft.color} size={64} />
              <TextField
                label="Name"
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                placeholder="e.g. Groceries"
                autoCapitalize="words"
                maxLength={24}
                error={error}
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Text variant="label" style={styles.label}>
              Icon
            </Text>
            <View style={styles.grid}>
              {categoryIconChoices.map((name) => {
                const selected = draft.icon === name;
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      haptic.select();
                      setDraft({ ...draft, icon: name });
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Icon ${name}`}
                    style={[
                      styles.iconCell,
                      { width: cell, height: cell, borderRadius: cell / 2 },
                      selected && { backgroundColor: tint(draft.color, 0.16), borderColor: inkOf(draft.color) },
                    ]}
                  >
                    <Icon name={name} size={22} color={selected ? inkOf(draft.color) : colors.textSecondary} />
                  </Pressable>
                );
              })}
            </View>

            <Text variant="label" style={styles.label}>
              Colour
            </Text>
            <View style={styles.grid}>
              {swatches.map((s) => {
                const selected = draft.color === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      haptic.select();
                      setDraft({ ...draft, color: s });
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Colour ${s}`}
                    style={[styles.swatchRing, { width: cell, height: cell, borderRadius: cell / 2 }, selected && { borderColor: s }]}
                  >
                    <View style={[styles.swatch, { backgroundColor: s, borderRadius: cell / 2 }]}>
                      {selected ? <Icon name="check" size={18} color="#FFFFFF" strokeWidth={3} /> : null}
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
    paddingTop: space.lg,
    paddingBottom: space.xxxl,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  iconCell: {
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRing: {
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  swatch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
