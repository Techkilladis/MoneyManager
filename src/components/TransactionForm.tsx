// Shared add/edit form for expenses and income. Deliberately light: one big
// amount, who it was paid to (with recent suggestions), one row of category
// chips (pre-filled from merchant memory), and the optional details — when,
// for whom, note — folded into rows that open sheets.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { font, fontFamily, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Category, Member, TransactionKind } from '@/database/schema';
import { categoryService, classificationService, ledgerService, memberService } from '@/services';
import { formatDayLabel, formatTime, parseAmount, sanitizeAmountInput } from '@/utils/format';
import { DateTimeSheet } from './DateTimeSheet';
import { CategoryChips, CategoryGrid } from './Pickers';
import {
  BottomBar,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  IconName,
  ListRow,
  MemberAvatar,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  Text,
  TextField,
} from './ui';

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
  /** Presented as a modal: close with an "x" instead of a back arrow. */
  modal?: boolean;
}

const KINDS = [
  { value: 'EXPENSE' as TransactionKind, label: 'Expense' },
  { value: 'INCOME' as TransactionKind, label: 'Income' },
];

export function TransactionForm({
  title,
  submitLabel,
  initial,
  autoFocusAmount = false,
  smartDefaults = false,
  onSubmit,
  headerRight,
  allowKindChange = true,
  modal = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
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
  const [sheet, setSheet] = useState<'date' | 'category' | 'member' | 'note' | null>(null);
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
  const member = members.find((m) => m.id === memberId);

  const query = merchant.trim().toLowerCase();
  const merchantSuggestions = recentMerchants
    .filter((m) => m.toLowerCase() !== query && (!query || m.toLowerCase().includes(query)))
    .slice(0, 6);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={allowKindChange ? '' : title}
        back={!modal}
        close={modal}
        right={headerRight}
        center={allowKindChange ? <SegmentedControl compact options={KINDS} value={kind} onChange={changeKind} /> : null}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Amount: the one dominant field */}
          <Pressable style={styles.amountBlock} onPress={() => amountRef.current?.focus()} accessibilityLabel={title}>
            <Text variant="label">{income ? 'Amount received' : 'Amount'}</Text>
            <View style={styles.amountRow}>
              <Text variant="title" color={colors.textTertiary} style={styles.rupee}>
                ₹
              </Text>
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
                selectionColor={colors.brand}
                cursorColor={colors.brand}
                style={[styles.amountInput, income && amount ? { color: colors.positive } : null]}
                accessibilityLabel="Amount in rupees"
              />
            </View>
            {errors.amount ? (
              <Text variant="caption" color={colors.negative} style={{ marginTop: space.xxs }}>
                {errors.amount}
              </Text>
            ) : null}
          </Pressable>

          {/* Who */}
          <TextField
            label={income ? 'Received from' : 'Paid to'}
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
              style={styles.bleed}
              contentContainerStyle={styles.suggestions}
            >
              {merchantSuggestions.map((m) => (
                <Chip key={m} label={m} icon="history" onPress={() => pickMerchant(m)} />
              ))}
            </ScrollView>
          ) : null}

          {/* Category */}
          <View style={styles.sectionHead}>
            <Text variant="label">Category</Text>
            {suggestionApplied && suggestedId === categoryId ? (
              <View style={styles.hint}>
                <Icon name="sparkles" size={14} color={colors.brand} />
                <Text variant="caption" color={colors.brand}>
                  From your history
                </Text>
              </View>
            ) : null}
          </View>
          <CategoryChips
            categories={visibleCategories}
            value={categoryId}
            onChange={pickCategory}
            suggestedId={suggestedId}
            onMore={() => setSheet('category')}
          />

          {/* Optional details, folded away */}
          <Card padded={false} style={styles.details}>
            <DetailRow icon="calendar" label="When" value={`${formatDayLabel(date.getTime())}, ${formatTime(date.getTime())}`} onPress={() => setSheet('date')} />
            {!income && members.length > 0 ? (
              <>
                <Divider />
                <DetailRow icon="user" label="For" value={member?.name ?? 'Not set'} muted={!member} onPress={() => setSheet('member')} />
              </>
            ) : null}
            <Divider />
            <DetailRow icon="note" label="Note" value={note.trim() || 'Add'} muted={!note.trim()} onPress={() => setSheet('note')} />
          </Card>

          {errors.form ? (
            <Text variant="label" color={colors.negative} align="center" style={{ marginTop: space.md }}>
              {errors.form}
            </Text>
          ) : null}
        </ScrollView>

        <BottomBar>
          <Button title={submitLabel} size="lg" fullWidth loading={saving} onPress={submit} icon="check" />
        </BottomBar>
      </KeyboardAvoidingView>

      <DateTimeSheet visible={sheet === 'date'} value={date} onClose={() => setSheet(null)} onChange={setDate} />

      <Sheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Category">
        <CategoryGrid
          categories={visibleCategories}
          value={categoryId}
          onChange={(id) => {
            pickCategory(id);
            setSheet(null);
          }}
          suggestedId={suggestedId}
          onManage={() => {
            setSheet(null);
            router.push('/categories');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'member'} onClose={() => setSheet(null)} title="Who was it for?">
        <Card padded={false}>
          {members.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={m.name}
                left={<MemberAvatar name={m.name} color={m.color} />}
                right={m.id === memberId ? <Icon name="check" size={20} color={colors.brand} /> : null}
                onPress={() => {
                  setMemberId(m.id === memberId ? null : m.id);
                  setSheet(null);
                }}
              />
            </View>
          ))}
        </Card>
      </Sheet>

      <Sheet
        visible={sheet === 'note'}
        onClose={() => setSheet(null)}
        title="Note"
        footer={<Button title="Done" size="lg" fullWidth onPress={() => setSheet(null)} />}
      >
        <TextField value={note} onChangeText={setNote} placeholder="What was it for?" multiline maxLength={200} autoFocus />
      </Sheet>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  muted = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  muted?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.detailRow, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <Icon name={icon} size={20} color={colors.textTertiary} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="label" color={muted ? colors.textTertiary : colors.textSecondary} numberOfLines={1} style={styles.detailValue}>
        {value}
      </Text>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
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
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  rupee: {
    marginRight: space.xxs,
  },
  amountInput: {
    fontSize: font.size.hero,
    fontFamily: fontFamily.semibold,
    color: colors.text,
    letterSpacing: -1,
    minWidth: 32,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  bleed: {
    marginHorizontal: -space.lg,
  },
  suggestions: {
    gap: space.xs,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xxl,
    marginBottom: space.sm,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  details: {
    marginTop: space.xxl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingHorizontal: space.md,
  },
  detailValue: {
    maxWidth: '50%',
  },
}));
