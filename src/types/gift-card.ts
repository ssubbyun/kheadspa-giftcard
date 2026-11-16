export interface Promotion {
  id: string;
  titleKo: string;
  titleEn: string;
  descriptionKo: string;
  descriptionEn: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number; // e.g. 20 for 20%
  startAt: string; // ISO date
  endAt: string; // ISO date (2026-11-30T23:59:59-05:00)
  isActive: boolean;
}

export interface GiftCard {
  id: string;
  code: string; // Format: KSPA-XXXX-XXXX-XXXX
  initialBalance: number; // Face value, e.g. $200
  currentBalance: number; // Remaining balance, e.g. $50
  paidAmount: number; // Actual Stripe charged amount, e.g. $160
  currency: 'USD';
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED';
  buyerName: string;
  buyerEmail: string;
  recipientType: 'self' | 'gift';
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  qrCodeDataUrl?: string;
  stripePaymentIntentId?: string;
  promotionId?: string;
  createdAt: string;
  expiresAt: string; // Exactly 2 years from createdAt
}

export interface GiftCardTransaction {
  id: string;
  giftCardId: string;
  transactionType: 'INITIAL_PURCHASE' | 'REDEEM' | 'REFUND';
  amount: number; // Negative for REDEEM (e.g. -150), positive for INITIAL (e.g. +200)
  balanceBefore: number;
  balanceAfter: number;
  location?: 'Manhattan' | 'Norwood' | 'Fort Lee';
  staffNote?: string;
  staffName?: string;
  createdAt: string;
}
