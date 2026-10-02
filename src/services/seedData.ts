// Development Seed Data
// Run this to populate the database with sample transactions for UI development

import { transactionRepository } from '../database/repositories/transactionRepository';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';

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
  const personalId = categoryMap.get('Personal');
  
  const selfId = memberMap.get('Self');
  const dadId = memberMap.get('Dad');
  const momId = memberMap.get('Mom');
  const brotherId = memberMap.get('Brother');
  const friendId = memberMap.get('Friend');
  
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  
  const sampleTransactions = [
    // Recent transactions (last 7 days)
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
    },
    // Some pending transactions
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
    },
  ];
  
  let created = 0;
  for (const tx of sampleTransactions) {
    // Check if already exists
    if (tx.notificationId) {
      const existing = await transactionRepository.getByNotificationId(tx.notificationId);
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