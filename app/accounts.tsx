import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { space, swatches } from '@/design/tokens';
import { makeStyles, useTheme } from '@/design/theme';
import { Account } from '@/database/schema';
import { accountBackfillService, accountService, ledgerService } from '@/services';
import type { AccountOverview } from '@/services/ledger';
import { useScreenData } from '@/hooks/useScreenData';
import { formatINR, pluralize } from '@/utils/format';
import { RerunScanSheet } from '@/components/RerunScanSheet';
import { AccountDraft, AccountFormSheet } from '@/components/AccountFormSheet';
import {
  BottomBar,
  Button,
  Card,
  Chip,
  Divider,
  IconTile,
  ListRow,
  LoadingView,
  ScreenHeader,
  Text,
} from '@/components/ui';
import { accountIcon, formatAccountType } from '@/domain/account';

async function fetchAccounts() {
  const backfillRes = await accountBackfillService.runAutoBackfill({ force: true });
  const [accs, overview] = await Promise.all([
    accountService.getAll(),
    ledgerService.getAccountOverview(),
  ]);
  return { accounts: accs, unconfigured: backfillRes.unconfigured, overview };
}

function formatActivity(stats: AccountOverview | undefined): string {
  if (!stats || stats.count === 0) return 'No entries linked yet';
  const parts = [pluralize(stats.count, 'entry', 'entries')];
  if (stats.totalSpentPaise > 0) {
    parts.push(`${formatINR(stats.totalSpentPaise, { decimals: 'never' })} spent`);
  }
  if (stats.totalIncomePaise > 0) {
    parts.push(`${formatINR(stats.totalIncomePaise, { decimals: 'never' })} in`);
  }
  return parts.join(' · ');
}

export default function AccountsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data, reload } = useScreenData(fetchAccounts);
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [rerunScanVisible, setRerunScanVisible] = useState(false);

  if (!data) return <LoadingView />;
  const accounts = data.accounts;

  const open = (acc?: Account) => {
    if (acc) {
      setDraft({
        id: acc.id,
        name: acc.name,
        bankName: acc.bankName ?? '',
        mask: acc.mask ?? '',
        type: acc.type,
        color: acc.color ?? swatches[0],
      });
    } else {
      setDraft({
        id: null,
        name: '',
        bankName: '',
        mask: '',
        type: 'SAVINGS',
        color: swatches[accounts.length % (swatches.length - 1)],
      });
    }
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Accounts" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" style={styles.intro}>
          Accounts represent your bank accounts, credit cards, and cash funding sources.
        </Text>

        {Platform.OS === 'android' && (
          <Button
            title="Rerun scan"
            variant="ghost"
            icon="refresh"
            onPress={() => setRerunScanVisible(true)}
            style={{ marginBottom: space.sm }}
          />
        )}

        {data.unconfigured.length > 0 && (
          <View style={{ marginBottom: space.lg }}>
            <Text variant="label" style={{ marginBottom: space.xs }}>
              Discovered from past transactions
            </Text>
            <Card padded={false}>
              {data.unconfigured.map((disc, idx) => (
                <React.Fragment key={`${disc.bankName}-${disc.mask}`}>
                  {idx > 0 && <Divider />}
                  <ListRow
                    title={disc.bankName ? `${disc.bankName} (••${disc.mask})` : `Account ••${disc.mask}`}
                    subtitle={`${disc.count} transaction${disc.count === 1 ? '' : 's'} waiting to link`}
                    left={<IconTile icon="sparkles" color={colors.brand} />}
                    right={<Chip label="Setup" selected color={colors.brand} />}
                    onPress={() => {
                      setDraft({
                        id: null,
                        name: disc.bankName ? `${disc.bankName}` : `Account ••${disc.mask}`,
                        bankName: disc.bankName ?? '',
                        mask: disc.mask,
                        type: 'SAVINGS',
                        color: swatches[accounts.length % (swatches.length - 1)],
                      });
                    }}
                  />
                </React.Fragment>
              ))}
            </Card>
          </View>
        )}

        <Card padded={false}>
          {accounts.map((acc, index) => {
            const icon = accountIcon(acc.type);
            const baseSubtitle = acc.type === 'CASH'
              ? 'Physical Cash'
              : `${formatAccountType(acc.type)}${acc.bankName ? ` • ${acc.bankName}` : ''}`;
            const activity = formatActivity(data.overview[acc.id]);

            return (
              <React.Fragment key={acc.id}>
                {index > 0 && <Divider />}
                <ListRow
                  title={acc.name}
                  subtitle={`${baseSubtitle}\n${activity}`}
                  left={<IconTile icon={icon} color={acc.color ?? colors.brand} />}
                  right={acc.mask ? <Chip label={`••${acc.mask}`} /> : undefined}
                  chevron
                  onPress={() => open(acc)}
                />
              </React.Fragment>
            );
          })}
        </Card>
      </ScrollView>

      <BottomBar>
        <Button title="Add account" icon="plus" onPress={() => open()} />
      </BottomBar>

      <AccountFormSheet
        draft={draft}
        accounts={accounts}
        onClose={() => setDraft(null)}
        onChanged={reload}
      />

      <RerunScanSheet
        visible={rerunScanVisible}
        onClose={() => setRerunScanVisible(false)}
        onComplete={() => {
          reload();
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: space.lg,
    paddingBottom: 100,
  },
  intro: {
    color: colors.textSecondary,
    marginBottom: space.md,
  },
}));
