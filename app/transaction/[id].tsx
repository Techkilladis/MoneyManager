// Transaction Detail Screen
import React, { useEffect, useState } from 'react';
import { View, Linking, Platform, Alert, ScrollView } from 'react-native';
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
import { transactionService, categoryService, memberService } from '@/services';
import { FormattedTransaction } from '@/domain/transaction';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors } from '@/design/tokens';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const transactionId = params?.id;
  
  const [transaction, setTransaction] = useState<FormattedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (transactionId) {
      loadTransaction();
    }
  }, [transactionId]);

  const loadTransaction = async () => {
    if (!transactionId) return;
    
    try {
      setLoading(true);
      setError(null);
      const tx = await transactionService.getFormattedTransaction(transactionId);
      if (tx) {
        setTransaction(tx);
      } else {
        setError('Transaction not found');
      }
    } catch (err) {
      console.error('[TransactionDetail] Error:', err);
      setError('Failed to load transaction');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (transactionId) {
      router.push(`/transactions/edit/${transactionId}`);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => confirmDelete()
        }
      ]
    );
  };

  const confirmDelete = async () => {
    if (!transactionId) return;
    
    try {
      setDeleting(true);
      await transactionService.deleteTransaction(transactionId);
      router.back();
    } catch (err) {
      console.error('[TransactionDetail] Delete error:', err);
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

  if (error || !transaction) {
    return (
      <Screen>
        <EmptyState
          title={error || 'Transaction not found'}
          action={{ label: 'Go Back', onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const { 
    id, amount, amountPaise, currency, merchant, date, time, timestamp,
    category, member, note, status, sourceApp 
  } = transaction;

  const getCategoryDisplay = () => {
    if (!category) return null;
    return (
      <Row gap={6} align="center">
        <Badge variant={status === 'PENDING' ? 'pending' : 'success'} size="small">
          {category.name}
        </Badge>
      </Row>
    );
  };

  const getMemberDisplay = () => {
    if (!member) return null;
    return (
      <Row gap={6} align="center">
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: member.color || colors.accent,
          }}
        />
        <Footnote color="rgba(0,0,0,0.54)">{member.name}</Footnote>
      </Row>
    );
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <Section paddedHorizontal style={{ paddingTop: 8, paddingBottom: 4 }}>
          <DisplayLarge style={{ letterSpacing: -0.8 }}>{merchant}</DisplayLarge>
          <Body color="rgba(0,0,0,0.38)" style={{ marginTop: 4 }}>
            {date} at {time}
          </Body>
        </Section>

        {/* Amount Card */}
        <Section paddedHorizontal>
          <Card>
            <Row justify="space-between" align="center" style={{ paddingVertical: 20 }}>
              <BodyEmphasis>Amount</BodyEmphasis>
              <DisplayLarge style={{ letterSpacing: -0.8 }}>{amount}</DisplayLarge>
            </Row>
          </Card>
        </Section>

        {/* Details */}
        <Section paddedHorizontal>
          <Card>
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Category</BodyEmphasis>
              {getCategoryDisplay()}
            </Row>
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Member</BodyEmphasis>
              {getMemberDisplay() || <Footnote color="rgba(0,0,0,0.38)">Not assigned</Footnote>}
            </Row>
            {note && (
              <>
                <Divider inset />
                <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
                  <BodyEmphasis>Note</BodyEmphasis>
                  <Body color="rgba(0,0,0,0.54)" style={{ maxWidth: '60%', textAlign: 'right' }}>
                    {note}
                  </Body>
                </Row>
              </>
            )}
            <Divider inset />
            <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
              <BodyEmphasis>Status</BodyEmphasis>
              <Badge 
                variant={status === 'PENDING' ? 'pending' : status === 'CONFIRMED' ? 'success' : 'neutral'}
                size="standard"
              >
                {status}
              </Badge>
            </Row>
            {sourceApp && (
              <>
                <Divider inset />
                <Row justify="space-between" align="center" style={{ paddingVertical: 14 }}>
                  <BodyEmphasis>Source</BodyEmphasis>
                  <Footnote color="rgba(0,0,0,0.38)">{sourceApp}</Footnote>
                </Row>
              </>
            )}
          </Card>
        </Section>

        {/* Actions */}
        <Section paddedHorizontal>
          <Button variant="secondary" size="large" fullWidth onPress={handleEdit}>
            Edit Transaction
          </Button>
          <Button variant="destructive" size="large" fullWidth onPress={handleDelete} style={{ marginTop: 12 }} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete Transaction'}
          </Button>
        </Section>
      </ScrollView>
    </Screen>
  );
}