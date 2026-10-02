// Design System Primitives - Apple-inspired components

import React, { forwardRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  Pressable, 
  TextInput, 
  ScrollView,
  ViewProps,
  TextProps,
  TouchableOpacityProps,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
  TextStyle
} from 'react-native';
import { colors, typography, spacing, radius, shadows, designTokens } from './tokens';

// ============================================
// Base Components
// ============================================

// Screen - Root container for screens
export interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  safeAreaTop?: boolean;
  safeAreaBottom?: boolean;
}

export const Screen = forwardRef<View, ScreenProps>(
  ({ children, style, dark = false, safeAreaTop = true, safeAreaBottom = true, ...props }, ref) => {
    const baseStyle: ViewStyle = {
      flex: 1,
      backgroundColor: dark ? colors.backgroundDark : colors.background,
      ...(safeAreaTop && { paddingTop: Platform.OS === 'ios' ? 0 : 0 }),
    };

    return (
      <View
        ref={ref}
        style={[
          baseStyle,
          dark && { backgroundColor: colors.backgroundDark },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }
);
Screen.displayName = 'Screen';

// Section - Content section with consistent padding
export interface SectionProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  paddedHorizontal?: boolean;
  paddedVertical?: boolean;
  dark?: boolean;
}

export const Section = forwardRef<View, SectionProps>(
  ({ children, style, padded = true, paddedHorizontal = true, paddedVertical = false, dark = false, ...props }, ref) => {
    const horizontalPadding = padded || paddedHorizontal ? spacing[16] : 0; // 20px
    const verticalPadding = padded || paddedVertical ? spacing[13] : 0; // 16px

    return (
      <View
        ref={ref}
        style={[
          {
            paddingHorizontal: horizontalPadding,
            paddingVertical: verticalPadding,
            backgroundColor: dark ? colors.backgroundDark : colors.background,
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }
);
Section.displayName = 'Section';

// Card - Elevated surface
export interface CardProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  dark?: boolean;
  bordered?: boolean;
  onPress?: () => void;
}

export const Card = forwardRef<View, CardProps>(
  ({ children, style, elevated = false, dark = false, bordered = false, onPress, ...props }, ref) => {
    const Component = onPress ? TouchableOpacity : View;
    const pressProps = onPress ? { activeOpacity: 0.9, onPress } : {};

    return (
      <Component
        ref={ref}
        style={[
          {
            backgroundColor: dark ? colors.surfaceDark : colors.surface,
            borderRadius: radius.standard,
            borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
            borderColor: bordered ? (dark ? colors.borderAccent : colors.borderDefault) : 'transparent',
            ...(elevated ? shadows.elevated : shadows.standard),
          },
          style,
        ]}
        {...pressProps}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Card.displayName = 'Card';

// ============================================
// Typography Components
// ============================================

// Text variants with Apple-inspired styling
const textVariants: Record<string, TextStyle> = {
  displayHero: {
    fontSize: typography.size.displayHero,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.displayHero * typography.lineHeight.tight,
    letterSpacing: typography.letterSpacing.tight,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  displayLarge: {
    fontSize: typography.size.displayLarge,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.displayLarge * typography.lineHeight.snug,
    letterSpacing: typography.letterSpacing.display,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  displayMedium: {
    fontSize: typography.size.displayMedium,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.displayMedium * typography.lineHeight.snug,
    letterSpacing: typography.letterSpacing.display,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  title1: {
    fontSize: typography.size.title1,
    fontWeight: typography.weight.bold,
    lineHeight: typography.size.title1 * typography.lineHeight.snug,
    letterSpacing: 0.231,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  title2: {
    fontSize: typography.size.title2,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.title2 * typography.lineHeight.snug,
    letterSpacing: 0.231,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  headline: {
    fontSize: typography.size.headline,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.headline * typography.lineHeight.snug,
    letterSpacing: typography.letterSpacing.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.body * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  bodyEmphasis: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.body * typography.lineHeight.snug,
    letterSpacing: typography.letterSpacing.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  callout: {
    fontSize: typography.size.callout,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.callout * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textSecondary,
  },
  subhead: {
    fontSize: typography.size.subhead,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.subhead * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textSecondary,
  },
  footnote: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.footnote * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    color: colors.textTertiary,
  },
  caption1: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.caption1 * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    color: colors.textTertiary,
  },
  caption2: {
    fontSize: typography.size.caption2,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.caption2 * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    color: colors.textTertiary,
  },
  micro: {
    fontSize: typography.size.micro,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.micro * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.micro,
    fontFamily: typography.fontFamily.primary,
    color: colors.textTertiary,
  },
  // Button text
  button: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.body * typography.lineHeight.button,
    letterSpacing: typography.letterSpacing.normal,
    fontFamily: typography.fontFamily.primary,
  },
  buttonSmall: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.caption1 * typography.lineHeight.button,
    letterSpacing: typography.letterSpacing.normal,
    fontFamily: typography.fontFamily.primary,
  },
  // Link text
  link: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.footnote * typography.lineHeight.normal,
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    textDecorationLine: 'underline',
  },
};

type TextVariant = keyof typeof textVariants;

interface TextPrimitiveProps extends Omit<TextProps, 'style'> {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  dark?: boolean;
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export const TextPrimitive = forwardRef<Text, TextPrimitiveProps>(
  ({ variant = 'body', color, style, dark = false, children, textAlign, ...props }, ref) => {
    const variantStyle = textVariants[variant];
    const resolvedColor = color || (dark ? colors.textOnDark : colors.textPrimary);

    return (
      <Text
        ref={ref}
        style={[
          variantStyle,
          { color: resolvedColor, textAlign },
          style,
        ]}
        {...props}
      >
        {children}
      </Text>
    );
  }
);
TextPrimitive.displayName = 'TextPrimitive';

// Convenience exports
export const DisplayHero = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="displayHero" {...props} />;
export const DisplayLarge = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="displayLarge" {...props} />;
export const DisplayMedium = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="displayMedium" {...props} />;
export const Title1 = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="title1" {...props} />;
export const Title2 = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="title2" {...props} />;
export const Headline = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="headline" {...props} />;
export const Body = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="body" {...props} />;
export const BodyEmphasis = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="bodyEmphasis" {...props} />;
export const Callout = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="callout" {...props} />;
export const Subhead = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="subhead" {...props} />;
export const Footnote = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="footnote" {...props} />;
export const Caption1 = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="caption1" {...props} />;
export const Caption2 = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="caption2" {...props} />;
export const Micro = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="micro" {...props} />;
export const ButtonText = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="button" {...props} />;
export const ButtonTextSmall = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="buttonSmall" {...props} />;
export const LinkText = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="link" {...props} />;

// ============================================
// Button Components
// ============================================

export type ButtonVariant = 'primary' | 'primaryDark' | 'secondary' | 'ghost' | 'pill' | 'destructive';
export type ButtonSize = 'large' | 'standard' | 'small';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  dark?: boolean;
}

const buttonStyles = StyleSheet.create({
  base: {
    borderRadius: radius.standard,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  large: {
    paddingVertical: spacing[5], // 8px
    paddingHorizontal: spacing[16], // 20px
    minHeight: 44,
  },
  standard: {
    paddingVertical: spacing[4], // 7px
    paddingHorizontal: spacing[14], // 17px
    minHeight: 40,
  },
  small: {
    paddingVertical: spacing[2], // 4px
    paddingHorizontal: spacing[10], // 12px
    minHeight: 32,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  primaryDark: {
    backgroundColor: colors.textPrimary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pill: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radius.pill,
  },
  destructive: {
    backgroundColor: colors.error,
  },
});

type ButtonStyleKey = 'base' | 'large' | 'standard' | 'small' | 'fullWidth' | 'disabled' | 'primary' | 'primaryDark' | 'secondary' | 'ghost' | 'pill' | 'destructive';

export const Button = forwardRef<View, ButtonProps>(
  ({
    variant = 'primary',
    size = 'standard',
    children,
    style,
    disabled = false,
    loading = false,
    fullWidth = false,
    dark = false,
    onPress,
    ...props
  }, ref) => {
    const isSecondary = variant === 'secondary';
    const isGhost = variant === 'ghost';
    const isPill = variant === 'pill';
    const isDestructive = variant === 'destructive';
    const isPrimaryDark = variant === 'primaryDark';

    // Determine text color based on variant and dark mode
    let textColor: string = colors.textOnDark; // default for primary/destructive
    if (isSecondary || isGhost || isPill) {
      textColor = dark ? colors.linkOnDark : colors.linkOnLight;
    } else if (isPrimaryDark) {
      textColor = colors.textOnDark;
    }

    if (disabled || loading) {
      textColor = dark ? colors.textOnDarkTertiary : colors.textTertiary;
    }

    const containerStyle: StyleProp<ViewStyle> = [
      buttonStyles.base,
      buttonStyles[size],
      buttonStyles[variant as ButtonStyleKey],
      fullWidth && buttonStyles.fullWidth,
      (disabled || loading) && buttonStyles.disabled,
      style,
    ];

    const textVariant = size === 'small' ? 'buttonSmall' : 'button';

    return (
      <TouchableOpacity
        ref={ref}
        style={containerStyle}
        disabled={disabled || loading}
        onPress={onPress}
        activeOpacity={0.9}
        {...props}
      >
        {loading ? (
          <View style={{ width: 20, height: 20 }} /> // Placeholder for spinner
        ) : (
          <TextPrimitive variant={textVariant} color={textColor} dark={dark}>
            {children}
          </TextPrimitive>
        )}
      </TouchableOpacity>
    );
  }
);
Button.displayName = 'Button';

// ============================================
// Badge Component
// ============================================

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'pending';

interface BadgeProps extends ViewProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'small' | 'standard';
  style?: StyleProp<ViewStyle>;
}

const badgeStyles = StyleSheet.create({
  base: {
    borderRadius: radius.micro,
    paddingHorizontal: spacing[3], // 5px
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  small: {
    paddingVertical: 1,
    minHeight: 16,
  },
  standard: {
    paddingVertical: spacing[1], // 2px
    minHeight: 20,
  },
  neutral: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  success: {
    backgroundColor: colors.successBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.successBorder,
  },
  warning: {
    backgroundColor: 'rgba(155, 104, 41, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(155, 104, 41, 0.4)',
  },
  error: {
    backgroundColor: colors.errorBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.errorBorder,
  },
  pending: {
    backgroundColor: 'rgba(83, 58, 253, 0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(83, 58, 253, 0.4)',
  },
});

export const Badge = forwardRef<View, BadgeProps>(
  ({ children, variant = 'neutral', size = 'standard', style, ...props }, ref) => {
    const textColor: Record<BadgeVariant, string> = {
      neutral: colors.textPrimary,
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      pending: colors.accent,
    };

    return (
      <View
        ref={ref}
        style={[
          badgeStyles.base,
          badgeStyles[size],
          badgeStyles[variant],
          style,
        ]}
        {...props}
      >
        <TextPrimitive variant={size === 'small' ? 'caption2' : 'caption1'} color={textColor[variant]}>
          {children}
        </TextPrimitive>
      </View>
    );
  }
);
Badge.displayName = 'Badge';

// ============================================
// Row Component - Flexible horizontal layout
// ============================================

interface RowProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: keyof typeof spacing;
}

export const Row = forwardRef<View, RowProps>(
  ({ children, style, align = 'center', justify = 'flex-start', gap, ...props }, ref) => {
    return (
      <View
        ref={ref}
        style={[
          {
            flexDirection: 'row',
            alignItems: align,
            justifyContent: justify,
            gap: gap ? spacing[gap] : 0,
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }
);
Row.displayName = 'Row';

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
  };
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export const EmptyState = ({
  title,
  subtitle,
  action,
  icon,
  style,
  dark = false,
}: EmptyStateProps) => {
  return (
    <View
      style={[
        {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: spacing[16],
          paddingVertical: spacing[24],
        },
        style,
      ]}
    >
      {icon && (
        <View
          style={{
            marginBottom: spacing[16],
            opacity: 0.4,
          }}
        >
          {icon}
        </View>
      )}
      <Title1 color={dark ? colors.textOnDarkSecondary : colors.textSecondary} textAlign="center" dark={dark}>
        {title}
      </Title1>
      {subtitle && (
        <Body color={dark ? colors.textOnDarkTertiary : colors.textTertiary} textAlign="center" dark={dark} style={{ marginTop: spacing[6] }}>
          {subtitle}
        </Body>
      )}
      {action && (
        <Button
          variant={action.variant || 'secondary'}
          size="standard"
          onPress={action.onPress}
          style={{ marginTop: spacing[16] }}
        >
          {action.label}
        </Button>
      )}
    </View>
  );
};

// ============================================
// Divider Component
// ============================================

interface DividerProps {
  horizontal?: boolean;
  inset?: boolean;
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Divider = ({
  horizontal = true,
  inset = false,
  dark = false,
  style,
  ...props
}: DividerProps) => {
  if (horizontal) {
    return (
      <View
        style={[
          {
            height: StyleSheet.hairlineWidth,
            backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDefault,
            marginHorizontal: inset ? spacing[16] : 0,
            marginVertical: spacing[10],
          },
          style,
        ]}
        {...props}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: StyleSheet.hairlineWidth,
          backgroundColor: dark ? 'rgba(255, 255, 255, 0.08)' : colors.borderDefault,
          marginVertical: inset ? spacing[16] : 0,
        },
        style,
      ]}
      {...props}
    />
  );
};

// ============================================
// Input Component (for forms)
// ============================================

interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address';
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  disabled?: boolean;
}

export const Input = ({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry = false,
  keyboardType = 'default',
  style,
  dark = false,
  disabled = false,
}: InputProps) => {
  const hasError = !!error;
  const borderColor = hasError
    ? colors.error
    : dark
    ? 'rgba(255, 255, 255, 0.16)'
    : colors.borderDefault;
  const focusedBorderColor = hasError ? colors.error : colors.accent;

  return (
    <View style={style}>
      {label && (
        <BodyEmphasis dark={dark} color={dark ? colors.textOnDarkSecondary : colors.textPrimary} style={{ marginBottom: spacing[3] }}>
          {label}
        </BodyEmphasis>
      )}
      <TextInput
        style={[
          {
            backgroundColor: dark ? colors.surfaceDark : colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor,
            borderRadius: radius.small,
            paddingHorizontal: spacing[10],
            paddingVertical: spacing[4],
            fontSize: typography.size.body,
            fontFamily: typography.fontFamily.primary,
            color: dark ? colors.textOnDark : colors.textPrimary,
            fontWeight: typography.weight.regular,
          },
          error && { borderColor: colors.error },
          disabled && { opacity: 0.5, backgroundColor: dark ? colors.surfaceDark : colors.surfaceElevated },
        ]}
        onChangeText={onChangeText}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={dark ? colors.textOnDarkTertiary : colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        editable={!disabled}
        selectionColor={colors.accent}
      />
      {error && (
        <Footnote color={colors.error} dark={dark} style={{ marginTop: spacing[2], marginLeft: spacing[1] }}>
          {error}
        </Footnote>
      )}
    </View>
  );
};

// Export all primitives
export const primitives = {
  Screen,
  Section,
  Card,
  TextPrimitive,
  DisplayHero,
  DisplayLarge,
  DisplayMedium,
  Title1,
  Title2,
  Headline,
  Body,
  BodyEmphasis,
  Callout,
  Subhead,
  Footnote,
  Caption1,
  Caption2,
  Micro,
  ButtonText,
  ButtonTextSmall,
  LinkText,
  Button,
  Badge,
  Row,
  EmptyState,
  Divider,
  Input,
};

export type Primitives = typeof primitives;