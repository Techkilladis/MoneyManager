// Transactions Screen - Premium Transaction List
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ScrollView, RefreshControl, View, TextInput, Keyboard, FlatList, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { 
  Screen, 
  Section, 
  Card, 
  Row, 
  Column,
  BodyEmphasis, 
  Body, 
  Footnote, 
  Badge,
  Divider,
  EmptyState,
  Input,
  DisplayLarge,
  Button,
  Title2,
  Caption1,
  Caption2,
  Micro,
  Title1,
  SectionHeader,
  ListItem,
  TextPrimitive,
} from '@/design/primitives';
import { transactionService, categoryService, memberService } from '@/services';
import { FormattedTransaction } from '@/domain/transaction';
import { useRouter } from 'expo-router';
import { formatDateForInput, formatDate } from '@/utils/date';
import { colors, spacing, radius, shadows, typography } from '@/design/tokens';

export default function TransactionsScreen() {
  const router = useRouter();
  
  const [transactions, setTransactions] = useState<FormattedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;
  
  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const [dateFilterPreset, setDateFilterPreset] = useState<'today' | 'this_week' | 'this_month' | 'custom'>('this_month');
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter data
  const [categories, setCategories] = useState<Array<{ id: string; label: string; color: string | null }>>([]);
  const [members, setMembers] = useState<Array<{ id: string; label: string; color: string | null }>>([]);

  const loadFilterData = useCallback(async () => {
    try {
      const [cats, mems] = await Promise.all([
        categoryService.getAll(),
        memberService.getAll(),
      ]);
      setCategories(cats.map(c => ({ id: c.id, label: c.name, color: c.color })));
      setMembers(mems.map(m => ({ id: m.id, label: m.name, color: m.color })));
    } catch (err) {
      console.error('[TransactionsScreen] Load filter data error:', err);
    }
  }, []);

  useEffect(() => {
    loadFilterData();
  }, [loadFilterData]);

  const loadTransactions = useCallback(async (isRefresh = false, isLoadMore = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      if (isLoadMore) setLoading(true);
      if (!isLoadMore && !isRefresh) setLoading(true);
      
      setError(null);
      
      // Build date range from preset
      let startDate: number | undefined;
      let endDate: number | undefined;
      
      if (dateFilterPreset !== 'custom') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date;
        
        switch (dateFilterPreset) {
          case 'today':
            start = today;
            break;
          case 'this_week':
            start = new Date(today);
            start.setDate(today.getDate() - today.getDay());
            break;
          case 'this_month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        }
        startDate = start.getTime();
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      } else if (customDateRange) {
        startDate = new Date(customDateRange.start).setHours(0, 0, 0, 0);
        endDate = new Date(customDateRange.end).setHours(23, 59, 59, 999);
      }
      
      const newOffset = isRefresh || !isLoadMore ? 0 : offset;
      const data = await transactionService.getFormattedTransactions({
        search: searchQuery || undefined,
        categoryId: categoryFilter || undefined,
        memberId: memberFilter || undefined,
        startDate,
        endDate,
        limit: LIMIT,
        offset: newOffset,
        is_pending_capture: 0, // Exclude pending captures from normal transaction list
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
  }, [searchQuery, offset, categoryFilter, memberFilter, dateFilterPreset, customDateRange]);

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

  useEffect(() => {
    loadTransactions();
  }, []);

  // Reset when search/filter changes
  useEffect(() => {
    loadTransactions(true);
  }, [categoryFilter, memberFilter, dateFilterPreset]);

  if (loading && transactions.length === 0) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Body color={colors.textTertiary}>Loading transactions…</Body>
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
      <TouchableOpacity
        key={tx.id}
        onPress={() => router.push(`/transaction/${tx.id}`)}
        activeOpacity={0.9}
        style={{ paddingVertical: spacing[3] }}
      >
        <Row justify="space-between" align="center">
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
              <Caption2 color={colors.textTertiary}>{time}</Caption2>
              {tx.member && (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textQuaternary }} />
                  <Caption2 color={colors.textTertiary}>{tx.member.name}</Caption2>
                </>
              )}
              {tx.note && (
                <>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textQuaternary }} />
                  <Caption2 color={colors.textTertiary} numberOfLines={1} ellipsizeMode="tail">{tx.note}</Caption2>
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
      </TouchableOpacity>
    );
  };

  const clearFilters = () => {
    setCategoryFilter(null);
    setMemberFilter(null);
    setDateFilterPreset('this_month');
    setCustomDateRange(null);
    setShowFilters(false);
  };

  const hasActiveFilters = categoryFilter || memberFilter || dateFilterPreset !== 'this_month' || customDateRange;

  return (
    <Screen>
      <Section paddedHorizontal style={{ paddingTop: spacing[2], paddingBottom: spacing[3] }}>
        <Row justify="space-between" align="center">
          <Title1>Transactions</Title1>
          <Button variant="primary" size="small" onPress={() => router.push('/transactions/new')}>
            <TextPrimitive variant="micro">+</TextPrimitive>
            <TextPrimitive variant="buttonSmall">New</TextPrimitive>
          </Button>
        </Row>
      </Section>

      {/* Filter Bar */}
      <Section paddedHorizontal style={{ paddingBottom: spacing[2] }}>
        <Row gap={spacing[2]} align="center">
          <Button
            variant={hasActiveFilters ? 'primary' : 'subtle'}
            size="small"
            onPress={() => setShowFilters(!showFilters)}
            fullWidth={false}
          >
            <TextPrimitive variant="micro">🔍</TextPrimitive>
            <TextPrimitive variant="buttonSmall">Filters</TextPrimitive>
            {hasActiveFilters && (
              <Badge variant="indigo" size="small" dot style={{ marginLeft: spacing[1] }}>
                <Micro>Active</Micro>
              </Badge>
            )}
          </Button>
          
          {showFilters && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <Row gap={spacing[2]}>
                {/* Category Filter */}
                {categories.length > 0 && (
                  <View style={{ width: 140 }}>
                    <BodyEmphasis style={{ marginBottom: spacing[2] }}>Category</BodyEmphasis>
                    <Button 
                      variant={categoryFilter ? 'secondary' : 'subtle'} 
                      size="small"
                      fullWidth
                      onPress={() => Alert.alert('Category', 'Select category', [
                        { text: 'All', onPress: () => setCategoryFilter(null) },
                        ...categories.map(c => ({
                          text: c.label,
                          onPress: () => setCategoryFilter(c.id),
                        })),
                      ])}
                    >
                      <TextPrimitive variant="buttonSmall">
                        {categoryFilter ? categories.find(c => c.id === categoryFilter)?.label || 'Category' : 'All'}
                      </TextPrimitive>
                    </Button>
                  </View>
                )}
                
                {/* Member Filter */}
                {members.length > 0 && (
                  <View style={{ width: 140 }}>
                    <BodyEmphasis style={{ marginBottom: spacing[2] }}>Member</BodyEmphasis>
                    <Button 
                      variant={memberFilter ? 'secondary' : 'subtle'} 
                      size="small"
                      fullWidth
                      onPress={() => Alert.alert('Member', 'Select member', [
                        { text: 'All', onPress: () => setMemberFilter(null) },
                        ...members.map(m => ({
                          text: m.label,
                          onPress: () => setMemberFilter(m.id),
                        })),
                      ])}
                    >
                      <TextPrimitive variant="buttonSmall">
                        {memberFilter ? members.find(m => m.id === memberFilter)?.label || 'Member' : 'All'}
                      </TextPrimitive>
                    </Button>
                  </View>
                )}
                
                {/* Date Filter */}
                <View style={{ width: 130 }}>
                  <BodyEmphasis style={{ marginBottom: spacing[2] }}>Date</BodyEmphasis>
                  <Button 
                    variant="secondary" 
                    size="small"
                    fullWidth
                    onPress={() => Alert.alert('Date Range', 'Select date range', [
                      { text: 'Today', onPress: () => { setDateFilterPreset('today'); setCustomDateRange(null); } },
                      { text: 'This Week', onPress: () => { setDateFilterPreset('this_week'); setCustomDateRange(null); } },
                      { text: 'This Month', onPress: () => { setDateFilterPreset('this_month'); setCustomDateRange(null); } },
                      { text: 'Custom', onPress: () => { setDateFilterPreset('custom'); } },
                    ])}
                  >
                    <TextPrimitive variant="buttonSmall">
                      {dateFilterPreset === 'today' ? 'Today' : dateFilterPreset === 'this_week' ? 'This Week' : dateFilterPreset === 'this_month' ? 'This Month' : 'Custom'}
                    </TextPrimitive>
                  </Button>
                </View>
              </Row>
            </ScrollView>
          )}
        </Row>
      </Section>

      {/* Search */}
      <Section paddedHorizontal style={{ paddingBottom: spacing[3] }}>
        <Input
          placeholder="Search transactions…"
          value={searchQuery}
          onChangeText={onSearchChange}
          dark={false}
          leftIcon={<TextPrimitive variant="micro" color={colors.textTertiary}>🔍</TextPrimitive>}
        />
      </Section>

      <FlatList
        data={transactions}
        renderItem={({ item, index }) => renderTransactionRow(item, index, index === transactions.length - 1)}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[25] }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          transactions.length === 0 ? (
            <Section paddedHorizontal style={{ paddingTop: spacing[16], paddingBottom: spacing[16] }}>
              <EmptyState
                title={searchQuery ? 'No matches found' : 'No transactions yet'}
                subtitle={searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Transactions will appear here once added'}
                action={{
                  label: 'Add Transaction',
                  onPress: () => router.push('/transactions/new')
                }}
                style={{ paddingVertical: spacing[12] }}
              />
            </Section>
          ) : null
        }
      />
      
      {hasMore && loading && (
        <Section paddedHorizontal style={{ paddingVertical: spacing[4], alignItems: 'center' }}>
          <Body color={colors.textTertiary}>Loading more…</Body>
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderDefault,
    backgroundColor: colors.surfaceElevated,
  },
  filterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterChipText: {
    fontSize: typography.size.caption1,
    fontFamily: typography.fontFamily.primary,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.textOnAccent,
  },
});