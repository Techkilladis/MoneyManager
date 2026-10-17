import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { router } from 'expo-router';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { categoryService, ledgerService, memberService } from '@/services';
import { transactionRepository } from '@/database/repositories/transactionRepository';
import { useScreenData } from '@/hooks/useScreenData';
import { FormattedTransaction } from '@/domain/transaction';
import { categoryGlyph } from '@/domain/glyphs';
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
              emoji={activeCategory ? categoryGlyph(activeCategory.icon) : undefined}
              selected
              color={activeCategory?.color}
              icon={activeCategory ? undefined : 'x'}
              onPress={() => setCategoryId(null)}
            />
          ) : null}
          {activeMember ? <Chip label={activeMember.name} selected color={activeMember.color} onPress={() => setMemberId(null)} /> : null}
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
          <Icon name="zap" size={16} color={colors.brand} />
          <Text variant="labelStrong" color={colors.brand} style={{ flex: 1 }}>
            {data.pendingCount === 1 ? '1 UPI payment waiting for review' : `${data.pendingCount} UPI payments waiting for review`}
          </Text>
          <Icon name="chevronRight" size={16} color={colors.brand} />
        </Pressable>
      ) : null}

      <View style={styles.summary}>
        <Text variant="label">{pluralize(data.totals.count, kind === 'INCOME' ? 'payment' : kind === 'EXPENSE' ? 'expense' : 'transaction')}</Text>
        <View style={styles.summaryValues}>
          {kind !== 'INCOME' ? (
            <Text variant="bodyStrong" numeric>
              {kind === 'all' && data.totals.income > 0 ? 'Spent ' : ''}
              {formatINR(data.totals.total)}
            </Text>
          ) : null}
          {kind !== 'EXPENSE' && (data.totals.income > 0 || kind === 'INCOME') ? (
            <Text variant="bodyStrong" numeric color={colors.positive}>
              +{formatINR(data.totals.income)}
            </Text>
          ) : null}
        </View>
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
          <Icon name="tag" size={20} color={filterCount > 0 ? colors.textOnBrand : colors.text} />
          {filterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text variant="caption" color={colors.brand} style={{ fontWeight: '700', fontSize: 10, lineHeight: 12 }}>
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
            <Text variant="labelStrong" color={colors.textSecondary}>
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
              {!first ? <Divider inset={72} /> : null}
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
        <Text variant="labelStrong" color={colors.textSecondary} style={styles.sheetLabel}>
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
              emoji={categoryGlyph(c.icon)}
              color={c.color}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
          <Chip label="Uncategorized" icon="tag" selected={categoryId === 'none'} onPress={() => setCategoryId(categoryId === 'none' ? null : 'none')} />
        </View>
        <Text variant="labelStrong" color={colors.textSecondary} style={styles.sheetLabel}>
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
  },
  filterBtn: {
    width: 50,
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
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
  summaryValues: {
    flexDirection: 'row',
    gap: space.sm,
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
    gap: space.xs,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.brandSoft,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  list: {
    paddingBottom: space.xxxl,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg + space.xxs,
    paddingTop: space.lg,
    paddingBottom: space.xs,
  },
  item: {
    marginHorizontal: space.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  itemFirst: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.xxs,
  },
  itemLast: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    paddingBottom: space.xxs,
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
