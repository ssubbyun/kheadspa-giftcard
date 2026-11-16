import { GiftCard, GiftCardTransaction, Promotion } from '@/types/gift-card';
import QRCode from 'qrcode';

// 1. 활성 프로모션: 11월 30일까지 20% 특별 할인
export const ACTIVE_PROMOTION: Promotion = {
  id: 'promo-nov-2026-20off',
  titleKo: '11월 한정 홀리데이 20% 특별 할인',
  titleEn: 'Limited Time: 20% Off Holiday Gift Cards',
  descriptionKo: '$200 액면가 구매 시 20% 할인된 $160만 결제됩니다. (11월 30일 마감)',
  descriptionEn: 'Receive a $200 stored value for only $160. Valid through Nov 30.',
  discountType: 'PERCENTAGE',
  discountValue: 20, // 20%
  startAt: '2026-11-01T00:00:00-05:00',
  endAt: '2026-11-30T23:59:59-05:00',
  isActive: true,
};

// 인메모리 저장소 (개발/서버리스 환경 지원)
const globalStore = global as unknown as {
  __giftCards?: Map<string, GiftCard>;
  __transactions?: GiftCardTransaction[];
};

if (!globalStore.__giftCards) {
  globalStore.__giftCards = new Map<string, GiftCard>();
}
if (!globalStore.__transactions) {
  globalStore.__transactions = [];
}

const cards = globalStore.__giftCards;
const transactions = globalStore.__transactions;

// 2년 유효기간 계산 헬퍼 함수
export function calculateTwoYearExpiry(startDate: Date = new Date()): string {
  const expiry = new Date(startDate);
  expiry.setFullYear(expiry.getFullYear() + 2);
  return expiry.toISOString();
}

// 프로모션 할인 계산 헬퍼
export function calculatePromotionDiscount(amount: number): {
  faceValue: number;
  discountRate: number;
  discountAmount: number;
  chargeAmount: number;
  isPromoActive: boolean;
  promotion: Promotion;
} {
  const now = new Date();
  const promoEnd = new Date(ACTIVE_PROMOTION.endAt);
  const promoStart = new Date(ACTIVE_PROMOTION.startAt);
  const isPromoActive = ACTIVE_PROMOTION.isActive && now >= promoStart && now <= promoEnd;

  if (isPromoActive && ACTIVE_PROMOTION.discountType === 'PERCENTAGE') {
    const rate = ACTIVE_PROMOTION.discountValue / 100;
    const discountAmount = Math.round(amount * rate * 100) / 100;
    const chargeAmount = Math.round((amount - discountAmount) * 100) / 100;
    return {
      faceValue: amount,
      discountRate: ACTIVE_PROMOTION.discountValue,
      discountAmount,
      chargeAmount,
      isPromoActive: true,
      promotion: ACTIVE_PROMOTION,
    };
  }

  return {
    faceValue: amount,
    discountRate: 0,
    discountAmount: 0,
    chargeAmount: amount,
    isPromoActive: false,
    promotion: ACTIVE_PROMOTION,
  };
}

// 16자리 코드 생성 (e.g. KSPA-8F2A-99B4-102C)
export function generateGiftCardCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `KSPA-${segment()}-${segment()}-${segment()}`;
}

// 초기 샘플 카드 시딩 (테스트 및 즉시 시연용)
async function seedInitialCard() {
  const demoCode = 'KSPA-HOLIDAY-2026';
  if (!cards.has(demoCode)) {
    const createdAt = '2026-11-10T10:00:00Z';
    const expiresAt = calculateTwoYearExpiry(new Date(createdAt));
    const qrDataUrl = await QRCode.toDataURL(demoCode, { margin: 1, width: 220 });

    const demoCard: GiftCard = {
      id: 'card-demo-001',
      code: demoCode,
      initialBalance: 200,
      currentBalance: 50,
      paidAmount: 160,
      currency: 'USD',
      status: 'ACTIVE',
      buyerName: '김민서',
      buyerEmail: 'minseo.kim@example.com',
      recipientType: 'gift',
      recipientName: '이지은',
      recipientEmail: 'jieun.lee@example.com',
      message: '생일 축하해요! 맨해튼 K-headspa에서 힐링하고 오세요 :)',
      qrCodeDataUrl: qrDataUrl,
      stripePaymentIntentId: 'pi_test_demo_holiday_200',
      promotionId: ACTIVE_PROMOTION.id,
      createdAt,
      expiresAt,
    };

    cards.set(demoCode, demoCard);

    // 샘플 트랜잭션 기록
    transactions.push(
      {
        id: 'tx-001',
        giftCardId: demoCard.id,
        transactionType: 'INITIAL_PURCHASE',
        amount: 200,
        balanceBefore: 0,
        balanceAfter: 200,
        staffNote: '11월 20% 프로모션 구매 ($160 결제, $200 충전)',
        createdAt,
      },
      {
        id: 'tx-002',
        giftCardId: demoCard.id,
        transactionType: 'REDEEM',
        amount: -150,
        balanceBefore: 200,
        balanceAfter: 50,
        location: 'Manhattan',
        staffName: 'Sarah K.',
        staffNote: 'Signature Wet Head Spa 90min 시술 차감',
        createdAt: '2026-11-13T14:30:00Z',
      }
    );
  }
}

seedInitialCard().catch(console.error);

// 카드 조회
export function getGiftCardByCode(code: string): { card?: GiftCard; transactions: GiftCardTransaction[] } {
  const normalized = code.trim().toUpperCase();
  const card = cards.get(normalized);
  if (!card) return { transactions: [] };

  // 만료일 체크 (구매일로부터 2년)
  if (card.status === 'ACTIVE' && new Date() > new Date(card.expiresAt)) {
    card.status = 'EXPIRED';
  } else if (card.status === 'ACTIVE' && card.currentBalance <= 0) {
    card.status = 'EXHAUSTED';
  }

  const txs = transactions.filter((t) => t.giftCardId === card.id);
  return { card, transactions: txs };
}

// 새 카드 발급
export async function issueGiftCard(params: {
  faceValue: number;
  buyerName: string;
  buyerEmail: string;
  recipientType: 'self' | 'gift';
  recipientName?: string;
  recipientEmail?: string;
  message?: string;
  stripePaymentIntentId?: string;
}): Promise<GiftCard> {
  const calc = calculatePromotionDiscount(params.faceValue);
  const code = generateGiftCardCode();
  const now = new Date();
  const expiresAt = calculateTwoYearExpiry(now); // 정확히 2년 뒤 만료
  const qrCodeDataUrl = await QRCode.toDataURL(code, { margin: 1, width: 240 });

  const newCard: GiftCard = {
    id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    code,
    initialBalance: params.faceValue,
    currentBalance: params.faceValue,
    paidAmount: calc.chargeAmount,
    currency: 'USD',
    status: 'ACTIVE',
    buyerName: params.buyerName,
    buyerEmail: params.buyerEmail,
    recipientType: params.recipientType,
    recipientName: params.recipientType === 'gift' ? params.recipientName : params.buyerName,
    recipientEmail: params.recipientType === 'gift' ? params.recipientEmail : params.buyerEmail,
    message: params.message,
    qrCodeDataUrl,
    stripePaymentIntentId: params.stripePaymentIntentId,
    promotionId: calc.isPromoActive ? ACTIVE_PROMOTION.id : undefined,
    createdAt: now.toISOString(),
    expiresAt, // 2-year expiration date
  };

  cards.set(code, newCard);

  // 최초 발급 트랜잭션 기록
  transactions.push({
    id: `tx-${Date.now()}`,
    giftCardId: newCard.id,
    transactionType: 'INITIAL_PURCHASE',
    amount: params.faceValue,
    balanceBefore: 0,
    balanceAfter: params.faceValue,
    staffNote: calc.isPromoActive
      ? `11월 20% 프로모션 결제 ($${calc.chargeAmount} 결제, $${params.faceValue} 충전)`
      : `기프트 카드 정상 발급 ($${params.faceValue})`,
    createdAt: now.toISOString(),
  });

  return newCard;
}

// 매장 차감 (Redeem)
export function redeemGiftCard(params: {
  code: string;
  redeemAmount: number;
  location: 'Manhattan' | 'Norwood' | 'Fort Lee';
  staffName: string;
  staffNote?: string;
}): { success: boolean; message: string; card?: GiftCard; remainingBalance?: number } {
  const { card } = getGiftCardByCode(params.code);
  if (!card) {
    return { success: false, message: '기프트 카드를 찾을 수 없습니다. 번호를 다시 확인해 주세요.' };
  }

  if (card.status === 'EXPIRED') {
    return { success: false, message: '유효기간(구매일로부터 2년)이 만료된 기프트 카드입니다.' };
  }

  if (card.status !== 'ACTIVE' || card.currentBalance <= 0) {
    return { success: false, message: '잔액이 소진되었거나 비활성 상태인 기프트 카드입니다.' };
  }

  if (params.redeemAmount <= 0) {
    return { success: false, message: '차감 금액은 0보다 커야 합니다.' };
  }

  if (params.redeemAmount > card.currentBalance) {
    return {
      success: false,
      message: `잔액이 부족합니다. (현재 잔액: $${card.currentBalance.toFixed(2)}, 요청 금액: $${params.redeemAmount.toFixed(2)})`,
      card,
      remainingBalance: card.currentBalance,
    };
  }

  const balanceBefore = card.currentBalance;
  const balanceAfter = Math.round((balanceBefore - params.redeemAmount) * 100) / 100;

  card.currentBalance = balanceAfter;
  if (balanceAfter <= 0) {
    card.status = 'EXHAUSTED';
  }

  transactions.push({
    id: `tx-${Date.now()}`,
    giftCardId: card.id,
    transactionType: 'REDEEM',
    amount: -params.redeemAmount,
    balanceBefore,
    balanceAfter,
    location: params.location,
    staffName: params.staffName,
    staffNote: params.staffNote || '현장 시술 차감',
    createdAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: `성공적으로 $${params.redeemAmount.toFixed(2)} 차감되었습니다.`,
    card,
    remainingBalance: balanceAfter,
  };
}
