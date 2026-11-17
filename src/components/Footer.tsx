'use client';

import React from 'react';

interface FooterProps {
  lang: 'ko' | 'en';
  onOpenStaff?: () => void;
}

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

export default function Footer({ lang, onOpenStaff }: FooterProps) {
  return (
    <footer className="border-t border-[#EBE7DF] bg-white py-12 text-center text-xs text-stone-500 mt-20">
      <div className="max-w-6xl mx-auto px-4 space-y-4">
        <div>
          <span className="font-serif-luxury text-xl sm:text-2xl font-semibold tracking-wider text-stone-900 uppercase">
            K-headspa &amp; wellness
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

        <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-stone-400 gap-3">
          <span>
            {lang === 'ko'
              ? '모든 기프트 카드는 구매일로부터 2년간 유효하며 전 지점에서 사용 가능합니다.'
              : 'All digital gift cards are valid for 2 years and redeemable at all locations.'}
          </span>

          <div className="flex items-center gap-4">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-600 hover:text-stone-900 underline underline-offset-2 font-medium"
            >
              {lang === 'ko' ? '온라인 시술 예약' : 'Book Online'}
            </a>
            <span>·</span>
            <button
              type="button"
              onClick={onOpenStaff}
              className="text-stone-400 hover:text-stone-700 underline underline-offset-2 cursor-pointer"
            >
              Staff POS
            </button>
            <span>·</span>
            <span>
              <code>gift.kheadspawellness.com</code>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
