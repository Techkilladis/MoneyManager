import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { radius, space, tint } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Category, Member } from '@/database/schema';
import { categoryGlyph } from '@/domain/glyphs';
import { Icon, MemberAvatar, Text } from './ui';

/** Four-column grid of category tiles. Tapping the selected tile clears it. */
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
        const accent = c.color ?? colors.brand;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(selected ? null : c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={c.name}
            style={styles.tileSlot}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.tile,
                  { backgroundColor: selected ? tint(accent, 0.18) : pressed ? colors.surfaceMuted : colors.surface },
                  { borderColor: selected ? accent : colors.border },
                ]}
              >
                <Text style={styles.tileEmoji}>{categoryGlyph(c.icon)}</Text>
                <Text variant="caption" color={selected ? colors.text : colors.textSecondary} numberOfLines={1} style={styles.tileLabel}>
                  {c.name}
                </Text>
                {suggestedId === c.id && !selected ? (
                  <View style={[styles.suggestDot, { backgroundColor: accent }]} />
                ) : null}
                {selected ? (
                  <View style={[styles.check, { backgroundColor: accent }]}>
                    <Icon name="check" size={10} color={colors.textOnBrand} strokeWidth={3.5} />
                  </View>
                ) : null}
              </View>
            )}
          </Pressable>
        );
      })}
      {onManage ? (
        <Pressable onPress={onManage} style={styles.tileSlot} accessibilityRole="button" accessibilityLabel="Manage categories">
          {({ pressed }) => (
            <View style={[styles.tile, styles.tileDashed, pressed && { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="plus" size={20} color={colors.textTertiary} />
              <Text variant="caption" numberOfLines={1} style={styles.tileLabel}>
                New
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
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
        const accent = m.color ?? colors.brand;
        return (
          <Pressable
            key={m.id}
            onPress={() => onChange(selected ? null : m.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.member,
              { borderColor: selected ? accent : colors.border, backgroundColor: selected ? tint(accent, 0.14) : colors.surface },
            ]}
          >
            <MemberAvatar name={m.name} color={m.color} size={26} />
            <Text variant="labelStrong" color={selected ? colors.text : colors.textSecondary}>
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
  },
  tileSlot: {
    width: '25%',
    padding: space.xxs,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 76,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: space.xxs,
  },
  tileDashed: {
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  tileEmoji: {
    fontSize: 24,
    lineHeight: 30,
  },
  tileLabel: {
    marginTop: 4,
  },
  suggestDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberRow: {
    gap: space.xs,
    paddingRight: space.lg,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 40,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
}));
