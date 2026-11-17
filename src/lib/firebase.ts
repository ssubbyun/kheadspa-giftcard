import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  Firestore,
  Transaction,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { GiftCard, GiftCardTransaction } from '@/types/gift-card';
import { getErrorMessage, isValidDollarCents } from './barcode';

// Firebase Admin 모듈러 초기화
function initFirebase(): Firestore | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  const hasExplicitCert = Boolean(projectId && clientEmail && privateKey);
  const isCloudRuntime = Boolean(
    process.env.FUNCTION_TARGET || process.env.K_SERVICE || process.env.FIREBASE_CONFIG
  );

  if (!hasExplicitCert && !isCloudRuntime) {
    return null;
  }

  if (getApps().length > 0) {
    return getFirestore(getApp());
  }

  let app: App;
  if (hasExplicitCert && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
    app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  } else {
    // Cloud Functions / Cloud Run 런타임에서는 Application Default Credentials 사용
    app = initializeApp();
  }

  const firestore = getFirestore(app);
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}

export const db: Firestore | null = initFirebase();

export function isFirebaseConfigured(): boolean {
  return Boolean(db);
}

// 1. 기프트 카드 원자적 발급 (동일 Stripe PaymentIntent 중복 발급 원천 차단)
export async function issueGiftCardInFirebase(
  card: GiftCard,
  initialTx: GiftCardTransaction
): Promise<GiftCard> {
  if (!db) {
    throw new Error('Firebase 데이터베이스가 연결되어 있지 않습니다.');
  }

  if (!card.stripePaymentIntentId) {
    throw new Error('유효한 Stripe PaymentIntent ID가 누락되었습니다.');
  }

  const cardRef = db.collection('gift_cards').doc(card.code);
  const txRef = db.collection('gift_card_transactions').doc(initialTx.id);
  const piLockRef = db.collection('processed_payment_intents').doc(card.stripePaymentIntentId);

  await db.runTransaction(async (t: Transaction) => {
    const piDoc = await t.get(piLockRef);
    if (piDoc.exists) {
      throw new Error('이미 처리되어 카드가 발급된 결제건(PaymentIntent)입니다.');
    }

    const existingCard = await t.get(cardRef);
    if (existingCard.exists) {
      throw new Error('동일한 기프트 카드 코드가 이미 존재합니다. 다시 시도해 주세요.');
    }

    t.set(piLockRef, {
      paymentIntentId: card.stripePaymentIntentId,
      giftCardCode: card.code,
      giftCardId: card.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    t.set(cardRef, {
      ...card,
      updatedAt: FieldValue.serverTimestamp(),
    });

    t.set(txRef, {
      ...initialTx,
      createdAtServer: FieldValue.serverTimestamp(),
    });
  });

  return card;
}

// 2. 기프트 카드 조회 (무제한 유효기간 정규화 및 잔액 상태 반영)
export async function getGiftCardFromFirebase(code: string): Promise<GiftCard | null> {
  if (!db) {
    throw new Error('Firebase 데이터베이스가 연결되어 있지 않습니다.');
  }

  const docRef = db.collection('gift_cards').doc(code.toUpperCase());
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const card = snap.data() as GiftCard;
  const firestoreUpdates: Record<string, unknown> = {};

  if (card.expiresAt !== null) {
    card.expiresAt = null;
    firestoreUpdates.expiresAt = null;
  }

  if (card.status === 'EXPIRED' && card.currentBalance > 0) {
    card.status = 'ACTIVE';
    firestoreUpdates.status = 'ACTIVE';
  } else if (card.status === 'ACTIVE' && card.currentBalance <= 0) {
    card.status = 'EXHAUSTED';
    firestoreUpdates.status = 'EXHAUSTED';
  }

  if (Object.keys(firestoreUpdates).length > 0) {
    await docRef.update({
      ...firestoreUpdates,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return card;
}

// 3. 특정 카드의 트랜잭션 내역 조회
export async function getTransactionsFromFirebase(cardId: string): Promise<GiftCardTransaction[]> {
  if (!db) {
    throw new Error('Firebase 데이터베이스가 연결되어 있지 않습니다.');
  }

  const snap = await db
    .collection('gift_card_transactions')
    .where('giftCardId', '==', cardId)
    .get();

  return snap.docs
    .map((doc: QueryDocumentSnapshot) => doc.data() as GiftCardTransaction)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// 4. 원자적 차감 트랜잭션 (무제한 유효기간 정책 반영 및 에러 시 로컬 Fallback 없이 즉시 반환)
export async function redeemInFirebase(params: {
  code: string;
  redeemAmount: number;
  location: 'Manhattan' | 'Norwood' | 'Fort Lee';
  staffName: string;
  staffNote?: string;
}): Promise<{ success: boolean; message: string; card?: GiftCard; remainingBalance?: number }> {
  if (!db) {
    throw new Error('Firebase 데이터베이스가 연결되어 있지 않습니다.');
  }

  if (!isValidDollarCents(params.redeemAmount, 0.01, 10000)) {
    return {
      success: false,
      message: '올바른 차감 금액을 입력해 주세요 (최소 $0.01, 소수점 둘째 자리까지).',
    };
  }

  const cardRef = db.collection('gift_cards').doc(params.code.toUpperCase());
  const txRef = db.collection('gift_card_transactions').doc(`tx-${Date.now()}`);

  try {
    const result = await db.runTransaction(async (t: Transaction) => {
      const doc = await t.get(cardRef);
      if (!doc.exists) {
        throw new Error('기프트 카드를 찾을 수 없습니다.');
      }

      const card = doc.data() as GiftCard;
      const now = new Date();
      const cardUpdates: Record<string, unknown> = {};

      if (card.expiresAt !== null) {
        card.expiresAt = null;
        cardUpdates.expiresAt = null;
      }

      if (card.status === 'EXPIRED' && card.currentBalance > 0) {
        card.status = 'ACTIVE';
      }

      if (card.status !== 'ACTIVE' || card.currentBalance <= 0) {
        throw new Error('잔액이 소진되었거나 비활성 상태인 카드입니다.');
      }

      if (params.redeemAmount > card.currentBalance) {
        throw new Error(`잔액이 부족합니다. (현재 잔액: $${card.currentBalance.toFixed(2)})`);
      }

      const balanceBefore = card.currentBalance;
      const balanceAfter = Math.round((balanceBefore - params.redeemAmount) * 100) / 100;

      card.currentBalance = balanceAfter;
      if (balanceAfter <= 0) {
        card.status = 'EXHAUSTED';
      }

      const newTx: GiftCardTransaction = {
        id: txRef.id,
        giftCardId: card.id,
        transactionType: 'REDEEM',
        amount: -params.redeemAmount,
        balanceBefore,
        balanceAfter,
        location: params.location,
        staffName: params.staffName,
        staffNote: params.staffNote || '현장 시술 차감',
        createdAt: now.toISOString(),
      };

      t.update(cardRef, {
        ...cardUpdates,
        currentBalance: balanceAfter,
        status: card.status,
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.set(txRef, newTx);

      return { card, remainingBalance: balanceAfter };
    });

    return {
      success: true,
      message: `성공적으로 $${params.redeemAmount.toFixed(2)} 차감되었습니다.`,
      card: result.card,
      remainingBalance: result.remainingBalance,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: getErrorMessage(err, '차감 처리 중 오류가 발생했습니다.'),
    };
  }
}

// 5. 기프트 카드 발송 상태 및 연락처 메타데이터 업데이트
export async function updateGiftCardMetadataInFirebase(
  code: string,
  updates: Partial<GiftCard>
): Promise<GiftCard | null> {
  if (!db) {
    throw new Error('Firebase 데이터베이스가 연결되어 있지 않습니다.');
  }

  const cardRef = db.collection('gift_cards').doc(code.trim().toUpperCase());
  const snap = await cardRef.get();
  if (!snap.exists) return null;

  const cleanUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      cleanUpdates[k] = v;
    }
  }

  await cardRef.update({
    ...cleanUpdates,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const updatedSnap = await cardRef.get();
  return updatedSnap.exists ? (updatedSnap.data() as GiftCard) : null;
}

// 6. 예약 발송 대기 중(PENDING_SCHEDULED)이면서 발송일(maxDateEst)이 도래한 카드 목록 조회
export async function getPendingScheduledCardsFromFirebase(
  maxDateEst: string
): Promise<GiftCard[]> {
  if (!db) {
    throw new Error('Firebase 데이터베이스가 연결되어 있지 않습니다.');
  }

  const snap = await db
    .collection('gift_cards')
    .where('deliveryStatus', '==', 'PENDING_SCHEDULED')
    .get();

  return snap.docs
    .map((doc: QueryDocumentSnapshot) => doc.data() as GiftCard)
    .filter(
      (card) =>
        card.status === 'ACTIVE' &&
        Boolean(card.scheduledDeliveryDate) &&
        (card.scheduledDeliveryDate as string) <= maxDateEst
    );
}

