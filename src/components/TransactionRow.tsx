import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { space } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { FormattedTransaction } from '@/domain/transaction';
import { formatDayLabel, formatINR, formatSourceApp, formatTime } from '@/utils/format';
import { CategoryAvatar, Text, UncategorizedAvatar } from './ui';

interface Props {
  tx: FormattedTransaction;
  onPress?: (tx: FormattedTransaction) => void;
  /** Show the day as well as the time (for lists not grouped by day). */
  showDate?: boolean;
}

function TransactionRowBase({ tx, onPress, showDate = false }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const when = showDate ? `${formatDayLabel(tx.timestamp)} · ${formatTime(tx.timestamp)}` : formatTime(tx.timestamp);
  const meta = [tx.category?.name ?? 'Uncategorized', tx.member?.name, when].filter(Boolean).join(' · ');
  const source = tx.sourceType === 'UPI_NOTIFICATION' ? formatSourceApp(tx.sourceApp) : null;
  const income = tx.kind === 'INCOME';
  const shared = !income && tx.sharedPaise > 0;

  return (
    <Pressable
      onPress={onPress ? () => onPress(tx) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${tx.merchant}, ${income ? 'received' : 'spent'} ${formatINR(tx.amountPaise)}, ${meta}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {tx.category ? (
        <CategoryAvatar icon={tx.category.icon} color={tx.category.color} />
      ) : (
        <UncategorizedAvatar />
      )}
      <View style={styles.body}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {tx.merchant}
        </Text>
        <Text variant="caption" numberOfLines={1} style={styles.meta}>
          {meta}
        </Text>
      </View>
      <View style={styles.trailing}>
        <Text variant="bodyStrong" numeric color={income ? colors.positive : undefined}>
          {income ? '+' : '−'}
          {formatINR(tx.amountPaise)}
        </Text>
        {shared ? (
          <Text variant="caption" style={styles.meta} numeric>
            Your share {formatINR(tx.amountPaise - tx.sharedPaise)}
          </Text>
        ) : source ? (
          <Text variant="caption" style={styles.meta}>
            {source}
          </Text>
        ) : tx.note ? (
          <Text variant="caption" numberOfLines={1} style={[styles.meta, styles.note]}>
            {tx.note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export const TransactionRow = memo(TransactionRowBase);

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  meta: {
    marginTop: 2,
  },
  trailing: {
    alignItems: 'flex-end',
    maxWidth: '40%',
  },
  note: {
    maxWidth: 96,
  },
}));
