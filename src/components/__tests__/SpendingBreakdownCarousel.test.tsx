import React from 'react';
import { Animated, ScrollView, StyleSheet, Text as RNText } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { SpendingBreakdownCarousel, type AccountBreakdown } from '../SpendingBreakdownCarousel';
import { Card } from '../ui';
import type { CategoryShare } from '@/services/ledger';

const mockCategories: CategoryShare[] = [
  { categoryId: 'cat-1', name: 'Food', icon: 'utensils', color: '#E11D48', totalPaise: 50000, count: 3, share: 0.5 },
  { categoryId: 'cat-2', name: 'Transport', icon: 'car', color: '#2563EB', totalPaise: 30000, count: 2, share: 0.3 },
  { categoryId: 'cat-3', name: 'Bills', icon: 'receipt', color: '#16A34A', totalPaise: 20000, count: 1, share: 0.2 },
];

const mockBreakdowns: AccountBreakdown[] = [
  {
    account: {
      accountId: 'acc-hdfc',
      name: 'HDFC',
      bankName: 'HDFC',
      mask: '1234',
      type: 'SAVINGS',
      color: '#1D4ED8',
      icon: null,
      totalPaise: 70000,
      count: 4,
      share: 0.7,
    },
    categories: [mockCategories[0], mockCategories[1]],
  },
  {
    account: {
      accountId: 'account-cash',
      name: 'Cash',
      bankName: null,
      mask: null,
      type: 'CASH',
      color: '#16A34A',
      icon: null,
      totalPaise: 30000,
      count: 2,
      share: 0.3,
    },
    categories: [mockCategories[2]],
  },
];

function readViewportHeight(root: renderer.ReactTestInstance): number | undefined {
  const viewport = root.findByProps({ testID: 'carousel-viewport' });
  const flatStyle = StyleSheet.flatten(viewport.props.style) as { height?: unknown };
  const raw = flatStyle?.height;
  if (typeof raw === 'number') return raw;
  if (raw && typeof (raw as { __getValue?: () => number }).__getValue === 'function') {
    return (raw as { __getValue: () => number }).__getValue();
  }
  return undefined;
}

function getDotNodes(root: renderer.ReactTestInstance) {
  return root.findAll(
    (node) => typeof node.type === 'string' && typeof node.props?.testID === 'string' && node.props.testID.startsWith('carousel-dot-')
  );
}

function activeDotIndex(root: renderer.ReactTestInstance): number {
  return getDotNodes(root).findIndex((d) => d.props.accessibilityState?.selected === true);
}

describe('SpendingBreakdownCarousel', () => {
  it('dynamically adjusts viewport height to match each slide instead of staying fixed at the tallest card', () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(
        <SpendingBreakdownCarousel
          totalPaise={100000}
          categories={mockCategories}
          accountBreakdowns={mockBreakdowns}
        />
      );
    });

    const root = testRenderer!.root;
    const scrollView = root.findByType(ScrollView);
    const cardWidth = StyleSheet.flatten(scrollView.props.style).width as number;
    expect(cardWidth).toBeGreaterThan(0);

    const cards = root.findAllByType(Card);
    expect(cards).toHaveLength(3);

    // Report distinct intrinsic heights: Slide 0 (All Accounts) is tallest (520),
    // Slide 1 (HDFC) is shorter (260), Slide 2 (Cash) is medium (340).
    act(() => {
      cards[0].props.onLayout({ nativeEvent: { layout: { height: 520 } } });
      cards[1].props.onLayout({ nativeEvent: { layout: { height: 260 } } });
      cards[2].props.onLayout({ nativeEvent: { layout: { height: 340 } } });
    });

    expect(readViewportHeight(root)).toBe(520);
    expect(activeDotIndex(root)).toBe(0);

    // Halfway swipe between Slide 0 (520) and Slide 1 (260) interpolates height smoothly
    act(() => {
      scrollView.props.onScroll?.({ nativeEvent: { contentOffset: { x: cardWidth * 0.5, y: 0 } } });
    });
    expect(readViewportHeight(root)).toBeCloseTo(390, 5);

    // Swipe settles on Slide 1 (HDFC, height 260)
    act(() => {
      scrollView.props.onScroll?.({ nativeEvent: { contentOffset: { x: cardWidth, y: 0 } } });
      scrollView.props.onMomentumScrollEnd?.({ nativeEvent: { contentOffset: { x: cardWidth, y: 0 } } });
    });
    expect(readViewportHeight(root)).toBe(260);
    expect(activeDotIndex(root)).toBe(1);

    // Swipe settles on Slide 2 (Cash, height 340)
    act(() => {
      scrollView.props.onScroll?.({ nativeEvent: { contentOffset: { x: cardWidth * 2, y: 0 } } });
      scrollView.props.onMomentumScrollEnd?.({ nativeEvent: { contentOffset: { x: cardWidth * 2, y: 0 } } });
    });
    expect(readViewportHeight(root)).toBe(340);
    expect(activeDotIndex(root)).toBe(2);
  });

  it('hides pagination dots and adapts cleanly when there are no account breakdowns', () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(
        <SpendingBreakdownCarousel
          totalPaise={100000}
          categories={mockCategories}
          accountBreakdowns={[]}
        />
      );
    });

    const root = testRenderer!.root;
    const cards = root.findAllByType(Card);
    expect(cards).toHaveLength(1);

    act(() => {
      cards[0].props.onLayout({ nativeEvent: { layout: { height: 480 } } });
    });

    expect(readViewportHeight(root)).toBe(480);
    expect(getDotNodes(root)).toHaveLength(0);

    const text = root.findAllByType(RNText).map((n) => n.props.children).flat().join(' ');
    expect(text).toContain('All Accounts');
    expect(text).toContain('Overall spending');
  });

  it('clamps active dot and viewport height safely when account breakdowns shrink on refresh', () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(
        <SpendingBreakdownCarousel
          totalPaise={100000}
          categories={mockCategories}
          accountBreakdowns={mockBreakdowns}
        />
      );
    });

    const root = testRenderer!.root;
    const scrollView = root.findByType(ScrollView);
    const cardWidth = StyleSheet.flatten(scrollView.props.style).width as number;
    const cards = root.findAllByType(Card);

    act(() => {
      cards[0].props.onLayout({ nativeEvent: { layout: { height: 520 } } });
      cards[1].props.onLayout({ nativeEvent: { layout: { height: 260 } } });
      cards[2].props.onLayout({ nativeEvent: { layout: { height: 340 } } });
    });

    act(() => {
      scrollView.props.onMomentumScrollEnd?.({ nativeEvent: { contentOffset: { x: cardWidth * 2, y: 0 } } });
    });
    expect(activeDotIndex(root)).toBe(2);

    // Refresh reduces accountBreakdowns from 2 accounts to 1 account
    act(() => {
      testRenderer!.update(
        <SpendingBreakdownCarousel
          totalPaise={70000}
          categories={[mockCategories[0], mockCategories[1]]}
          accountBreakdowns={[mockBreakdowns[0]]}
        />
      );
    });

    expect(activeDotIndex(root)).toBe(1);
    expect(readViewportHeight(root)).toBe(260);
    expect(Animated).toBeDefined();
  });
});
