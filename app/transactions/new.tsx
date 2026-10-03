// Transaction Create Screen
import React, { useEffect, useState, useCallback } from 'react';
import { View, Alert, Keyboard, ScrollView } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  Body, 
  BodyEmphasis, 
  Footnote, 
  Badge,
  Divider,
  DisplayLarge,
  Button,
  EmptyState
} from '@/design/primitives';
import { 
  AmountInput, 
  SelectRow, 
  DateTimeSelectRow, 
  FormRow,
  InputField
} from '@/components/forms';
import { transactionService, categoryService, memberService } from '@/services';
import { Category, Member } from '@/database/schema';
import { useRouter } from 'expo-router';
import { formatPaiseForInput, parsePaise, formatPaise as formatCurrency } from '@/utils/currency';
import { formatDateForInput, formatTimeForInput, combineDateTime } from '@/utils/date';

export default function TransactionCreateScreen() {
  const router = useRouter();

  // Form state
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  
  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // Load reference data
  const loadReferenceData = useCallback(async () => {
    try {
      const [cats, mems] = await Promise.all([
        categoryService.getAll(),
        memberService.getAll(),
      ]);
      setCategories(cats);
      setMembers(mems);
      
      // Set default category (first one) and member (Self)
      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
      }
      const selfMember = mems.find(m => m.name === 'Self');
      if (selfMember && !memberId) {
        setMemberId(selfMember.id);
      }
    } catch (err) {
      console.error('[TransactionCreate] Load reference data error:', err);
    }
  }, [categoryId, memberId]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  // Validation
  const validateField = (name: string, value: any): string | null => {
    switch (name) {
      case 'amount':
        if (!value || value.trim() === '') return 'Amount is required';
        const paise = parsePaise(value);
        if (paise === null || paise <= 0) return 'Enter a valid amount';
        return null;
      case 'merchant':
        if (!value || value.trim() === '') return 'Merchant is required';
        if (value.trim().length < 1) return 'Merchant name too short';
        return null;
      case 'categoryId':
        if (value === null) return 'Category is required';
        return null;
      case 'memberId':
        if (value === null) return 'Member is required';
        return null;
      case 'date':
        if (isNaN(value.getTime())) return 'Invalid date';
        return null;
      default:
        return null;
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string | undefined> = {};
    
    const amountError = validateField('amount', amount);
    if (amountError) errors.amount = amountError;
    
    const merchantError = validateField('merchant', merchant);
    if (merchantError) errors.merchant = merchantError;
    
    const categoryError = validateField('categoryId', categoryId);
    if (categoryError) errors.categoryId = categoryError;
    
    const memberError = validateField('memberId', memberId);
    if (memberError) errors.memberId = memberError;
    
    const dateError = validateField('date', date);
    if (dateError) errors.date = dateError;
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const amountPaise = parsePaise(amount);
      if (amountPaise === null) throw new Error('Invalid amount');
      
      const input = {
        amountPaise,
        currency: 'INR',
        merchant: merchant.trim(),
        transactionTimestamp: date.getTime(),
        categoryId,
        memberId,
        note: note.trim() || null,
        status: 'CONFIRMED' as const,
        sourceApp: 'Manual',
      };
      
      await transactionService.createTransaction(input);
      router.back();
    } catch (err) {
      console.error('[TransactionCreate] Save error:', err);
      setError('Failed to create transaction');
    } finally {
      setSaving(false);
    }
  };

  // Category options for SelectRow
  const categoryOptions = categories.map(c => ({
    id: c.id,
    label: c.name,
    color: c.color || undefined,
  }));

  const memberOptions = members.map(m => ({
    id: m.id,
    label: m.name,
    color: m.color || undefined,
  }));

  const handleAmountChange = (text: string) => {
    // Allow only numbers, decimal point, and commas
    const clean = text.replace(/[^0-9.,]/g, '');
    // Allow only one decimal point
    const parts = clean.split('.');
    if (parts.length > 2) {
      setAmount(parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setAmount(clean);
    }
    // Clear amount error on change
    if (fieldErrors.amount) {
      setFieldErrors(prev => ({ ...prev, amount: undefined }));
    }
  };

  const handleMerchantChange = (text: string) => {
    setMerchant(text);
    if (fieldErrors.merchant) {
      setFieldErrors(prev => ({ ...prev, merchant: undefined }));
    }
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
  };

  const handleDatePress = () => {
    Alert.alert(
      'Date & Time',
      'Date picker would open here',
      [{ text: 'OK' }]
    );
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Section paddedHorizontal style={{ paddingTop: 8, paddingBottom: 4 }}>
          <DisplayLarge style={{ letterSpacing: -0.8 }}>New Transaction</DisplayLarge>
        </Section>

        {error && (
          <Section paddedHorizontal>
            <Card style={{ backgroundColor: '#fff0f0', borderColor: '#ffcccc' }}>
              <Body color="#cc0000">{error}</Body>
            </Card>
          </Section>
        )}

        {/* Amount Section */}
        <Section paddedHorizontal>
          <Card>
            <AmountInput
              label="Amount"
              value={amount}
              onChangeText={handleAmountChange}
              placeholder="0.00"
              error={fieldErrors.amount}
              autoFocus
              editable={!saving}
            />
          </Card>
        </Section>

        {/* Merchant Section */}
        <Section paddedHorizontal>
          <Card>
            <FormRow
              label="Merchant"
              required
              error={fieldErrors.merchant}
            >
              <InputField
                label="Merchant"
                value={merchant}
                onChangeText={handleMerchantChange}
                placeholder="Enter merchant name"
                editable={!saving}
              />
            </FormRow>
          </Card>
        </Section>

        {/* Category & Member */}
        <Section paddedHorizontal>
          <Card>
            <FormRow label="Category" required error={fieldErrors.categoryId}>
              <SelectRow
                label="Category"
                value={categoryId}
                options={categoryOptions}
                onPress={() => Alert.alert('Category', 'Select category', [
                  { text: 'Cancel', style: 'cancel' },
                  ...categoryOptions.map(c => ({
                    text: c.label,
                    onPress: () => setCategoryId(c.id),
                  })),
                ])}
                editable={!saving}
              />
            </FormRow>
            
            <Divider inset />
            
            <FormRow label="Member" required error={fieldErrors.memberId}>
              <SelectRow
                label="Member"
                value={memberId}
                options={memberOptions}
                onPress={() => Alert.alert('Member', 'Select member', [
                  { text: 'Cancel', style: 'cancel' },
                  ...memberOptions.map(m => ({
                    text: m.label,
                    onPress: () => setMemberId(m.id),
                  })),
                ])}
                editable={!saving}
              />
            </FormRow>
          </Card>
        </Section>

        {/* Date */}
        <Section paddedHorizontal>
          <Card>
            <FormRow label="Date & Time" required error={fieldErrors.date}>
              <DateTimeSelectRow
                label="Date & Time"
                date={date}
                onPress={handleDatePress}
                mode="datetime"
                editable={!saving}
              />
            </FormRow>
          </Card>
        </Section>

        {/* Note */}
        <Section paddedHorizontal>
          <Card>
            <FormRow label="Note">
              <InputField
                label="Note"
                value={note}
                onChangeText={handleNoteChange}
                placeholder="Add a note (optional)"
                editable={!saving}
                style={{ minHeight: 80 }}
              />
            </FormRow>
          </Card>
        </Section>

        {/* Actions */}
        <Section paddedHorizontal style={{ marginTop: 8 }}>
          <Button 
            variant="primary" 
            size="large" 
            fullWidth 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create Transaction'}
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}