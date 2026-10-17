import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Switch as RNSwitch,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, font, radius, space, tint } from '@/design/tokens';
import { Icon, IconName } from './Icon';
import { Text } from './Text';

// ---------------------------------------------------------------- Chip

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string | null;
  emoji?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, onPress, color, emoji, icon, style }: ChipProps) {
  const accent = color ?? colors.brand;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: tint(accent, 0.14), borderColor: accent }
          : { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
      {icon ? <Icon name={icon} size={14} color={selected ? accent : colors.textSecondary} /> : null}
      {!emoji && !icon && color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text variant="labelStrong" color={selected ? colors.text : colors.textSecondary} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------- SegmentedControl

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
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
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.borderStrong, true: colors.brand }}
      thumbColor={colors.surface}
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
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.negative : focused ? colors.brand : colors.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="labelStrong" color={colors.textSecondary} style={styles.fieldLabel}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, { borderColor }, multiline && styles.fieldMultiline]}>
        {icon ? <Icon name={icon} size={18} color={focused ? colors.brand : colors.textTertiary} /> : null}
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
  color = colors.brand,
  height = 8,
  track = colors.surfaceMuted,
}: {
  value: number; // 0..1, clamped
  color?: string;
  height?: number;
  track?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 15,
    lineHeight: 18,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md - 2,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  fieldLabel: {
    marginBottom: space.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 50,
    paddingHorizontal: space.md,
    borderWidth: 1.5,
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
});
