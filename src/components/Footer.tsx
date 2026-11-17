'use client';

import React from 'react';
import { Leaf, MapPin, ShieldCheck } from 'lucide-react';

interface FooterProps {
  lang: 'ko' | 'en';
  onOpenStaff?: () => void;
}

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

export default function Footer({ lang, onOpenStaff }: FooterProps) {
  return (
    <footer className="border-t border-[#ece0d8] bg-[#fef1e9] text-xs text-[#424844] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-14 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Column 1: Brand Philosophy */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1b2e24] text-[#ffdea5] flex items-center justify-center border border-[#c5a059]/40">
                <Leaf className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-serif-luxury text-xl font-semibold tracking-wider text-[#061910] uppercase block leading-none">
                  K-headspa &amp; wellness
                </span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-[#775a19] font-semibold">
                  Korean Scalp Sanctuary
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-[#424844]/90">
              {lang === 'ko'
                ? '정밀 두피 진단과 세라믹 바신 테라피, 한국 전통 보태니컬 스파 리추얼을 전 지점에서 만나보세요.'
                : 'Restorative Korean scalp microscopy, ceramic waterfall therapy, and botanical relaxation rituals across NY & NJ.'}
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#775a19]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {lang === 'ko' ? '2년 유효기간 · 전 지점 통합 사용' : '2-Year Validity · Redeemable Across All 3 Studios'}
              </span>
            </div>
          </div>

          {/* Column 2: Real Studio Addresses */}
          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#061910] block">
              {lang === 'ko' ? '스튜디오 지점' : 'Studio Locations'}
            </span>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#775a19] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#061910] block">Manhattan Flagship</strong>
                  <span className="text-[#424844]">820 Washington St, New York, NY</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#775a19] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#061910] block">Norwood Studio</strong>
                  <span className="text-[#424844]">450 Livingston St, Norwood, NJ</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#775a19] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#061910] block">Fort Lee Studio</strong>
                  <span className="text-[#424844]">204 Tom Hunter Rd, Fort Lee, NJ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Concierge & Staff Access */}
          <div className="space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#061910] block">
              {lang === 'ko' ? '예약 및 고객 지원' : 'Concierge & Care'}
            </span>
            <p className="text-xs text-[#424844] leading-relaxed">
              {lang === 'ko'
                ? '모든 디지털 기프트 카드는 이메일과 SMS 바코드 바우처로 발급되며, 3개 지점 어디서나 분할 사용하실 수 있습니다.'
                : 'Digital passes include a 1D checkout barcode and QR code for instant in-store scanning across multiple visits.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-full bg-[#1b2e24] hover:bg-[#061910] text-white text-xs font-semibold transition shadow-sm"
              >
                {lang === 'ko' ? '온라인 시술 예약' : 'Book Online'}
              </a>
              <button
                type="button"
                onClick={onOpenStaff}
                className="inline-flex items-center px-3.5 py-2 rounded-full border border-[#c2c8c2] bg-white/70 hover:bg-white text-[#424844] hover:text-[#061910] text-xs font-semibold transition cursor-pointer"
              >
                Staff POS
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-[#ece0d8] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#737874] gap-3">
          <span>
            {lang === 'ko'
              ? '모든 기프트 카드는 구매일로부터 2년간 유효하며 전 지점에서 사용 가능합니다.'
              : 'All digital gift cards are valid for 2 years from issue date and redeemable at all locations.'}
          </span>
          <div className="flex items-center gap-3">
            <code>gift.kheadspawellness.com</code>
            <span>·</span>
            <span>Powered by Stripe</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
