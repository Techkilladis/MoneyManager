// Review queue for auto-captured UPI payments. Works through pending
// captures oldest-first: confirm (with category/member/note) or ignore,
// then moves straight to the next one. Opened from the capture pop-up
// (?sourceEventId=), it shows just that payment and closes afterwards,
// returning to the app the user was in when the SMS arrived (&leave=1);
// leaving without confirming keeps it pending.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { font, fontFamily, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Category, Member } from '@/database/schema';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import { categoryService, classificationService, memberService, transactionService } from '@/services';
import { notificationDetectionService } from '@/services/notificationDetection';
import { dataEvents } from '@/services/events';
import { useScreenData } from '@/hooks/useScreenData';
import { FormattedTransaction } from '@/domain/transaction';
import {
  amountToInput,
  formatDayLabel,
  formatSourceApp,
  formatTime,
  parseAmount,
  sanitizeAmountInput,
  splitINR,
} from '@/utils/format';
import { CategoryChips, CategoryGrid, MemberChips } from '@/components/Pickers';
import { haptic } from '@/utils/haptics';
import {
  BottomBar,
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  IconName,
  LoadingView,
  ScreenHeader,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';

export default function QuickCaptureScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ id?: string; sourceEventId?: string; leave?: string }>();
  const toast = useToast();
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  const handleManualScan = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const res = await notificationDetectionService.scanSmsInbox(1);
      if (res.captured > 0) {
        await transactionService.syncPendingNativeEvents();
        dataEvents.emit();
        toast.show(`Found ${res.captured} new payment${res.captured === 1 ? '' : 's'}`);
      } else {
        toast.show('No new payments found in recent SMS');
      }
    } catch {
      toast.show('Could not scan messages');
    } finally {
      setScanning(false);
    }
  }, [scanning, toast]);

  const fetcher = useCallback(async () => {
    let startId = params.id ?? null;
    if (!startId && params.sourceEventId) {
      // The pop-up usually beats the app's own sync of the new SMS payment.
      const tx = await transactionService.ensureCaptureForEvent(params.sourceEventId);
      if (tx) {
        // Guard: if the transaction was already reviewed between the deep-link and
        // now (race condition when another app was in the foreground), skip it and
        // fall back to showing whatever pending queue exists.
        if (tx.status === 'PENDING') {
          startId = tx.id;
        } else {
          console.debug('[QuickCapture] Deep-linked transaction already reviewed:', tx.id, 'status:', tx.status);
        }
      }
    }
    // Read the queue
    let pending = await transactionRepository.getPending(); // newest first

    // If queue is empty or requested payment isn't in pending,
    // sync pending native events immediately to guarantee any SMS captured
    // while the app was offloaded from RAM is imported into the database!
    if (pending.length === 0 || (startId && !pending.some((t) => t.id === startId))) {
      await transactionService.syncPendingNativeEvents();
      pending = await transactionRepository.getPending();
      if (!startId && params.sourceEventId) {
        const tx = await transactionRepository.getBySourceEventId(params.sourceEventId);
        if (tx && tx.status === 'PENDING') {
          startId = tx.id;
        }
      }
    }

    // Automated fallback: If no pending reviews exist, perform a quick 1-day scan of recent SMS
    if (pending.length === 0 && Platform.OS === 'android') {
      try {
        const scanRes = await notificationDetectionService.scanSmsInbox(1);
        if (scanRes.captured > 0) {
          await transactionService.syncPendingNativeEvents();
          pending = await transactionRepository.getPending();
          if (pending.length > 0) {
            dataEvents.emit();
          }
        }
      } catch (scanErr) {
        console.warn('[QuickCapture] Automated fallback SMS scan failed:', scanErr);
      }
    }

    return { queue: pending.map((t) => t.id).reverse(), startId };
  }, [params.id, params.sourceEventId]);

  const { data } = useScreenData(fetcher);

  const fromPopup = !!params.sourceEventId;
  const leaveApp = params.leave === '1';
  const startId = data?.startId;
  const onReviewed = useCallback(
    (id: string) => {
      if (fromPopup && id === startId) {
        if (leaveApp) {
          // Back to the app the payment interrupted; Home is ready for next time.
          router.replace('/');
          BackHandler.exitApp();
        } else if (router.canGoBack()) router.back();
        else router.replace('/');
        return;
      }
      setReviewed((r) => [...r, id]);
    },
    [fromPopup, leaveApp, startId]
  );

  if (!data) return <LoadingView />;

  const remaining = data.queue.filter((id) => !reviewed.includes(id));
  const current =
    data.startId && remaining.includes(data.startId) ? data.startId : remaining[0] ?? null;
  const total = remaining.length + reviewed.length;

  if (!current) {
    const done = reviewed.length > 0;
    const requestedMissing = !!data.startId && reviewed.length === 0;
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Review" close />
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
          actionLabel={!done && Platform.OS === 'android' ? (scanning ? 'Scanning...' : 'Scan recent SMS') : 'Done'}
          onAction={
            !done && Platform.OS === 'android'
              ? handleManualScan
              : () => {
                  if (done) toast.show('All payments reviewed');
                  router.back();
                }
          }
          secondaryLabel={!done && Platform.OS === 'android' ? 'Done' : undefined}
          onSecondary={!done && Platform.OS === 'android' ? () => router.back() : undefined}
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
  const { colors } = useTheme();
  const styles = useStyles();
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
  const [sheet, setSheet] = useState<'category' | 'member' | 'note' | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const [celebrate] = useState(() => new Animated.Value(0));
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
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
    haptic.success();
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
      setError(tx.kind === 'INCOME' ? 'Add who paid you' : 'Add who you paid');
      return;
    }
    setBusy('confirm');
    setError(null);
    // Merchant memory may suggest an expense category for money received.
    const picked = categories.find((c) => c.id === categoryId);
    const result = await transactionService.confirmTransaction(
      tx.id,
      picked && picked.kind === tx.kind ? picked.id : undefined,
      tx.kind === 'INCOME' ? undefined : memberId ?? undefined,
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
    // Clear any existing undo timer before dismissing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const result = await transactionService.dismissTransaction(tx.id);
    if (!mountedRef.current) return;
    setBusy(null);
    if (!result.success) {
      toast.show('Could not ignore this payment', 'error');
      return;
    }
    dataEvents.emit();
    // Show dismissed state with undo capability
    setDismissed(true);
    toast.show('Payment ignored', 'info', {
      label: 'Undo',
      onPress: async () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        await transactionService.undismissTransaction(tx.id);
        if (mountedRef.current) setDismissed(false);
      },
    });
    // Auto-expire after 5 seconds — move to next without undo
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      timeoutRef.current = null;
      onReviewed(id);
    }, 5000);
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
  const income = tx.kind === 'INCOME';
  const kindCategories = categories.filter((c) => c.kind === (income ? 'INCOME' : 'EXPENSE'));
  const suggestedCategory = suggestion?.categoryId ? categories.find((c) => c.id === suggestion.categoryId) : null;
  const amountPaise = parseAmount(amount) ?? 0;

  const [whole, fraction] = splitINR(amountPaise);
  const member = members.find((m) => m.id === memberId);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title={income ? 'Money received' : 'Review payment'}
        subtitle={`${income ? 'Received via' : 'From'} ${source} · ${formatDayLabel(tx.timestamp)}, ${formatTime(tx.timestamp)}`}
        close
        center={
          counter ? (
            <View style={styles.progress}>
              <View style={styles.dots}>
                {Array.from({ length: Math.min(total, 5) }, (_, i) => (
                  <View key={i} style={[styles.dot, i < Math.min(position, 5) && styles.dotDone]} />
                ))}
              </View>
              <Text variant="label" numeric>
                {counter}
              </Text>
            </View>
          ) : null
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Amount */}
          <View style={styles.amountBlock}>
            <Text variant="label">{income ? 'You received' : 'You paid'}</Text>
            {editingAmount ? (
              <View style={styles.amountRow}>
                <Text variant="title" color={colors.textTertiary} style={{ marginRight: space.xxs }}>
                  ₹
                </Text>
                <TextInput
                  value={amount}
                  onChangeText={(t) => setAmount(sanitizeAmountInput(t))}
                  keyboardType="decimal-pad"
                  autoFocus
                  onBlur={() => setEditingAmount(false)}
                  selectionColor={colors.brand}
                  cursorColor={colors.brand}
                  style={styles.amountInput}
                  accessibilityLabel="Amount in rupees"
                />
              </View>
            ) : (
              <>
                <View style={styles.amountRow}>
                  <Text variant="hero" numeric color={income ? colors.positive : undefined}>
                    {income ? '+' : ''}
                    {whole}
                  </Text>
                  <Text variant="title" numeric color={colors.textTertiary}>
                    {fraction}
                  </Text>
                </View>
                <Pressable onPress={() => setEditingAmount(true)} hitSlop={10} accessibilityRole="button" style={styles.editLink}>
                  <Icon name="pencil" size={14} color={colors.brand} />
                  <Text variant="labelStrong" color={colors.brand}>
                    Edit amount
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          <TextField
            label={income ? 'Received from' : 'Paid to'}
            value={merchant}
            onChangeText={setMerchant}
            placeholder={income ? 'Who paid you?' : 'Who did you pay?'}
            autoCapitalize="words"
          />

          <View style={styles.sectionHead}>
            <Text variant="label">{income ? 'What was it?' : 'What was it for?'}</Text>
            {suggestedCategory ? (
              <View style={styles.hint}>
                <Icon name="sparkles" size={14} color={colors.brand} />
                <Text variant="caption" color={colors.brand}>
                  {suggestion?.confidence === 'HIGH' ? 'You usually pick this' : 'Suggested'}
                </Text>
              </View>
            ) : null}
          </View>
          <CategoryChips
            categories={kindCategories}
            value={categoryId}
            onChange={setCategoryId}
            suggestedId={suggestion?.categoryId}
            onMore={() => setSheet('category')}
          />

          <Card padded={false} style={styles.details}>
            {members.length > 0 && !income ? (
              <>
                <DetailRow icon="user" label="For" value={member?.name ?? 'Not set'} muted={!member} onPress={() => setSheet('member')} />
                <Divider />
              </>
            ) : null}
            <DetailRow icon="note" label="Note" value={note.trim() || 'Add'} muted={!note.trim()} onPress={() => setSheet('note')} />
          </Card>

          {error ? (
            <Text variant="label" color={colors.negative} align="center" style={{ marginTop: space.md }}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <BottomBar style={styles.footer}>
          {dismissed ? (
            <Button
              title="Undo — restore ignored payment"
              icon="arrowLeft"
              size="lg"
              onPress={() => {
                if (timeoutRef.current) {
                  clearTimeout(timeoutRef.current);
                  timeoutRef.current = null;
                }
                setDismissed(false);
              }}
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <Button
                title="Ignore"
                variant="secondary"
                size="lg"
                loading={busy === 'dismiss'}
                disabled={busy !== null || !!success}
                onPress={dismiss}
                style={styles.ignore}
              />
              <Button
                title="Confirm"
                icon="check"
                size="lg"
                loading={busy === 'confirm'}
                disabled={busy !== null || !!success}
                onPress={confirm}
                style={{ flex: 1 }}
              />
            </>
          )}
        </BottomBar>
      </KeyboardAvoidingView>

      <Sheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Category">
        <CategoryGrid
          categories={kindCategories}
          value={categoryId}
          onChange={(cid) => {
            setCategoryId(cid);
            setSheet(null);
          }}
          suggestedId={suggestion?.categoryId}
          onManage={() => {
            setSheet(null);
            router.push('/categories');
          }}
        />
      </Sheet>

      <Sheet visible={sheet === 'member'} onClose={() => setSheet(null)} title="Who was it for?">
        <MemberChips
          members={members}
          value={memberId}
          onChange={(mid) => {
            setMemberId(mid);
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet
        visible={sheet === 'note'}
        onClose={() => setSheet(null)}
        title="Note"
        footer={<Button title="Done" size="lg" fullWidth onPress={() => setSheet(null)} />}
      >
        <TextField value={note} onChangeText={setNote} placeholder="What was it for?" maxLength={200} multiline autoFocus />
      </Sheet>

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
          <Text variant="title" style={{ marginTop: space.lg }}>
            {success}
          </Text>
        </Animated.View>
      ) : null}
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
      <Text variant="label" color={muted ? colors.textTertiary : colors.textSecondary} numberOfLines={1} style={{ maxWidth: '50%' }}>
        {value}
      </Text>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors, scheme) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceMuted,
  },
  dotDone: {
    backgroundColor: colors.brand,
  },
  amountBlock: {
    alignItems: 'center',
    paddingTop: space.xl,
    paddingBottom: space.xxl,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: space.xs,
    minHeight: 52,
  },
  amountInput: {
    fontSize: font.size.hero,
    fontFamily: fontFamily.semibold,
    letterSpacing: -1,
    color: colors.text,
    minWidth: 60,
    padding: 0,
    fontVariant: ['tabular-nums'],
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: space.xs,
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
  footer: {
    flexDirection: 'row',
    gap: space.sm,
  },
  ignore: {
    width: 112,
  },
  successScrim: {
    backgroundColor: scheme === 'dark' ? 'rgba(18,18,15,0.96)' : 'rgba(246,245,241,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
