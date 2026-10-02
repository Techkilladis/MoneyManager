// Transactions Screen
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, TextInput, Keyboard, FlatList } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  BodyEmphasis, 
  Body, 
  Footnote, 
  Badge,
  Divider,
  EmptyState,
  Input,
  DisplayLarge 
} from '@/design/primitives';
import { transactionService } from '@/services';
import { FormattedTransaction } from '@/domain/transaction';

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<FormattedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const loadTransactions = useCallback(async (isRefresh = false, isLoadMore = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      if (isLoadMore) setLoading(true);
      if (!isLoadMore && !isRefresh) setLoading(true);
      
      setError(null);
      
      const newOffset = isRefresh || !isLoadMore ? 0 : offset;
      const data = await transactionService.getFormattedTransactions({
        search: searchQuery || undefined,
        limit: LIMIT,
        offset: newOffset,
      });
      
      if (isRefresh || !isLoadMore) {
        setTransactions(data);
        setOffset(LIMIT);
      } else {
        setTransactions(prev => [...prev, ...data]);
        setOffset(prev => prev + LIMIT);
      }
      
      setHasMore(data.length === LIMIT);
    } catch (err) {
      console.error('[TransactionsScreen] Error loading transactions:', err);
      setError('Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, offset]);

  const onRefresh = () => {
    loadTransactions(true);
  };

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    // Debounce search
    setTimeout(() => {
      loadTransactions(true);
    }, 300);
  };

  const onEndReached = () => {
    if (hasMore && !loading && !refreshing) {
      loadTransactions(false, true);
    }
  };

  const renderItem = ({ item, index }: { item: FormattedTransaction; index: number }) => {
    const isLast = index === transactions.length - 1;
    return renderTransactionRow(item, index, isLast);
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  // Reset when search changes
  useEffect(() => {
    if (searchQuery !== '') {
      loadTransactions(true);
    }
  }, [searchQuery]);

  if (loading && transactions.length === 0) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Body color="rgba(0,0,0,0.38)">Loading transactions…</Body>
      </Screen>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <Screen>
        <EmptyState
          title="Unable to load"
          subtitle={error}
          action={{ label: 'Retry', onPress: () => loadTransactions(true) }}
        />
      </Screen>
    );
  }

  const renderTransactionRow = (tx: FormattedTransaction, index: number, isLast: boolean) => {
    const showDivider = !isLast;
    const { date, time } = { date: tx.date, time: tx.time };
    
    return (
      <View key={tx.id}>
        <Row justify="space-between" align="center" style={{ paddingVertical: 12 }}>
          <View style={{ flex: 1 }}>
            <Row gap={8} align="center" style={{ marginBottom: 4 }}>
              <BodyEmphasis>{tx.merchant}</BodyEmphasis>
              {tx.category && (
                <Badge variant={tx.status === 'PENDING' ? 'pending' : 'success'} size="small">
                  {tx.category.name}
                </Badge>
              )}
              {tx.status === 'PENDING' && !tx.category && (
                <Badge variant="pending" size="small">Pending</Badge>
              )}
            </Row>
            <Row gap={8} align="center">
              <Footnote color="rgba(0,0,0,0.38)">{date}</Footnote>
              <Footnote color="rgba(0,0,0,0.38)">{time}</Footnote>
              {tx.member && (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)' }} />
                  <Footnote color="rgba(0,0,0,0.38)">{tx.member.name}</Footnote>
                </>
              )}
              {tx.note && (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)' }} />
                  <Footnote color="rgba(0,0,0,0.38)">{tx.note}</Footnote>
                </>
              )}
            </Row>
          </View>
          <BodyEmphasis style={{ textAlign: 'right', marginLeft: 16 }}>{tx.amount}</BodyEmphasis>
        </Row>
        {showDivider && <Divider inset />}
      </View>
    );
  };

  return (
    <Screen>
      <Section paddedHorizontal style={{ paddingTop: 8, paddingBottom: 4 }}>
        <DisplayLarge style={{ letterSpacing: -0.8 }}>Transactions</DisplayLarge>
      </Section>

      <Section paddedHorizontal style={{ paddingBottom: 12 }}>
        <Input
          placeholder="Search transactions…"
          value={searchQuery}
          onChangeText={onSearchChange}
          dark={false}
        />
      </Section>

      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0071e3']} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          transactions.length === 0 ? (
            <Section paddedHorizontal style={{ paddingTop: 48, paddingBottom: 48 }}>
              <EmptyState
                title={searchQuery ? 'No matches found' : 'No transactions yet'}
                subtitle={searchQuery 
                  ? 'Try adjusting your search' 
                  : 'Transactions will appear here once added'}
                style={{ paddingVertical: 32 }}
              />
            </Section>
          ) : null
        }
      />
      
      {hasMore && loading && (
        <Section paddedHorizontal style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Body color="rgba(0,0,0,0.38)">Loading more…</Body>
        </Section>
      )}
    </Screen>
  );
}