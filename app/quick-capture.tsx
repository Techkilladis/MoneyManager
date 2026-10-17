// Review queue for auto-captured UPI payments. Works through pending
// captures oldest-first: confirm (with category/member/note) or ignore,
// then moves straight to the next one.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius, space, tint } from '@/design/tokens';
import { Category, Member } from '@/database/schema';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import { categoryService, classificationService, memberService, transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { FormattedTransaction } from '@/domain/transaction';
import { categoryGlyph } from '@/domain/glyphs';
import {
  amountToInput,
  formatDayLabel,
  formatINR,
  formatSourceApp,
  formatTime,
  parseAmount,
  sanitizeAmountInput,
} from '@/utils/format';
import { CategoryGrid, MemberChips } from '@/components/Pickers';
import { Button, EmptyState, Icon, LoadingView, ScreenHeader, Text, TextField, useToast } from '@/components/ui';

export default function QuickCaptureScreen() {
  const params = useLocalSearchParams<{ id?: string; sourceEventId?: string }>();
  const toast = useToast();
  const [reviewed, setReviewed] = useState<string[]>([]);

  const fetcher = useCallback(async () => {
    const pending = await transactionRepository.getPending(); // newest first
    let startId = params.id ?? null;
    if (!startId && params.sourceEventId) {
      const tx = await transactionRepository.getBySourceEventId(params.sourceEventId);
      startId = tx?.id ?? null;
    }
    return { queue: pending.map((t) => t.id).reverse(), startId };
  }, [params.id, params.sourceEventId]);

  const { data } = useScreenData(fetcher);

  const onReviewed = useCallback((id: string) => setReviewed((r) => [...r, id]), []);

  if (!data) return <LoadingView />;

  const remaining = data.queue.filter((id) => !reviewed.includes(id));
  const current =
    data.startId && remaining.includes(data.startId) ? data.startId : data.startId && reviewed.length === 0 ? null : remaining[0] ?? null;
  const total = remaining.length + reviewed.length;

  if (!current) {
    const done = reviewed.length > 0;
    const requestedMissing = !!data.startId && reviewed.length === 0;
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review" back />
        <EmptyState
          icon={done ? 'check' : requestedMissing ? 'info' : 'inbox'}
          title={done ? 'All caught up!' : requestedMissing ? 'Already reviewed' : 'Nothing to review'}
          message={
            done
              ? `You reviewed ${reviewed.length === 1 ? '1 payment' : `${reviewed.length} payments`}. They're in your history now.`
              : requestedMissing
                ? 'This payment has already been confirmed or ignored.'
                : 'New UPI payments detected from your notifications will appear here.'
          }
          actionLabel="Done"
          onAction={() => {
            if (done) toast.show('All payments reviewed');
            router.back();
          }}
        />
      </View>
    );
  }

  return <ReviewCard key={current} id={current} position={reviewed.length + 1} total={total} onReviewed={onReviewed} />;
}

// ---------------------------------------------------------------- card

interface Suggestion {
  categoryId: string | null;
  memberId: string | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

function ReviewCard({
  id,
  position,
  total,
  onReviewed,
}: {
  id: string;
  position: number;
  total: number;
  onReviewed: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [tx, setTx] = useState<FormattedTransaction | null>(null);
  const [missing, setMissing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);
  const [busy, setBusy] = useState<'confirm' | 'dismiss' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [celebrate] = useState(() => new Animated.Value(0));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    Promise.all([transactionService.getFormattedTransaction(id), categoryService.getAll(), memberService.getAll()])
      .then(async ([data, cats, mems]) => {
        if (!mountedRef.current) return;
        setCategories(cats);
        setMembers(mems);
        if (!data) {
          setMissing(true);
          return;
        }
        setTx(data);
        setAmount(amountToInput(data.amountPaise));
        setMerchant(data.merchant === 'Unknown Merchant' ? '' : data.merchant);
        setNote(data.note ?? '');
        setCategoryId(data.category?.id ?? null);
        setMemberId(data.member?.id ?? null);

        try {
          const { suggestion: s } = await classificationService.getSuggestion({ merchant: data.merchant, amountPaise: data.amountPaise });
          if (!mountedRef.current || !s) return;
          setSuggestion({ categoryId: s.categoryId, memberId: s.memberId, confidence: s.confidence });
          if (!data.category && s.categoryId && classificationService.shouldPrefill(s.confidence)) setCategoryId(s.categoryId);
          if (!data.member && s.memberId && classificationService.shouldPrefill(s.confidence)) setMemberId(s.memberId);
        } catch (e) {
          console.warn('[QuickCapture] suggestion failed:', e);
        }
      })
      .catch((e) => {
        console.error('[QuickCapture] load failed:', e);
        if (mountedRef.current) setMissing(true);
      });
  }, [id]);

  const finish = (message: string) => {
    setSuccess(message);
    Animated.sequence([
      Animated.spring(celebrate, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
      Animated.delay(550),
    ]).start(() => {
      dataEvents.emit();
      onReviewed(id);
    });
  };

  const confirm = async () => {
    if (!tx) return;
    const amountPaise = parseAmount(amount);
    if (!amountPaise || amountPaise <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!merchant.trim()) {
      setError('Add who you paid');
      return;
    }
    setBusy('confirm');
    setError(null);
    const result = await transactionService.confirmTransaction(
      tx.id,
      categoryId ?? undefined,
      memberId ?? undefined,
      amountPaise,
      merchant.trim(),
      note.trim() || undefined
    );
    if (!mountedRef.current) return;
    setBusy(null);
    if (!result.success) {
      setError(result.error ?? 'Could not save this payment');
      return;
    }
    // Teach merchant memory under the (possibly corrected) merchant name too.
    if (merchant.trim() !== tx.merchant) transactionService.learnMerchant(merchant.trim(), categoryId, memberId);
    const cat = categories.find((c) => c.id === categoryId);
    finish(cat ? `Saved to ${cat.name}` : 'Saved');
  };

  const dismiss = async () => {
    if (!tx) return;
    setBusy('dismiss');
    const result = await transactionService.dismissTransaction(tx.id);
    if (!mountedRef.current) return;
    setBusy(null);
    if (!result.success) {
      toast.show('Could not ignore this payment', 'error');
      return;
    }
    dataEvents.emit();
    onReviewed(id);
  };

  const counter = total > 1 ? `${position} of ${total}` : undefined;

  if (missing) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review payment" back />
        <EmptyState icon="alert" title="Payment not found" message="It may have been reviewed already." actionLabel="Skip" onAction={() => onReviewed(id)} />
      </View>
    );
  }
  if (!tx) return <LoadingView />;

  const source = formatSourceApp(tx.sourceApp) ?? 'UPI';
  const suggestedCategory = suggestion?.categoryId ? categories.find((c) => c.id === suggestion.categoryId) : null;
  const amountPaise = parseAmount(amount) ?? 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Review payment"
        back
        right={
          counter ? (
            <View style={styles.counter}>
              <Text variant="caption" color={colors.brand} style={{ fontWeight: '600' }}>
                {counter}
              </Text>
            </View>
          ) : null
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.receipt}>
            <View style={styles.sourcePill}>
              <Icon name="zap" size={13} color={colors.brand} />
              <Text variant="caption" color={colors.brand} style={{ fontWeight: '600' }}>
                Detected from {source}
              </Text>
            </View>
            {editingAmount ? (
              <View style={styles.amountRow}>
                <Text style={styles.amountText}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={() => setEditingAmount(false)}
                  selectionColor={colors.brand}
                  style={[styles.amountText, styles.amountInput]}
                />
              </View>
            ) : (
              <Pressable onPress={() => setEditingAmount(true)} style={styles.amountRow} accessibilityLabel="Edit amount" accessibilityRole="button">
                <Text style={styles.amountText} numeric>
                  {formatINR(amountPaise)}
                </Text>
                <View style={styles.editBadge}>
                  <Icon name="pencil" size={12} color={colors.textTertiary} />
                </View>
              </Pressable>
            )}
            <Text variant="label" align="center">
              {formatDayLabel(tx.timestamp)} at {formatTime(tx.timestamp)}
            </Text>
          </View>

          <TextField
            label="Paid to"
            icon="store"
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Who did you pay?"
            autoCapitalize="words"
          />

          {suggestedCategory ? (
            <View style={[styles.suggestion, { backgroundColor: tint(suggestedCategory.color, 0.12) }]}>
              <Icon name="sparkles" size={16} color={colors.brand} />
              <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                {suggestion?.confidence === 'HIGH' ? 'You usually file' : 'Last time you filed'} {tx.merchant} under{' '}
                <Text variant="caption" color={colors.text} style={{ fontWeight: '600' }}>
                  {categoryGlyph(suggestedCategory.icon)} {suggestedCategory.name}
                </Text>
              </Text>
            </View>
          ) : null}

          <Text variant="labelStrong" color={colors.textSecondary} style={styles.label}>
            What was it for?
          </Text>
          <CategoryGrid
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
            suggestedId={suggestion?.categoryId}
            onManage={() => router.push('/categories')}
          />

          {members.length > 0 ? (
            <>
              <Text variant="labelStrong" color={colors.textSecondary} style={styles.label}>
                Spent on
              </Text>
              <MemberChips members={members} value={memberId} onChange={setMemberId} />
            </>
          ) : null}

          <TextField
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            maxLength={200}
            containerStyle={{ marginTop: space.lg }}
          />

          {error ? (
            <Text variant="label" color={colors.negative} align="center" style={{ marginTop: space.md }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <Button
            title="Ignore"
            variant="outline"
            size="lg"
            loading={busy === 'dismiss'}
            disabled={busy !== null || !!success}
            onPress={dismiss}
            style={{ flex: 1 }}
          />
          <Button
            title="Confirm"
            icon="check"
            size="lg"
            loading={busy === 'confirm'}
            disabled={busy !== null || !!success}
            onPress={confirm}
            style={{ flex: 2 }}
          />
        </View>
      </KeyboardAvoidingView>

      {success ? (
        <Animated.View style={[StyleSheet.absoluteFill, styles.successScrim, { opacity: celebrate }]} pointerEvents="none">
          <Animated.View
            style={[
              styles.successBadge,
              { transform: [{ scale: celebrate.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
            ]}
          >
            <Icon name="check" size={44} color={colors.textOnBrand} strokeWidth={3} />
          </Animated.View>
          <Text variant="heading" style={{ marginTop: space.lg }}>
            {success}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  counter: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  receipt: {
    alignItems: 'center',
    paddingVertical: space.lg,
    marginBottom: space.md,
    borderRadius: radius.xxl,
    backgroundColor: colors.surface,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.xs,
    minHeight: 60,
  },
  amountText: {
    fontSize: 44,
    lineHeight: 54,
    fontWeight: font.weight.bold,
    letterSpacing: -1,
    color: colors.text,
  },
  amountInput: {
    minWidth: 60,
    padding: 0,
  },
  editBadge: {
    marginLeft: space.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
    padding: space.sm,
    borderRadius: radius.lg,
  },
  label: {
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  successScrim: {
    backgroundColor: 'rgba(245,246,250,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
