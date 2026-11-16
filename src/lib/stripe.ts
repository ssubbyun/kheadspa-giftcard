import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// Stripe 인스턴스 (API 키가 제공된 경우 활성화)
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
    })
  : null;

// Stripe Test API 상태 확인
export function isStripeConfigured(): boolean {
  return Boolean(stripeSecretKey && stripeSecretKey.startsWith('sk_test_'));
}

// 결제 인텐트 생성 헬퍼
export async function createStripePaymentIntent(params: {
  amountInDollars: number; // e.g. 160.00
  faceValue: number;       // e.g. 200.00
  buyerEmail: string;
  metadata?: Record<string, string>;
}): Promise<{ clientSecret: string; paymentIntentId: string; isMock: boolean }> {
  const amountCents = Math.round(params.amountInDollars * 100);

  if (stripe) {
    try {
      const intent = await stripe.paymentIntents.create({
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

      return {
        clientSecret: intent.client_secret || '',
        paymentIntentId: intent.id,
        isMock: false,
      };
    } catch (err) {
      console.warn('[Stripe API Error] Falling back to test simulator:', err);
    }
  }

  // API 키가 아직 .env에 입력되지 않았을 때 개발 및 시연용 모의 클라이언트 시크릿
  const mockId = `pi_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return {
    clientSecret: `${mockId}_secret_${Math.random().toString(36).substring(2, 10)}`,
    paymentIntentId: mockId,
    isMock: true,
  };
}
