// Home Screen
import React, { useEffect, useState } from 'react';
import { ScrollView, RefreshControl, View } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  DisplayLarge, 
  Body, 
  BodyEmphasis, 
  Footnote, 
  Badge,
  Divider,
  EmptyState 
} from '@/design/primitives';
import { transactionService } from '@/services';
import { HomeData, FormattedTransaction } from '@/domain/transaction';

export default function HomeScreen() {
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const data = await transactionService.getHomeData();
      setHomeData(data);
    } catch (err) {
      console.error('[HomeScreen] Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  useEffect(() => {
    loadData();
  }, []);

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
          action={{ label: 'Retry', onPress: loadData }}
        />
      </Screen>
    );
  }

  if (!homeData) {
    return (
      <Screen>
        <EmptyState title="No data available" />
      </Screen>
    );
  }

  const { totalSpendingFormatted, pendingCount, recentTransactions, pendingTransactions } = homeData;

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
              {tx.member && (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.2)' }} />
                  <Footnote color="rgba(0,0,0,0.38)">{tx.member.name}</Footnote>
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
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0071e3']} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Greeting / Current Context */}
        <Section paddedHorizontal paddedVertical={false} style={{ paddingTop: 8, paddingBottom: 4 }}>
          <DisplayLarge style={{ letterSpacing: -0.8 }}>₹{totalSpendingFormatted.replace('₹', '')}</DisplayLarge>
          <Body color="rgba(0,0,0,0.38)" style={{ marginTop: 4 }}>Current period spending</Body>
        </Section>

        {/* Pending Transactions */}
        {pendingCount > 0 && (
          <Section paddedHorizontal>
            <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
              <BodyEmphasis>Pending ({pendingCount})</BodyEmphasis>
              <Footnote color="#0071e3">Review</Footnote>
            </Row>
            {pendingTransactions.map((tx, i) => renderTransactionRow(tx, i, i === pendingTransactions.length - 1))}
          </Section>
        )}

        {/* Recent Transactions */}
        <Section paddedHorizontal>
          <Row justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <BodyEmphasis>Recent</BodyEmphasis>
            <Footnote color="#0071e3">View all</Footnote>
          </Row>
          {recentTransactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              subtitle="Your confirmed transactions will appear here"
              style={{ paddingVertical: 32 }}
            />
          ) : (
            recentTransactions.map((tx, i) => renderTransactionRow(tx, i, i === recentTransactions.length - 1))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}