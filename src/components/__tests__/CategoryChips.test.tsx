import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { CategoryChips } from '../Pickers';
import { Chip } from '../ui';
import { Category } from '@/database/schema';

describe('CategoryChips contextual Slot 1 pinning and selection dynamics', () => {
  const mockCategories: Category[] = [
    { id: 'cat-food', name: 'Food', icon: 'fork.knife', color: '#FF9500', sortOrder: 1, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-travel', name: 'Travel', icon: 'car.fill', color: '#007AFF', sortOrder: 2, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-shopping', name: 'Shopping', icon: 'bag.fill', color: '#AF52DE', sortOrder: 3, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-bills', name: 'Bills', icon: 'doc.text.fill', color: '#FF3B30', sortOrder: 4, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-entertainment', name: 'Entertainment', icon: 'tv.fill', color: '#FF2D92', sortOrder: 5, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-health', name: 'Health', icon: 'cross.case.fill', color: '#34C759', sortOrder: 6, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-education', name: 'Education', icon: 'book.fill', color: '#5856D6', sortOrder: 7, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
    { id: 'cat-subscriptions', name: 'Subscriptions', icon: 'repeat', color: '#00C7BE', sortOrder: 8, kind: 'EXPENSE', createdAt: 0, updatedAt: 0 },
  ];

  it('pins the active selection to Slot 1 with a checkmark indicator and deduplicates subsequent slots', () => {
    const onChange = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    // Active selection is cat-education (which is at index 6 in categories)
    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={mockCategories}
          value="cat-education"
          onChange={onChange}
          suggestedId="cat-bills"
          onMore={jest.fn()}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const categoryChips = chips.filter((c) => c.props.label !== 'More');

    // Slot 1 should be Education
    expect(categoryChips[0].props.label).toBe('Education');
    expect(categoryChips[0].props.selected).toBe(true);
    expect(categoryChips[0].props.trailingIcon).toBe('check');

    // Education must NOT appear anywhere in subsequent slots (no duplicates)
    const subsequentLabels = categoryChips.slice(1).map((c) => c.props.label);
    expect(subsequentLabels).not.toContain('Education');

    // Subsequent slots follow the category ranking order: Food, Travel, Shopping, Bills...
    expect(subsequentLabels[0]).toBe('Food');
    expect(subsequentLabels[1]).toBe('Travel');
  });

  it('pins high-confidence merchant recommendation to Slot 1 with sparkle icon when no selection is active', () => {
    const onChange = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    // No active selection, but suggestedId is cat-shopping (index 2)
    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={mockCategories}
          value={null}
          onChange={onChange}
          suggestedId="cat-shopping"
          onMore={jest.fn()}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const categoryChips = chips.filter((c) => c.props.label !== 'More');

    // Slot 1 should be Shopping
    expect(categoryChips[0].props.label).toBe('Shopping');
    expect(categoryChips[0].props.selected).toBe(false);
    expect(categoryChips[0].props.trailingIcon).toBe('sparkles');

    // Shopping must NOT be duplicated in subsequent slots
    const subsequentLabels = categoryChips.slice(1).map((c) => c.props.label);
    expect(subsequentLabels).not.toContain('Shopping');

    // Subsequent slots follow ranking order: Food, Travel, Bills...
    expect(subsequentLabels[0]).toBe('Food');
    expect(subsequentLabels[1]).toBe('Travel');
    expect(subsequentLabels[2]).toBe('Bills');
  });

  it('displays the top freshiency-ranked category in Slot 1 when neither selection nor recommendation is present', () => {
    const onChange = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={mockCategories}
          value={null}
          onChange={onChange}
          onMore={jest.fn()}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const categoryChips = chips.filter((c) => c.props.label !== 'More');

    // Slot 1 is top ranked (Food)
    expect(categoryChips[0].props.label).toBe('Food');
    expect(categoryChips[0].props.selected).toBe(false);
    expect(categoryChips[0].props.trailingIcon).toBeUndefined();

    // Subsequent slots
    expect(categoryChips[1].props.label).toBe('Travel');
    expect(categoryChips[2].props.label).toBe('Shopping');
  });

  it('reverts Slot 1 to the top freshiency category when tapping the selected chip to deselect', () => {
    const onChange = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    // User has selected Food
    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={mockCategories}
          value="cat-food"
          onChange={onChange}
          onMore={jest.fn()}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const slot1 = chips[0];
    expect(slot1.props.label).toBe('Food');
    expect(slot1.props.selected).toBe(true);

    // Tapping selected chip triggers onChange(null)
    act(() => {
      slot1.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith(null);

    // Re-rendering with value=null restores top freshiency ranking
    act(() => {
      testRenderer!.update(
        <CategoryChips
          categories={mockCategories}
          value={null}
          onChange={onChange}
          onMore={jest.fn()}
        />
      );
    });

    const updatedChips = testRenderer!.root.findAllByType(Chip);
    const updatedCategoryChips = updatedChips.filter((c) => c.props.label !== 'More');
    expect(updatedCategoryChips[0].props.label).toBe('Food');
    expect(updatedCategoryChips[0].props.selected).toBe(false);
    expect(updatedCategoryChips[1].props.label).toBe('Travel');
  });

  it('limits visible category chips to at most 6 followed by the More button', () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={mockCategories}
          value="cat-education"
          onChange={jest.fn()}
          onMore={jest.fn()}
          limit={6}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const categoryChips = chips.filter((c) => c.props.label !== 'More');
    const moreChip = chips.find((c) => c.props.label === 'More');

    // Exactly 6 category chips rendered
    expect(categoryChips.length).toBe(6);
    expect(moreChip).toBeDefined();

    // Verify labels in order: Education (pinned selection), Food, Travel, Shopping, Bills, Entertainment
    expect(categoryChips.map((c) => c.props.label)).toEqual([
      'Education',
      'Food',
      'Travel',
      'Shopping',
      'Bills',
      'Entertainment',
    ]);
  });

  it('provides accessible labels indicating category name and selection or recommendation state', () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    act(() => {
      testRenderer = renderer.create(
        <CategoryChips
          categories={mockCategories}
          value="cat-food"
          onChange={jest.fn()}
          suggestedId="cat-travel"
          onMore={jest.fn()}
        />
      );
    });

    const chips = testRenderer!.root.findAllByType(Chip);
    const categoryChips = chips.filter((c) => c.props.label !== 'More');

    // Selected Food announces selection
    expect(categoryChips[0].props.accessibilityLabel).toBe('Food, selected');
    // Non-selected Travel announces name
    expect(categoryChips[1].props.accessibilityLabel).toBe('Travel');

    // When no selection but suggestion is present
    act(() => {
      testRenderer!.update(
        <CategoryChips
          categories={mockCategories}
          value={null}
          onChange={jest.fn()}
          suggestedId="cat-travel"
          onMore={jest.fn()}
        />
      );
    });

    const updatedChips = testRenderer!.root.findAllByType(Chip);
    const updatedCategoryChips = updatedChips.filter((c) => c.props.label !== 'More');
    // Recommended Travel in Slot 1 announces recommendation
    expect(updatedCategoryChips[0].props.accessibilityLabel).toBe('Travel, recommended');
  });
});
