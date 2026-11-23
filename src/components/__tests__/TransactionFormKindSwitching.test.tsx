import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TransactionForm } from '../TransactionForm';
import { CategoryChips } from '../Pickers';
import { SegmentedControl } from '../ui';
import { categoryService } from '@/services';
import { Category } from '@/database/schema';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
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

jest.mock('@/services', () => ({
  categoryService: {
    getAll: jest.fn(),
    getRankedByUsage: jest.fn(),
  },
  memberService: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  accountService: {
    getAll: jest.fn().mockResolvedValue([]),
  },
  ledgerService: {
    getRecentMerchants: jest.fn().mockResolvedValue([]),
  },
  classificationService: {
    classify: jest.fn().mockResolvedValue(null),
    shouldPrefill: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('@/services/settings', () => ({
  getSetting: jest.fn().mockResolvedValue(null),
  setSetting: jest.fn().mockResolvedValue(undefined),
}));

describe('TransactionForm freshiency ranking and kind switching', () => {
  const rankedCategories: Category[] = [
    // Expense categories ranked by freshiency
    { id: 'cat-education', name: 'Education', icon: 'book', color: '#5856D6', sortOrder: 7, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-food', name: 'Food', icon: 'fork', color: '#FF9500', sortOrder: 1, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    // Income categories ranked by freshiency
    { id: 'cat-income-salary', name: 'Salary', icon: 'cash', color: '#10B981', sortOrder: 101, kind: 'INCOME', createdAt: 0, updatedAt: 0 },
    { id: 'cat-income-freelance', name: 'Freelance', icon: 'laptop', color: '#0EA5E9', sortOrder: 102, kind: 'INCOME', createdAt: 0, updatedAt: 0 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (categoryService.getRankedByUsage as jest.Mock).mockResolvedValue(rankedCategories);
    (categoryService.getAll as jest.Mock).mockResolvedValue(rankedCategories);
  });

  it('calls categoryService.getRankedByUsage on mount and displays expense categories in freshiency order', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <TransactionForm
          title="Add expense"
          submitLabel="Save"
          onSubmit={jest.fn()}
        />
      );
    });

    expect(categoryService.getRankedByUsage).toHaveBeenCalled();

    const categoryChips = testRenderer!.root.findByType(CategoryChips);
    const passedCategories = categoryChips.props.categories as Category[];

    // Should only contain EXPENSE categories
    expect(passedCategories.every((c) => c.kind === 'EXPENSE')).toBe(true);
    // Order should match ranked order: Education first, then Food
    expect(passedCategories.map((c) => c.name)).toEqual(['Education', 'Food']);
  });

  it('swaps to income categories in freshiency order when toggling to INCOME and resets invalidated category', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <TransactionForm
          title="Add transaction"
          submitLabel="Save"
          onSubmit={jest.fn()}
          initial={{ categoryId: 'cat-education', kind: 'EXPENSE' }}
        />
      );
    });

    let categoryChips = testRenderer!.root.findByType(CategoryChips);
    expect(categoryChips.props.value).toBe('cat-education');
    expect(categoryChips.props.categories.map((c: Category) => c.name)).toEqual(['Education', 'Food']);

    // Find the SegmentedControl and trigger change to INCOME
    const segmentedControl = testRenderer!.root.findByType(SegmentedControl);
    await act(async () => {
      segmentedControl.props.onChange('INCOME');
    });

    categoryChips = testRenderer!.root.findByType(CategoryChips);
    const incomeCategories = categoryChips.props.categories as Category[];

    // Categories swapped to INCOME in ranked order
    expect(incomeCategories.every((c) => c.kind === 'INCOME')).toBe(true);
    expect(incomeCategories.map((c) => c.name)).toEqual(['Salary', 'Freelance']);

    // Selected expense category 'cat-education' was invalidated and reset to null
    expect(categoryChips.props.value).toBeNull();
  });
});
