/** Monthly recap: one screen summarising a month, shareable as text. */
import React, { useCallback, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { recapService } from '@/services';
import { monthKeyOf, parseMonthKey, previousMonthKey, recapHeadline, recapShareText } from '@/services/recap';
import { suppressLock } from '@/services/appLock';
import { useScreenData } from '@/hooks/useScreenData';
import { formatINR, pluralize, splitINR } from '@/utils/format';
import { StackedBar } from '@/components/Charts';
import { TransactionRow } from '@/components/TransactionRow';
import {
  BottomBar,
  Button,
  Card,
  CategoryAvatar,
  Divider,
  EmptyState,
  IconButton,
  IconTile,
  KeyFigure,
  LoadingView,
  ScreenHeader,
  SectionTitle,
  StatusChip,
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
  const params = useLocalSearchParams<{ month?: string }>();
  const [key, setKey] = useState(() => (params.month && parseMonthKey(params.month) ? params.month : previousMonthKey()));
  const fetcher = useCallback(async () => ({ recap: await recapService.getMonthlyRecap(key) }), [key]);
  const { data } = useScreenData(fetcher);
  const currentKey = monthKeyOf(new Date());
  const canGoNext = key < currentKey;
  const canGoPrev = key > '2000-01'; // earliest plausible month key

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
    <View style={styles.screen}>
      <ScreenHeader
        title=""
        close
        onBack={close}
        center={
          <View style={styles.monthNav}>
            <IconButton
              icon="chevronLeft"
              size={40}
              background="transparent"
              color={canGoPrev ? colors.textSecondary : colors.textDisabled}
              accessibilityLabel="Previous month"
              disabled={!canGoPrev}
              onPress={() => setKey(shiftKey(key, -1))}
            />
            <Text variant="labelStrong" style={styles.monthLabel}>
              {recap?.label ?? ''}
            </Text>
            <IconButton
              icon="chevronRight"
              size={40}
              background="transparent"
              accessibilityLabel="Next month"
              onPress={() => canGoNext && setKey(shiftKey(key, 1))}
              color={canGoNext ? colors.textSecondary : colors.textDisabled}
            />
          </View>
        }
        right={<IconButton icon="share2" accessibilityLabel="Share recap" onPress={() => void share()} />}
      />

      {!data ? (
        <LoadingView />
      ) : !recap || recap.count === 0 ? (
        <EmptyState icon="calendar" title="Nothing recorded" message="There's no spending in this month to recap." actionLabel="Close" onAction={close} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {good ? (
              <View style={{ marginBottom: space.md }}>
                <StatusChip tone="warn" icon="sparkles" label="Nice month" />
              </View>
            ) : null}
            <KeyFigure label={`You spent in ${recap.monthName}`} value={whole} fraction={fraction}>
              <View style={styles.changeRow}>
                {recap.change !== null && Math.abs(recap.change) >= 0.005 ? (
                  <StatusChip
                    tone={recap.change > 0 ? 'up' : 'down'}
                    icon={recap.change > 0 ? 'trendingUp' : 'trendingDown'}
                    label={`${Math.round(Math.abs(recap.change) * 100)}%`}
                  />
                ) : null}
                <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                  {recapHeadline(recap)}
                </Text>
              </View>
              <Text variant="caption" style={{ marginTop: space.xs }}>
                {pluralize(recap.count, 'expense')} · {formatINR(recap.dailyAverage, { decimals: 'never' })} a day on average
              </Text>
            </KeyFigure>

            <Card padded={false} style={styles.block}>
              <View style={styles.gridRow}>
                <Stat label="Income" value={recap.income > 0 ? formatINR(recap.income, { decimals: 'never' }) : '—'} />
                <View style={styles.vLine} />
                <Stat
                  label={recap.saved >= 0 ? 'Saved' : 'Overspent'}
                  value={recap.income > 0 ? formatINR(Math.abs(recap.saved), { decimals: 'never' }) : '—'}
                  hint={recap.savingsRate !== null && recap.savingsRate > 0 ? `${Math.round(recap.savingsRate * 100)}% of income` : undefined}
                  tone={recap.income > 0 ? (recap.saved >= 0 ? 'good' : 'bad') : undefined}
                />
              </View>
              <Divider />
              <View style={styles.gridRow}>
                <Stat label="No-spend days" value={String(recap.noSpendDays)} hint={`of ${recap.daysCounted}`} />
                <View style={styles.vLine} />
                <Stat
                  label="Budgets kept"
                  value={recap.budgets.total > 0 ? String(recap.budgets.within) : '—'}
                  hint={recap.budgets.total > 0 ? `of ${recap.budgets.total}` : undefined}
                  tone={recap.budgets.total > 0 ? (recap.budgets.within === recap.budgets.total ? 'good' : 'bad') : undefined}
                />
              </View>
            </Card>

            {recap.categories.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle title="Where it went" />
                <Card>
                  <StackedBar
                    slices={recap.categories.map((c) => ({ key: c.categoryId ?? 'none', value: c.totalPaise, color: c.color ?? colors.textTertiary }))}
                  />
                  <View style={{ marginTop: space.md, gap: space.sm }}>
                    {recap.categories.map((c) => (
                      <View key={c.categoryId ?? 'none'} style={styles.inline}>
                        {c.categoryId ? <CategoryAvatar icon={c.icon} color={c.color} size={36} /> : <UncategorizedAvatar size={36} />}
                        <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                          {c.name}
                        </Text>
                        <Text variant="caption" numeric style={{ width: 40, textAlign: 'right' }}>
                          {Math.round(c.share * 100)}%
                        </Text>
                        <Text variant="bodyStrong" numeric style={{ minWidth: 80, textAlign: 'right' }}>
                          {formatINR(c.totalPaise, { decimals: 'never' })}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            ) : null}

            {recap.topMerchant || recap.biggest ? (
              <View style={styles.block}>
                <SectionTitle title="Standouts" />
                <Card padded={false}>
                  {recap.topMerchant ? (
                    <View style={styles.standout}>
                      <IconTile icon="store" />
                      <View style={{ flex: 1 }}>
                        <Text variant="caption">Most visited</Text>
                        <Text variant="body" numberOfLines={1}>
                          {recap.topMerchant.name} · {pluralize(recap.topMerchant.count, 'time')}
                        </Text>
                      </View>
                      <Text variant="bodyStrong" numeric>
                        {formatINR(recap.topMerchant.total, { decimals: 'never' })}
                      </Text>
                    </View>
                  ) : null}
                  {recap.topMerchant && recap.biggest ? <Divider /> : null}
                  {recap.biggest ? <TransactionRow tx={recap.biggest} showDate onPress={(t) => router.push(`/transaction/${t.id}`)} /> : null}
                </Card>
              </View>
            ) : null}
          </ScrollView>
          <BottomBar>
            <Button title="Share my recap" icon="share2" size="lg" fullWidth onPress={() => void share()} />
          </BottomBar>
        </>
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
      <View style={styles.statValue}>
        <Text
          variant="title"
          numeric
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          color={tone === 'good' ? colors.positive : tone === 'bad' ? colors.negative : colors.text}
        >
          {value}
        </Text>
        {hint ? (
          <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    minWidth: 112,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xxxl,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
  },
  block: {
    marginTop: space.xxl,
  },
  gridRow: {
    flexDirection: 'row',
  },
  vLine: {
    width: 1,
    backgroundColor: colors.border,
  },
  stat: {
    flex: 1,
    padding: space.md,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xxs,
    marginTop: space.xxs,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  standout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
}));
