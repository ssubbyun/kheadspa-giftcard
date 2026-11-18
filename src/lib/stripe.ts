import crypto from 'crypto';
import Stripe from 'stripe';
import { getAppEnv } from './barcode';

export function hasRealStripeSecretKey(): boolean {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  return (
    (key.startsWith('sk_test_') || key.startsWith('sk_live_')) &&
    !key.includes('sample') &&
    !key.includes('placeholder')
  );
}

export function isDemoCheckoutAllowed(): boolean {
  if (getAppEnv() === 'production') {
    return false;
  }
  return (
    !hasRealStripeSecretKey() &&
    (process.env.ALLOW_DEMO_CHECKOUT || '').trim().toLowerCase() === 'true'
  );
}

function getDemoSigningSecret(): string {
  return (process.env.STAFF_PORTAL_PIN || '').trim() || 'kheadspa-demo-hmac';
}

function computeDemoSig(
  ts: string,
  nonce: string,
  faceCents: number,
  chargeCents: number
): string {
  return crypto
    .createHmac('sha256', getDemoSigningSecret())
    .update(`${ts}.${nonce}.${faceCents}.${chargeCents}`)
    .digest('hex')
    .slice(0, 16);
}

export function getStripeClient(): Stripe | null {
  const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-02-24.acacia' as Stripe.StripeConfig['apiVersion'],
    typescript: true,
  });
}

export function requireStripe(): Stripe {
  const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!hasRealStripeSecretKey()) {
    throw new Error(
      'Stripe API 키(STRIPE_SECRET_KEY)가 설정되지 않았습니다. 환경 변수에 유효한 Stripe Secret Key(sk_test_... 또는 sk_live_...)를 설정해 주세요.'
    );
  }
  const client = getStripeClient();
  if (!client || !stripeSecretKey) {
    throw new Error('Stripe 클라이언트 초기화에 실패했습니다.');
  }
  return client;
}

// 결제 인텐트 생성 (데모 모드 허용 조건 미충족 시 실제 Stripe API만 사용)
export async function createStripePaymentIntent(params: {
  amountInDollars: number; // e.g. 160.00
  faceValue: number; // e.g. 200.00
  buyerEmail: string;
  metadata?: Record<string, string>;
  demoMode?: boolean;
}): Promise<{ clientSecret: string; paymentIntentId: string; demoMode: boolean }> {
  if (params.demoMode) {
    if (!isDemoCheckoutAllowed()) {
      throw new Error(
        '데모 결제 시뮬레이션 모드가 비활성화되어 있거나 실제 Stripe 키가 이미 설정되어 있습니다.'
      );
    }

    const faceCents = Math.round(params.faceValue * 100);
    const chargeCents = Math.round(params.amountInDollars * 100);
    const ts = Date.now().toString(36);
    const nonce = crypto.randomBytes(6).toString('hex');
    const sig = computeDemoSig(ts, nonce, faceCents, chargeCents);
    const paymentIntentId = `pi_demo_${ts}_${nonce}_${faceCents}_${chargeCents}_${sig}`;

    return {
      clientSecret: `demo_secret_${paymentIntentId}`,
      paymentIntentId,
      demoMode: true,
    };
  }

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
    demoMode: false,
  };
}

// 결제 인텐트 서버 사이드 검증 (실제 Stripe API 또는 HMAC 서명된 데모 인텐트 검증)
export async function verifySucceededPaymentIntent(params: {
  paymentIntentId: string;
  expectedChargeDollars: number;
  expectedFaceValue: number;
}): Promise<Stripe.PaymentIntent> {
  if (params.paymentIntentId && params.paymentIntentId.startsWith('pi_demo_')) {
    if (!isDemoCheckoutAllowed()) {
      throw new Error('데모 결제 모드가 비활성화되어 있어 데모 결제를 승인할 수 없습니다.');
    }

    const match =
      /^pi_demo_([a-z0-9]+)_([a-f0-9]{12})_(\d+)_(\d+)_([a-f0-9]{16})$/.exec(
        params.paymentIntentId
      );
    if (!match) {
      throw new Error('유효하지 않은 데모 결제 식별자(PaymentIntent) 형식입니다.');
    }

    const [, ts, nonce, faceCentsStr, chargeCentsStr, providedSig] = match;
    const faceCents = Number(faceCentsStr);
    const chargeCents = Number(chargeCentsStr);
    const expectedSig = computeDemoSig(ts, nonce, faceCents, chargeCents);

    const expectedBuf = Buffer.from(expectedSig, 'utf-8');
    const providedBuf = Buffer.from(providedSig, 'utf-8');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new Error('데모 결제 서명 검증에 실패했습니다.');
    }

    const expectedFaceCents = Math.round(params.expectedFaceValue * 100);
    const expectedChargeCents = Math.round(params.expectedChargeDollars * 100);

    if (chargeCents !== expectedChargeCents) {
      throw new Error(
        `결제 금액이 일치하지 않습니다. (기대 금액: $${params.expectedChargeDollars.toFixed(2)}, 실제 승인 금액: $${(
          chargeCents / 100
        ).toFixed(2)})`
      );
    }

    if (faceCents !== expectedFaceCents) {
      throw new Error('요청된 액면가가 결제 인텐트의 액면가와 일치하지 않습니다.');
    }

    return {
      id: params.paymentIntentId,
      status: 'succeeded',
      amount: chargeCents,
      amount_received: chargeCents,
    } as Stripe.PaymentIntent;
  }

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
