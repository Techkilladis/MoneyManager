// Transactions Screen - Premium Transaction List
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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

  // Track mount state and the latest in-flight request so stale responses
  // never overwrite newer results and results are ignored after unmount.
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Loads category/member options for the filter bar. All setState calls
  // happen in promise callbacks (never in the synchronous body), so this is
  // safe to call from an effect.
  const loadFilterData = useCallback((): void => {
    Promise.all([
      categoryService.getAll(),
      memberService.getAll(),
    ])
      .then(([cats, mems]) => {
        if (!mountedRef.current) return;
        setCategories(cats.map(c => ({ id: c.id, label: c.name, color: c.color })));
        setMembers(mems.map(m => ({ id: m.id, label: m.name, color: m.color })));
      })
      .catch((err) => {
        console.error('[TransactionsScreen] Load filter data error:', err);
      });
  }, []);

  useEffect(() => {
    loadFilterData();
  }, [loadFilterData]);

  // Loads a page of transactions. `isRefresh` replaces the list, `isLoadMore`
  // appends the next page. Callers own the synchronous loading/refreshing
  // state (event handlers may set it directly; effects rely on the initial
  // state), which keeps every setState call in this function inside promise
  // callbacks — safe to call from effects and event handlers alike.
  const loadTransactions = useCallback((isRefresh = false, isLoadMore = false): void => {
    const requestId = ++requestIdRef.current;
    const isCurrent = () => mountedRef.current && requestId === requestIdRef.current;

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

    transactionService.getFormattedTransactions({
      search: searchQuery || undefined,
      categoryId: categoryFilter || undefined,
      memberId: memberFilter || undefined,
      startDate,
      endDate,
      limit: LIMIT,
      offset: newOffset,
      is_pending_capture: 0, // Exclude pending captures from normal transaction list
    })
      .then((data) => {
        if (!isCurrent()) return;

        if (isRefresh || !isLoadMore) {
          setTransactions(data);
          setOffset(LIMIT);
        } else {
          setTransactions(prev => [...prev, ...data]);
          setOffset(prev => prev + LIMIT);
        }

        setHasMore(data.length === LIMIT);
        setError(null);
      })
      .catch((err) => {
        if (!isCurrent()) return;
        console.error('[TransactionsScreen] Error loading transactions:', err);
        setError('Failed to load transactions');
      })
      .finally(() => {
        if (!isCurrent()) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [searchQuery, offset, categoryFilter, memberFilter, dateFilterPreset, customDateRange]);

  // Keep a ref to the latest loader so the effects below always call the
  // up-to-date version without re-running whenever its identity changes.
  const loadTransactionsRef = useRef(loadTransactions);
  useEffect(() => {
    loadTransactionsRef.current = loadTransactions;
  });

  // Initial load (mount only)
  useEffect(() => {
    loadTransactionsRef.current();
  }, []);

  // Reload when filters change. The first run (mount) is skipped — the
  // initial-load effect above already covers it, and skipping avoids firing
  // the same query twice per mount.
  const didInitialFilterRunRef = useRef(false);
  useEffect(() => {
    if (!didInitialFilterRunRef.current) {
      didInitialFilterRunRef.current = true;
      return;
    }
    loadTransactionsRef.current(true);
  }, [categoryFilter, memberFilter, dateFilterPreset]);

  // Filter selection helpers. They enter the refreshing state only when the
  // selection actually changes — a no-op tap triggers no reload (matching the
  // previous behaviour), so a spinner set for it would never clear.
  const changeCategoryFilter = (id: string | null) => {
    if (categoryFilter === id) return;
    setCategoryFilter(id);
    setRefreshing(true);
  };

  const changeMemberFilter = (id: string | null) => {
    if (memberFilter === id) return;
    setMemberFilter(id);
    setRefreshing(true);
  };

  const changeDateFilterPreset = (preset: 'today' | 'this_week' | 'this_month' | 'custom') => {
    if (dateFilterPreset === preset) return;
    setDateFilterPreset(preset);
    if (preset !== 'custom') {
      setCustomDateRange(null);
    }
    setRefreshing(true);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions(true);
  };

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    // Debounce search; use the ref so the fired request always uses the
    // latest search query rather than the closure captured at schedule time.
    setTimeout(() => {
      setRefreshing(true);
      loadTransactionsRef.current(true);
    }, 300);
  };

  const onEndReached = () => {
    if (hasMore && !loading && !refreshing) {
      setLoading(true);
      loadTransactions(false, true);
    }
  };

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
          action={{ label: 'Retry', onPress: () => { setRefreshing(true); loadTransactions(true); } }}
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
                        { text: 'All', onPress: () => changeCategoryFilter(null) },
                        ...categories.map(c => ({
                          text: c.label,
                          onPress: () => changeCategoryFilter(c.id),
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
                        { text: 'All', onPress: () => changeMemberFilter(null) },
                        ...members.map(m => ({
                          text: m.label,
                          onPress: () => changeMemberFilter(m.id),
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
                      { text: 'Today', onPress: () => changeDateFilterPreset('today') },
                      { text: 'This Week', onPress: () => changeDateFilterPreset('this_week') },
                      { text: 'This Month', onPress: () => changeDateFilterPreset('this_month') },
                      { text: 'Custom', onPress: () => changeDateFilterPreset('custom') },
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