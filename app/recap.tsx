/** Monthly recap: one screen summarising a month, shareable as text. */
import React, { useCallback, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { recapService } from '@/services';
import { monthKeyOf, parseMonthKey, previousMonthKey, recapHeadline, recapShareText } from '@/services/recap';
import { suppressLock } from '@/services/appLock';
import { useScreenData } from '@/hooks/useScreenData';
import { formatINR, pluralize, splitINR } from '@/utils/format';
import { StackedBar } from '@/components/Charts';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Button,
  Card,
  CategoryAvatar,
  EmptyState,
  Icon,
  IconButton,
  LoadingView,
  SectionTitle,
  Text,
  UncategorizedAvatar,
} from '@/components/ui';

function shiftKey(key: string, delta: number): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  return monthKeyOf(new Date(p.year, p.month + delta, 1));
}

export default function RecapScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ month?: string }>();
  const [key, setKey] = useState(() => (params.month && parseMonthKey(params.month) ? params.month : previousMonthKey()));
  const fetcher = useCallback(async () => ({ recap: await recapService.getMonthlyRecap(key) }), [key]);
  const { data } = useScreenData(fetcher);
  const currentKey = monthKeyOf(new Date());
  const canGoNext = key < currentKey;

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const share = async () => {
    if (!data?.recap) return;
    suppressLock();
    await Share.share({ message: recapShareText(data.recap) });
  };

  const recap = data?.recap;
  const [whole, fraction] = splitINR(recap?.spent ?? 0);
  const good = recap ? (recap.change !== null && recap.change < 0) || (recap.savingsRate ?? 0) > 0 : false;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <IconButton icon="x" accessibilityLabel="Close" onPress={close} background={colors.surfaceMuted} />
        <View style={styles.monthNav}>
          <IconButton icon="chevronLeft" size={36} accessibilityLabel="Previous month" onPress={() => setKey(shiftKey(key, -1))} />
          <Text variant="labelStrong" style={{ minWidth: 120, textAlign: 'center' }}>
            {recap?.label ?? ''}
          </Text>
          <IconButton
            icon="chevronRight"
            size={36}
            accessibilityLabel="Next month"
            onPress={() => canGoNext && setKey(shiftKey(key, 1))}
            color={canGoNext ? colors.text : colors.textDisabled}
          />
        </View>
        <IconButton icon="share" accessibilityLabel="Share recap" onPress={() => void share()} background={colors.surfaceMuted} />
      </View>

      {!data ? (
        <LoadingView />
      ) : !recap || recap.count === 0 ? (
        <EmptyState icon="calendar" title="Nothing recorded" message="There's no spending in this month to recap." actionLabel="Close" onAction={close} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            {good ? (
              <View style={styles.badge}>
                <Icon name="sparkles" size={14} color="#FDE68A" />
                <Text variant="caption" color="#FFFFFF">
                  Nice month
                </Text>
              </View>
            ) : null}
            <Text variant="overline" color={colors.textOnDarkMuted}>
              You spent in {recap.monthName}
            </Text>
            <View style={styles.amount}>
              <Text variant="hero" color="#FFFFFF" numeric style={{ fontSize: 42, lineHeight: 48 }}>
                {whole}
              </Text>
              <Text variant="heading" color={colors.textOnDarkSubtle} numeric style={{ marginBottom: 6 }}>
                {fraction}
              </Text>
            </View>
            <Text variant="body" color="#FFFFFF">
              {recapHeadline(recap)}
            </Text>
            <Text variant="caption" color={colors.textOnDarkMuted} style={{ marginTop: space.xxs }}>
              {pluralize(recap.count, 'expense')} · {formatINR(recap.dailyAverage, { decimals: 'never' })} a day on average
            </Text>
          </LinearGradient>

          <View style={styles.grid}>
            <Stat label="Income" value={recap.income > 0 ? formatINR(recap.income, { decimals: 'never' }) : '—'} />
            <Stat
              label={recap.saved >= 0 ? 'Saved' : 'Overspent'}
              value={recap.income > 0 ? formatINR(Math.abs(recap.saved), { decimals: 'never' }) : '—'}
              hint={recap.savingsRate !== null && recap.savingsRate > 0 ? `${Math.round(recap.savingsRate * 100)}% of income` : undefined}
              tone={recap.income > 0 ? (recap.saved >= 0 ? 'good' : 'bad') : undefined}
            />
            <Stat label="No-spend days" value={String(recap.noSpendDays)} hint={`of ${recap.daysCounted}`} />
            <Stat
              label="Budgets kept"
              value={recap.budgets.total > 0 ? `${recap.budgets.within}/${recap.budgets.total}` : '—'}
              tone={recap.budgets.total > 0 ? (recap.budgets.within === recap.budgets.total ? 'good' : 'bad') : undefined}
            />
          </View>

          {recap.categories.length > 0 ? (
            <View style={styles.block}>
              <SectionTitle title="Where it went" />
              <Card>
                <StackedBar
                  slices={recap.categories.map((c) => ({ key: c.categoryId ?? 'none', value: c.totalPaise, color: c.color ?? colors.textTertiary }))}
                />
                <View style={{ marginTop: space.sm }}>
                  {recap.categories.map((c) => (
                    <View key={c.categoryId ?? 'none'} style={styles.catRow}>
                      {c.categoryId ? <CategoryAvatar icon={c.icon} color={c.color} size={36} /> : <UncategorizedAvatar size={36} />}
                      <Text variant="labelStrong" style={{ flex: 1 }}>
                        {c.name}
                      </Text>
                      <Text variant="labelStrong" numeric>
                        {formatINR(c.totalPaise, { decimals: 'never' })}
                      </Text>
                      <Text variant="caption" numeric style={{ width: 40, textAlign: 'right' }}>
                        {Math.round(c.share * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
            </View>
          ) : null}

          {recap.topMerchant ? (
            <Card style={styles.block}>
              <View style={styles.inline}>
                <View style={styles.iconTile}>
                  <Icon name="store" size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="caption">Most visited</Text>
                  <Text variant="bodyStrong">{recap.topMerchant.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyStrong" numeric>
                    {formatINR(recap.topMerchant.total, { decimals: 'never' })}
                  </Text>
                  <Text variant="caption">{pluralize(recap.topMerchant.count, 'time')}</Text>
                </View>
              </View>
            </Card>
          ) : null}

          {recap.biggest ? (
            <View style={styles.block}>
              <SectionTitle title="Biggest expense" />
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <TransactionRow tx={recap.biggest} showDate onPress={(t) => router.push(`/transaction/${t.id}`)} />
              </Card>
            </View>
          ) : null}

          <Button title="Share my recap" icon="share" variant="secondary" size="lg" fullWidth onPress={() => void share()} style={styles.block} />
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text variant="caption">{label}</Text>
      <Text
        variant="heading"
        numeric
        numberOfLines={1}
        adjustsFontSizeToFit
        color={tone === 'good' ? colors.positive : tone === 'bad' ? colors.negative : colors.text}
        style={{ marginTop: 2 }}
      >
        {value}
      </Text>
      {hint ? <Text variant="caption">{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  hero: {
    borderRadius: radius.xxl,
    padding: space.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginBottom: space.sm,
  },
  amount: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: space.xs,
    marginBottom: space.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
  },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: space.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  block: {
    marginTop: space.xl,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
