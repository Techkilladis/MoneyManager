import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { router } from 'expo-router';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { categoryService, ledgerService, memberService } from '@/services';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import { useScreenData } from '@/hooks/useScreenData';
import { FormattedTransaction } from '@/domain/transaction';
import { formatDayLabel, formatINR, pluralize, startOfDay } from '@/utils/format';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Button,
  Chip,
  Divider,
  EmptyState,
  ErrorView,
  Icon,
  LoadingView,
  ScreenHeader,
  SegmentedControl,
  Sheet,
  Text,
  TextField,
} from '@/components/ui';

type KindFilter = 'all' | 'EXPENSE' | 'INCOME';

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'EXPENSE', label: 'Spent' },
  { value: 'INCOME', label: 'Received' },
];

const PAGE = 40;

type Period = 'month' | 'last_month' | 'quarter' | 'year' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'quarter', label: '3 months' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function periodRange(p: Period): { start?: number; end?: number } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case 'month':
      return { start: new Date(y, m, 1).getTime(), end: new Date(y, m + 1, 1).getTime() };
    case 'last_month':
      return { start: new Date(y, m - 1, 1).getTime(), end: new Date(y, m, 1).getTime() };
    case 'quarter':
      return { start: new Date(y, m - 2, 1).getTime(), end: new Date(y, m + 1, 1).getTime() };
    case 'year':
      return { start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime() };
    default:
      return {};
  }
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [period, setPeriod] = useState<Period>('month');
  const [kind, setKind] = useState<KindFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filters = useMemo(
    () => ({
      ...periodRange(period),
      kind: kind === 'all' ? undefined : kind,
      search: search || undefined,
      categoryId,
      memberId,
    }),
    [period, kind, search, categoryId, memberId]
  );
  const filterKey = JSON.stringify(filters);

  const fetcher = useCallback(async () => {
    const [items, totals, daily, pending, categories, members] = await Promise.all([
      ledgerService.getHistoryPage(filters, PAGE, 0),
      ledgerService.getHistoryTotals(filters),
      ledgerService.getDailyTotals(filters),
      transactionRepository.getPending(),
      categoryService.getAll(),
      memberService.getAll(),
    ]);
    // A fresh key per load: after edits/deletes, offsets shift, so older
    // extra pages must not be appended to a newly loaded first page.
    return { key: `${filterKey}:${Date.now()}`, items, totals, daily, pendingCount: pending.length, categories, members };
  }, [filters, filterKey]);

  const { data, error, refreshing, refresh, reload } = useScreenData(fetcher);

  // Extra pages are tied to the filter key they were loaded for, so a
  // filter change implicitly discards them.
  const [more, setMore] = useState<{ key: string; items: FormattedTransaction[]; done: boolean }>({ key: '', items: [], done: false });
  const [loadingMore, setLoadingMore] = useState(false);

  const items = useMemo(() => {
    if (!data) return [];
    return more.key === data.key ? [...data.items, ...more.items] : data.items;
  }, [data, more]);
  const done = !data || data.items.length < PAGE || (more.key === data.key && more.done);

  const loadMore = () => {
    if (!data || done || loadingMore) return;
    const key = data.key;
    setLoadingMore(true);
    ledgerService
      .getHistoryPage(filters, PAGE, items.length)
      .then((page) => {
        setMore((prev) => ({
          key,
          items: prev.key === key ? [...prev.items, ...page] : page,
          done: page.length < PAGE,
        }));
      })
      .catch((err) => console.error('[History] load more failed:', err))
      .finally(() => setLoadingMore(false));
  };

  const sections = useMemo(() => {
    const groups: { title: string; day: number; data: FormattedTransaction[] }[] = [];
    for (const tx of items) {
      const day = startOfDay(tx.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.data.push(tx);
      else groups.push({ title: formatDayLabel(tx.timestamp), day, data: [tx] });
    }
    return groups;
  }, [items]);

  const onSearch = (text: string) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(text.trim()), 250);
  };

  const openTx = useCallback((tx: FormattedTransaction) => router.push(`/transaction/${tx.id}`), []);

  if (error && !data) return <ErrorView message={error} onRetry={reload} />;
  if (!data) return <LoadingView />;

  const activeCategory = data.categories.find((c) => c.id === categoryId);
  const activeMember = data.members.find((m) => m.id === memberId);
  const filterCount = (categoryId ? 1 : 0) + (memberId ? 1 : 0);
  const hasQuery = !!search || filterCount > 0;

  const header = (
    <View>
      <SegmentedControl
        options={KINDS}
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId(null);
        }}
        style={styles.kinds}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} selected={period === p.value} onPress={() => setPeriod(p.value)} />
        ))}
      </ScrollView>

      {filterCount > 0 ? (
        <View style={styles.activeFilters}>
          {categoryId ? (
            <Chip
              label={activeCategory?.name ?? 'Uncategorized'}
              selected
              color={activeCategory?.color ?? colors.textTertiary}
              trailingIcon="x"
              onPress={() => setCategoryId(null)}
            />
          ) : null}
          {activeMember ? <Chip label={activeMember.name} selected color={activeMember.color} trailingIcon="x" onPress={() => setMemberId(null)} /> : null}
          <Pressable onPress={() => { setCategoryId(null); setMemberId(null); }} hitSlop={8}>
            <Text variant="labelStrong" color={colors.brand}>
              Clear
            </Text>
          </Pressable>
        </View>
      ) : null}

      {data.pendingCount > 0 ? (
        <Pressable
          onPress={() => router.push('/quick-capture')}
          style={({ pressed }) => [styles.pending, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <View style={styles.pendingIcon}>
            <Icon name="zap" size={16} color={colors.textOnBrand} />
          </View>
          <Text variant="labelStrong" color={colors.brand} style={{ flex: 1 }}>
            {data.pendingCount === 1 ? '1 UPI payment waiting for review' : `${data.pendingCount} UPI payments waiting for review`}
          </Text>
          <Icon name="chevronRight" size={16} color={colors.brand} />
        </Pressable>
      ) : null}

      <View style={styles.summary}>
        <View>
          <Text variant="label">{pluralize(data.totals.count, kind === 'INCOME' ? 'payment' : kind === 'EXPENSE' ? 'expense' : 'transaction')}</Text>
          <Text variant="title" numeric color={kind === 'INCOME' ? colors.positive : colors.text} style={{ marginTop: space.xxs }}>
            {kind === 'INCOME' ? `+${formatINR(data.totals.income, { decimals: 'never' })}` : formatINR(data.totals.total, { decimals: 'never' })}
          </Text>
        </View>
        {kind === 'all' && data.totals.income > 0 ? (
          <Text variant="bodyStrong" numeric color={colors.positive}>
            +{formatINR(data.totals.income, { decimals: 'never' })} in
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader large title="History" />
      <View style={styles.searchRow}>
        <TextField
          icon="search"
          value={searchInput}
          onChangeText={onSearch}
          placeholder="Search merchant or note"
          returnKeyType="search"
          containerStyle={{ flex: 1 }}
          right={
            searchInput ? (
              <Pressable onPress={() => onSearch('')} hitSlop={10} accessibilityLabel="Clear search">
                <Icon name="x" size={16} color={colors.textTertiary} />
              </Pressable>
            ) : null
          }
        />
        <Pressable
          onPress={() => setShowFilters(true)}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          style={({ pressed }) => [styles.filterBtn, filterCount > 0 && styles.filterBtnActive, pressed && { opacity: 0.8 }]}
        >
          <Icon name="sliders" size={20} color={colors.text} />
          {filterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text variant="caption" color={colors.textOnBrand} style={{ fontWeight: '600', fontSize: 11, lineHeight: 14 }}>
                {filterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.brand]} tintColor={colors.brand} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text variant="label">
              {section.title}
            </Text>
            <View style={styles.dayTotals}>
              {(data.daily.get(section.day)?.spent ?? 0) > 0 ? (
                <Text variant="label" numeric color={colors.textTertiary}>
                  {formatINR(data.daily.get(section.day)?.spent ?? 0)}
                </Text>
              ) : null}
              {(data.daily.get(section.day)?.income ?? 0) > 0 ? (
                <Text variant="label" numeric color={colors.positive}>
                  +{formatINR(data.daily.get(section.day)?.income ?? 0)}
                </Text>
              ) : null}
            </View>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View style={[styles.item, first && styles.itemFirst, last && styles.itemLast]}>
              {!first ? <Divider /> : null}
              <TransactionRow tx={item} onPress={openTx} />
            </View>
          );
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={{ marginVertical: space.lg }} /> : null}
        ListEmptyComponent={
          hasQuery ? (
            <EmptyState icon="search" title="No matches" message="Try a different search, period or filter." />
          ) : (
            <EmptyState
              icon="receipt"
              title="Nothing here yet"
              message="Expenses you add or confirm will show up here, grouped by day."
              actionLabel="Add expense"
              onAction={() => router.push('/transactions/new')}
            />
          )
        }
      />

      <Sheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filter"
        footer={<Button title="Show results" size="lg" fullWidth onPress={() => setShowFilters(false)} />}
      >
        <Text variant="label" style={styles.sheetLabel}>
          Category
        </Text>
        <View style={styles.wrap}>
          <Chip label="All" selected={!categoryId} onPress={() => setCategoryId(null)} />
          {data.categories
            .filter((c) => kind === 'all' || c.kind === kind)
            .map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              categoryIcon={c.icon}
              color={c.color}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
          <Chip label="Uncategorized" categoryIcon={null} selected={categoryId === 'none'} onPress={() => setCategoryId(categoryId === 'none' ? null : 'none')} />
        </View>
        <Text variant="label" style={styles.sheetLabel}>
          Spent on
        </Text>
        <View style={styles.wrap}>
          <Chip label="Everyone" selected={!memberId} onPress={() => setMemberId(null)} />
          {data.members.map((m) => (
            <Chip key={m.id} label={m.name} color={m.color} selected={memberId === m.id} onPress={() => setMemberId(memberId === m.id ? null : m.id)} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  filterBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    borderColor: colors.brand,
  },
  filterBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kinds: {
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  periods: {
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  dayTotals: {
    flexDirection: 'row',
    gap: space.xs,
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.brandSoftBorder,
    backgroundColor: colors.brandSoft,
  },
  pendingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
  },
  list: {
    paddingBottom: space.xxxl,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xs,
  },
  // Each day is one card: rows share side borders, the first and last round off.
  item: {
    marginHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  itemFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  itemLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  sheetLabel: {
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginBottom: space.md,
  },
}));
