/**
 * Voice / text transaction entry.
 *
 * User types or speaks a phrase like "paid ₹200 for swiggy" or "lunch 300"
 * and the app parses it into a transaction preview.  User confirms and it
 * is saved immediately.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { transactionService } from '@/services';
import { dataEvents } from '@/services/events';
import { parseTransaction, ParsedTransaction, preprocessText } from '@/services/voiceCapture';
import { formatINR } from '@/utils/format';
import { haptic } from '@/utils/haptics';
import {
  BottomBar,
  Button,
  Card,
  Icon,
  ScreenHeader,
  Text,
  useToast,
} from '@/components/ui';

// ---------------------------------------------------------------------- state

export default function VoiceCaptureScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const toast = useToast();

  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse as user types (debounced)
  useEffect(() => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    if (!input.trim()) {
      const timer = setTimeout(() => setParsed(null), 50);
      return () => clearTimeout(timer);
    }
    parseTimer.current = setTimeout(() => {
      void parseTransaction(preprocessText(input)).then(setParsed);
    }, 350);
    return () => {
      if (parseTimer.current) clearTimeout(parseTimer.current);
    };
  }, [input]);

  const handleSave = useCallback(async () => {
    if (!parsed || saving) return;
    setSaving(true);
    try {
      await transactionService.createManualTransaction({
        amountPaise: parsed.amountPaise ?? 0,
        merchant: parsed.merchant ?? 'Unknown',
        transactionTimestamp: Date.now(),
        categoryId: parsed.categoryId,
        memberId: parsed.memberId,
        note: parsed.note,
        kind: parsed.kind,
      });
      dataEvents.emit();
      haptic.success();
      toast.show(`${formatINR(parsed.amountPaise ?? 0)} saved`);
      router.back();
    } catch (err) {
      console.error('[VoiceCapture] save failed:', err);
      toast.show('Could not save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  }, [parsed, saving, toast]);

  const handleSpeak = useCallback(async () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!input.trim()) return;
    setSpeaking(true);
    try {
      await Speech.speak(input, {
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch {
      setSpeaking(false);
    }
  }, [input, speaking]);

  const handleVoiceInput = useCallback(() => {
    // On mobile, this triggers the keyboard's built-in voice input.
    // The user can tap the microphone icon on their keyboard.
    inputRef.current?.focus();
    // Briefly highlight the input to draw attention to the keyboard's mic button
    setIsRecording(true);
    setTimeout(() => setIsRecording(false), 1500);
  }, []);

  const preview = parsed;
  const hasData = preview?.amountPaise ?? 0 > 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Add by voice or text" back />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Input area */}
          <View style={[styles.inputCard, { borderRadius: radius.xl }]}>
            <View style={styles.inputHeader}>
              <Icon name="mic" size={18} color={colors.textTertiary} />
              <Text variant="label" color={colors.textTertiary} style={{ marginLeft: space.xs }}>
                Type or speak your transaction
              </Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder={'e.g. "paid ₹200 for swiggy" or "lunch 300"'}
                placeholderTextColor={colors.textDisabled}
                multiline
                numberOfLines={3}
                style={[styles.textInput, isRecording && styles.textInputPulse]}
                selectionColor={colors.brand}
                cursorColor={colors.brand}
                accessibilityLabel="Transaction description"
              />
              <Pressable
                onPress={handleVoiceInput}
                style={[styles.micButton, isRecording && styles.micButtonActive]}
                accessibilityRole="button"
                accessibilityLabel="Use voice input — tap the microphone on your keyboard"
              >
                <Icon name={isRecording ? 'micOff' : 'mic'} size={20} color={isRecording ? colors.brand : colors.textTertiary} />
              </Pressable>
            </View>
            <Text variant="caption" color={colors.textTertiary} style={styles.hint}>
              Tip: Tap the microphone icon on your keyboard to speak
            </Text>
          </View>

          {/* Live preview */}
          {preview && (
            <Card style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text variant="labelStrong" color={colors.textSecondary}>
                  Detected
                </Text>
                {preview.confidence === 'HIGH' ? (
                  <View style={styles.confidenceBadge}>
                    <Icon name="sparkles" size={12} color={colors.textOnBrand} />
                    <Text variant="caption" color={colors.textOnBrand} style={{ marginLeft: 2 }}>
                      High confidence
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.previewRow}>
                <View style={styles.previewIcon}>
                  <Icon
                    name={preview.kind === 'INCOME' ? 'arrowDown' : 'arrowUp'}
                    size={18}
                    color={preview.kind === 'INCOME' ? colors.positive : colors.negative}
                  />
                </View>
                <View style={styles.previewDetails}>
                  {preview.amountPaise ? (
                    <Text variant="hero" numeric>
                      {preview.kind === 'INCOME' ? '+' : '-'}
                      {formatINR(preview.amountPaise, { decimals: 'never' })}
                    </Text>
                  ) : (
                    <Text variant="title" color={colors.textDisabled}>
                      ?
                    </Text>
                  )}
                  <View style={styles.previewMeta}>
                    {preview.merchant ? (
                      <Text variant="bodyStrong">{preview.merchant}</Text>
                    ) : null}
                    {preview.categoryName ? (
                      <>
                        {preview.merchant ? <Text variant="bodyStrong" color={colors.textTertiary}> · </Text> : null}
                        <Text variant="bodyStrong" color={colors.textTertiary}>{preview.categoryName}</Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>

              {preview.memberId ? (
                <View style={styles.memberHint}>
                  <Icon name="user" size={14} color={colors.textTertiary} />
                  <Text variant="caption" color={colors.textTertiary} style={{ marginLeft: space.xs }}>
                    From a known contact
                  </Text>
                </View>
              ) : null}

              {!hasData ? (
                <Text variant="label" color={colors.warning} style={styles.noData}>
                  Could not detect an amount. Try mentioning the amount, e.g. "₹200"
                </Text>
              ) : null}
            </Card>
          )}

          {/* Examples */}
          {!input && (
            <Card padded={false} style={styles.examplesCard}>
              <SectionTitle title="Try saying" />
              <ExampleChip label="paid ₹200 for swiggy" onPress={() => setInput('paid ₹200 for swiggy')} />
              <ExampleChip label="lunch 300" onPress={() => setInput('lunch 300')} />
              <ExampleChip label="received ₹5000 from Rahul" onPress={() => setInput('received ₹5000 from Rahul')} />
              <ExampleChip label="uber 150" onPress={() => setInput('uber 150')} />
              <ExampleChip label="salary 45000" onPress={() => setInput('salary 45000')} />
              <ExampleChip label="electricity bill 800" onPress={() => setInput('electricity bill 800')} />
            </Card>
          )}
        </ScrollView>

        <BottomBar>
          {preview ? (
            <>
              <Button
                title="Read Aloud"
                variant="secondary"
                size="lg"
                icon={speaking ? 'pause' : 'volume'}
                onPress={handleSpeak}
                style={styles.secondaryBtn}
              />
              <Button
                title="Save Transaction"
                icon="check"
                size="lg"
                loading={saving}
                disabled={!hasData || saving}
                onPress={handleSave}
                style={styles.saveBtn}
              />
            </>
          ) : (
            <Button
              title="Start typing or speaking..."
              variant="secondary"
              size="lg"
              fullWidth
              disabled
            />
          )}
        </BottomBar>
      </KeyboardAvoidingView>
    </View>
  );
}

// ------------------------------------------------------------------ sub-components



function ExampleChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={styles.exampleChip} accessibilityRole="button">
      <Text variant="body" color={colors.textSecondary}>{label}</Text>
      <Icon name="chevronRight" size={14} color={colors.textTertiary} />
    </Pressable>
  );
}

function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text variant="labelStrong" color={colors.textSecondary} style={{ paddingHorizontal: space.md, paddingTop: space.md }}>{title}</Text>;
}

// ---------------------------------------------------------------------- styles

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    paddingTop: space.lg,
    gap: space.lg,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    minHeight: 48,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    lineHeight: 26,
  },
  textInputPulse: {
    backgroundColor: colors.brandSoft,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginLeft: space.sm,
  },
  micButtonActive: {
    backgroundColor: colors.brandSoft,
  },
  hint: {
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  previewCard: {
    padding: space.lg,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDetails: {
    flex: 1,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  memberHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.sm,
    paddingLeft: space.xs,
  },
  noData: {
    textAlign: 'center',
    marginTop: space.md,
  },
  examplesCard: {
    marginTop: space.sm,
    borderRadius: radius.xl,
  },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  secondaryBtn: {
    width: 120,
  },
  saveBtn: {
    flex: 1,
  },
}));


