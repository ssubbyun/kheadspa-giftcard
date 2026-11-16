'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Sparkles, ArrowRight } from 'lucide-react';

interface PromotionBannerProps {
  onScrollToBuy: () => void;
  lang: 'ko' | 'en';
}

export default function PromotionBanner({ onScrollToBuy, lang }: PromotionBannerProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    // 마감 시점: 2026년 11월 30일 23:59:59 EST
    const targetDate = new Date('2026-11-30T23:59:59-05:00').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#1A1816] text-[#FBF9F5] border-b border-[#35302B] sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        
        {/* 프로모션 타이틀 & 배지 */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <Sparkles className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            {lang === 'ko' ? '11월 특별 프로모션' : 'NOVEMBER SPECIAL'}
          </span>
          <p className="font-medium text-stone-200">
            <strong className="text-amber-300 font-bold">
              {lang === 'ko' ? '기프트 카드 20% 특별 할인' : '20% OFF Holiday Gift Cards'}
            </strong>
            <span className="text-stone-400 ml-2">
              {lang === 'ko'
                ? '($200 액면가 구매 시 $160 결제 · 구매일로부터 2년 유효)'
                : '($200 card value for only $160 · Valid for 2 years)'}
            </span>
          </p>
        </div>

        {/* 카운트다운 타이머 & CTA 버튼 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-stone-400 font-sans text-[11px] hidden sm:inline">
              {lang === 'ko' ? '마감까지:' : 'Ends in:'}
            </span>
            {timeLeft ? (
              <span className="text-amber-400 font-bold tracking-wider">
                {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
              </span>
            ) : (
              <span className="text-stone-400">Loading...</span>
            )}
          </div>

          <button
            onClick={onScrollToBuy}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs transition duration-150 shadow-sm"
          >
            <span>{lang === 'ko' ? '할인 구매하기' : 'Shop Now'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

      </div>
    </div>
  );
}
