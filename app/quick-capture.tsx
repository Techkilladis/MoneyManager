// Quick Capture Screen - Polished capture workflow for pending UPI events
// Phase 5: Added merchant memory suggestions with confidence indicators
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Platform, StyleSheet, Keyboard, Animated, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  Column,
  DisplayMedium,
  Title1,
  Title2,
  Headline,
  Body, 
  BodyEmphasis, 
  Subhead,
  Caption1,
  Caption2,
  Micro,
  Badge,
  Divider,
  Button,
  Input,
  TextPrimitive,
  SectionHeader,
} from '@/design/primitives';
import { transactionService, categoryService, memberService, classificationService, merchantService } from '@/services';
import { FormattedTransaction } from '@/domain/transaction';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadows, typography } from '@/design/tokens';

export default function QuickCaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, sourceEventId } = useLocalSearchParams<{ id?: string; sourceEventId?: string }>();
  
  const [tx, setTx] = useState<FormattedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; label: string; color: string | null }>>([]);
  const [members, setMembers] = useState<Array<{ id: string; label: string; color: string | null }>>([]);
  
  // Suggestion state
  const [suggestion, setSuggestion] = useState<{
    categoryId: string | null;
    memberId: string | null;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    source: 'USER_CONFIRMED' | 'SYSTEM_DEFAULT' | 'AI_SUGGESTED';
    merchantId?: string;
    merchantName?: string;
  } | null>(null);
  const [merchantEntity, setMerchantEntity] = useState<{ id: string; canonicalName: string; normalizedKey: string } | null>(null);
  
  // Picker modal state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  useEffect(() => {
    loadData();
    loadFilterData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      let data: FormattedTransaction | null = null;
      
      if (id) {
        data = await transactionService.getFormattedTransaction(id);
      } else if (sourceEventId) {
        data = null;
      }
      
      if (!data) {
        setError('Payment not found');
        setLoading(false);
        return;
      }
      
      setTx(data);
      
      setAmount(formatPaiseForInput(data.amountPaise));
      setMerchant(data.merchant);
      setNote(data.note || '');
      setCategoryId(data.category?.id || null);
      setMemberId(data.member?.id || null);
      
      // Get classification suggestion from merchant memory (Phase 5)
      try {
        const classification = await classificationService.getSuggestion({
          merchant: data.merchant,
          amountPaise: data.amountPaise,
          categoryId: data.category?.id || null,
          memberId: data.member?.id || null,
          sourceEventId: data.sourceEventId || undefined,
        });
        
        if (classification.suggestion) {
          setSuggestion(classification.suggestion);
          
          // Pre-fill if confidence is sufficient and user hasn't explicitly chosen
          if (!data.category?.id && classification.suggestion.categoryId && 
              classificationService.shouldPrefill(classification.suggestion.confidence)) {
            setCategoryId(classification.suggestion.categoryId);
          }
          if (!data.member?.id && classification.suggestion.memberId && 
              classificationService.shouldPrefill(classification.suggestion.confidence)) {
            setMemberId(classification.suggestion.memberId);
          }
        }
        setMerchantEntity(classification.merchant);
      } catch (classificationError) {
        console.warn('[QuickCapture] Classification failed:', classificationError);
      }
      
    } catch (err) {
      console.error('[QuickCapture] Load error:', err);
      setError('Failed to load payment');
    } finally {
      setLoading(false);
    }
  };

  const loadFilterData = async () => {
    try {
      const [cats, mems] = await Promise.all([
        categoryService.getAll(),
        memberService.getAll(),
      ]);
      setCategories(cats.map(c => ({ id: c.id, label: c.name, color: c.color })));
      setMembers(mems.map(m => ({ id: m.id, label: m.name, color: m.color })));
    } catch (err) {
      console.error('[QuickCapture] Filter data load error:', err);
    }
  };

  const formatPaiseForInput = (paise: number) => {
    return (paise / 100).toFixed(2);
  };

  const parseAmountInput = (value: string) => {
    const rupees = parseFloat(value.replace(/[₹,\s]/g, ''));
    return isNaN(rupees) ? 0 : Math.round(rupees * 100);
  };

  const handleCategorySelect = useCallback((newCategoryId: string | null) => {
    const oldCategoryId = categoryId;
    setCategoryId(newCategoryId);
    setShowCategoryPicker(false);
    Keyboard.dismiss();
    
    // Record correction if user changed from suggestion
    if (suggestion && oldCategoryId !== newCategoryId && merchantEntity) {
      classificationService.recordCorrection(
        merchantEntity.id,
        oldCategoryId,
        memberId,
        newCategoryId,
        memberId
      ).catch(console.warn);
    }
  }, [categoryId, memberId, merchantEntity, suggestion]);

  const handleMemberSelect = useCallback((newMemberId: string | null) => {
    const oldMemberId = memberId;
    setMemberId(newMemberId);
    setShowMemberPicker(false);
    Keyboard.dismiss();
    
    // Record correction if user changed from suggestion
    if (suggestion && oldMemberId !== newMemberId && merchantEntity) {
      classificationService.recordCorrection(
        merchantEntity.id,
        categoryId,
        oldMemberId,
        categoryId,
        newMemberId
      ).catch(console.warn);
    }
  }, [memberId, categoryId, merchantEntity, suggestion]);

  const handleConfirm = async () => {
    if (!tx) return;
    
    const amountPaise = parseAmountInput(amount);
    if (amountPaise <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!merchant.trim()) {
      setError('Please enter a merchant name');
      return;
    }
    
    setConfirming(true);
    setError(null);
    
    try {
      const result = await transactionService.confirmTransaction(
        tx.id,
        categoryId || undefined,
        memberId || undefined,
        amountPaise,
        merchant.trim(),
        note.trim() || undefined
      );
      
      if (result.success) {
        router.back();
      } else {
        setError(result.error || 'Failed to confirm payment');
      }
    } catch (err) {
      console.error('[QuickCapture] Confirm error:', err);
      setError('Failed to confirm payment');
    } finally {
      setConfirming(false);
    }
  };

  const handleDismiss = async () => {
    if (!tx) return;
    
    setDismissing(true);
    setError(null);
    
    try {
      const result = await transactionService.dismissTransaction(tx.id);
      
      if (result.success) {
        router.back();
      } else {
        setError(result.error || 'Failed to dismiss payment');
      }
    } catch (err) {
      console.error('[QuickCapture] Dismiss error:', err);
      setError('Failed to dismiss payment');
    } finally {
      setDismissing(false);
    }
  };

  const renderCategoryOption = (cat: { id: string; label: string; color: string | null }, isSelected: boolean) => (
    <TouchableOpacity
      key={cat.id}
      style={styles.pickerOption}
      onPress={() => handleCategorySelect(cat.id)}
      activeOpacity={0.7}
    >
      <Row align="center" gap={spacing[3]} style={{ flex: 1 }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? cat.color || colors.accent : colors.borderDefault,
            backgroundColor: isSelected ? (cat.color || colors.accent) + '20' : 'transparent',
          }}
        >
          {isSelected && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <TextPrimitive variant="micro" color={cat.color || colors.accent}>✓</TextPrimitive>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <BodyEmphasis>{cat.label}</BodyEmphasis>
          {isSelected && suggestion?.categoryId === cat.id && (
            <Caption2 color={colors.accent}>
              {getSuggestionLabel(suggestion.confidence, suggestion.source)}
            </Caption2>
          )}
        </View>
      </Row>
    </TouchableOpacity>
  );

  const renderMemberOption = (mem: { id: string; label: string; color: string | null }, isSelected: boolean) => (
    <TouchableOpacity
      key={mem.id}
      style={styles.pickerOption}
      onPress={() => handleMemberSelect(mem.id)}
      activeOpacity={0.7}
    >
      <Row align="center" gap={spacing[3]} style={{ flex: 1 }}>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? mem.color || colors.accent : colors.borderDefault,
            backgroundColor: isSelected ? (mem.color || colors.accent) + '20' : 'transparent',
          }}
        >
          {isSelected && (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <TextPrimitive variant="micro" color={mem.color || colors.accent}>✓</TextPrimitive>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <BodyEmphasis>{mem.label}</BodyEmphasis>
          {isSelected && suggestion?.memberId === mem.id && (
            <Caption2 color={colors.accent}>
              {getSuggestionLabel(suggestion.confidence, suggestion.source)}
            </Caption2>
          )}
        </View>
      </Row>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Body color={colors.textTertiary}>Loading…</Body>
      </Screen>
    );
  }

  if (error && !tx) {
    return (
      <Screen>
        <Section paddedHorizontal style={{ paddingTop: spacing[20] }}>
          <Card variant="outlined">
            <Section padded>
              <BodyEmphasis color={colors.error} style={{ textAlign: 'center' }}>
                {error}
              </BodyEmphasis>
              <Button 
                variant="primary" 
                fullWidth 
                onPress={() => router.back()}
                style={{ marginTop: spacing[4] }}
              >
                Go Back
              </Button>
            </Section>
          </Card>
        </Section>
      </Screen>
    );
  }

  if (!tx) return null;

  const sourceAppLabel = tx.sourceApp || 'Unknown';
  const isSeedData = tx.sourceType === 'SEED_DATA';

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[25] + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        onScroll={Keyboard.dismiss}
      >
        {/* Header */}
        <Section paddedHorizontal style={{ paddingTop: spacing[2], paddingBottom: spacing[2] }}>
          <Row justify="space-between" align="center">
            <Title1 style={{ letterSpacing: typography.letterSpacing.display }}>Quick Capture</Title1>
            <Button variant="ghost" size="small" onPress={() => router.back()}>
              <TextPrimitive variant="micro">✕</TextPrimitive>
            </Button>
          </Row>
        </Section>

        {/* Payment Card - Large Amount Display */}
        <Section paddedHorizontal>
          <Card variant="elevated" style={{ padding: spacing[6] }}>
            <Column gap={spacing[2]} align="center">
              {/* Source App Badge */}
              <Row gap={spacing[2]} align="center">
                <Badge variant="indigo" size="small" dot>
                  <Caption2>{sourceAppLabel}</Caption2>
                </Badge>
                {isSeedData && (
                  <Badge variant="neutral" size="small">
                    <Caption2>Test Data</Caption2>
                  </Badge>
                )}
              </Row>

              {/* Amount - Large */}
              <DisplayMedium style={{ letterSpacing: typography.letterSpacing.display, color: colors.textPrimary }}>
                {amount}
              </DisplayMedium>
              <Body color={colors.textTertiary}>INR</Body>

              {/* Merchant */}
              <Title2 style={{ textAlign: 'center' }}>
                {merchant || 'Unknown Merchant'}
              </Title2>

              {/* Time */}
              <Subhead color={colors.textTertiary} style={{ textAlign: 'center' }}>
                {tx.date}, {tx.time}
              </Subhead>
            </Column>
          </Card>
        </Section>

        {/* Form Fields */}
        <Section paddedHorizontal style={{ paddingTop: spacing[4] }}>
          <Card variant="outlined">
            <Section padded>
              {/* Amount Input */}
              <SectionHeader title="Amount" subtitle="Edit if incorrect" />
              <Input
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                label="Amount (₹)"
                leftIcon={<TextPrimitive variant="micro" color={colors.textTertiary}>₹</TextPrimitive>}
              />

              <Divider inset style={{ marginVertical: spacing[3] }} />

              {/* Merchant Input */}
              <SectionHeader title="Merchant" />
              <Input
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Enter merchant name"
                label="Merchant"
                leftIcon={<TextPrimitive variant="micro" color={colors.textTertiary}>🏪</TextPrimitive>}
              />

              <Divider inset style={{ marginVertical: spacing[3] }} />

              {/* Category Selector - Polished inline picker */}
              <SectionHeader 
                title="Category" 
                subtitle={suggestion?.categoryId && !tx.category?.id ? 
                  `Suggested: ${categories.find(c => c.id === suggestion.categoryId)?.label} (${getConfidenceLabel(suggestion.confidence)})` 
                  : undefined} 
              />
              <Button
                variant={categoryId ? 'secondary' : 'subtle'}
                fullWidth
                onPress={() => setShowCategoryPicker(true)}
                style={{ marginTop: spacing[1] }}
              >
                <Row justify="space-between" align="center">
                  <Column gap={spacing[1]}>
                    <BodyEmphasis>Category</BodyEmphasis>
                    <Row gap={spacing[2]} align="center">
                      <Caption1 color={colors.textTertiary}>
                        {categoryId 
                          ? categories.find(c => c.id === categoryId)?.label || 'Select category'
                          : 'Choose a category (optional)'}
                      </Caption1>
                      {suggestion?.categoryId === categoryId && categoryId && (
                        <Badge variant="indigo" size="small">
                          <Caption2>{getConfidenceLabel(suggestion.confidence)}</Caption2>
                        </Badge>
                      )}
                    </Row>
                  </Column>
                  <TextPrimitive variant="micro" color={colors.textTertiary}>▼</TextPrimitive>
                </Row>
              </Button>

              <Divider inset style={{ marginVertical: spacing[3] }} />

              {/* Member Selector - Polished inline picker */}
              <SectionHeader 
                title="Member" 
                subtitle={suggestion?.memberId && !tx.member?.id ? 
                  `Suggested: ${members.find(m => m.id === suggestion.memberId)?.label} (${getConfidenceLabel(suggestion.confidence)})` 
                  : undefined} 
              />
              <Button
                variant={memberId ? 'secondary' : 'subtle'}
                fullWidth
                onPress={() => setShowMemberPicker(true)}
                style={{ marginTop: spacing[1] }}
              >
                <Row justify="space-between" align="center">
                  <Column gap={spacing[1]}>
                    <BodyEmphasis>Member</BodyEmphasis>
                    <Row gap={spacing[2]} align="center">
                      <Caption1 color={colors.textTertiary}>
                        {memberId 
                          ? members.find(m => m.id === memberId)?.label || 'Select member'
                          : 'Select member (optional)'}
                      </Caption1>
                      {suggestion?.memberId === memberId && memberId && (
                        <Badge variant="indigo" size="small">
                          <Caption2>{getConfidenceLabel(suggestion.confidence)}</Caption2>
                        </Badge>
                      )}
                    </Row>
                  </Column>
                  <TextPrimitive variant="micro" color={colors.textTertiary}>▼</TextPrimitive>
                </Row>
              </Button>

              <Divider inset style={{ marginVertical: spacing[3] }} />

              {/* Note Input */}
              <SectionHeader title="Note" subtitle="Add a note (optional)" />
              <Input
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                label="Note"
                maxLength={200}
              />
            </Section>
          </Card>
        </Section>

        {/* Action Buttons */}
        <Section paddedHorizontal style={{ paddingTop: spacing[4] }}>
          <Row gap={spacing[3]}>
            <Button
              variant="destructive"
              size="standard"
              fullWidth
              onPress={handleDismiss}
              disabled={dismissing}
            >
              {dismissing ? (
                <>
                  <TextPrimitive variant="micro">⏳</TextPrimitive>
                  <TextPrimitive variant="buttonSmall">Dismissing…</TextPrimitive>
                </>
              ) : (
                <>
                  <TextPrimitive variant="micro">✕</TextPrimitive>
                  <TextPrimitive variant="buttonSmall">Dismiss</TextPrimitive>
                </>
              )}
            </Button>
            
            <Button
              variant="primary"
              size="standard"
              fullWidth
              onPress={handleConfirm}
              disabled={confirming}
            >
              {confirming ? (
                <>
                  <TextPrimitive variant="micro">⏳</TextPrimitive>
                  <TextPrimitive variant="buttonSmall">Confirming…</TextPrimitive>
                </>
              ) : (
                <>
                  <TextPrimitive variant="micro">✓</TextPrimitive>
                  <TextPrimitive variant="buttonSmall">Confirm Payment</TextPrimitive>
                </>
              )}
            </Button>
          </Row>
        </Section>

        {error && (
          <Section paddedHorizontal style={{ paddingTop: spacing[2] }}>
            <Card variant="outlined" style={{ backgroundColor: colors.errorBackground }}>
              <Section padded>
                <Body color={colors.error} style={{ textAlign: 'center' }}>
                  {error}
                </Body>
              </Section>
            </Card>
          </Section>
        )}

        {/* Category Picker Modal */}
        {showCategoryPicker && (
          <PickerModal
            visible={showCategoryPicker}
            onClose={() => setShowCategoryPicker(false)}
            title="Select Category"
            subtitle="Choose a category for this payment"
            options={categories}
            selectedId={categoryId}
            suggestionId={suggestion?.categoryId ?? null}
            suggestionConfidence={suggestion?.confidence ?? 'LOW'}
            suggestionSource={suggestion?.source ?? 'USER_CONFIRMED'}
            onSelect={handleCategorySelect}
            renderOption={renderCategoryOption}
            onClear={() => handleCategorySelect(null)}
          />
        )}

        {/* Member Picker Modal */}
        {showMemberPicker && (
          <PickerModal
            visible={showMemberPicker}
            onClose={() => setShowMemberPicker(false)}
            title="Select Member"
            subtitle="Choose a member for this payment"
            options={members}
            selectedId={memberId}
            suggestionId={suggestion?.memberId ?? null}
            suggestionConfidence={suggestion?.confidence ?? 'LOW'}
            suggestionSource={suggestion?.source ?? 'USER_CONFIRMED'}
            onSelect={handleMemberSelect}
            renderOption={renderMemberOption}
            onClear={() => handleMemberSelect(null)}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

// Helper functions for suggestion display
function getConfidenceLabel(confidence: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (confidence) {
    case 'HIGH': return 'High confidence';
    case 'MEDIUM': return 'Suggested';
    case 'LOW': return 'Low confidence';
    default: return '';
  }
}

function getSuggestionLabel(confidence: 'LOW' | 'MEDIUM' | 'HIGH', source: 'USER_CONFIRMED' | 'SYSTEM_DEFAULT' | 'AI_SUGGESTED'): string {
  const sourceLabel = source === 'USER_CONFIRMED' ? 'Your choice' : source === 'SYSTEM_DEFAULT' ? 'Default' : 'AI';
  return `${sourceLabel} • ${getConfidenceLabel(confidence)}`;
}

// Picker Modal Component
interface PickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  options: Array<{ id: string; label: string; color: string | null }>;
  selectedId: string | null;
  suggestionId: string | null;
  suggestionConfidence: 'LOW' | 'MEDIUM' | 'HIGH' | undefined;
  suggestionSource: 'USER_CONFIRMED' | 'SYSTEM_DEFAULT' | 'AI_SUGGESTED' | undefined;
  onSelect: (id: string | null) => void;
  renderOption: (option: { id: string; label: string; color: string | null }, isSelected: boolean) => React.ReactElement;
  onClear: () => void;
}

function PickerModal({
  visible,
  onClose,
  title,
  subtitle,
  options,
  selectedId,
  suggestionId,
  suggestionConfidence,
  suggestionSource,
  onSelect,
  renderOption,
  onClear,
}: PickerModalProps) {
  const [animValue] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(animValue, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animValue]);

  if (!visible) return null;

  return (
      <Animated.View style={[styles.modalOverlay, { opacity: animValue }]}>
        <Animated.View style={[
          styles.modalContent,
          {
            transform: [{
              translateY: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            }],
          },
        ]}>
        <Section padded style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault }}>
          <Row justify="space-between" align="center">
            <Title2>{title}</Title2>
            <Button variant="ghost" size="small" onPress={onClose}>
              <TextPrimitive variant="micro">✕</TextPrimitive>
            </Button>
          </Row>
          <Body color={colors.textTertiary} style={{ marginTop: spacing[1] }}>{subtitle}</Body>
          {suggestionId && (
            <Badge variant="indigo" size="small" style={{ marginTop: spacing[2], alignSelf: 'flex-start' }}>
              <Caption2>Suggested: {getConfidenceLabel(suggestionConfidence!)} ({suggestionSource})</Caption2>
            </Badge>
          )}
        </Section>

        <Section padded>
          <Button
            variant={selectedId ? 'destructive' : 'subtle'}
            fullWidth
            onPress={onClear}
            style={{ marginBottom: spacing[3] }}
          >
            <Row justify="center" align="center" gap={spacing[2]}>
              <TextPrimitive variant="micro">✕</TextPrimitive>
              <TextPrimitive variant="buttonSmall">Clear Selection</TextPrimitive>
            </Row>
          </Button>
        </Section>

        <Section style={{ maxHeight: 300 }}>
          {options.map(option => 
            renderOption(option, selectedId === option.id)
          )}
        </Section>

        <Section padded style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault }}>
          <Button variant="secondary" fullWidth onPress={onClose}>
            <TextPrimitive variant="buttonSmall">Done</TextPrimitive>
          </Button>
        </Section>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pickerOption: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.large,
    backgroundColor: colors.surface,
    marginBottom: spacing[1],
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing[4],
    maxHeight: '80%',
  },
});

const formatPaiseForInput = (paise: number) => {
  return (paise / 100).toFixed(2);
};

const parseAmountInput = (value: string) => {
  const rupees = parseFloat(value.replace(/[₹,\s]/g, ''));
  return isNaN(rupees) ? 0 : Math.round(rupees * 100);
};