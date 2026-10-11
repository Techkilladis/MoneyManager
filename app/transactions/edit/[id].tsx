// Transaction Edit/Create Screen
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  ConfirmDialog,
  FormRow,
  InputField
} from '@/components/forms';
import { transactionService, categoryService, memberService } from '@/services';
import { Category, Member, TransactionStatus } from '@/database/schema';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatPaiseForInput, parsePaise, formatPaise as formatCurrency } from '@/utils/currency';
import { formatDateForInput, formatTimeForInput, combineDateTime } from '@/utils/date';

type ScreenMode = 'create' | 'edit';

export default function TransactionEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const transactionId = params?.id;
  const mode: ScreenMode = transactionId ? 'edit' : 'create';

  // Form state
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [status, setStatus] = useState<TransactionStatus>('CONFIRMED');
  
  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // Tracks which transaction id has finished loading (successfully or not) so
  // the loading state can be derived during render instead of being set
  // synchronously inside an effect.
  const [loadedTransactionId, setLoadedTransactionId] = useState<string | null>(null);
  const loading = mode === 'edit' && loadedTransactionId !== transactionId;

  // Track mount state so late-arriving async results are ignored after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load reference data (categories/members). All setState calls happen in
  // promise callbacks, so this is safe to call from an effect.
  const loadReferenceData = useCallback((): void => {
    Promise.all([
      categoryService.getAll(),
      memberService.getAll(),
    ])
      .then(([cats, mems]) => {
        if (!mountedRef.current) return;
        setCategories(cats);
        setMembers(mems);
      })
      .catch((err) => {
        console.error('[TransactionEdit] Load reference data error:', err);
      });
  }, []);

  // Load existing transaction for edit mode. Applies the fetched values to the
  // form; setState only happens in promise callbacks.
  const loadTransaction = useCallback((): void => {
    if (!transactionId) return;

    transactionService.getFormattedTransaction(transactionId)
      .then((tx) => {
        if (!mountedRef.current) return;
        if (tx) {
          setAmount(formatPaiseForInput(tx.amountPaise));
          setMerchant(tx.merchant);
          setCategoryId(tx.category?.id || null);
          setMemberId(tx.member?.id || null);
          setNote(tx.note || '');
          setDate(new Date(tx.timestamp));
          setStatus(tx.status as TransactionStatus);
        } else {
          setError('Transaction not found');
        }
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        console.error('[TransactionEdit] Load error:', err);
        setError('Failed to load transaction');
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoadedTransactionId(transactionId);
      });
  }, [transactionId]);

  useEffect(() => {
    loadReferenceData();
    if (mode === 'edit') {
      loadTransaction();
    }
  }, [mode, loadReferenceData, loadTransaction]);

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
        if (mode === 'edit' && value === null) return 'Category is required';
        return null;
      case 'memberId':
        if (mode === 'edit' && value === null) return 'Member is required';
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
        status,
        sourceApp: mode === 'create' ? 'Manual' : undefined,
      };
      
      if (mode === 'create') {
        await transactionService.createTransaction(input);
      } else {
        await transactionService.updateTransaction(transactionId!, input);
      }
      
      router.back();
    } catch (err) {
      console.error('[TransactionEdit] Save error:', err);
      setError('Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionId) return;
    
    try {
      setDeleting(true);
      await transactionService.deleteTransaction(transactionId);
      router.back();
    } catch (err) {
      console.error('[TransactionEdit] Delete error:', err);
      Alert.alert('Error', 'Failed to delete transaction');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Body color="rgba(0,0,0,0.38)">Loading…</Body>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <EmptyState
          title="Unable to load"
          subtitle={error}
          action={{ label: 'Go Back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

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
    // In a real app, this would open a date picker modal
    // For now, we'll just show an alert to demonstrate
    Alert.alert(
      'Date & Time',
      'Date picker would open here',
      [{ text: 'OK' }]
    );
  };

  const title = mode === 'create' ? 'New Transaction' : 'Edit Transaction';

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Section paddedHorizontal style={{ paddingTop: 8, paddingBottom: 4 }}>
          <DisplayLarge style={{ letterSpacing: -0.8 }}>{title}</DisplayLarge>
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
              autoFocus={mode === 'create'}
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
                onPress={() => Alert.alert('Category', 'Category picker would open here', [
                  { text: 'Cancel', style: 'cancel' },
                  ...categoryOptions.slice(0, 5).map(c => ({
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
                onPress={() => Alert.alert('Member', 'Member picker would open here', [
                  { text: 'Cancel', style: 'cancel' },
                  ...memberOptions.slice(0, 5).map(m => ({
                    text: m.label,
                    onPress: () => setMemberId(m.id),
                  })),
                ])}
                editable={!saving}
              />
            </FormRow>
          </Card>
        </Section>

        {/* Date & Status */}
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
            
            {mode === 'edit' && (
              <>
                <Divider inset />
                <FormRow label="Status">
                  <SelectRow
                    label="Status"
                    value={status}
                    options={[
                      { id: 'PENDING', label: 'Pending' },
                      { id: 'CONFIRMED', label: 'Confirmed' },
                    ]}
                    onPress={() => Alert.alert('Status', 'Select transaction status', [
                      { text: 'Pending', onPress: () => setStatus('PENDING') },
                      { text: 'Confirmed', onPress: () => setStatus('CONFIRMED') },
                    ])}
                    editable={!saving}
                  />
                </FormRow>
              </>
            )}
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
            {saving ? 'Saving…' : mode === 'create' ? 'Create Transaction' : 'Save Changes'}
          </Button>
          
          {mode === 'edit' && (
            <>
              <Button 
                variant="secondary" 
                size="large" 
                fullWidth 
                onPress={() => router.push(`/transaction/${transactionId}`)}
                style={{ marginTop: 12 }}
                disabled={saving}
              >
                View Details
              </Button>
              
              <ConfirmDialog
                visible={showDeleteConfirm}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                destructive
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
              />
              
              <Button 
                variant="destructive" 
                size="large" 
                fullWidth 
                onPress={() => setShowDeleteConfirm(true)}
                style={{ marginTop: 12 }}
                disabled={saving || deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Transaction'}
              </Button>
            </>
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}