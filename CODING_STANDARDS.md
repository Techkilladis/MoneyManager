# Coding Standards

## Design System & UI Components

Always inspect existing components and theme definitions before writing JSX:

- **UI Primitives (`src/components/ui/`)**:
  - `Button`: Accepts `title` (or `children`), `variant` (`'primary' | 'secondary' | 'ghost' | 'danger'`), `size` (`'sm' | 'md' | 'lg'`), `loading`, `icon`, `disabled`, `onPress`. Do not pass `label`.
  - `Chip`: Accepts `label`, `selected`, `onPress`, `variant`, `color`, `icon`. Do not pass `size`.
  - `Sheet`: Accepts `visible`, `onClose`, `title`, `children`.
  - `SegmentedControl`: Accepts `options: { value: T; label: string }[]`, `value: T`, `onChange: (value: T) => void`.
  - `TextField`: Accepts `label`, `value`, `onChangeText`, `placeholder`, `keyboardType`, `error`.
  - `Icon`: Accepts `name: IconName`, `size`, `color`. Check `IconName` union in `src/components/ui/Icon.tsx`.
- **Theming & Styles (`src/design/theme.tsx`, `src/design/tokens.ts`)**:
  - Use `makeStyles((colors, scheme) => ({ ... }))`. The factory receives `colors: Palette` and `scheme: Scheme` as arguments, not a destructured object.
  - Palette keys are defined in `Palette` (`src/design/tokens.ts`): `background`, `surface`, `surfaceElevated`, `text`, `textSecondary`, `textTertiary`, `border`, `brand`, etc. Do not assume `.accent` exists.

## React & State Management

- **No Synchronous setState in useEffect**: Never call `setState` synchronously within a `useEffect` body (`react-hooks/set-state-in-effect`).
  - Compute derived values during render.
  - To reset form state on entity/modal change, key the child form component (`<Form key={id} ... />`) with `useState(() => initialValues)`.
- **Screen Data Fetching**: Use `useScreenData(fetcher)` and listen to `dataEvents` (`src/services/events.ts`). Emit `dataEvents.emit()` after any mutating transaction/account action.

## Account Domain Integration

- All accounts standardize on the `Account` entity (`src/database/schema.ts`, `src/domain/account.ts`):
  - Supported types: `SAVINGS`, `CURRENT`, `CREDIT_CARD`, `CASH`.
  - System default account: `account-cash` (`id: 'account-cash'`).
  - Helpers: `formatAccountType(type)`, `formatAccountLabel(account)`, `accountIcon(type)`.
  - Service access: mutate and query via `accountService` and `transactionService.assignAccountToPending`.

## Component Seams & File Size

- Keep screens thin. If a modal or sheet handles its own draft state, validation, and submission, extract it to a dedicated component in `src/components/` (e.g. `AccountDiscoveryModal.tsx`).
- Do not let screen files grow into monolithic handlers (>400 lines) with interleaved bottom sheets.
