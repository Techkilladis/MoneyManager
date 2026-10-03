// Transactions Screen
import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, TextInput, Keyboard, FlatList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
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
  DisplayLarge,
  Button
} from '@/design/primitives';
import { transactionService, categoryService, memberService } from '@/services';
import { FormattedTransaction } from '@/domain/transaction';
import { useRouter } from 'expo-router';
import { formatDateForInput, formatDate } from '@/utils/date';
import { SelectRow } from '@/components/forms';
import { colors, typography, radius } from '@/design/tokens';

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
      <TouchableOpacity
        key={tx.id}
        onPress={() => router.push(`/transaction/${tx.id}`)}
        activeOpacity={0.9}
        style={{ paddingVertical: 12 }}
      >
        <Row justify="space-between" align="center">
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
      <Section paddedHorizontal style={{ paddingTop: 8, paddingBottom: 4 }}>
        <Row justify="space-between" align="center">
          <DisplayLarge style={{ letterSpacing: -0.8 }}>Transactions</DisplayLarge>
          <Button variant="primary" size="small" onPress={() => router.push('/transactions/new')}>
            Add
          </Button>
        </Row>
      </Section>

      {/* Filter Bar */}
      <Section paddedHorizontal style={{ paddingBottom: 8 }}>
        <Row gap={8} align="center">
          <TouchableOpacity
            style={[
              styles.filterChip,
              hasActiveFilters && styles.filterChipActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Body style={[
              styles.filterChipText,
              hasActiveFilters && styles.filterChipTextActive,
            ]}>
              Filters {hasActiveFilters && '•'}
            </Body>
          </TouchableOpacity>
          
          {showFilters && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <Row gap={6}>
                {/* Category Filter */}
                {categories.length > 0 && (
                  <SelectRow
                    label="Category"
                    value={categoryFilter}
                    options={[{ id: '', label: 'All', color: undefined }, ...categories.map(c => ({ id: c.id, label: c.label, color: c.color || undefined }))]}
                    onPress={() => Alert.alert('Category', 'Select category', [
                      { text: 'All', onPress: () => setCategoryFilter(null) },
                      ...categories.map(c => ({
                        text: c.label,
                        onPress: () => setCategoryFilter(c.id),
                      })),
                    ])}
                    editable
                    style={{ width: 140 }}
                  />
                )}
                
                {/* Member Filter */}
                {members.length > 0 && (
                  <SelectRow
                    label="Member"
                    value={memberFilter}
                    options={[{ id: '', label: 'All', color: undefined }, ...members.map(m => ({ id: m.id, label: m.label, color: m.color || undefined }))]}
                    onPress={() => Alert.alert('Member', 'Select member', [
                      { text: 'All', onPress: () => setMemberFilter(null) },
                      ...members.map(m => ({
                        text: m.label,
                        onPress: () => setMemberFilter(m.id),
                      })),
                    ])}
                    editable
                    style={{ width: 140 }}
                  />
                )}
                
                {/* Date Filter */}
                <SelectRow
                  label="Date"
                  value={dateFilterPreset}
                  options={[
                    { id: 'today', label: 'Today' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'custom', label: 'Custom' },
                  ]}
                  onPress={() => Alert.alert('Date Range', 'Select date range', [
                    { text: 'Today', onPress: () => { setDateFilterPreset('today'); setCustomDateRange(null); } },
                    { text: 'This Week', onPress: () => { setDateFilterPreset('this_week'); setCustomDateRange(null); } },
                    { text: 'This Month', onPress: () => { setDateFilterPreset('this_month'); setCustomDateRange(null); } },
                    { text: 'Custom', onPress: () => { setDateFilterPreset('custom'); } },
                  ])}
                  editable
                  style={{ width: 130 }}
                />
              </Row>
            </ScrollView>
          )}
        </Row>
      </Section>

      {/* Search */}
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
        renderItem={({ item, index }) => renderTransactionRow(item, index, index === transactions.length - 1)}
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
                action={{
                  label: 'Add Transaction',
                  onPress: () => router.push('/transactions/new')
                }}
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

const styles = StyleSheet.create({
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    color: colors.textOnDark,
  },
});