import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { GiftCard, GiftCardTransaction } from '@/types/gift-card';

// Firebase Admin 모듈러 초기화
function initFirebase(): Firestore | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');

    let app: App;
    if (getApps().length > 0) {
      app = getApp();
    } else {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    return getFirestore(app);
  }

  return null;
}

export const db: Firestore | null = initFirebase();

export function isFirebaseConfigured(): boolean {
  return Boolean(db);
}

// 1. 기프트 카드 저장 (Firestore)
export async function saveGiftCardToFirebase(card: GiftCard): Promise<void> {
  if (!db) return;
  const docRef = db.collection('gift_cards').doc(card.code);
  await docRef.set({
    ...card,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// 2. 기프트 카드 조회
export async function getGiftCardFromFirebase(code: string): Promise<GiftCard | null> {
  if (!db) return null;
  const docRef = db.collection('gift_cards').doc(code.toUpperCase());
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return snap.data() as GiftCard;
}

// 3. 트랜잭션 기록 저장
export async function saveTransactionToFirebase(tx: GiftCardTransaction): Promise<void> {
  if (!db) return;
  const docRef = db.collection('gift_card_transactions').doc(tx.id);
  await docRef.set({
    ...tx,
    createdAtServer: FieldValue.serverTimestamp(),
  });
}

// 4. 특정 카드의 트랜잭션 내역 조회
export async function getTransactionsFromFirebase(cardId: string): Promise<GiftCardTransaction[]> {
  if (!db) return [];
  const snap = await db
    .collection('gift_card_transactions')
    .where('giftCardId', '==', cardId)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((doc: any) => doc.data() as GiftCardTransaction);
}

// 5. 원자적 차감 트랜잭션 (Firestore runTransaction으로 중복 차감 완벽 차단)
export async function redeemInFirebase(params: {
  code: string;
  redeemAmount: number;
  location: 'Manhattan' | 'Norwood' | 'Fort Lee';
  staffName: string;
  staffNote?: string;
}): Promise<{ success: boolean; message: string; card?: GiftCard; remainingBalance?: number }> {
  if (!db) {
    return { success: false, message: 'Firebase가 연결되지 않았습니다.' };
  }

  const cardRef = db.collection('gift_cards').doc(params.code.toUpperCase());
  const txRef = db.collection('gift_card_transactions').doc(`tx-${Date.now()}`);

  try {
    const result = await db.runTransaction(async (t: any) => {
      const doc = await t.get(cardRef);
      if (!doc.exists) {
        throw new Error('기프트 카드를 찾을 수 없습니다.');
      }

      const card = doc.data() as GiftCard;

      if (card.status === 'EXPIRED') {
        throw new Error('유효기간(구매일로부터 2년)이 만료된 기프트 카드입니다.');
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
        createdAt: new Date().toISOString(),
      };

      t.update(cardRef, {
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
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '차감 처리 중 오류가 발생했습니다.',
    };
  }
}
