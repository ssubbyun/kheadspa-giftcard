'use client';

import React from 'react';
import { Sparkles, Calendar, CheckCircle2, Shield, QrCode, Building2 } from 'lucide-react';
import { GiftCardDesignId } from '@/types/gift-card';
import { getCardDesign } from '@/lib/card-designs';

interface GiftCardHeroProps {
  amount: number;
  discountRate: number;
  recipientName: string;
  designId?: GiftCardDesignId;
  lang: 'ko' | 'en';
}

export default function GiftCardHero({
  amount,
  discountRate,
  recipientName,
  designId,
  lang,
}: GiftCardHeroProps) {
  const chargeAmount = Math.round(amount * (1 - discountRate / 100) * 100) / 100;
  const design = getCardDesign(designId);

  return (
    <div className="space-y-6">
      {/* Live Pass Status Strip */}
      <div className="flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#061910]">
          <span className="w-2 h-2 rounded-full bg-[#c5a059] animate-pulse" />
          {lang === 'ko' ? '실시간 디지털 바우처 미리보기' : 'Live Sanctuary Pass Preview'}
        </span>
        <span className="text-[11px] font-mono text-[#737874]">
          KSPA · DIGITAL PASS
        </span>
      </div>

      {/* 3D Tactile Luxury Gift Card Canvas with Stitch Double Foil Rim */}
      <div className="relative group">
        {/* Ambient Halo Backglow */}
        <div className="absolute -inset-2 bg-gradient-to-tr from-[#c5a059]/30 via-[#1b2e24]/15 to-[#e9c176]/30 rounded-3xl blur-xl opacity-65 group-hover:opacity-95 transition-opacity duration-500 pointer-events-none" />

        <div
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${design.gradientClass} p-6 sm:p-8 text-[#fff8f5] border ${design.borderClass} aspect-[1.58/1] flex flex-col justify-between luxury-gold-glow transition-all duration-300`}
        >
          {/* Double Hairline Foil Border */}
          <div className="absolute inset-2.5 rounded-xl border border-[#e9c176]/30 pointer-events-none" />
          <div className="absolute inset-3.5 rounded-lg border border-[#ffdea5]/15 pointer-events-none" />

          {/* Subtle Botanical Watermark SVG */}
          <svg
            aria-hidden="true"
            className="absolute -right-10 -bottom-10 w-56 h-56 text-white/[0.05] pointer-events-none"
            fill="currentColor"
            viewBox="0 0 200 200"
          >
            <path d="M100 0 C120 40 160 80 200 100 C160 120 120 160 100 200 C80 160 40 120 0 100 C40 80 80 40 100 0 Z" />
            <circle cx="100" cy="100" fill="none" r="38" stroke="currentColor" strokeWidth="2" />
          </svg>

          {/* 상단 브랜드 & 테마 배지 */}
          <div className="relative z-10 flex justify-between items-start gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`font-serif-luxury text-lg sm:text-2xl tracking-wider ${design.accentTextClass} font-semibold uppercase leading-none`}
                >
                  K-headspa &amp; wellness
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-stone-200/85 tracking-[0.16em] uppercase mt-1 font-medium">
                {design.headlineEn}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md border border-[#ffdea5]/25 text-[10px] font-semibold tracking-wider uppercase text-[#ffdea5] shrink-0">
              <Shield className="w-3 h-3 text-[#e9c176]" />
              <span>{lang === 'ko' ? design.badgeKo : design.badgeEn}</span>
            </div>
          </div>

          {/* 중앙 충전 액면가 & 프로모션 태그 */}
          <div className="relative z-10 my-auto py-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.16em] text-stone-300/85 font-semibold">
                {lang === 'ko' ? '카드 충전 액면가 (Stored Value)' : 'Stored Card Value'}
              </span>
              {discountRate > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#061910] bg-[#ffdea5] px-2.5 py-0.5 rounded-full shadow-sm">
                  <Sparkles className="w-2.5 h-2.5" />
                  {discountRate}% {lang === 'ko' ? '특별 할인' : 'OFF'}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-serif-luxury text-4xl sm:text-5xl font-medium tracking-tight text-white">
                ${amount.toFixed(2)}
              </span>
              {discountRate > 0 && (
                <span className="text-xs text-stone-200/90">
                  ({lang === 'ko' ? '실제 결제액:' : 'You Pay:'}{' '}
                  <strong className="text-[#ffdea5] font-bold font-mono">
                    ${chargeAmount.toFixed(2)}
                  </strong>
                  )
                </span>
              )}
            </div>
          </div>

          {/* 하단 수신자 & 무제한 유효기간 명시 */}
          <div className="relative z-10 flex justify-between items-end text-xs text-stone-200/85 border-t border-[#ffdea5]/20 pt-3">
            <div>
              <span className="text-[9px] uppercase tracking-[0.16em] text-stone-300/75 block">
                {lang === 'ko' ? '받는 분 (Recipient)' : 'Honored Recipient'}
              </span>
              <span className="text-white font-semibold truncate max-w-[190px] block mt-0.5">
                {recipientName || (lang === 'ko' ? '소중한 분께' : 'Valued Guest')}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[9px] uppercase tracking-[0.16em] text-stone-300/75 flex items-center justify-end gap-1">
                <Calendar className="w-2.5 h-2.5 text-[#e9c176]" />
                {lang === 'ko' ? '유효기간' : 'Validity'}
              </span>
              <span className="font-mono text-[10px] text-[#ffdea5] mt-0.5 block">
                {lang === 'ko' ? '무제한 (만료 없음)' : 'No Expiration'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Barcode & QR Pass Pill Banner */}
      <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1b2e24] text-[#ffdea5] flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#061910]">
              {lang === 'ko' ? '1D 바코드 · QR 모바일 바우처 포함' : 'Scannable Barcode & QR Voucher'}
            </p>
            <p className="text-[11px] text-[#424844]">
              {lang === 'ko' ? '결제 완료 즉시 이메일과 SMS로 발급' : 'Delivered instantly via Email & SMS'}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-[#d1e8d9] text-[#0c1f16] text-[10px] font-bold uppercase tracking-wider shrink-0">
          {lang === 'ko' ? '기본 포함' : 'Included'}
        </span>
      </div>

      {/* Sanctuary Guarantees Bento Trust Cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="p-4 rounded-2xl bg-[#f8ece4]/75 border border-[#ece0d8] flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-[#1b2e24] shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <strong className="text-[#061910] block">
              {lang === 'ko' ? '유효기간 무제한 · 분할 사용 보장' : 'Never Expires · Multi-Visit Balance'}
            </strong>
            <span className="text-[#424844] leading-relaxed block">
              {lang === 'ko'
                ? '만료일이나 휴면 수수료 없이 잔액 소진 시까지 언제든 나누어 사용할 수 있습니다.'
                : 'Balances never expire and carry over across multiple spa visits with zero dormancy fees.'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#f8ece4]/75 border border-[#ece0d8] flex items-start gap-3">
          <Building2 className="w-4 h-4 text-[#775a19] shrink-0 mt-0.5" />
          <div className="text-xs space-y-0.5">
            <strong className="text-[#061910] block">
              {lang === 'ko' ? 'Manhattan · Norwood · Fort Lee 전 지점 호환' : 'Redeemable Across All 3 NY & NJ Studios'}
            </strong>
            <span className="text-[#424844] leading-relaxed block">
              {lang === 'ko'
                ? '받는 분이 원하는 지점과 시술 프로그램을 자유롭게 선택해 예약하실 수 있습니다.'
                : 'Recipients may apply the balance toward any head spa or wellness treatment at any studio.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
