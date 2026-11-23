import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Category, Member } from '@/database/schema';
import { CategoryAvatar, Chip, Icon, MemberAvatar, Text } from './ui';

/** Four-column grid of category badges. Tapping the selected one clears it. */
export function CategoryGrid({
  categories,
  value,
  onChange,
  suggestedId,
  onManage,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  suggestedId?: string | null;
  onManage?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(selected ? null : c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={c.name}
            style={({ pressed }) => [styles.tileSlot, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.ring, { borderColor: selected ? colors.brand : 'transparent' }]}>
              <CategoryAvatar icon={c.icon} color={c.color} size={48} />
              {selected ? (
                <View style={styles.check}>
                  <Icon name="check" size={11} color={colors.textOnBrand} strokeWidth={3.5} />
                </View>
              ) : suggestedId === c.id ? (
                <View style={[styles.check, styles.suggest]}>
                  <Icon name="sparkles" size={10} color={colors.brand} strokeWidth={2.5} />
                </View>
              ) : null}
            </View>
            <Text variant="caption" color={selected ? colors.text : colors.textSecondary} numberOfLines={1} style={styles.tileLabel}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
      {onManage ? (
        <Pressable
          onPress={onManage}
          style={({ pressed }) => [styles.tileSlot, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Manage categories"
        >
          <View style={[styles.ring, { borderColor: 'transparent' }]}>
            <View style={styles.newBadge}>
              <Icon name="plus" size={20} color={colors.textTertiary} />
            </View>
          </View>
          <Text variant="caption" numberOfLines={1} style={styles.tileLabel}>
            New
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * One scrollable row of category chips for forms: the selected and suggested
 * categories first, then the rest, then "More" (opens the full grid).
 */
export function CategoryChips({
  categories,
  value,
  onChange,
  suggestedId,
  onMore,
  limit = 6,
}: {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  suggestedId?: string | null;
  onMore?: () => void;
  limit?: number;
}) {
  const styles = useStyles();
  const ordered = useMemo(() => {
    if (categories.length === 0) return [];

    // Contextual Slot 1 Pinning:
    // 1. If active selection exists and matches a category, Slot 1 = selection
    // 2. Else if high-confidence recommendation exists, Slot 1 = recommendation
    // 3. Else Slot 1 = top freshiency-ranked category (categories[0])
    const selectedCat = value ? categories.find((c) => c.id === value) : undefined;
    const suggestedCat = !selectedCat && suggestedId ? categories.find((c) => c.id === suggestedId) : undefined;
    const slot1 = selectedCat ?? suggestedCat ?? categories[0];

    const rest = categories.filter((c) => c.id !== slot1.id);
    return [slot1, ...rest].slice(0, limit);
  }, [categories, value, suggestedId, limit]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
      style={styles.bleed}
    >
      {ordered.map((c) => {
        const selected = c.id === value;
        const isSuggested = !value && c.id === suggestedId;
        const trailingIcon = selected ? 'check' : isSuggested ? 'sparkles' : undefined;
        return (
          <Chip
            key={c.id}
            label={c.name}
            categoryIcon={c.icon}
            color={c.color}
            selected={selected}
            trailingIcon={trailingIcon}
            accessibilityLabel={`${c.name}${selected ? ', selected' : isSuggested ? ', recommended' : ''}`}
            onPress={() => onChange(selected ? null : c.id)}
          />
        );
      })}
      {onMore ? <Chip label="More" icon="layoutGrid" onPress={onMore} style={{ height: 44 }} /> : null}
    </ScrollView>
  );
}

/** Horizontal member chips with avatars. Tapping the selected chip clears it. */
export function MemberChips({
  members,
  value,
  onChange,
}: {
  members: Member[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberRow} keyboardShouldPersistTaps="handled">
      {members.map((m) => {
        const selected = m.id === value;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(selected ? null : m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${m.name}${selected ? ' (selected)' : ''}`}
            style={[
              styles.member,
              selected
                ? { borderColor: colors.brandSoftBorder, backgroundColor: colors.brandSoft }
                : { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <MemberAvatar name={m.name} color={m.color} size={30} />
            <Text variant="labelStrong" color={selected ? colors.brand : colors.textSecondary}>
              {m.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -space.xxs,
    rowGap: space.md,
  },
  tileSlot: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: space.xxs,
  },
  ring: {
    padding: 3,
    borderRadius: 32,
    borderWidth: 2,
  },
  tileLabel: {
    marginTop: 6,
    maxWidth: '100%',
  },
  check: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggest: {
    backgroundColor: colors.brandSoft,
  },
  newBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bleed: {
    marginHorizontal: -space.lg,
  },
  chipRow: {
    gap: space.xs,
    paddingHorizontal: space.lg,
  },
  memberRow: {
    gap: space.xs,
    paddingRight: space.lg,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 44,
    paddingLeft: 6,
    paddingRight: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
}));
