// Form components extending the Phase 1 design system

import React, { forwardRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform,
  Modal,
  Keyboard,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { 
  colors, 
  typography, 
  spacing, 
  radius, 
  shadows 
} from '@/design/tokens';

// ============================================
// Input Field
// ============================================

export interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address' | 'phone-pad';
  editable?: boolean;
  rightElement?: React.ReactNode;
  style?: any;
  autoFocus?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

export const InputField = forwardRef<TextInput, InputFieldProps>(
  ({ 
    label, 
    value, 
    onChangeText, 
    placeholder, 
    error, 
    secureTextEntry = false, 
    keyboardType = 'default',
    editable = true,
    rightElement,
    style,
    autoFocus = false,
    onBlur,
    onFocus,
  }, ref) => {
    const hasError = !!error;
    
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={ref}
            style={[
              styles.input,
              hasError && styles.inputError,
              !editable && styles.inputDisabled,
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            editable={editable}
            autoFocus={autoFocus}
            onBlur={onBlur}
            onFocus={onFocus}
            selectionColor={colors.accent}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {rightElement && (
            <View style={styles.rightElement}>
              {rightElement}
            </View>
          )}
        </View>
        {hasError && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </View>
    );
  }
);

InputField.displayName = 'InputField';

// ============================================
// Select Row (for category/member selection)
// ============================================

export interface SelectOption {
  id: string;
  label: string;
  color?: string | undefined;
  icon?: string;
}

export interface SelectRowProps {
  label: string;
  value: string | null;
  options: SelectOption[];
  onPress: () => void;
  editable?: boolean;
  style?: any;
}

export const SelectRow = ({
  label,
  value,
  options,
  onPress,
  editable = true,
  style,
}: SelectRowProps) => {
  const disabled = !editable;
  const selectedOption = value ? options.find(o => o.id === value) : null;
  
  return (
    <TouchableOpacity
      style={[styles.selectRow, disabled && styles.selectRowDisabled, style]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <View style={styles.selectLeft}>
        <Text style={styles.selectLabel}>{label}</Text>
        {selectedOption && (
          <View style={styles.selectValueContainer}>
            {selectedOption.color && (
              <View
                style={[
                  styles.selectColorDot,
                  { backgroundColor: selectedOption.color },
                ]}
              />
            )}
            <Text style={styles.selectValue}>{selectedOption.label}</Text>
          </View>
        )}
        {!selectedOption && (
          <Text style={styles.selectPlaceholder}>Select</Text>
        )}
      </View>
      {!disabled && (
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================
// Date/Time Select Row
// ============================================

export interface DateTimeSelectRowProps {
  label: string;
  date: Date;
  onPress: () => void;
  mode?: 'date' | 'time' | 'datetime';
  editable?: boolean;
  style?: any;
}

export const DateTimeSelectRow = ({
  label,
  date,
  onPress,
  mode = 'datetime',
  editable = true,
  style,
}: DateTimeSelectRowProps) => {
  const disabled = !editable;
  
  const formatDate = (d: Date) => {
    if (mode === 'time') {
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }
    if (mode === 'date') {
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return `${d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} ${d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })}`;
  };
  
  return (
    <TouchableOpacity
      style={[styles.selectRow, disabled && styles.selectRowDisabled, style]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <View style={styles.selectLeft}>
        <Text style={styles.selectLabel}>{label}</Text>
        <Text style={styles.selectValue}>{formatDate(date)}</Text>
      </View>
      {!disabled && (
        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================================
// Segmented Control
// ============================================

export interface SegmentedControlProps {
  segments: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  style?: any;
}

export const SegmentedControl = ({
  segments,
  value,
  onChange,
  style,
}: SegmentedControlProps) => {
  return (
    <View style={[styles.segmentedContainer, style]}>
      {segments.map((segment, index) => (
        <TouchableOpacity
          key={segment.value}
          style={[
            styles.segment,
            index === 0 ? styles.segmentFirst : {},
            index === segments.length - 1 ? styles.segmentLast : {},
            value === segment.value && styles.segmentActive,
          ]}
          onPress={() => onChange(segment.value)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.segmentText,
            value === segment.value && styles.segmentTextActive,
          ]}>
            {segment.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ============================================
// Confirm Dialog
// ============================================

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!visible) return null;
  
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay} onStartShouldSetResponder={() => true}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{title}</Text>
          {message && (
            <Text style={styles.modalMessage}>{message}</Text>
          )}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.modalButtonCancel,
              ]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                destructive && styles.modalButtonDestructive,
              ]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.modalButtonText,
                destructive && styles.modalButtonTextDestructive,
              ]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// Amount Input (specialized for currency)
// ============================================

export interface AmountInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  editable?: boolean;
  style?: any;
  autoFocus?: boolean;
}

export const AmountInput = ({
  label,
  value,
  onChangeText,
  placeholder = '0.00',
  error,
  editable = true,
  style,
  autoFocus = false,
}: AmountInputProps) => {
  const hasError = !!error;
  
  return (
    <View style={[styles.amountContainer, style]}>
      <Text style={styles.amountLabel}>{label}</Text>
      <View style={styles.amountInputWrapper}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={[
            styles.amountInput,
            hasError && styles.amountInputError,
            !editable && styles.amountInputDisabled,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          editable={editable}
          autoFocus={autoFocus}
          selectionColor={colors.accent}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={12}
        />
      </View>
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

// ============================================
// Transaction Form Row (label + value preview)
// ============================================

export interface FormRowProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  style?: any;
}

export const FormRow = ({ label, children, required = false, error, style }: FormRowProps) => {
  const hasError = !!error;
  
  return (
    <View style={[styles.formRow, style]}>
      <View style={styles.formRowLeft}>
        <Text style={styles.formRowLabel}>
          {label}
          {required && <Text style={styles.requiredAsterisk}>*</Text>}
        </Text>
      </View>
      <View style={styles.formRowRight}>
        {children}
      </View>
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  // InputField
  container: {
    marginBottom: spacing[12],
  },
  label: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
    borderRadius: radius.small,
    paddingHorizontal: spacing[10],
  },
  input: {
    flex: 1,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
    fontWeight: typography.weight.regular,
    paddingVertical: spacing[4],
    paddingRight: spacing[8],
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surfaceElevated,
  },
  rightElement: {
    marginLeft: spacing[8],
  },
  errorText: {
    fontSize: typography.size.caption2,
    fontFamily: typography.fontFamily.primary,
    color: colors.error,
    marginTop: spacing[2],
    marginLeft: spacing[1],
  },
  
  // SelectRow
  selectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
    borderRadius: radius.small,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    minHeight: 48,
  },
  selectRowDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surfaceElevated,
  },
  selectLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[6],
  },
  selectLabel: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    textTransform: 'uppercase',
  },
  selectValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  selectColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  selectValue: {
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textPrimary,
    fontWeight: typography.weight.regular,
  },
  selectPlaceholder: {
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textTertiary,
    fontWeight: typography.weight.regular,
  },
  chevron: {
    marginLeft: spacing[8],
  },
  chevronText: {
    fontSize: 20,
    color: colors.textTertiary,
    fontWeight: typography.weight.regular,
  },
  
  // SegmentedControl
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.standard,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[8],
    borderRadius: radius.small,
    alignItems: 'center',
  },
  segmentFirst: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentLast: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    ...shadows.ambient,
  },
  segmentText: {
    fontSize: typography.size.caption1,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
    letterSpacing: typography.letterSpacing.caption,
  },
  segmentTextActive: {
    color: colors.accent,
    fontWeight: typography.weight.semibold,
  },
  
  // ConfirmDialog
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.standard,
    padding: spacing[16],
    width: '100%',
    maxWidth: 320,
    ...shadows.elevated,
  },
  modalTitle: {
    fontSize: typography.size.title2,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing[4],
    letterSpacing: 0.231,
  },
  modalMessage: {
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    color: colors.textSecondary,
    marginBottom: spacing[16],
    lineHeight: typography.size.body * typography.lineHeight.normal,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[8],
  },
  modalButton: {
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[3],
    borderRadius: radius.standard,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
  },
  modalButtonDestructive: {
    backgroundColor: colors.error,
  },
  modalButtonText: {
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.weight.semibold,
    color: colors.accent,
  },
  modalButtonTextDestructive: {
    color: colors.textOnDark,
  },
  
  // AmountInput
  amountContainer: {
    marginBottom: spacing[12],
  },
  amountLabel: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing[3],
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    textTransform: 'uppercase',
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
    borderRadius: radius.small,
  },
  currencySymbol: {
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    paddingHorizontal: spacing[10],
  },
  amountInput: {
    flex: 1,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.weight.regular,
    color: colors.textPrimary,
    paddingVertical: spacing[4],
    paddingRight: spacing[10],
    textAlign: 'right',
  },
  amountInputError: {
    borderColor: colors.error,
  },
  amountInputDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surfaceElevated,
  },
  
  // FormRow
  formRow: {
    marginBottom: spacing[12],
  },
  formRowLeft: {
    flex: 1,
    marginRight: spacing[12],
  },
  formRowRight: {
    flex: 2,
  },
  formRowLabel: {
    fontSize: typography.size.caption1,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
    letterSpacing: typography.letterSpacing.caption,
    fontFamily: typography.fontFamily.primary,
    textTransform: 'uppercase',
    marginBottom: spacing[2],
  },
  requiredAsterisk: {
    color: colors.error,
    marginLeft: 2,
  },
});

// Export all form components
export const forms = {
  InputField,
  SelectRow,
  DateTimeSelectRow,
  SegmentedControl,
  ConfirmDialog,
  AmountInput,
  FormRow,
};