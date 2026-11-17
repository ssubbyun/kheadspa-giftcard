import { GiftCard, GiftCardDesignId, GiftCardTransaction, Promotion } from '@/types/gift-card';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import {
  isFirebaseConfigured,
  issueGiftCardInFirebase,
  getGiftCardFromFirebase,
  getTransactionsFromFirebase,
  redeemInFirebase,
  updateGiftCardMetadataInFirebase,
  getPendingScheduledCardsFromFirebase,
} from './firebase';
import {
  generateCode128DataUrl,
  normalizeGiftCardCode,
  normalizeUsPhone,
} from './barcode';

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

// 파일 기반 로컬 영구 스토리지 경로 (Firebase 미연결 시에만 사용, 하이브리드 Fallback 금지)
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'gift_cards_store.json');

interface StoreData {
  cards: Record<string, GiftCard>;
  transactions: GiftCardTransaction[];
  processedPaymentIntents: Record<string, string>; // paymentIntentId -> giftCardCode
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        cards: parsed.cards || {},
        transactions: parsed.transactions || [],
        processedPaymentIntents: parsed.processedPaymentIntents || {},
      };
    }
  } catch (err) {
    console.warn('[Storage] Initializing new local store:', err);
  }
  return { cards: {}, transactions: [], processedPaymentIntents: {} };
}

// 지적사항 #3 해결: 로컬 파일 쓰기 실패 시 침묵하지 않고 즉시 예외를 발생시켜 데이터 유실 방지
function saveStoreStrict(data: StoreData) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
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

// EST 기준 오늘 날짜 (YYYY-MM-DD)
export function getTodayEstDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export function isFutureScheduledDate(dateStr?: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr > getTodayEstDateString();
}

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://gift.kheadspawellness.com').replace(/\/+$/, '');
}

export function getVoucherUrl(code: string): string {
  return `${getAppBaseUrl()}/?card=${encodeURIComponent(code)}`;
}

// 초기 샘플 카드 시딩 (로컬 모드용)
async function seedInitialCard() {
  if (isFirebaseConfigured()) return;
  const demoCode = 'KSPA-HOLIDAY-2026';
  if (!localStore.cards[demoCode]) {
    const createdAt = '2026-11-10T10:00:00Z';
    const expiresAt = calculateTwoYearExpiry(new Date(createdAt));
    const qrDataUrl = await QRCode.toDataURL(getVoucherUrl(demoCode), { margin: 1, width: 240 });
    const barcodeDataUrl = generateCode128DataUrl(demoCode);

    const demoCard: GiftCard = {
      id: 'card-demo-001',
      code: demoCode,
      initialBalance: 200,
      currentBalance: 50,
      paidAmount: 160,
      currency: 'USD',
      status: 'ACTIVE',
      designId: 'holiday-emerald',
      buyerName: '김민서',
      buyerEmail: 'minseo.kim@example.com',
      recipientType: 'gift',
      recipientName: '이지은',
      recipientEmail: 'jieun.lee@example.com',
      message: '생일 축하해요! 맨해튼 K-headspa에서 힐링하고 오세요 :)',
      deliveryStatus: 'SKIPPED_NO_CREDENTIALS',
      qrCodeDataUrl: qrDataUrl,
      barcodeDataUrl,
      stripePaymentIntentId: 'pi_test_demo_holiday_200',
      promotionId: ACTIVE_PROMOTION.id,
      createdAt,
      expiresAt,
    };

    localStore.cards[demoCode] = demoCard;
    localStore.processedPaymentIntents['pi_test_demo_holiday_200'] = demoCode;

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

    try {
      saveStoreStrict(localStore);
    } catch (e) {
      console.error('Seed write error:', e);
    }
  }
}

seedInitialCard().catch(console.error);

// 1. 카드 조회 (지적사항 #3 해결: Firebase가 설정되어 있으면 오직 Firebase만 사용, 실패 시 로컬로 넘어가지 않고 에러 반환)
export async function getGiftCardByCodeAsync(code: string): Promise<{ card?: GiftCard; transactions: GiftCardTransaction[] }> {
  const normalized = normalizeGiftCardCode(code);
  if (!normalized) return { transactions: [] };

  if (isFirebaseConfigured()) {
    const card = await getGiftCardFromFirebase(normalized);
    if (!card) return { transactions: [] };
    const txs = await getTransactionsFromFirebase(card.id);
    return { card, transactions: txs };
  }

  const card = localStore.cards[normalized];
  if (!card) return { transactions: [] };

  if (card.status === 'ACTIVE' && new Date() > new Date(card.expiresAt)) {
    card.status = 'EXPIRED';
    saveStoreStrict(localStore);
  } else if (card.status === 'ACTIVE' && card.currentBalance <= 0) {
    card.status = 'EXHAUSTED';
    saveStoreStrict(localStore);
  }

  const txs = localStore.transactions.filter((t) => t.giftCardId === card.id);
  return { card, transactions: txs };
}

// 2. 새 카드 발급 (PaymentIntent 재사용 중복 방지 및 단일 저장소 강제)
export async function issueGiftCard(params: {
  faceValue: number;
  paidAmount: number;
  designId?: GiftCardDesignId;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  recipientType: 'self' | 'gift';
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  message?: string;
  scheduledDeliveryDate?: string;
  stripePaymentIntentId: string;
}): Promise<GiftCard> {
  if (!params.stripePaymentIntentId) {
    throw new Error('Stripe 결제 식별자(PaymentIntent ID)가 필요합니다.');
  }

  const calc = calculatePromotionDiscount(params.faceValue);
  const code = generateGiftCardCode();
  const now = new Date();
  const expiresAt = calculateTwoYearExpiry(now); // 정확히 2년 뒤 만료
  const voucherUrl = getVoucherUrl(code);
  const qrCodeDataUrl = await QRCode.toDataURL(voucherUrl, { margin: 1, width: 240 });
  const barcodeDataUrl = generateCode128DataUrl(code);

  const normalizedBuyerPhone = normalizeUsPhone(params.buyerPhone);
  const normalizedRecipientPhone =
    params.recipientType === 'gift'
      ? normalizeUsPhone(params.recipientPhone)
      : normalizedBuyerPhone;

  const cleanSchedule =
    params.scheduledDeliveryDate && /^\d{4}-\d{2}-\d{2}$/.test(params.scheduledDeliveryDate.trim())
      ? params.scheduledDeliveryDate.trim()
      : undefined;
  const isScheduledForFuture = isFutureScheduledDate(cleanSchedule);

  const newCard: GiftCard = {
    id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    code,
    initialBalance: params.faceValue,
    currentBalance: params.faceValue,
    paidAmount: params.paidAmount,
    currency: 'USD',
    status: 'ACTIVE',
    designId: params.designId || 'signature-gold',
    buyerName: params.buyerName,
    buyerEmail: params.buyerEmail,
    buyerPhone: normalizedBuyerPhone,
    recipientType: params.recipientType,
    recipientName: params.recipientType === 'gift' ? params.recipientName : params.buyerName,
    recipientEmail: params.recipientType === 'gift' ? params.recipientEmail : params.buyerEmail,
    recipientPhone: normalizedRecipientPhone,
    message: params.message,
    scheduledDeliveryDate: cleanSchedule,
    deliveryStatus: isScheduledForFuture ? 'PENDING_SCHEDULED' : undefined,
    qrCodeDataUrl,
    barcodeDataUrl,
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
      ? `11월 20% 프로모션 결제 ($${params.paidAmount} 결제, $${params.faceValue} 충전)`
      : `기프트 카드 정상 발급 ($${params.faceValue})`,
    createdAt: now.toISOString(),
  };

  // Firebase가 설정되어 있으면 오직 Firebase 트랜잭션으로만 저장 (실패 시 즉시 예외 발생)
  if (isFirebaseConfigured()) {
    return await issueGiftCardInFirebase(newCard, initialTx);
  }

  // 로컬 모드: PaymentIntent 중복 사용 검증
  if (localStore.processedPaymentIntents[params.stripePaymentIntentId]) {
    throw new Error('이미 처리되어 기프트 카드가 발급된 결제건(PaymentIntent)입니다.');
  }

  localStore.processedPaymentIntents[params.stripePaymentIntentId] = code;
  localStore.cards[code] = newCard;
  localStore.transactions.push(initialTx);

  // 파일 쓰기 실패 시 즉시 에러 발생 (지적사항 #3 해결)
  saveStoreStrict(localStore);

  return newCard;
}

// 3. 매장 차감 (지적사항 #3 해결: Firebase 차감 실패 시 로컬로 넘어가지 않고 즉시 실패 반환)
export async function redeemGiftCardAsync(params: {
  code: string;
  redeemAmount: number;
  location: 'Manhattan' | 'Norwood' | 'Fort Lee';
  staffName: string;
  staffNote?: string;
}): Promise<{ success: boolean; message: string; card?: GiftCard; remainingBalance?: number }> {
  const normalizedCode = normalizeGiftCardCode(params.code);

  // Firebase 연동 시 오직 Firebase에서만 처리하고 그 결과를 그대로 반환 (절대 로컬 Fallback 하지 않음!)
  if (isFirebaseConfigured()) {
    return await redeemInFirebase({
      ...params,
      code: normalizedCode,
    });
  }

  const { card } = await getGiftCardByCodeAsync(normalizedCode);
  if (!card) {
    return { success: false, message: '기프트 카드를 찾을 수 없습니다. 번호를 다시 확인해 주세요.' };
  }

  if (card.status === 'EXPIRED' || new Date() > new Date(card.expiresAt)) {
    card.status = 'EXPIRED';
    saveStoreStrict(localStore);
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
  saveStoreStrict(localStore);

  return {
    success: true,
    message: `성공적으로 $${params.redeemAmount.toFixed(2)} 차감되었습니다.`,
    card,
    remainingBalance: balanceAfter,
  };
}

// 4. 발송 상태 및 연락처 업데이트
export async function updateGiftCardDeliveryAsync(
  code: string,
  updates: Partial<GiftCard>
): Promise<GiftCard | null> {
  const normalized = normalizeGiftCardCode(code);
  if (!normalized) return null;

  if (isFirebaseConfigured()) {
    return await updateGiftCardMetadataInFirebase(normalized, updates);
  }

  const card = localStore.cards[normalized];
  if (!card) return null;

  Object.assign(card, updates);
  saveStoreStrict(localStore);
  return card;
}

// 5. 당일(또는 과거 미발송) 예약 발송 카드 조회
export async function getDueScheduledGiftCardsAsync(maxDateEst: string): Promise<GiftCard[]> {
  if (isFirebaseConfigured()) {
    return await getPendingScheduledCardsFromFirebase(maxDateEst);
  }

  return Object.values(localStore.cards).filter(
    (card) =>
      card.status === 'ACTIVE' &&
      card.deliveryStatus === 'PENDING_SCHEDULED' &&
      Boolean(card.scheduledDeliveryDate) &&
      (card.scheduledDeliveryDate as string) <= maxDateEst
  );
}

