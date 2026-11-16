import { GiftCard, GiftCardTransaction, Promotion } from '@/types/gift-card';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import {
  isFirebaseConfigured,
  saveGiftCardToFirebase,
  getGiftCardFromFirebase,
  saveTransactionToFirebase,
  getTransactionsFromFirebase,
  redeemInFirebase,
} from './firebase';

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

// 파일 기반 로컬 영구 스토리지 경로 (로컬 개발 및 Firebase 백업용)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gift_cards_store.json');

interface StoreData {
  cards: Record<string, GiftCard>;
  transactions: GiftCardTransaction[];
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Storage] Initializing new local store:', err);
  }
  return { cards: {}, transactions: [] };
}

function saveStore(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Failed to persist data to disk:', err);
  }
}

const localStore = loadStore();

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

// 초기 샘플 카드 시딩 (테스트 및 시연용)
async function seedInitialCard() {
  const demoCode = 'KSPA-HOLIDAY-2026';
  if (!localStore.cards[demoCode]) {
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

    localStore.cards[demoCode] = demoCard;

    localStore.transactions.push(
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

    saveStore(localStore);
  }
}

seedInitialCard().catch(console.error);

// 1. 카드 조회 (Firebase 우선, 로컬 fallback)
export async function getGiftCardByCodeAsync(code: string): Promise<{ card?: GiftCard; transactions: GiftCardTransaction[] }> {
  const normalized = code.trim().toUpperCase();

  if (isFirebaseConfigured()) {
    try {
      const card = await getGiftCardFromFirebase(normalized);
      if (card) {
        const txs = await getTransactionsFromFirebase(card.id);
        return { card, transactions: txs };
      }
    } catch (e) {
      console.warn('[Firebase] Fallback to local store:', e);
    }
  }

  const card = localStore.cards[normalized];
  if (!card) return { transactions: [] };

  if (card.status === 'ACTIVE' && new Date() > new Date(card.expiresAt)) {
    card.status = 'EXPIRED';
    saveStore(localStore);
  } else if (card.status === 'ACTIVE' && card.currentBalance <= 0) {
    card.status = 'EXHAUSTED';
    saveStore(localStore);
  }

  const txs = localStore.transactions.filter((t) => t.giftCardId === card.id);
  return { card, transactions: txs };
}

// 2. 새 카드 발급 (Firebase 및 로컬 동시 기록)
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

  const initialTx: GiftCardTransaction = {
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
  };

  // Firebase에 저장
  if (isFirebaseConfigured()) {
    try {
      await saveGiftCardToFirebase(newCard);
      await saveTransactionToFirebase(initialTx);
    } catch (err) {
      console.warn('[Firebase] Save error, stored locally:', err);
    }
  }

  // 로컬 파일 동기화
  localStore.cards[code] = newCard;
  localStore.transactions.push(initialTx);
  saveStore(localStore);

  return newCard;
}

// 3. 매장 차감 (Redeem - Firebase 원자적 트랜잭션 지원)
export async function redeemGiftCardAsync(params: {
  code: string;
  redeemAmount: number;
  location: 'Manhattan' | 'Norwood' | 'Fort Lee';
  staffName: string;
  staffNote?: string;
}): Promise<{ success: boolean; message: string; card?: GiftCard; remainingBalance?: number }> {
  // Firebase 연동된 경우 Firestore runTransaction 실행
  if (isFirebaseConfigured()) {
    const fbResult = await redeemInFirebase(params);
    if (fbResult.success && fbResult.card) {
      // 로컬 캐시도 갱신
      localStore.cards[params.code.toUpperCase()] = fbResult.card;
      saveStore(localStore);
      return fbResult;
    }
  }

  const { card } = await getGiftCardByCodeAsync(params.code);
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

  const newTx: GiftCardTransaction = {
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
  };

  localStore.transactions.push(newTx);
  saveStore(localStore);

  return {
    success: true,
    message: `성공적으로 $${params.redeemAmount.toFixed(2)} 차감되었습니다.`,
    card,
    remainingBalance: balanceAfter,
  };
}
