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
    <div className="bg-[#1b2e24] text-[#fff8f5] border-b border-[#c5a059]/25 shadow-[0_2px_12px_rgba(6,25,16,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2.5 text-xs">
        {/* 프로모션 타이틀 & 샴페인 골드 배지 */}
        <div className="flex items-center gap-2.5 flex-wrap justify-center md:justify-start">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.14em] uppercase bg-[#ffdea5]/15 text-[#ffdea5] border border-[#e9c176]/35">
            <Sparkles className="w-3 h-3 text-[#e9c176] animate-spin" style={{ animationDuration: '6s' }} />
            {lang === 'ko' ? '11월 특별 프로모션' : 'SEASONAL PRIVILEGE'}
          </span>
          <p className="font-medium text-[#fef1e9]">
            <strong className="text-[#ffdea5] font-semibold">
              {lang === 'ko' ? '기프트 카드 20% 특별 할인' : '20% OFF Holiday Gift Cards'}
            </strong>
            <span className="text-[#d1e8d9]/80 ml-2">
              {lang === 'ko'
                ? '($200 액면가 구매 시 $160 결제 · 2년 유효)'
                : '($200 Value for $160 · 2-Year Validity)'}
            </span>
          </p>
        </div>

        {/* 카운트다운 타이머 & CTA 버튼 */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#061910]/65 border border-[#c5a059]/25 text-[#d1e8d9] text-[11px] font-mono">
            <Clock className="w-3 h-3 text-[#e9c176]" />
            <span className="text-[#b6ccbd] font-sans text-[10px] uppercase tracking-wider hidden sm:inline">
              {lang === 'ko' ? '마감까지' : 'Ends in'}
            </span>
            {timeLeft ? (
              <span className="text-[#ffdea5] font-semibold tracking-wider">
                {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s
              </span>
            ) : (
              <span className="text-[#b6ccbd]">...</span>
            )}
          </div>

          <button
            type="button"
            onClick={onScrollToBuy}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#ffdea5] hover:bg-[#e9c176] text-[#061910] font-semibold text-[11px] tracking-wide transition duration-150 shadow-sm cursor-pointer"
          >
            <span>{lang === 'ko' ? '할인 구매하기' : 'Shop Now'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
