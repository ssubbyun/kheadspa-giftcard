'use client';

import React from 'react';

export default function Footer({ lang }: { lang: 'ko' | 'en' }) {
  return (
    <footer className="border-t border-[#EBE7DF] bg-white py-12 text-center text-xs text-stone-500 mt-20">
      <div className="max-w-6xl mx-auto px-4 space-y-4">
        <div>
          <span className="font-serif-luxury text-xl sm:text-2xl font-semibold tracking-wider text-stone-900 uppercase">
            K-headspa & wellness
          </span>
          <p className="text-[10px] uppercase tracking-widest text-stone-400 mt-0.5">
            Manhattan · Norwood · Fort Lee
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-stone-600 text-xs">
          <span>
            <strong>Manhattan:</strong> 820 Washington St, New York, NY
          </span>
          <span>
            <strong>Norwood:</strong> 450 Livingston St, Norwood, NJ
          </span>
          <span>
            <strong>Fort Lee:</strong> 204 Tom Hunter Rd, Fort Lee, NJ
          </span>
        </div>

        <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-stone-400 gap-2">
          <span>
            {lang === 'ko'
              ? '모든 기프트 카드는 구매일로부터 2년간 유효하며 전 지점에서 사용 가능합니다.'
              : 'All digital gift cards are valid for 2 years and redeemable at all locations.'}
          </span>
          <span>
            Subdomain: <code>gift.kheadspawellness.com</code> · Powered by Stripe
          </span>
        </div>
      </div>
    </footer>
  );
}
