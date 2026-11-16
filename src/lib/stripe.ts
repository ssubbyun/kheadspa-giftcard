import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// Stripe 인스턴스 (API 키가 설정되어 있어야 생성됨)
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
    })
  : null;

export function requireStripe(): Stripe {
  if (!stripe || !stripeSecretKey || stripeSecretKey.includes('placeholder') || stripeSecretKey.includes('sample')) {
    throw new Error(
      'Stripe API 키(STRIPE_SECRET_KEY)가 설정되지 않았습니다. 환경 변수에 유효한 Stripe Secret Key(sk_test_... 또는 sk_live_...)를 설정해 주세요.'
    );
  }
  return stripe;
}

// 결제 인텐트 생성 (모의 결제 Fallback 완전 제거 — 실제 Stripe API 호출 실패 시 즉시 예외 발생)
export async function createStripePaymentIntent(params: {
  amountInDollars: number; // e.g. 160.00
  faceValue: number;       // e.g. 200.00
  buyerEmail: string;
  metadata?: Record<string, string>;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripeClient = requireStripe();
  const amountCents = Math.round(params.amountInDollars * 100);

  const intent = await stripeClient.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    receipt_email: params.buyerEmail,
    automatic_payment_methods: { enabled: true },
    metadata: {
      faceValue: params.faceValue.toString(),
      chargedAmount: params.amountInDollars.toString(),
      ...params.metadata,
    },
  });

  if (!intent.client_secret) {
    throw new Error('Stripe PaymentIntent client_secret 생성에 실패했습니다.');
  }

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

// 결제 인텐트 서버 사이드 검증 (결제 완료 상태, 결제 금액, 액면가 메타데이터 일치 확인)
export async function verifySucceededPaymentIntent(params: {
  paymentIntentId: string;
  expectedChargeDollars: number;
  expectedFaceValue: number;
}): Promise<Stripe.PaymentIntent> {
  const stripeClient = requireStripe();

  if (!params.paymentIntentId || !params.paymentIntentId.startsWith('pi_')) {
    throw new Error('유효하지 않은 Stripe PaymentIntent ID입니다.');
  }

  const intent = await stripeClient.paymentIntents.retrieve(params.paymentIntentId);

  if (intent.status !== 'succeeded') {
    throw new Error(`결제가 완료되지 않았습니다. (현재 결제 상태: ${intent.status})`);
  }

  const expectedCents = Math.round(params.expectedChargeDollars * 100);
  if (intent.amount_received < expectedCents || intent.amount !== expectedCents) {
    throw new Error(
      `결제 금액이 일치하지 않습니다. (기대 금액: $${params.expectedChargeDollars.toFixed(2)}, 실제 승인 금액: $${(
        intent.amount_received / 100
      ).toFixed(2)})`
    );
  }

  const metaFaceValue = Number(intent.metadata?.faceValue);
  if (metaFaceValue && metaFaceValue !== params.expectedFaceValue) {
    throw new Error('요청된 액면가가 결제 인텐트의 액면가와 일치하지 않습니다.');
  }

  return intent;
}
