// Home Screen - Premium Dashboard
import React, { useEffect, useState, useMemo } from 'react';
import { ScrollView, RefreshControl, View, Platform } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  Column,
  DisplayLarge, 
  DisplayMedium,
  DisplaySmall,
  Title1,
  Title2,
  Headline,
  Body, 
  BodyEmphasis, 
  Callout,
  Subhead,
  Footnote, 
  Caption1,
  Caption2,
  Micro,
  Badge,
  Divider,
  EmptyState,
  Button,
  Avatar,
  Input,
  TextPrimitive,
  SectionHeader,
} from '@/design/primitives';
import { transactionService } from '@/services';
import { HomeData, FormattedTransaction } from '@/domain/transaction';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, shadows, typography } from '@/design/tokens';

const formatPaise = (paise: number) => {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function HomeScreen() {
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadData = async () => {
    try {
      setError(null);
      const data = await transactionService.getHomeData();
      setHomeData(data);
    } catch (err) {
      console.error('[HomeScreen] Error loading data:', err);
      if (err instanceof Error && err.message.includes('no such table')) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          const data = await transactionService.getHomeData();
          setHomeData(data);
          return;
        } catch (retryErr) {
          console.error('[HomeScreen] Retry failed:', retryErr);
        }
      }
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

  // Spending insights - always called to maintain hook order
  const spendingInsights = useMemo(() => {
    if (!homeData) return { today: 0, week: 0, month: 0 };
    const { recentTransactions } = homeData;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).getTime();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();

    const todaySpending = recentTransactions
      .filter(t => t.timestamp >= todayStart)
      .reduce((sum, t) => sum + t.amountPaise, 0);
    
    const weekSpending = recentTransactions
      .filter(t => t.timestamp >= weekStart)
      .reduce((sum, t) => sum + t.amountPaise, 0);

    const monthSpending = recentTransactions
      .filter(t => t.timestamp >= monthStart)
      .reduce((sum, t) => sum + t.amountPaise, 0);

    return {
      today: todaySpending,
      week: weekSpending,
      month: monthSpending,
    };
  }, [homeData]);

  const renderTransactionRow = (tx: FormattedTransaction, index: number, isLast: boolean) => {
    const showDivider = !isLast;
    const { date, time } = { date: tx.date, time: tx.time };

    return (
      <View key={tx.id}>
        <Row justify="space-between" align="center" style={{ paddingVertical: spacing[3] }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row gap={spacing[2]} align="center" style={{ marginBottom: spacing[1], flexWrap: 'wrap' }}>
              <BodyEmphasis numberOfLines={1} ellipsizeMode="tail">{tx.merchant}</BodyEmphasis>
              {tx.category && (
                <Badge 
                  variant={tx.status === 'PENDING' ? 'pending' : tx.status === 'CONFIRMED' ? 'success' : 'neutral'} 
                  size="small"
                >
                  {tx.category.name}
                </Badge>
              )}
              {tx.status === 'PENDING' && !tx.category && (
                <Badge variant="pending" size="small">Pending</Badge>
              )}
            </Row>
            <Row gap={spacing[2]} align="center">
              <Caption2 color={colors.textTertiary}>{date}</Caption2>
              {tx.member && (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textQuaternary }} />
                  <Caption2 color={colors.textTertiary}>{tx.member.name}</Caption2>
                </>
              )}
            </Row>
          </View>
          <Column align="flex-end" style={{ marginLeft: spacing[4] }}>
            <BodyEmphasis style={{ textAlign: 'right' }}>{tx.amount}</BodyEmphasis>
            {tx.status === 'PENDING' && (
              <Micro color={colors.accent} style={{ textAlign: 'right', marginTop: 1 }}>
                Pending
              </Micro>
            )}
          </Column>
        </Row>
        {showDivider && <Divider inset />}
      </View>
    );
  };

  const renderInsightCard = (title: string, value: string, subtitle: string, trend?: 'up' | 'down' | 'neutral', iconColor?: string) => (
    <Card variant="outlined" style={{ flex: 1, minWidth: 120 }}>
      <Column gap={spacing[1]} style={{ padding: spacing[4] }}>
        <Row align="center" justify="space-between">
          <Body color={colors.textSecondary} style={{ flex: 1 }}>{title}</Body>
          {trend && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <TextPrimitive 
                variant="caption2" 
                color={trend === 'up' ? colors.error : trend === 'down' ? colors.success : colors.textTertiary}
              >
                {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
                {subtitle}
              </TextPrimitive>
            </View>
          )}
        </Row>
        <Headline color={colors.textPrimary} style={{ marginTop: spacing[1] }}>{value}</Headline>
        {iconColor && (
          <View style={{ 
            width: 32, 
            height: 32, 
            borderRadius: radius.large, 
            backgroundColor: iconColor + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: spacing[2]
          }}>
            <TextPrimitive variant="title1" color={iconColor}>₹</TextPrimitive>
          </View>
        )}
      </Column>
    </Card>
  );

  const renderEmptyState = () => (
    <Section paddedHorizontal>
      <EmptyState
        title="No transactions yet"
        subtitle="Your transactions will appear here once you start spending"
        action={{ 
          label: 'Add Transaction', 
          onPress: () => router.push('/transactions/new'), 
          variant: 'primary' 
        }}
        style={{ paddingVertical: spacing[12] }}
      />
    </Section>
  );

  const renderLoadingState = () => (
    <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Body color={colors.textTertiary}>Loading…</Body>
    </Screen>
  );

  const renderErrorState = () => (
    <Screen>
      <EmptyState
        title="Unable to load"
        subtitle={error ?? undefined}
        action={{ label: 'Retry', onPress: loadData, variant: 'primary' }}
      />
    </Screen>
  );

  const renderNoDataState = () => (
    <Screen>
      <EmptyState title="No data available" />
    </Screen>
  );

  const renderContent = () => {
    if (!homeData) return null;

    const { 
      totalSpendingFormatted, 
      pendingCount, 
      pendingTotalFormatted,
      recentTransactions, 
      pendingTransactions 
    } = homeData;
    const totalSpendingValue = totalSpendingFormatted.replace('₹', '').replace(',', '');

    return (
      <Screen>
        <ScrollView
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[colors.accent]}
              progressViewOffset={Platform.OS === 'ios' ? 20 : 0}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing[25] }}
        >
          {/* Hero Section - Total Confirmed Spending */}
          <Section paddedHorizontal paddedVertical={false} variant="default" style={{ paddingTop: spacing[6], paddingBottom: spacing[4] }}>
            <Row justify="space-between" align="flex-end">
              <Column gap={spacing[1]} style={{ flex: 1 }}>
                <DisplayMedium style={{ letterSpacing: typography.letterSpacing.display, color: colors.textPrimary }}>
                  {totalSpendingValue}
                </DisplayMedium>
                <Body color={colors.textTertiary}>Confirmed spending</Body>
              </Column>
              <Badge variant="indigo" dot>
                <Caption2>Confirmed</Caption2>
              </Badge>
            </Row>
          </Section>

          {/* Pending Section - Prominent but separate */}
          {pendingCount > 0 && (
            <Section paddedHorizontal variant="alt" style={{ paddingBottom: spacing[2] }}>
              <Card variant="outlined" style={{ padding: spacing[4] }}>
                <Row justify="space-between" align="center">
                  <Column gap={spacing[1]}>
                    <Row gap={spacing[2]} align="center">
                      <Badge variant="pending" dot>
                        <Caption2>Pending</Caption2>
                      </Badge>
                      <Title1 style={{ letterSpacing: typography.letterSpacing.display }}>
                        {pendingTotalFormatted}
                      </Title1>
                    </Row>
                    <Body color={colors.textTertiary}>
                      {pendingCount} payment{pendingCount > 1 ? 's' : ''} need review
                    </Body>
                  </Column>
                  <Button 
                    variant="primary" 
                    size="small" 
                    onPress={() => router.push('/quick-capture')}
                  >
                    <TextPrimitive variant="micro">→</TextPrimitive>
                    <TextPrimitive variant="buttonSmall">Review</TextPrimitive>
                  </Button>
                </Row>
              </Card>
            </Section>
          )}

          {/* Spending Insights Grid */}
          <Section paddedHorizontal variant="default" style={{ paddingBottom: spacing[4] }}>
            <SectionHeader title="Spending Overview" subtitle={`${recentTransactions.length} confirmed transactions this period`} />
            <Row gap={spacing[3]} style={{ marginTop: spacing[2] }}>
              {renderInsightCard(
                'Today', 
                formatPaise(spendingInsights.today), 
                '+12%', 
                'up', 
                colors.error
              )}
              {renderInsightCard(
                'This Week', 
                formatPaise(spendingInsights.week), 
                '-3%', 
                'down', 
                colors.success
              )}
              {renderInsightCard(
                'This Month', 
                formatPaise(spendingInsights.month), 
                '+8%', 
                'up', 
                colors.accentIndigo
              )}
            </Row>
          </Section>

          {/* Recent Confirmed Transactions */}
          <Section paddedHorizontal variant="default">
            <SectionHeader 
              title="Recent Confirmed" 
              subtitle={`${recentTransactions.length} transactions`}
              action={{ label: 'View all', onPress: () => router.push('/transactions') }}
            />
            {recentTransactions.length === 0 ? (
              renderEmptyState()
            ) : (
              recentTransactions.slice(0, 5).map((tx, i) => 
                renderTransactionRow(tx, i, i === Math.min(4, recentTransactions.length - 1))
              )
            )}
          </Section>

          {/* Quick Actions */}
          <Section paddedHorizontal variant="alt" style={{ paddingTop: spacing[4], paddingBottom: spacing[6] }}>
            <SectionHeader title="Quick Actions" />
            <Row gap={spacing[3]} style={{ marginTop: spacing[2] }}>
              <Button variant="primary" size="standard" fullWidth iconPosition="left" onPress={() => router.push('/transactions/new')}>
                <TextPrimitive variant="micro">+</TextPrimitive>
                <TextPrimitive variant="buttonSmall">New Transaction</TextPrimitive>
              </Button>
              <Button variant="secondary" size="standard" fullWidth iconPosition="left" onPress={() => router.push('/quick-capture')}>
                <TextPrimitive variant="micro">🕐</TextPrimitive>
                <TextPrimitive variant="buttonSmall">Review Pending</TextPrimitive>
              </Button>
            </Row>
            <Row gap={spacing[3]} style={{ marginTop: spacing[3] }}>
              <Button variant="subtle" size="standard" fullWidth onPress={() => router.push('/categories')}>
                <TextPrimitive variant="micro">🏷️</TextPrimitive>
                <TextPrimitive variant="buttonSmall">Categories</TextPrimitive>
              </Button>
              <Button variant="subtle" size="standard" fullWidth onPress={() => router.push('/settings')}>
                <TextPrimitive variant="micro">⚙️</TextPrimitive>
                <TextPrimitive variant="buttonSmall">Settings</TextPrimitive>
              </Button>
            </Row>
          </Section>
        </ScrollView>
      </Screen>
    );
  };

  // Always render the same hooks, conditional content inside
  if (loading) return renderLoadingState();
  if (error) return renderErrorState();
  if (!homeData) return renderNoDataState();
  return renderContent();
}