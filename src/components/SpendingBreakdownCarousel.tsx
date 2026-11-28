import React, { useState } from 'react';
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { accountIcon, formatAccountLabel } from '@/domain/account';
import type { AccountSpendingTotal, CategoryShare } from '@/services/ledger';
import { Donut } from '@/components/Charts';
import { formatCompactINR, formatINR, pluralize } from '@/utils/format';
import {
  Card,
  CategoryAvatar,
  Divider,
  IconName,
  IconTile,
  ProgressBar,
  Text,
  UncategorizedAvatar,
} from '@/components/ui';

export interface AccountBreakdown {
  account: AccountSpendingTotal;
  categories: CategoryShare[];
}

interface SpendingBreakdownCarouselProps {
  totalPaise: number;
  categories: CategoryShare[];
  accountBreakdowns: AccountBreakdown[];
}

interface BreakdownSlideProps {
  cardWidth: number;
  icon: IconName;
  iconColor: string;
  title: string;
  subtitle: string;
  totalPaise: number;
  categories: CategoryShare[];
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
}

function BreakdownSlide({
  cardWidth,
  icon,
  iconColor,
  title,
  subtitle,
  totalPaise,
  categories,
  onLayout,
}: BreakdownSlideProps) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Card style={{ width: cardWidth }} onLayout={onLayout}>
      <View style={styles.accountSlideHeader}>
        <IconTile icon={icon} color={iconColor} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="labelStrong">{title}</Text>
          <Text variant="caption">{subtitle}</Text>
        </View>
        <Text variant="labelStrong" numeric>
          {formatINR(totalPaise, { decimals: 'never' })}
        </Text>
      </View>
      <Divider style={{ marginVertical: space.sm }} />
      <View style={styles.donutWrap}>
        <Donut
          slices={categories.map((c) => ({
            key: c.categoryId ?? 'none',
            value: c.totalPaise,
            color: c.color ?? colors.textTertiary,
          }))}
        >
          <Text variant="caption">{pluralize(categories.length, 'category', 'categories')}</Text>
          <Text variant="heading" numeric>
            {formatCompactINR(totalPaise)}
          </Text>
        </Donut>
      </View>
      {categories.map((c) => (
        <View key={c.categoryId ?? 'none'} style={styles.breakdownRow}>
          {c.categoryId ? <CategoryAvatar icon={c.icon} color={c.color} size={36} /> : <UncategorizedAvatar size={36} />}
          <View style={{ flex: 1, gap: 6 }}>
            <View style={styles.breakdownText}>
              <Text variant="labelStrong" numberOfLines={1} style={{ flex: 1 }}>
                {c.name}
              </Text>
              <Text variant="labelStrong" numeric>
                {formatINR(c.totalPaise, { decimals: 'never' })}
              </Text>
            </View>
            <View style={styles.breakdownText}>
              <View style={{ flex: 1 }}>
                <ProgressBar value={c.share} color={c.color ?? colors.textTertiary} height={6} />
              </View>
              <Text variant="caption" numeric style={styles.pct}>
                {Math.round(c.share * 100)}%
              </Text>
            </View>
          </View>
        </View>
      ))}
    </Card>
  );
}

/**
 * Horizontal paged carousel for "Where it went" (All Accounts + per-account slides).
 * Dynamically animates its viewport height to match the visible slide so pagination
 * dots and following sections stay snug beneath shorter account cards.
 */
export function SpendingBreakdownCarousel({
  totalPaise,
  categories,
  accountBreakdowns,
}: SpendingBreakdownCarouselProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - space.lg * 2;
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [slideHeights, setSlideHeights] = useState<Record<string, number>>({});
  const [scrollX] = useState(() => new Animated.Value(0));

  const slideKeys = ['all', ...accountBreakdowns.map((b) => b.account.accountId)];
  const slideCount = slideKeys.length;
  const clampedIndex = Math.min(carouselIndex, slideCount - 1);
  const measuredHeights = slideKeys.map((k) => slideHeights[k]);
  const allHeightsMeasured = measuredHeights.every((h): h is number => typeof h === 'number' && h > 0);

  let carouselHeight: number | Animated.AnimatedInterpolation<number> | undefined;
  if (cardWidth > 0 && slideCount > 1 && allHeightsMeasured) {
    carouselHeight = scrollX.interpolate({
      inputRange: slideKeys.map((_, i) => i * cardWidth),
      outputRange: measuredHeights,
      extrapolate: 'clamp',
    });
  } else {
    carouselHeight = slideHeights[slideKeys[clampedIndex]];
  }

  const handleSlideLayout = (slideKey: string) => (e: { nativeEvent: { layout: { height: number } } }) => {
    const height = Math.ceil(e.nativeEvent.layout.height);
    if (height <= 0) return;
    setSlideHeights((prev) => (prev[slideKey] === height ? prev : { ...prev, [slideKey]: height }));
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (cardWidth <= 0) return;
        const idx = Math.max(0, Math.min(slideCount - 1, Math.round(e.nativeEvent.contentOffset.x / cardWidth)));
        setCarouselIndex((prev) => (prev === idx ? prev : idx));
      },
    }
  );

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (cardWidth <= 0) return;
    const offsetX = e.nativeEvent.contentOffset.x;
    scrollX.setValue(offsetX);
    const idx = Math.max(0, Math.min(slideCount - 1, Math.round(offsetX / cardWidth)));
    setCarouselIndex((prev) => (prev === idx ? prev : idx));
  };

  return (
    <View>
      <Animated.View
        testID="carousel-viewport"
        style={[
          { width: cardWidth, overflow: 'hidden' },
          carouselHeight !== undefined ? { height: carouselHeight } : undefined,
        ]}
      >
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={{ width: cardWidth }}
          contentContainerStyle={{ alignItems: 'flex-start' }}
          onScroll={handleScroll}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          <BreakdownSlide
            cardWidth={cardWidth}
            icon="landmark"
            iconColor={colors.brand}
            title="All Accounts"
            subtitle={
              accountBreakdowns.length === 0
                ? 'Overall spending'
                : `${pluralize(accountBreakdowns.length, 'account', 'accounts')} with spending`
            }
            totalPaise={totalPaise}
            categories={categories}
            onLayout={handleSlideLayout('all')}
          />

          {accountBreakdowns.map(({ account, categories: accCats }) => (
            <BreakdownSlide
              key={account.accountId}
              cardWidth={cardWidth}
              icon={accountIcon(account.type)}
              iconColor={account.color}
              title={formatAccountLabel(account)}
              subtitle={`${Math.round(account.share * 100)}% of total spend`}
              totalPaise={account.totalPaise}
              categories={accCats}
              onLayout={handleSlideLayout(account.accountId)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {slideCount > 1 ? (
        <View style={styles.carouselDots}>
          {slideKeys.map((key, i) => {
            const active = i === clampedIndex;
            return (
              <View
                key={key}
                testID={`carousel-dot-${i}`}
                accessibilityState={{ selected: active }}
                style={[styles.carouselDot, active && styles.carouselDotActive]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  accountSlideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingBottom: space.xs,
  },
  donutWrap: {
    alignItems: 'center',
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  breakdownText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  pct: {
    width: 36,
    textAlign: 'right',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  carouselDotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
}));
