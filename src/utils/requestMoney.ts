import { Share } from 'react-native';
import { getSettings } from '@/services/settings';
import { buildUpiLink } from '@/services/splits';
import { suppressLock } from '@/services/appLock';
import { formatINR } from './format';

/**
 * Shares a "pay me back" message with your UPI ID and a upi://pay link that
 * opens the other person's UPI app with the amount filled in.
 * Returns 'missing-upi' when you haven't saved your UPI ID yet.
 */
export async function requestMoney(input: {
  name: string;
  amountPaise: number;
  forWhat?: string;
}): Promise<'shared' | 'missing-upi'> {
  const { upiId, upiName } = await getSettings(['upiId', 'upiName']);
  if (!upiId) return 'missing-upi';
  const amount = formatINR(input.amountPaise);
  const link = buildUpiLink({
    upiId,
    name: upiName || undefined,
    amountPaise: input.amountPaise,
    note: input.forWhat ? `${input.forWhat} split` : 'Split payment',
  });
  const what = input.forWhat ? ` for ${input.forWhat}` : '';
  suppressLock();
  await Share.share({
    message: `Hi ${input.name}! Your share${what} is ${amount}.\nPay me on UPI: ${upiId}\n${link}`,
  });
  return 'shared';
}
