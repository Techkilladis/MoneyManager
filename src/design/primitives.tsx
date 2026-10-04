// Design System Primitives - Apple/Linear inspired components
// Refined for premium, minimal, professional Android app experience

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
  TextStyle,
  ActivityIndicator,
  Image,
  ImageStyle,
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
  variant?: 'default' | 'alt' | 'elevated';
}

export const Section = forwardRef<View, SectionProps>(
  ({ children, style, padded = true, paddedHorizontal = true, paddedVertical = false, dark = false, variant = 'default', ...props }, ref) => {
    const horizontalPadding = padded || paddedHorizontal ? spacing[16] : 0;
    const verticalPadding = padded || paddedVertical ? spacing[13] : 0;

    let bgColor: string = dark ? colors.backgroundDark : colors.background;
    if (variant === 'alt') {
      bgColor = dark ? colors.backgroundAltDark : colors.backgroundAlt;
    } else if (variant === 'elevated') {
      bgColor = dark ? colors.surfaceElevatedDark : colors.surfaceElevated;
    }

    return (
      <View
        ref={ref}
        style={[
          {
            paddingHorizontal: horizontalPadding,
            paddingVertical: verticalPadding,
            backgroundColor: bgColor,
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
  variant?: 'default' | 'elevated' | 'outlined' | 'subtle';
}

export const Card = forwardRef<View, CardProps>(
  ({ children, style, elevated = false, dark = false, bordered = false, onPress, variant = 'default', ...props }, ref) => {
    const Component = onPress ? TouchableOpacity : View;
    const pressProps = onPress ? { activeOpacity: 0.9, onPress } : {};

    let bgColor: string = dark ? colors.surfaceDark : colors.surface;
    let borderWidth = 0;
    let borderColor = 'transparent';

    // Determine shadow based on variant and elevated
    let shadow: ViewStyle = elevated ? shadows.elevated : shadows.card;
    if (variant === 'outlined' || variant === 'subtle') {
      shadow = shadows.none;
    }

    if (variant === 'outlined') {
      borderWidth = StyleSheet.hairlineWidth;
      borderColor = dark ? colors.borderDark : colors.borderDefault;
    } else if (variant === 'subtle') {
      bgColor = dark ? colors.backgroundDark : colors.background;
      borderWidth = StyleSheet.hairlineWidth;
      borderColor = dark ? colors.dividerDark : colors.dividerLight;
    } else if (bordered) {
      borderWidth = StyleSheet.hairlineWidth;
      borderColor = dark ? colors.borderDark : colors.borderDefault;
    }

    return (
      <Component
        ref={ref}
        style={[
          {
            backgroundColor: bgColor,
            borderRadius: radius.standard,
            borderWidth,
            borderColor,
            ...shadow,
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

// Text variants with Apple/Linear-inspired styling
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
  displaySmall: {
    fontSize: typography.size.displaySmall,
    fontWeight: typography.weight.regular,
    lineHeight: typography.size.displaySmall * typography.lineHeight.snug,
    letterSpacing: typography.letterSpacing.display,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  title1: {
    fontSize: typography.size.title1,
    fontWeight: typography.weight.semibold,
    lineHeight: typography.size.title1 * typography.lineHeight.snug,
    letterSpacing: -0.24,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
  },
  title2: {
    fontSize: typography.size.title2,
    fontWeight: typography.weight.medium,
    lineHeight: typography.size.title2 * typography.lineHeight.snug,
    letterSpacing: -0.22,
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
    fontWeight: typography.weight.medium,
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
    fontWeight: typography.weight.medium,
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
    color: colors.textQuaternary,
  },
  // Button text
  button: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    lineHeight: typography.size.body * typography.lineHeight.button,
    letterSpacing: typography.letterSpacing.normal,
    fontFamily: typography.fontFamily.primary,
  },
  buttonSmall: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.medium,
    lineHeight: typography.size.caption1 * typography.lineHeight.button,
    letterSpacing: typography.letterSpacing.normal,
    fontFamily: typography.fontFamily.primary,
  },
  // Link text
  link: {
    fontSize: typography.size.footnote,
    fontWeight: typography.weight.medium,
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
  weight?: TextStyle['fontWeight'];
}

export const TextPrimitive = forwardRef<Text, TextPrimitiveProps>(
  ({ variant = 'body', color, style, dark = false, children, textAlign, weight, ...props }, ref) => {
    const variantStyle = textVariants[variant];
    const resolvedColor = color || (dark ? colors.textOnDark : colors.textPrimary);

    return (
      <Text
        ref={ref}
        style={[
          variantStyle,
          { color: resolvedColor, textAlign, fontWeight: weight },
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
export const DisplaySmall = (props: Omit<TextPrimitiveProps, 'variant'>) => 
  <TextPrimitive variant="displaySmall" {...props} />;
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

export type ButtonVariant = 'primary' | 'primaryDark' | 'secondary' | 'ghost' | 'pill' | 'destructive' | 'subtle';
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
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const buttonStyles = StyleSheet.create({
  base: {
    borderRadius: radius.standard,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  large: {
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[16],
    minHeight: 48,
  },
  standard: {
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[14],
    minHeight: 44,
  },
  small: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[10],
    minHeight: 32,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
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
  subtle: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
  },
});

type ButtonStyleKey = 'base' | 'large' | 'standard' | 'small' | 'fullWidth' | 'disabled' | 'primary' | 'primaryDark' | 'secondary' | 'ghost' | 'pill' | 'destructive' | 'subtle';

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
    icon,
    iconPosition = 'left',
    ...props
  }, ref) => {
    const isSecondary = variant === 'secondary';
    const isGhost = variant === 'ghost';
    const isPill = variant === 'pill';
    const isDestructive = variant === 'destructive';
    const isPrimaryDark = variant === 'primaryDark';
    const isSubtle = variant === 'subtle';

    let textColor: string = colors.textOnAccent;
    if (isSecondary || isGhost || isPill) {
      textColor = dark ? colors.linkOnDark : colors.linkOnLight;
    } else if (isPrimaryDark) {
      textColor = colors.textOnAccent;
    } else if (isSubtle) {
      textColor = dark ? colors.textOnDarkSecondary : colors.textSecondary;
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
          <ActivityIndicator
            size="small"
            color={textColor}
            style={{ marginRight: iconPosition === 'left' ? spacing[3] : 0, marginLeft: iconPosition === 'right' ? spacing[3] : 0 }}
          />
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <View style={{ marginRight: spacing[3] }}>{icon}</View>
            )}
            <TextPrimitive variant={textVariant} color={textColor} dark={dark}>
              {children}
            </TextPrimitive>
            {icon && iconPosition === 'right' && (
              <View style={{ marginLeft: spacing[3] }}>{icon}</View>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  }
);
Button.displayName = 'Button';

// ============================================
// Badge Component
// ============================================

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'pending' | 'indigo';

interface BadgeProps extends ViewProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'small' | 'standard';
  style?: StyleProp<ViewStyle>;
  dot?: boolean;
}

const badgeStyles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  small: {
    paddingVertical: 1,
    minHeight: 16,
  },
  standard: {
    paddingVertical: spacing[1],
    minHeight: 20,
  },
  neutral: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  success: {
    backgroundColor: colors.successBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.successBorder,
  },
  warning: {
    backgroundColor: colors.warningBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.warningBorder,
  },
  error: {
    backgroundColor: colors.errorBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.errorBorder,
  },
  pending: {
    backgroundColor: colors.pendingBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.pendingBorder,
  },
  indigo: {
    backgroundColor: colors.accentLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderAccent,
  },
});

export const Badge = forwardRef<View, BadgeProps>(
  ({ children, variant = 'neutral', size = 'standard', style, dot = false, ...props }, ref) => {
    const textColor: Record<BadgeVariant, string> = {
      neutral: colors.textPrimary,
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      pending: colors.accent,
      indigo: colors.accentIndigo,
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
        {dot && (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: textColor[variant],
              marginRight: spacing[2],
            }}
          />
        )}
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
// Column Component - Flexible vertical layout
// ============================================

interface ColumnProps extends ViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  gap?: keyof typeof spacing;
}

export const Column = forwardRef<View, ColumnProps>(
  ({ children, style, align = 'flex-start', justify = 'flex-start', gap, ...props }, ref) => {
    return (
      <View
        ref={ref}
        style={[
          {
            flexDirection: 'column',
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
Column.displayName = 'Column';

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
            backgroundColor: dark ? colors.dividerDark : colors.dividerLight,
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
          backgroundColor: dark ? colors.dividerDark : colors.dividerLight,
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
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onBlur?: () => void;
  onFocus?: () => void;
  maxLength?: number;
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
  leftIcon,
  rightIcon,
  onBlur,
  onFocus,
  maxLength,
}: InputProps) => {
  const hasError = !!error;
  const [focused, setFocused] = React.useState(false);
  
  const borderColor = hasError
    ? colors.error
    : focused
    ? colors.accent
    : dark
    ? colors.borderDark
    : colors.borderDefault;

  return (
    <View style={style}>
      {label && (
        <BodyEmphasis dark={dark} color={dark ? colors.textOnDarkSecondary : colors.textPrimary} style={{ marginBottom: spacing[3] }}>
          {label}
        </BodyEmphasis>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {leftIcon && (
          <View style={{ marginRight: spacing[3] }}>
            {leftIcon}
          </View>
        )}
        <TextInput
          style={[
            {
              flex: 1,
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
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onFocus={() => { setFocused(true); onFocus?.(); }}
          maxLength={maxLength}
        />
        {rightIcon && (
          <View style={{ marginLeft: spacing[3] }}>
            {rightIcon}
          </View>
        )}
      </View>
      {error && (
        <Footnote color={colors.error} dark={dark} style={{ marginTop: spacing[2], marginLeft: spacing[1] }}>
          {error}
        </Footnote>
      )}
      {maxLength && (
        <Footnote color={dark ? colors.textOnDarkQuaternary : colors.textQuaternary} dark={dark} style={{ marginTop: spacing[2], textAlign: 'right' }}>
          {value.length}/{maxLength}
        </Footnote>
      )}
    </View>
  );
};

// ============================================
// Avatar Component
// ============================================

interface AvatarProps {
  source?: { uri: string };
  name?: string;
  size?: keyof typeof spacing | number;
  style?: StyleProp<ViewStyle>;
}

export const Avatar = ({ source, name, size = 20, style }: AvatarProps) => {
  const sizeValue = typeof size === 'number' ? size : spacing[size as keyof typeof spacing] || size;
  
  if (source?.uri) {
    return (
      <Image
        source={source}
        style={[
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: radius.circle,
          },
          style as ImageStyle,
        ]}
      />
    );
  }

  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <View
      style={[
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: radius.circle,
          backgroundColor: colors.accentLight,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <TextPrimitive variant="caption1" color={colors.accent} weight="medium">
        {initials}
      </TextPrimitive>
    </View>
  );
};

// ============================================
// Switch Component
// ============================================

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export const Switch = ({ value, onValueChange, disabled = false, style, dark = false }: SwitchProps) => {
  const handlePress = () => !disabled && onValueChange(!value);
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[
        {
          width: 44,
          height: 26,
          borderRadius: radius.pill,
          backgroundColor: value ? colors.accent : (dark ? colors.surfaceDark : colors.surface),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: value ? 'transparent' : (dark ? colors.borderDark : colors.borderDefault),
          justifyContent: 'center',
          paddingHorizontal: 2,
          ...shadows.ambient,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.circle,
          backgroundColor: colors.surface,
          ...shadows.card,
          transform: [{ translateX: value ? 18 : 0 }],
        }}
      />
    </Pressable>
  );
};

// ============================================
// Sheet/Modal Base Component
// ============================================

interface SheetProps {
  children: React.ReactNode;
  visible: boolean;
  onClose: () => void;
  dark?: boolean;
  grabber?: boolean;
  maxHeight?: number;
}

export const Sheet = ({ children, visible, onClose, dark = false, grabber = true, maxHeight }: SheetProps) => {
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        hitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
      >
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        />
      </Pressable>
      <View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: dark ? colors.surfaceDark : colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight: maxHeight || '85%',
            ...shadows.modal,
            overflow: 'hidden',
          },
        ]}
      >
        {grabber && (
          <View style={{ alignItems: 'center', paddingTop: spacing[3], paddingBottom: spacing[2] }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: dark ? colors.textOnDarkTertiary : colors.textTertiary,
              }}
            />
          </View>
        )}
        <View style={{ maxHeight: maxHeight ? maxHeight - (grabber ? 40 : 0) : undefined }}>
          {children}
        </View>
      </View>
    </View>
  );
};

// ============================================
// List Item Component
// ============================================

interface ListItemProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
  inset?: boolean;
  separator?: boolean;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const ListItem = ({
  children,
  onPress,
  style,
  dark = false,
  inset = true,
  separator = true,
  leftElement,
  rightElement,
}: ListItemProps) => {
  const Component = onPress ? Pressable : View;
  const handlePress = onPress ? () => onPress() : undefined;
  
  return (
    <Component
      onPress={handlePress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: inset ? spacing[16] : 0,
          paddingVertical: spacing[4],
          backgroundColor: dark ? colors.backgroundDark : colors.background,
          ...(leftElement && { paddingLeft: spacing[12] }),
        },
        style,
      ]}
      android_ripple={onPress ? { color: dark ? colors.accentLightDark : colors.accentLight } : undefined}
    >
      {leftElement && (
        <View style={{ marginRight: spacing[3], flexShrink: 0 }}>
          {leftElement}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {rightElement && (
        <View style={{ marginLeft: spacing[3], flexShrink: 0 }}>
          {rightElement}
        </View>
      )}
      {separator && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: inset ? spacing[16] : 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: dark ? colors.dividerDark : colors.dividerLight,
          }}
        />
      )}
    </Component>
  );
};

// ============================================
// Section Header Component
// ============================================

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
}

export const SectionHeader = ({ title, subtitle, action, style, dark = false }: SectionHeaderProps) => {
  return (
    <View style={[{ paddingHorizontal: spacing[16], paddingVertical: spacing[3] }, style]}>
      <Row justify="space-between" align="center">
        <Column gap={1}>
          <Title2 dark={dark}>{title}</Title2>
          {subtitle && <Caption1 dark={dark} color={dark ? colors.textOnDarkTertiary : colors.textTertiary}>{subtitle}</Caption1>}
        </Column>
        {action && (
          <Button variant="ghost" size="small" onPress={action.onPress}>
            {action.label}
          </Button>
        )}
      </Row>
    </View>
  );
};

// ============================================
// Export all primitives
// ============================================

export const primitives = {
  Screen,
  Section,
  Card,
  TextPrimitive,
  DisplayHero,
  DisplayLarge,
  DisplayMedium,
  DisplaySmall,
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
  Column,
  EmptyState,
  Divider,
  Input,
  Avatar,
  Switch,
  Sheet,
  ListItem,
  SectionHeader,
};

export type Primitives = typeof primitives;