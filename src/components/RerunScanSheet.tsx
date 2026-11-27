import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Card, Divider, IconTile, ListRow, LoadingView, Sheet, useToast } from '@/components/ui';
import { haptic } from '@/utils/haptics';
import { pluralize } from '@/utils/format';
import { rerunScanService, RerunScanMode, RerunScanResult } from '@/services/rerunScan';
import { DiscoveredAccount } from '@/services/accountBackfill';
import { AccountDiscoveryModal } from './AccountDiscoveryModal';
import { space } from '@/design/tokens';
import { makeStyles } from '@/design/theme';

export interface RerunScanSheetProps {
  visible: boolean;
  onClose: () => void;
  onComplete?: (result: RerunScanResult) => void;
}

export function RerunScanSheet({ visible, onClose, onComplete }: RerunScanSheetProps) {
  const [loading, setLoading] = useState(false);
  const [discoveryQueue, setDiscoveryQueue] = useState<DiscoveredAccount[]>([]);
  const [pendingResult, setPendingResult] = useState<RerunScanResult | null>(null);
  const toast = useToast();
  const styles = useStyles();

  const activeDiscovery = discoveryQueue[0] ?? null;

  const handleScan = async (mode: RerunScanMode) => {
    setLoading(true);
    try {
      const res = await rerunScanService.rerunScan({ mode });
      haptic.success();

      // Format toast message
      if (res.captured > 0 || res.relinked > 0) {
        toast.show(
          `Rerun complete: ${pluralize(res.captured, 'new payment')} found, ${pluralize(res.relinked, 'transaction')} linked`
        );
      } else {
        toast.show('Rerun complete · No new payments found');
      }

      onComplete?.(res);

      if (res.unconfigured && res.unconfigured.length > 0) {
        setPendingResult(res);
        setDiscoveryQueue(res.unconfigured);
      } else {
        onClose();
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err?.message === 'SMS_PERMISSION_DENIED') {
        Alert.alert(
          'Permission Required',
          'SMS access is needed to scan your inbox for bank transactions.'
        );
      } else {
        toast.show('Scan failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const advanceDiscoveryQueue = () => {
    const remaining = discoveryQueue.slice(1);
    setDiscoveryQueue(remaining);
    if (remaining.length === 0) {
      if (pendingResult) {
        onComplete?.(pendingResult);
        setPendingResult(null);
      }
      onClose();
    }
  };

  return (
    <>
      <Sheet visible={visible && !activeDiscovery} onClose={loading ? () => {} : onClose} title="Rerun scan">
        {loading ? (
          <View style={styles.loadingContainer}>
            <LoadingView label="Scanning messages and updating accounts..." />
          </View>
        ) : (
          <Card padded={false} style={styles.card}>
            <ListRow
              title="Incremental scan"
              subtitle="Scan recent SMS messages since last scan"
              left={<IconTile icon="clock" />}
              onPress={() => handleScan('incremental')}
              chevron
            />
            <Divider inset={space.lg + 40} />
            <ListRow
              title="Complete scan"
              subtitle="Deep scan of inbox messages to recover missed history"
              left={<IconTile icon="sparkles" />}
              onPress={() => handleScan('complete')}
              chevron
            />
          </Card>
        )}
      </Sheet>

      <AccountDiscoveryModal
        visible={activeDiscovery !== null}
        initialData={
          activeDiscovery
            ? { bankName: activeDiscovery.bankName ?? '', mask: activeDiscovery.mask }
            : null
        }
        onClose={advanceDiscoveryQueue}
        onSaved={() => {}}
      />
    </>
  );
}

const useStyles = makeStyles(() => ({
  loadingContainer: {
    paddingVertical: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginVertical: space.sm,
  },
}));
