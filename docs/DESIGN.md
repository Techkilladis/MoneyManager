# Design System — "Paper & Ink"

Money Manager uses a custom **Paper & Ink** design system built on Expo SDK 52 with React Native 0.76. The system is flat, calm, and editorial — no gradients, no drop shadows (except the toast), no decorative chrome.

## Philosophy

- **Warm paper canvas, flat white cards.** A soft paper background (`#F6F5F1` light / `#12120F` dark) with hairline-bordered white cards on top.
- **Deep ink text, single accent.** Primary actions use the moss/emerald brand colour. Semantic colours (positive, negative, warning) appear only where money flows demand them.
- **Category colours are small.** They live in icon badges and charts — never as large fills.
- **Dynamic type is first-class.** All text scales with the system font multiplier via `AccessibilityInfo`.

## Architecture

```
src/design/
├── tokens.ts      # Colour palette, spacing, type scale, radii, shadows
├── scheme.ts      # Active scheme singleton (light/dark)
├── theme.tsx      # ThemeProvider + makeStyles() factory
src/components/ui/ # Reusable components consuming useTheme()
```

### Theme Provider

[`ThemeProvider`](src/design/theme.tsx:29) wraps the app and provides a `ThemeValue` context:

```typescript
interface ThemeValue {
  scheme: 'light' | 'dark';
  colors: Palette;
  preference: ThemePreference; // 'system' | 'light' | 'dark'
  setPreference: (p: ThemePreference) => void;
}
```

### makeStyles Factory

[`makeStyles`](src/design/theme.tsx:83) creates a hook that caches one StyleSheet per scheme for performance:

```typescript
const useStyles = makeStyles((colors, scheme) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderColor: colors.border },
}));
// Usage: const styles = useStyles();
```

## Colour Palette

### Light Mode

| Token | Value | Purpose |
|-------|-------|---------|
| `background` | `#F6F5F1` | Warm paper canvas |
| `surface` | `#FFFFFF` | Flat white cards |
| `surfaceMuted` | `#F0EEE8` | Hush tracks, neutral badges |
| `surfacePressed` | `#E9E7E0` | Button/press feedback |
| `text` | `#141412` | Primary ink |
| `textSecondary` | `#5C5B55` | Secondary descriptions |
| `textTertiary` | `#6B6960` | Captions, hints (~4.7:1 on paper) |
| `textDisabled` | `#C4C2BA` | Disabled states |
| `textOnBrand` | `#FFFFFF` | Text/icons on brand fill |
| `textOnInk` | `#FFFFFF` | Text/icons on any ink fill |
| `brand` | `#0E7A5F` | Moss/emerald primary action |
| `brandPressed` | `#0B6650` | Brand press state |
| `brandSoft` | `#E4F1EC` | Soft brand background |
| `brandSoftBorder` | `#C9E3D9` | Soft brand border |
| `positive` | `#0E7A5F` | Same as brand — money in |
| `positiveSoft` | `#E4F1EC` | Positive soft background |
| `negative` | `#C2532F` | Clay — money out / over budget |
| `negativeSoft` | `#FBEDE7` | Negative soft background |
| `warning` | `#B7791F` | Amber — approaching limit |
| `warningSoft` | `#FBF1DF` | Warning soft background |
| `info` | `#2563EB` | Blue — informational |
| `infoSoft` | `#E4EEFE` | Info soft background |
| `border` | `#E8E6E0` | Hairline card borders |
| `borderStrong` | `#D9D6CE` | Stronger dividers |
| `divider` | `#E8E6E0` | List dividers |
| `scrim` | `rgba(20,20,18,0.45)` | Overlay dimming |

### Dark Mode

| Token | Value | Purpose |
|-------|-------|---------|
| `background` | `#12120F` | Warm near-black paper |
| `surface` | `#1B1B18` | Slightly lighter cards |
| `surfaceMuted` | `#262621` | Muted surfaces |
| `surfacePressed` | `#2E2E29` | Press feedback |
| `text` | `#F3F2EE` | Lifted primary ink |
| `textSecondary` | `#B5B3AB` | Secondary text |
| `textTertiary` | `#75736B` | Tertiary (~4.5:1 on dark paper) |
| `textDisabled` | `#4A4943` | Disabled |
| `textOnBrand` | `#0A1F18` | Text on dark brand fill |
| `textOnInk` | `#12120F` | Text on dark ink |
| `brand` | `#3CC79A` | Mint — accent lifts for legibility |
| `brandPressed` | `#34B089` | Brand press |
| `brandSoft` | `#16302A` | Soft brand bg |
| `brandSoftBorder` | `#24493E` | Soft brand border |
| `positive` | `#3CC79A` | Same as brand |
| `positiveSoft` | `#16302A` | Positive soft |
| `negative` | `#F08A68` | Clay lifts in dark |
| `negativeSoft` | `#3A2119` | Negative soft |
| `warning` | `#E3A84A` | Amber lifts |
| `warningSoft` | `#352914` | Warning soft |
| `info` | `#60A5FA` | Blue lifts |
| `infoSoft` | `#14243F` | Info soft |
| `border` | `#2A2A26` | Dark hairlines |
| `borderStrong` | `#3A3933` | Stronger dark borders |
| `divider` | `#2A2A26` | Dark dividers |
| `scrim` | `rgba(0,0,0,0.6)` | Dark overlay |

### Accessibility

All text colours meet **WCAG 2.0 AA** (4.5:1 contrast ratio for body text). Tertiary text was bumped from `#97958D` (~3.2:1) to `#6B6960` (~4.7:1) in light mode, and from `#7E7C74` (~3.0:1) to `#75736B` (~4.5:1) in dark mode.

### Utility Functions

| Function | Purpose |
|----------|---------|
| [`tint(hex, amount)`](src/design/tokens.ts:168) | Creates a soft wash of a colour for badges/chips by mixing with white (light) or card bg (dark) |
| [`inkOf(hex)`](src/design/tokens.ts:189) | Computes the legible text colour to draw on top of `tint(hex)` — darkened in light mode, lifted in dark mode |

## Typography

The app uses **Inter** font loaded at runtime via `app/_layout.tsx`. Two family variants are shipped: `regular` (400) and `semibold` (600).

### Type Scale

| Variant | Size | Weight | Line Height | Letter Spacing | Default Color |
|---------|------|--------|-------------|----------------|---------------|
| `hero` | 40px | 600 | 48px | -1 | `text` |
| `title` | 22px | 600 | 28px | -0.4 | `text` |
| `heading` | 16px | 600 | 22px | -0.1 | `text` |
| `body` | 16px | 400 | 22px | -0.1 | `text` |
| `bodyStrong` | 16px | 600 | 22px | -0.1 | `text` |
| `label` | 13px | 400 | 18px | — | `textSecondary` |
| `labelStrong` | 13px | 600 | 18px | — | `text` |
| `caption` | 13px | 400 | 18px | — | `textTertiary` |
| `overline` | 13px | 600 | 18px | — | `textTertiary` |

### Dynamic Type

The [`Text`](src/components/ui/Text.tsx:90) component reads the system font scale via `AccessibilityInfo.getFontScale()` and applies it as a multiplier to both `fontSize` and `lineHeight`. This ensures all text respects user-set accessibility font sizes on iOS and Android.

```typescript
<Text variant="body" numeric>₹1,23,456</Text>
```

The `numeric` prop enables tabular-nums (`fontVariant: ['tabular-nums']`) for aligned columns of numbers.

### Weight Resolution

[`fontFor(weight)`](src/components/ui/Text.tsx:85) maps any fontWeight to an Inter family string. Any weight >= 500 uses `semibold`; everything else uses `regular`. This is because Inter ships one family per weight on Android.

## Spacing

A 4-point base scale. Layout uses multiples of 8 where possible.

| Token | Value |
|-------|-------|
| `xxs` | 4px |
| `xs` | 8px |
| `sm` | 12px |
| `md` | 16px |
| `lg` | 20px |
| `xl` | 24px |
| `xxl` | 32px |
| `xxxl` | 48px |

## Radius

| Token | Value |
|-------|-------|
| `sm` | 8px |
| `md` | 12px |
| `lg` | 16px |
| `xl` | 20px |
| `xxl` | 28px |
| `pill` | 999px (fully rounded) |

## Shadows

The design is flat. The only shadow is on the toast notification:

```typescript
shadow: {
  raised: {
    shadowColor: '#141412',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
}
```

## Component Library

### Text

[`Text`](src/components/ui/Text.tsx:90) — All text goes through this component. Accepts `variant`, `color`, `align`, `numeric` props. Falls back to default colour from the current palette.

```typescript
<Text variant="hero" numeric>₹1,23,456</Text>
<Text variant="caption" color={colors.textTertiary}>Due in 2 days</Text>
```

### Icon

[`Icon`](src/components/ui/Icon.tsx) — Renders icons from the `@expo/vector-icons` collection. Supports all named icons from the project's icon configuration.

```typescript
<Icon name="arrowLeft" size={20} color={colors.text} />
```

### Button

[`Button`](src/components/ui/Button.tsx:39) — Primary action button with multiple variants and sizes.

| Prop | Values |
|------|--------|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` |
| `size` | `'sm' \| 'md' \| 'lg'` |
| `loading` | `boolean` |
| `disabled` | `boolean` |
| `icon` | IconName (renders leading/trailing icon) |

```typescript
<Button title="Confirm" icon="check" onPress={handleConfirm} />
<Button title="Cancel" variant="secondary" size="lg" onPress={handleCancel} />
```

### IconButton

[`IconButton`](src/components/ui/Button.tsx:102) — Icon-only pressable with accessibilityLabel.

```typescript
<IconButton icon="share" onPress={handleShare} accessibilityLabel="Share this report" />
```

### Card

[`Card`](src/components/ui/Surface.tsx:17) — Flat white card with hairline border. No elevation, no shadow.

| Prop | Values |
|------|--------|
| `padded` | `boolean` (default: `true`) |
| `flat` | `boolean` (removes border) |
| `onPress` | `(void) => void` |
| `style` | ViewStyle |

```typescript
<Card padded={false} style={{ marginTop: space.lg }}>
  <View>...</View>
</Card>
```

### Divider

[`Divider`](src/components/ui/Surface.tsx:40) — Hairline horizontal divider.

```typescript
<Divider inset={space.md} />
```

### SectionTitle

[`SectionTitle`](src/components/ui/Surface.tsx:142) — Bold section header with optional action button.

| Prop | Values |
|------|--------|
| `title` | `string` |
| `action` | `string` (label for action button) |
| `onAction` | `() => void` |
| `style` | ViewStyle |

```typescript
<SectionTitle title="Privacy & security" />
<SectionTitle title="Appearance" action="Reset" onAction={handleReset} />
```

### GroupLabel

[`GroupLabel`](src/components/ui/Surface.tsx:177) — Overline-style group label (deprecated; use `SectionTitle` instead).

### ListRow

[`ListRow`](src/components/ui/Surface.tsx:90) — Single row in a list with optional leading icon, trailing chevron, subtitle, and value.

| Prop | Values |
|------|--------|
| `title` | `string` |
| `subtitle` | `string` (optional) |
| `value` | `string` (optional) |
| `icon` | IconName (optional leading icon) |
| `onPress` | `(void) => void` (optional, adds chevron) |

```typescript
<ListRow title="Theme" value={themeLabel} onPress={() => router.push('/settings/theme')} />
<ListRow title="App Lock" subtitle="Require biometrics on launch" icon="lock" onPress={toggleLock} />
```

### IconTile

[`IconTile`](src/components/ui/Surface.tsx:49) — Square tile with an icon, used for category/member selection grids.

### Chip

[`Chip`](src/components/ui/Controls.tsx:38) — Selected/unselected toggle chip with optional category icon and trailing indicator.

```typescript
<Chip label="Food" selected={selected} onPress={() => setSelected(!selected)} />
<Chip label="Groceries" categoryIcon="🍔" color="#10B981" />
```

### SegmentedControl

[`SegmentedControl`](src/components/ui/Controls.tsx:88) — Two-option segmented toggle.

```typescript
<SegmentedControl
  options={['Light', 'Dark']}
  value={theme}
  onChange={(v) => setTheme(v as 'light' | 'dark')}
/>
```

### Switch

[`Switch`](src/components/ui/Controls.tsx:118) — Native toggle switch.

```typescript
<Switch value={enabled} onValueChange={setEnabled} />
```

### TextField

[`TextField`](src/components/ui/Controls.tsx:155) — Labelled text input with optional placeholder, error, and multiline support.

```typescript
<TextField
  label="Amount"
  placeholder="0.00"
  value={amount}
  onChangeText={setAmount}
  error={amountError}
  keyboardType="decimal-pad"
/>
```

### ProgressBar

[`ProgressBar`](src/components/ui/Controls.tsx:193) — Linear progress bar for budget tracking.

| Prop | Values |
|------|--------|
| `progress` | `number` (0–1) |
| `color` | string (bar fill colour) |
| `style` | ViewStyle |

```typescript
<ProgressBar progress={0.75} color={colors.negative} />
```

### CategoryAvatar / UncategorizedAvatar / MemberAvatar

[`CategoryAvatar`](src/components/ui/Avatars.tsx), [`MemberAvatar`](src/components/ui/Avatars.tsx) — Circular avatar with icon, colour background, and initials. Used in category/member selection sheets and transaction rows.

```typescript
<CategoryAvatar name="Food" icon="🍔" color="#10B981" size={32} />
<MemberAvatar name="Rohan" color="#6366F1" size={32} />
<UncategorizedAvatar size={32} />
```

### ScreenHeader

[`ScreenHeader`](src/components/ui/Layout.tsx:18) — Top-of-screen header with optional title, subtitle, back button, and right slot. Supports large-title mode.

```typescript
<ScreenHeader
  title="Analytics"
  right={
    <IconButton icon="share" onPress={handleShare} accessibilityLabel="Share analytics" />
  }
/>
```

### KeyFigure

[`KeyFigure`](src/components/ui/Layout.tsx:99) — Large numeric display with optional label, fraction (paise), and inline content.

```typescript
<KeyFigure label="Spent this month" value={whole} fraction={fraction}>
  <StatusChip label="+12%" tone="negative" />
</KeyFigure>
```

### StatusChip

[`StatusChip`](src/components/ui/Layout.tsx:138) — Small pill with icon, label, and semantic tone.

| Tone | Meaning |
|------|---------|
| `'positive'` | Money in / on track |
| `'negative'` | Over budget / expense |
| `'warning'` | Approaching limit |
| `'neutral'` | Informational |

```typescript
<StatusChip label="₹2,340" tone="negative" icon="arrowUp" />
```

### EmptyState

[`EmptyState`](src/components/ui/Layout.tsx:174) — Empty state with icon, title, message, and optional action button.

```typescript
<EmptyState
  icon="inbox"
  title="No transactions yet"
  message="Tap the + button to add your first transaction."
/>
```

### BottomBar

[`BottomBar`](src/components/ui/Layout.tsx:92) — Fixed bottom bar for action buttons.

```typescript
<BottomBar style={styles.footer}>
  <Button title="Confirm" onPress={handleConfirm} />
</BottomBar>
```

### LoadingView / ErrorView

[`LoadingView`](src/components/ui/Layout.tsx:162) — Spinner with optional label.
[`ErrorView`](src/components/ui/Layout.tsx:216) — Error message with optional retry button.

### Sheet

[`Sheet`](src/components/ui/Sheet.tsx) — Bottom sheet modal for selection panels (category grid, member picker, etc.).

```typescript
<Sheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Category">
  <CategoryGrid ... />
</Sheet>
```

### Toast

[`ToastProvider`](src/components/ui/Toast.tsx:41) — Global toast notification system.

| Tone | Meaning |
|------|---------|
| `'success'` | Action completed |
| `'info'` | Informational message |
| `'error'` | Action failed |

```typescript
const { toast } = useToast();
toast.show('Payment saved', 'success');
toast.show('Payment ignored', 'info', { label: 'Undo', onPress: handleUndo });
```

## Icon System

Icons come from `@expo/vector-icons`. All icon names use **camelCase** (e.g., `'arrowLeft'` not `'arrow-left'`). The project uses `Ionicons` as the primary icon set.

Common icon names:
- Navigation: `'arrowBack'`, `'arrowForward'`, `'chevronDown'`, `'chevronUp'`
- Actions: `'add'`, `'check'`, `'close'`, `'trash'`, `'share'`, `'search'`, `'settings'`
- States: `'alert'`, `'checkmarkDone'`, `'informationCircle'`

## Layout Patterns

### Home Screen

The home screen (`app/(tabs)/index.tsx`) follows a top-down card layout:

1. **ScreenHeader** with summary amount and share button
2. **Budget progress** card with progress bar
3. **Summary stats** row (income, spent, balance)
4. **Review queue** for pending captures
5. **Needs attention** section with owed money, splits, recurring bills

### Quick Capture (Review Queue)

The review queue (`app/quick-capture.tsx`) shows one transaction at a time with:
- Progress indicator (dots + counter)
- Large amount display with edit capability
- Category chip selector
- Confirm/Dismiss action buttons
- Undo toast on dismiss (5-second window)

### Analytics

The analytics screen (`app/(tabs)/analytics.tsx`) includes:
- Period navigation (week/month/quarter/year)
- Key figure with change indicator
- Donut chart for category breakdown
- Budget progress cards
- Merchant ranking
- Member splits
- Insights (capped at 3)

### Settings

The settings screen (`app/(tabs)/settings.tsx`) uses categorized sections:

1. **Organize** — Budgets, Recurring, People & Splits, Categories, Monthly Recap
2. **Appearance** — Theme selection (SegmentedControl)
3. **Privacy & Security** — App Lock with timeout options
4. **Notifications** — Budget alerts, Bill reminders, Monthly recap
5. **Auto-capture** — Instant/Auto mode (Android only)
6. **Backup & Data** — Backup, Restore, Export CSV
7. **Home screen widget** — Widget status (Android only)
8. **Developer** — Load sample data, test parser, capture stats (`__DEV__` only)

Each section uses `<SectionTitle>` for consistent visual hierarchy.

## Colour Swatches

Categories and members use colours from a fixed palette of 12 swatches:

```
#F97316 (Orange)  #EF4444 (Red)     #EC4899 (Pink)    #A855F7 (Purple)
#6366F1 (Indigo)  #3B82F6 (Blue)    #0EA5E9 (Cyan)    #14B8A6 (Teal)
#10B981 (Emerald) #84CC16 (Lime)    #EAB308 (Yellow)  #78716C (Stone)
```

Use [`tint()`](src/design/tokens.ts:168) to generate soft backgrounds from any swatch, and [`inkOf()`](src/design/tokens.ts:189) to compute legible text/icon colours for those backgrounds.

## Accessibility Checklist

- [x] All text meets WCAG AA 4.5:1 contrast ratio
- [x] All icon buttons have `accessibilityLabel`
- [x] Dynamic type supported via `AccessibilityInfo` font scale
- [x] Semantic colour meanings are consistent (positive = money in, negative = money out)
- [x] Interactive elements have visible press states
- [ ] VoiceOver labels for charts (future enhancement)
