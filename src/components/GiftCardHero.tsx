'use client';

import React, { useSyncExternalStore } from 'react';
import { Sparkles, Calendar, CheckCircle2, Shield } from 'lucide-react';
import { GiftCardDesignId } from '@/types/gift-card';
import { getCardDesign } from '@/lib/card-designs';

interface GiftCardHeroProps {
  amount: number;
  discountRate: number;
  recipientName: string;
  designId?: GiftCardDesignId;
  lang: 'ko' | 'en';
}

const emptySubscribe = () => () => {};

function getTwoYearExpiryClient(): string {
  const today = new Date();
  const expiryYear = today.getFullYear() + 2;
  const expiryMonth = String(today.getMonth() + 1).padStart(2, '0');
  const expiryDay = String(today.getDate()).padStart(2, '0');
  return `${expiryYear}-${expiryMonth}-${expiryDay}`;
}

export default function GiftCardHero({
  amount,
  discountRate,
  recipientName,
  designId,
  lang,
}: GiftCardHeroProps) {
  const chargeAmount = Math.round(amount * (1 - discountRate / 100) * 100) / 100;
  const expiryString = useSyncExternalStore(
    emptySubscribe,
    getTwoYearExpiryClient,
    () => '2 Years'
  );
  const design = getCardDesign(designId);

  return (
    <div className="space-y-5">
      {/* 3D 에디토리얼 디지털 기프트 카드 시각화 */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${design.gradientClass} p-6 sm:p-8 text-[#FBF9F5] shadow-2xl border ${design.borderClass} aspect-[1.58/1] flex flex-col justify-between luxury-gold-glow transition-all duration-300`}
      >
        {/* 상단 브랜드 & 테마 배지 */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`font-serif-luxury text-xl sm:text-2xl tracking-wider ${design.accentTextClass} font-medium uppercase`}
              >
                K-headspa &amp; wellness
              </span>
            </div>
            <p className="text-[11px] text-stone-300/90 tracking-widest uppercase mt-0.5 font-medium">
              {design.headlineEn}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/35 border border-white/15 text-[10px] font-mono text-stone-200 shrink-0">
            <Shield className="w-3 h-3 text-amber-300" />
            <span>{lang === 'ko' ? design.badgeKo : design.badgeEn}</span>
          </div>
        </div>

        {/* 중앙 충전 액면가 & 프로모션 태그 */}
        <div className="my-auto py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-wider text-stone-300/80 font-medium">
              {lang === 'ko' ? '카드 충전 액면가 (Store Value)' : 'Stored Card Value'}
            </span>
            {discountRate > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-200 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
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
              <span className="text-xs text-stone-300/90">
                ({lang === 'ko' ? '실제 결제액:' : 'You Pay:'}{' '}
                <strong className="text-amber-300 font-bold font-mono">${chargeAmount.toFixed(2)}</strong>)
              </span>
            )}
          </div>
        </div>

        {/* 하단 수신자 & 2년 유효기간 명시 */}
        <div className="flex justify-between items-end text-xs text-stone-300/85 border-t border-white/15 pt-3">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-stone-400 block">
              {lang === 'ko' ? '받는 분 (Recipient)' : 'For'}
            </span>
            <span className="text-white font-medium truncate max-w-[180px] block">
              {recipientName || (lang === 'ko' ? '소중한 분께' : 'Valued Guest')}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-stone-400 flex items-center justify-end gap-1">
              <Calendar className="w-2.5 h-2.5 text-amber-300" />
              {lang === 'ko' ? '구매일로부터 2년 유효' : '2-Year Validity'}
            </span>
            <span className="font-mono text-[10px] text-stone-200">
              Valid thru {expiryString}
            </span>
          </div>
        </div>
      </div>

      {/* 안내 박스 */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 border border-[#EBE7DF] space-y-2 text-xs text-stone-700">
        <div className="flex items-center gap-2 font-bold text-stone-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{lang === 'ko' ? 'K-headspa 기프트 카드 보증 사항' : 'Gift Card Benefits'}</span>
        </div>
        <ul className="space-y-1.5 text-stone-600 pl-6 list-disc">
          <li>
            <strong>{lang === 'ko' ? '2년 넉넉한 유효기간' : '2-Year Extended Expiry'}</strong>:{' '}
            {lang === 'ko'
              ? '구매일로부터 2년 동안 언제든 자유롭게 분할 사용 가능합니다.'
              : 'Redeemable in installments anytime within 2 years.'}
          </li>
          <li>
            <strong>{lang === 'ko' ? '이메일 · SMS · 바코드 즉시 발급' : 'Email, SMS & Checkout Barcode'}</strong>:{' '}
            {lang === 'ko'
              ? '모바일 바우처에 1D 바코드 및 QR 코드가 함께 발급되어 매장에서 바로 스캔 결제할 수 있습니다.'
              : 'Includes a scannable barcode & QR voucher for effortless check-in.'}
          </li>
          <li>
            <strong>{lang === 'ko' ? '3개 전 지점 사용' : 'Valid at All Locations'}</strong>:{' '}
            {lang === 'ko'
              ? 'Manhattan, Norwood, Fort Lee 모든 매장의 헤드스파 및 스킨케어 시술에 적용됩니다.'
              : 'Redeemable across Manhattan, Norwood, and Fort Lee studios.'}
          </li>
        </ul>
      </div>
    </div>
  );
}
