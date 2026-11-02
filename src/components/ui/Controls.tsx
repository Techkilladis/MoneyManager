import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  Switch as RNSwitch,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { font, fontFamily, radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { haptic } from '@/utils/haptics';
import { CategoryAvatar } from './Avatars';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

// ---------------------------------------------------------------- Chip

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** A category or person colour: shows a dot and selects in the moss style. */
  color?: string | null;
  icon?: IconName;
  /** A category's stored icon: shows its badge at the start of the chip. */
  categoryIcon?: string | null;
  /** Trailing icon (e.g. "x" on a removable filter). */
  trailingIcon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pill chip. Plain chips select as ink (period filters); category and person
 * chips select as a moss wash so their colour badge stays visible.
 */
export function Chip({ label, selected = false, onPress, color, icon, categoryIcon, trailingIcon, style }: ChipProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const soft = categoryIcon !== undefined || !!color;
  const fg = selected ? (soft ? colors.brand : colors.textOnInk) : colors.textSecondary;
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              haptic.select();
              onPress();
            }
          : undefined
      }
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        categoryIcon !== undefined && styles.chipWithBadge,
        selected
          ? soft
            ? { backgroundColor: colors.brandSoft, borderColor: colors.brandSoftBorder }
            : { backgroundColor: colors.text, borderColor: colors.text }
          : { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {categoryIcon !== undefined ? <CategoryAvatar icon={categoryIcon} color={color} size={30} /> : null}
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      {categoryIcon === undefined && !icon && color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text variant="labelStrong" color={fg} numberOfLines={1}>
        {label}
      </Text>
      {trailingIcon ? <Icon name={trailingIcon} size={16} color={fg} /> : null}
    </Pressable>
  );
}

// ---------------------------------------------------- SegmentedControl

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Compact pill variant (form headers). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, compact = false, style }: SegmentedProps<T>) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.segmented, compact && styles.segmentedCompact, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              if (!active) haptic.select();
              onChange(opt.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, compact && styles.segmentCompact, active && styles.segmentActive]}
          >
            <Text variant="labelStrong" color={active ? colors.text : colors.textTertiary}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------- Switch

export function Switch({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <RNSwitch
      value={value}
      onValueChange={(v) => {
        haptic.select();
        onValueChange(v);
      }}
      disabled={disabled}
      trackColor={{ false: colors.borderStrong, true: colors.brand }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.borderStrong}
    />
  );
}

// ----------------------------------------------------------- TextField

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
  right?: React.ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, icon, containerStyle, right, onFocus, onBlur, multiline, style, ...rest },
  ref
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.negative : focused ? colors.brand : colors.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" style={styles.fieldLabel}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { borderColor }, multiline && styles.fieldMultiline]}>
        {icon ? <Icon name={icon} size={20} color={focused ? colors.brand : colors.textTertiary} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.brand}
          cursorColor={colors.brand}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
        {right}
      </View>
      {error ? (
        <Text variant="caption" color={colors.negative} style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

// --------------------------------------------------------- ProgressBar

export function ProgressBar({
  value,
  color: colorProp,
  height = 8,
  track: trackProp,
}: {
  value: number; // 0..1, clamped
  color?: string;
  height?: number;
  track?: string;
}) {
  const { colors } = useTheme();
  const color = colorProp ?? colors.brand;
  const track = trackProp ?? colors.surfaceMuted;
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipWithBadge: {
    height: 44,
    paddingLeft: 6,
    paddingRight: space.md,
    gap: space.xs,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    padding: 4,
  },
  segmentedCompact: {
    borderRadius: radius.pill,
    alignSelf: 'center',
  },
  segment: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentCompact: {
    flex: 0,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  fieldLabel: {
    marginBottom: space.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 56,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  fieldMultiline: {
    alignItems: 'flex-start',
    paddingVertical: space.sm,
  },
  input: {
    flex: 1,
    fontSize: font.size.body,
    fontFamily: fontFamily.regular,
    color: colors.text,
    paddingVertical: space.sm,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  fieldError: {
    marginTop: space.xxs,
  },
}));
