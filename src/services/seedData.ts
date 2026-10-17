// Development Seed Data
// Run this to populate the database with sample transactions for UI development

import { transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { SourceType } from '../database/schema';

export async function seedDevelopmentData(): Promise<void> {
  console.log('[Seed] Starting development data seed...');
  
  // Get category and member IDs
  const categories = await categoryRepository.getAll();
  const members = await memberRepository.getAll();
  
  const categoryMap = new Map(categories.map(c => [c.name, c.id]));
  const memberMap = new Map(members.map(m => [m.name, m.id]));
  
  const foodId = categoryMap.get('Food');
  const travelId = categoryMap.get('Travel');
  const shoppingId = categoryMap.get('Shopping');
  const billsId = categoryMap.get('Bills');
  const entertainmentId = categoryMap.get('Entertainment');
  const subscriptionsId = categoryMap.get('Subscriptions');
  const healthId = categoryMap.get('Health');
  const salaryId = categoryMap.get('Salary');
  
  const selfId = memberMap.get('Self');
  const dadId = memberMap.get('Dad');
  const momId = memberMap.get('Mom');
  const brotherId = memberMap.get('Brother');
  const friendId = memberMap.get('Friend');
  
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const sampleTransactions = [
    // Recent transactions (last 7 days) - CONFIRMED
    {
      amountPaise: 35000, // ₹350.00
      merchant: 'Swiggy',
      transactionTimestamp: now - 2 * 60 * 60 * 1000, // 2 hours ago
      categoryId: foodId,
      memberId: brotherId,
      note: 'Lunch order',
      status: 'CONFIRMED' as const,
      sourceApp: 'PhonePe',
      notificationId: 'sample-notif-1',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 24000, // ₹240.00
      merchant: 'Uber',
      transactionTimestamp: now - 5 * 60 * 60 * 1000, // 5 hours ago
      categoryId: travelId,
      memberId: selfId,
      note: 'Office to home',
      status: 'CONFIRMED' as const,
      sourceApp: 'Google Pay',
      notificationId: 'sample-notif-2',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 64900, // ₹649.00
      merchant: 'Netflix',
      transactionTimestamp: now - 1 * day,
      categoryId: subscriptionsId,
      memberId: selfId,
      note: 'Monthly subscription',
      status: 'CONFIRMED' as const,
      sourceApp: 'Paytm',
      notificationId: 'sample-notif-3',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 125000, // ₹1,250.00
      merchant: 'Amazon',
      transactionTimestamp: now - 2 * day,
      categoryId: shoppingId,
      memberId: selfId,
      note: 'Electronics',
      status: 'CONFIRMED' as const,
      sourceApp: 'Google Pay',
      notificationId: 'sample-notif-4',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 85000, // ₹850.00
      merchant: 'Electricity Bill',
      transactionTimestamp: now - 3 * day,
      categoryId: billsId,
      memberId: dadId,
      note: 'Monthly bill',
      status: 'CONFIRMED' as const,
      sourceApp: 'BHIM',
      notificationId: 'sample-notif-5',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 45000, // ₹450.00
      merchant: 'BookMyShow',
      transactionTimestamp: now - 4 * day,
      categoryId: entertainmentId,
      memberId: friendId,
      note: 'Movie tickets',
      status: 'CONFIRMED' as const,
      sourceApp: 'PhonePe',
      notificationId: 'sample-notif-6',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 120000, // ₹1,200.00
      merchant: 'Apollo Pharmacy',
      transactionTimestamp: now - 5 * day,
      categoryId: healthId,
      memberId: momId,
      note: 'Medicines',
      status: 'CONFIRMED' as const,
      sourceApp: 'Paytm',
      notificationId: 'sample-notif-7',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 32000, // ₹320.00
      merchant: 'Zomato',
      transactionTimestamp: now - 6 * day,
      categoryId: foodId,
      memberId: selfId,
      note: 'Dinner',
      status: 'CONFIRMED' as const,
      sourceApp: 'Google Pay',
      notificationId: 'sample-notif-8',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 180000, // ₹1,800.00
      merchant: 'Croma',
      transactionTimestamp: now - 7 * day,
      categoryId: shoppingId,
      memberId: selfId,
      note: 'Headphones',
      status: 'CONFIRMED' as const,
      sourceApp: 'PhonePe',
      notificationId: 'sample-notif-9',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 59900, // ₹599.00
      merchant: 'Spotify',
      transactionTimestamp: now - 10 * day,
      categoryId: subscriptionsId,
      memberId: selfId,
      note: 'Premium subscription',
      status: 'CONFIRMED' as const,
      sourceApp: 'Google Pay',
      notificationId: 'sample-notif-10',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    // Earlier Netflix payments, so recurring detection has a pattern to find.
    ...[31, 61].map((daysAgo, i) => ({
      amountPaise: 64900,
      merchant: 'Netflix',
      transactionTimestamp: now - (1 + daysAgo) * day,
      categoryId: subscriptionsId,
      memberId: selfId,
      note: 'Monthly subscription',
      status: 'CONFIRMED' as const,
      sourceApp: 'Paytm',
      notificationId: `sample-notif-netflix-${i}`,
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    })),
    // Income: this month's salary.
    {
      amountPaise: 8500000, // ₹85,000.00
      merchant: 'Acme Technologies',
      transactionTimestamp: new Date(new Date().getFullYear(), new Date().getMonth(), 1, 10, 0).getTime(),
      categoryId: salaryId,
      memberId: null,
      note: 'Salary',
      status: 'CONFIRMED' as const,
      sourceApp: 'Manual',
      notificationId: 'sample-notif-salary-1',
      sourceEventId: null,
      sourceType: 'SEED_DATA' as SourceType,
      kind: 'INCOME' as const,
      is_pending_capture: 0,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    // PENDING transactions - explicitly marked as SEED_DATA for testing
    // These have is_pending_capture = 1 to identify them as UPI capture events awaiting review
    {
      amountPaise: 15000, // ₹150.00
      merchant: 'Metro Recharge',
      transactionTimestamp: now - 30 * 60 * 1000, // 30 minutes ago
      categoryId: null,
      memberId: null,
      note: null,
      status: 'PENDING' as const,
      sourceApp: 'Google Pay',
      notificationId: 'sample-notif-pending-1',
      sourceEventId: 'seed-pending-1',
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 1,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
    {
      amountPaise: 8500, // ₹85.00
      merchant: 'Tea Stall',
      transactionTimestamp: now - 10 * 60 * 1000, // 10 minutes ago
      categoryId: null,
      memberId: null,
      note: null,
      status: 'PENDING' as const,
      sourceApp: 'PhonePe',
      notificationId: 'sample-notif-pending-2',
      sourceEventId: 'seed-pending-2',
      sourceType: 'SEED_DATA' as SourceType,
      is_pending_capture: 1,
      is_dismissed: 0,
      dismissed_at: null,
      parserMetadata: null,
    },
  ];
  
  let created = 0;
  for (const tx of sampleTransactions) {
    // Check if already exists
    if (tx.notificationId) {
      const existing = await transactionRepository.getByNotificationId(tx.notificationId);
      if (existing) continue;
    }
    if (tx.sourceEventId) {
      const existing = await transactionRepository.getBySourceEventId(tx.sourceEventId);
      if (existing) continue;
    }
    
    await transactionRepository.create(tx);
    created++;
  }
  
  console.log(`[Seed] Created ${created} sample transactions`);
}

export async function clearAllData(): Promise<void> {
  // This would be used for testing - not exposed in UI yet
  console.log('[Seed] Clear all data requested');
}