import React from 'react';
import { Pressable } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { CategoryGrid, CategoryChips } from '../Pickers';
import { Chip } from '../ui';
import { freshDatabase, addTx } from '../../../test/db';
import { categoryService } from '@/services';
import CategoriesScreen from '../../../app/categories';
import { Category } from '@/database/schema';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useFocusEffect: (cb: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useEffect } = require('react');
    useEffect(() => {
      cb();
    }, [cb]);
  },
  useLocalSearchParams: () => ({}),
}));

beforeEach(async () => {
  await freshDatabase();
});

describe('CategoryGrid freshiency sheet and Settings catalog isolation', () => {
  const now = new Date(2026, 10, 23, 12, 0).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  it('renders all categories in Category Freshiency order with the New category trigger button', () => {
    const onManage = jest.fn();
    const onChange = jest.fn();
    const rankedCategories: Category[] = [
      { id: 'cat-education', name: 'Education', icon: 'book', color: '#5856D6', sortOrder: 7, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
      { id: 'cat-health', name: 'Health', icon: 'cross', color: '#34C759', sortOrder: 6, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
      { id: 'cat-food', name: 'Food', icon: 'fork', color: '#FF9500', sortOrder: 1, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    ];

    let testRenderer: renderer.ReactTestRenderer | undefined;
    act(() => {
      testRenderer = renderer.create(
        <CategoryGrid
          categories={rankedCategories}
          value="cat-education"
          onChange={onChange}
          onManage={onManage}
        />
      );
    });

    // Check category ordering in grid
    const pressables = testRenderer!.root.findAllByType(Pressable);
    const categoryLabels = pressables.map((p) => p.props.accessibilityLabel).filter(Boolean);

    // Education, Health, Food, Manage categories
    expect(categoryLabels).toEqual(['Education', 'Health', 'Food', 'Manage categories']);

    // Tapping Manage categories triggers onManage
    const manageButton = pressables.find((p) => p.props.accessibilityLabel === 'Manage categories');
    expect(manageButton).toBeDefined();
    act(() => {
      manageButton!.props.onPress();
    });
    expect(onManage).toHaveBeenCalled();
  });

  it('proves CategoryGrid freshiency vs Settings static catalog ordering in SQLite', async () => {
    // Education (sortOrder 7) used 15 times recently
    for (let i = 0; i < 15; i++) {
      await addTx({
        categoryId: 'cat-education',
        amountPaise: 100000,
        at: now - (15 - i) * dayMs,
      });
    }

    // Health (sortOrder 6) used 8 times recently
    for (let i = 0; i < 8; i++) {
      await addTx({
        categoryId: 'cat-health',
        amountPaise: 50000,
        at: now - (8 - i) * dayMs,
      });
    }

    // Food (sortOrder 1) has 0 transactions

    // 1. Freshiency ranking (used by CategoryGrid & CategoryChips):
    // Education (#1) -> Health (#2) -> Food (#3)
    const freshiencyCategories = await categoryService.getRankedByUsage('EXPENSE', { now });
    expect(freshiencyCategories[0].id).toBe('cat-education');
    expect(freshiencyCategories[1].id).toBe('cat-health');
    const foodFreshiencyIndex = freshiencyCategories.findIndex((c) => c.id === 'cat-food');
    expect(foodFreshiencyIndex).toBeGreaterThan(1);

    // 2. Settings catalog order (used by app/categories.tsx):
    // Must remain strictly in static sortOrder ASC regardless of transaction activity
    const staticCategories = await categoryService.getAll();
    const staticExpenseCategories = staticCategories.filter((c) => c.kind === 'EXPENSE');

    // Food is #1 (sortOrder 1), Health is #6 (sortOrder 6), Education is #7 (sortOrder 7)
    expect(staticExpenseCategories[0].id).toBe('cat-food');
    const healthStaticIndex = staticExpenseCategories.findIndex((c) => c.id === 'cat-health');
    const educationStaticIndex = staticExpenseCategories.findIndex((c) => c.id === 'cat-education');
    expect(healthStaticIndex).toBeLessThan(educationStaticIndex);
  });

  it('renders Settings category screen in static catalog order completely unaffected by usage counts', async () => {
    // Add heavy usage for Education
    for (let i = 0; i < 20; i++) {
      await addTx({
        categoryId: 'cat-education',
        amountPaise: 100000,
        at: now - i * dayMs,
      });
    }

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<CategoriesScreen />);
    });

    // In Settings screen, ListRows are ordered by static sortOrder ASC: Food, Travel, Shopping, Bills...
    const rows = testRenderer!.root.findAll((node) => node.props && node.props.title && typeof node.props.title === 'string');
    const rowTitles = rows.map((r) => r.props.title);

    // Food (sortOrder 1) must be before Education (sortOrder 7) in Settings
    const foodIdx = rowTitles.indexOf('Food');
    const educationIdx = rowTitles.indexOf('Education');
    expect(foodIdx).toBeGreaterThanOrEqual(0);
    expect(educationIdx).toBeGreaterThan(foodIdx);
  });

  it('tapping More in CategoryChips triggers onMore callback to open CategoryGrid sheet', () => {
    const onMore = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={[
            { id: 'cat-food', name: 'Food', icon: 'fork', color: '#FF9500', sortOrder: 1, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
          ]}
          value={null}
          onChange={jest.fn()}
          onMore={onMore}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const moreChip = chips.find((c) => c.props.label === 'More');
    expect(moreChip).toBeDefined();

    act(() => {
      moreChip!.props.onPress();
    });
    expect(onMore).toHaveBeenCalled();
  });
});
