// Shared add/edit form for expenses and income: big amount entry, merchant
// with recent suggestions, category grid (pre-filled from merchant memory),
// member chips, date/time and note.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Category, Member, TransactionKind } from '@/database/schema';
import { categoryService, classificationService, ledgerService, memberService } from '@/services';
import { formatDayLabel, formatTime, parseAmount, sanitizeAmountInput } from '@/utils/format';
import { DateTimeSheet } from './DateTimeSheet';
import { CategoryGrid, MemberChips } from './Pickers';
import { Button, Chip, Icon, ScreenHeader, SegmentedControl, Text, TextField } from './ui';

export interface TransactionFormValues {
  amountPaise: number;
  merchant: string;
  categoryId: string | null;
  memberId: string | null;
  note: string | null;
  transactionTimestamp: number;
  kind: TransactionKind;
}

interface Props {
  title: string;
  submitLabel: string;
  initial?: Partial<TransactionFormValues> & { amountText?: string };
  autoFocusAmount?: boolean;
  /** Apply merchant-memory suggestions and default member (new entries). */
  smartDefaults?: boolean;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  headerRight?: React.ReactNode;
  /** Show the Expense / Income switch. */
  allowKindChange?: boolean;
}

export function TransactionForm({
  title,
  submitLabel,
  initial,
  autoFocusAmount = false,
  smartDefaults = false,
  onSubmit,
  headerRight,
  allowKindChange = true,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState(initial?.amountText ?? '');
  const [merchant, setMerchant] = useState(initial?.merchant ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [memberId, setMemberId] = useState<string | null>(initial?.memberId ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(() => new Date(initial?.transactionTimestamp ?? Date.now()));
  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? 'EXPENSE');
  const income = kind === 'INCOME';

  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [recentMerchants, setRecentMerchants] = useState<string[]>([]);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [merchantFocused, setMerchantFocused] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; merchant?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  const categoryTouched = useRef(initial?.categoryId != null);
  const memberDefaulted = useRef(false);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const mountedRef = useRef(true);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadOptions = useCallback(() => {
    Promise.all([categoryService.getAll(), memberService.getAll(), ledgerService.getRecentMerchants(10)])
      .then(([cats, mems, recents]) => {
        if (!mountedRef.current) return;
        setCategories(cats);
        setMembers(mems);
        setRecentMerchants(recents);
        if (smartDefaults) {
          const self = mems.find((m) => m.name === 'Self');
          if (self && !memberDefaulted.current) {
            memberDefaulted.current = true;
            setMemberId((prev) => prev ?? self.id);
          }
        }
      })
      .catch((err) => console.error('[TransactionForm] load options failed:', err));
  }, [smartDefaults]);

  // Reload on focus so categories added via "New" show up on return.
  useFocusEffect(
    useCallback(() => {
      loadOptions();
    }, [loadOptions])
  );

  const suggestForMerchant = useCallback(
    (name: string) => {
      if (!smartDefaults || !name.trim()) return;
      classificationService
        .getSuggestion({ merchant: name })
        .then(({ suggestion }) => {
          if (!mountedRef.current || !suggestion) return;
          setSuggestedId(suggestion.categoryId);
          if (!categoryTouched.current && suggestion.categoryId && classificationService.shouldPrefill(suggestion.confidence)) {
            setCategoryId(suggestion.categoryId);
            setSuggestionApplied(true);
          }
          if (suggestion.memberId && classificationService.shouldPrefill(suggestion.confidence)) {
            setMemberId(suggestion.memberId);
          }
        })
        .catch(() => undefined);
    },
    [smartDefaults]
  );

  const pickCategory = (id: string | null) => {
    categoryTouched.current = true;
    setSuggestionApplied(false);
    setCategoryId(id);
  };

  const pickMerchant = (name: string) => {
    setMerchant(name);
    setErrors((e) => ({ ...e, merchant: undefined }));
    suggestForMerchant(name);
  };

  const submit = async () => {
    const amountPaise = parseAmount(amount);
    const next: typeof errors = {};
    if (!amountPaise || amountPaise <= 0) next.amount = 'Enter an amount';
    if (!merchant.trim()) next.merchant = income ? 'Who paid you?' : 'Who did you pay?';
    setErrors(next);
    if (next.amount || next.merchant || !amountPaise) return;

    setSaving(true);
    try {
      await onSubmit({
        amountPaise,
        merchant: merchant.trim(),
        categoryId,
        memberId: income ? null : memberId,
        note: note.trim() || null,
        transactionTimestamp: date.getTime(),
        kind,
      });
    } catch (err) {
      console.error('[TransactionForm] save failed:', err);
      if (mountedRef.current) setErrors({ form: 'Could not save. Please try again.' });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const changeKind = (next: TransactionKind) => {
    if (next === kind) return;
    setKind(next);
    // Categories differ between expenses and income.
    const current = categories.find((c) => c.id === categoryId);
    if (current && current.kind !== next) {
      setCategoryId(null);
      categoryTouched.current = false;
      setSuggestionApplied(false);
    }
  };

  const visibleCategories = categories.filter((c) => c.kind === kind);
  const accent = income ? colors.positive : colors.brand;

  const query = merchant.trim().toLowerCase();
  const merchantSuggestions = recentMerchants
    .filter((m) => m.toLowerCase() !== query && (!query || m.toLowerCase().includes(query)))
    .slice(0, 6);

  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} back right={headerRight} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {allowKindChange ? (
            <SegmentedControl
              options={[
                { value: 'EXPENSE' as TransactionKind, label: 'Expense' },
                { value: 'INCOME' as TransactionKind, label: 'Income' },
              ]}
              value={kind}
              onChange={changeKind}
              style={{ marginTop: space.xs }}
            />
          ) : null}

          {/* Amount */}
          <Pressable style={styles.amountBlock} onPress={() => amountRef.current?.focus()}>
            <Text variant="overline" color={income ? colors.positive : undefined}>
              {income ? 'Amount received' : 'Amount'}
            </Text>
            <View style={styles.amountRow}>
              <Text style={[styles.amountInput, styles.rupee, !amount ? { color: colors.textDisabled } : income ? { color: colors.positive } : null]}>₹</Text>
              <TextInput
                ref={amountRef}
                value={amount}
                onChangeText={(t) => {
                  setAmount(sanitizeAmountInput(t));
                  if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
                }}
                placeholder="0"
                placeholderTextColor={colors.textDisabled}
                keyboardType="decimal-pad"
                autoFocus={autoFocusAmount}
                selectionColor={accent}
                cursorColor={accent}
                style={[styles.amountInput, income && amount ? { color: colors.positive } : null]}
                accessibilityLabel="Amount in rupees"
              />
            </View>
            {errors.amount ? (
              <Text variant="caption" color={colors.negative}>
                {errors.amount}
              </Text>
            ) : null}
          </Pressable>

          {/* Merchant */}
          <TextField
            label={income ? 'Received from' : 'Paid to'}
            icon="store"
            value={merchant}
            onChangeText={(t) => {
              setMerchant(t);
              if (errors.merchant) setErrors((e) => ({ ...e, merchant: undefined }));
            }}
            onFocus={() => setMerchantFocused(true)}
            onBlur={() => {
              setMerchantFocused(false);
              suggestForMerchant(merchant);
            }}
            placeholder={income ? 'Employer, client, friend…' : 'Swiggy, Uber, Landlord…'}
            autoCapitalize="words"
            returnKeyType="done"
            error={errors.merchant}
          />
          {merchantSuggestions.length > 0 && (merchantFocused || !merchant) ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.suggestions}
            >
              {merchantSuggestions.map((m) => (
                <Chip key={m} label={m} icon="clock" onPress={() => pickMerchant(m)} />
              ))}
            </ScrollView>
          ) : null}

          {/* Category */}
          <View style={styles.sectionHead}>
            <Text variant="labelStrong" color={colors.textSecondary}>
              Category
            </Text>
            {suggestionApplied && suggestedId === categoryId ? (
              <View style={styles.hint}>
                <Icon name="sparkles" size={13} color={colors.brand} />
                <Text variant="caption" color={colors.brand}>
                  From your history
                </Text>
              </View>
            ) : null}
          </View>
          <CategoryGrid
            categories={visibleCategories}
            value={categoryId}
            onChange={pickCategory}
            suggestedId={suggestedId}
            onManage={() => router.push('/categories')}
          />

          {/* Member */}
          {members.length > 0 && !income ? (
            <>
              <Text variant="labelStrong" color={colors.textSecondary} style={styles.label}>
                Spent on
              </Text>
              <MemberChips members={members} value={memberId} onChange={setMemberId} />
            </>
          ) : null}

          {/* Date */}
          <Text variant="labelStrong" color={colors.textSecondary} style={styles.label}>
            When
          </Text>
          <Pressable
            onPress={() => setShowDate(true)}
            style={({ pressed }) => [styles.dateRow, pressed && { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel="Change date and time"
          >
            <Icon name="calendar" size={18} color={colors.textTertiary} />
            <Text variant="body" style={{ flex: 1 }}>
              {formatDayLabel(date.getTime())}, {formatTime(date.getTime())}
            </Text>
            <Text variant="labelStrong" color={colors.brand}>
              Change
            </Text>
          </Pressable>

          {/* Note */}
          <TextField
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Optional — what was it for?"
            multiline
            maxLength={200}
            containerStyle={{ marginTop: space.lg }}
          />

          {errors.form ? (
            <Text variant="label" color={colors.negative} align="center" style={{ marginTop: space.md }}>
              {errors.form}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <Button title={submitLabel} size="lg" fullWidth loading={saving} onPress={submit} icon="check" />
        </View>
      </KeyboardAvoidingView>

      <DateTimeSheet visible={showDate} value={date} onClose={() => setShowDate(false)} onChange={setDate} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  amountBlock: {
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  rupee: {
    marginRight: 2,
    lineHeight: 58,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: font.weight.bold,
    color: colors.text,
    letterSpacing: -1,
    minWidth: 40,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  suggestions: {
    gap: space.xs,
    paddingTop: space.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.xs,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    marginTop: space.xl,
    marginBottom: space.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 50,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
}));
