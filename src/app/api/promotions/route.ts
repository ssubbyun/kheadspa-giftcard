import { NextResponse } from 'next/server';
import { ACTIVE_PROMOTION, calculatePromotionDiscount } from '@/lib/storage';
import { isDemoCheckoutAllowed } from '@/lib/stripe';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET() {
  const calc200 = calculatePromotionDiscount(200);

  return NextResponse.json(
    {
      promotion: ACTIVE_PROMOTION,
      serverTime: new Date().toISOString(),
      isPromoActive: calc200.isPromoActive,
      demoCheckoutAvailable: isDemoCheckoutAllowed(),
      sampleCalculation: {
        faceValue: 200,
        chargeAmount: calc200.chargeAmount,
        discountAmount: calc200.discountAmount,
        discountRate: calc200.discountRate,
      },
    },
    { headers: NO_STORE_HEADERS }
  );
}
