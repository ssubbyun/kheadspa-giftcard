'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, CheckCircle2, Shield } from 'lucide-react';

interface GiftCardHeroProps {
  amount: number;
  discountRate: number;
  recipientName: string;
  lang: 'ko' | 'en';
}

export default function GiftCardHero({ amount, discountRate, recipientName, lang }: GiftCardHeroProps) {
  const chargeAmount = Math.round(amount * (1 - discountRate / 100));
  const [expiryString, setExpiryString] = useState<string>('2028-11-30');

  useEffect(() => {
    // 클라이언트 마운트 후 현재 날짜 기준 정확한 2년 뒤 날짜 산출
    const today = new Date();
    const expiryYear = today.getFullYear() + 2;
    const expiryMonth = String(today.getMonth() + 1).padStart(2, '0');
    const expiryDay = String(today.getDate()).padStart(2, '0');
    setExpiryString(`${expiryYear}-${expiryMonth}-${expiryDay}`);
  }, []);

  return (
    <div className="space-y-5">
      {/* 3D 에디토리얼 디지털 기프트 카드 시각화 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1C1917] via-[#2A2624] to-[#141211] p-6 sm:p-8 text-[#FBF9F5] shadow-2xl border border-stone-800 aspect-[1.58/1] flex flex-col justify-between luxury-gold-glow">
        
        {/* 상단 브랜드 & 보안 칩 */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif-luxury text-xl sm:text-2xl tracking-wider text-amber-200 font-medium uppercase">
                K-headspa & wellness
              </span>
            </div>
            <p className="text-[10px] text-stone-400 tracking-widest uppercase mt-0.5">
              Digital Spa Ritual Pass
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-800/80 border border-stone-700/60 text-[10px] font-mono text-stone-300">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Stripe Secured</span>
          </div>
        </div>

        {/* 중앙 충전 액면가 & 프로모션 태그 */}
        <div className="my-auto py-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-wider text-stone-400 font-medium">
              {lang === 'ko' ? '카드 충전 액면가 (Store Value)' : 'Stored Card Value'}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
              <Sparkles className="w-2.5 h-2.5" />
              {discountRate}% {lang === 'ko' ? '특별 할인' : 'OFF'}
            </span>
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-serif-luxury text-4xl sm:text-5xl font-medium tracking-tight text-white">
              ${amount.toFixed(2)}
            </span>
            <span className="text-xs text-stone-400">
              ({lang === 'ko' ? '실제 결제액:' : 'You Pay:'} <strong className="text-amber-300 font-bold font-mono">${chargeAmount.toFixed(2)}</strong>)
            </span>
          </div>
        </div>

        {/* 하단 수신자 & 2년 유효기간 명시 */}
        <div className="flex justify-between items-end text-xs text-stone-400 border-t border-stone-800/80 pt-3">
          <div>
            <span className="text-[9px] uppercase tracking-wider text-stone-500 block">
              {lang === 'ko' ? '받는 분 (Recipient)' : 'For'}
            </span>
            <span className="text-stone-200 font-medium truncate max-w-[180px] block">
              {recipientName || (lang === 'ko' ? '소중한 분께' : 'Valued Guest')}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[9px] uppercase tracking-wider text-stone-500 flex items-center justify-end gap-1">
              <Calendar className="w-2.5 h-2.5 text-amber-400" />
              {lang === 'ko' ? '구매일로부터 2년 유효' : '2-Year Validity'}
            </span>
            <span className="font-mono text-[10px] text-stone-300">
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
            {lang === 'ko' ? '구매일로부터 2년 동안 언제든 자유롭게 분할 사용 가능합니다.' : 'Redeemable in installments anytime within 2 years.'}
          </li>
          <li>
            <strong>{lang === 'ko' ? '3개 전 지점 사용' : 'Valid at All Locations'}</strong>:{' '}
            Manhattan, Norwood, Fort Lee 모든 매장의 헤드스파 및 스킨케어 시술에 적용됩니다.
          </li>
          <li>
            <strong>{lang === 'ko' ? '잔액 실시간 추적' : 'Real-time Balance Tracking'}</strong>:{' '}
            {lang === 'ko' ? '시술 후 남은 차액은 다음 방문 시 재사용하실 수 있습니다.' : 'Remaining balance carries over for future visits.'}
          </li>
        </ul>
      </div>
    </div>
  );
}
