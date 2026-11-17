'use client';

import React from 'react';
import { CreditCard, Search, CalendarCheck, Globe, LogOut, Leaf } from 'lucide-react';

interface HeaderProps {
  activeTab: 'buy' | 'check' | 'staff';
  setActiveTab: (tab: 'buy' | 'check' | 'staff') => void;
  lang: 'ko' | 'en';
  setLang: (lang: 'ko' | 'en') => void;
  onResetVoucher?: () => void;
}

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

export default function Header({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  onResetVoucher,
}: HeaderProps) {
  const handleTabChange = (tab: 'buy' | 'check' | 'staff') => {
    onResetVoucher?.();
    setActiveTab(tab);
  };

  return (
    <header className="border-b border-[#ece0d8] bg-[#fff8f5]/85 backdrop-blur-xl shadow-[0_1px_10px_rgba(6,25,16,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-20 flex items-center justify-between gap-3">
        {/* 브랜드 락업 (보태니컬 모노그램 + 세리프 워드마크) */}
        <div
          className="cursor-pointer shrink-0 flex items-center gap-3 group"
          onClick={() => handleTabChange('buy')}
        >
          <div className="w-9 h-9 rounded-full bg-[#1b2e24] text-[#ffdea5] flex items-center justify-center border border-[#c5a059]/40 shadow-sm group-hover:scale-105 transition-transform">
            <Leaf className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif-luxury text-lg sm:text-2xl font-semibold tracking-wider text-[#061910] uppercase leading-none">
                K-headspa &amp; wellness
              </span>
            </div>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[#775a19] font-semibold mt-1">
              Manhattan · Norwood · Fort Lee
            </span>
          </div>
        </div>

        {/* 중앙 세그먼트 필 네비게이션 + 섹션 앵커 */}
        <div className="hidden md:flex items-center gap-6">
          <nav className="flex items-center gap-1 bg-[#fef1e9] p-1 rounded-full border border-[#ece0d8] shadow-[inset_0_1px_2px_rgba(32,27,22,0.03)]">
            <button
              type="button"
              onClick={() => handleTabChange('buy')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'buy'
                  ? 'bg-[#061910] text-white shadow-sm'
                  : 'text-[#424844] hover:text-[#061910]'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '기프트 카드 구매' : 'Buy Gift Card'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('check')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'check'
                  ? 'bg-[#061910] text-white shadow-sm'
                  : 'text-[#424844] hover:text-[#061910]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '잔액 조회' : 'Check Balance'}</span>
            </button>
          </nav>

          {activeTab === 'buy' && (
            <div className="hidden lg:flex items-center gap-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#424844]">
              <a href="#rituals" className="hover:text-[#061910] transition-colors">
                {lang === 'ko' ? '리추얼 안내' : 'Rituals'}
              </a>
              <a href="#locations" className="hover:text-[#061910] transition-colors">
                {lang === 'ko' ? '지점 안내' : 'Locations'}
              </a>
            </div>
          )}
        </div>

        {/* 우측 유틸리티 & CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 모바일 전용 탭 전환 */}
          <div className="flex md:hidden items-center gap-1 bg-[#fef1e9] p-1 rounded-full border border-[#ece0d8]">
            <button
              type="button"
              onClick={() => handleTabChange('buy')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                activeTab === 'buy' ? 'bg-[#061910] text-white' : 'text-[#424844]'
              }`}
            >
              {lang === 'ko' ? '구매' : 'Buy'}
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('check')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                activeTab === 'check' ? 'bg-[#061910] text-white' : 'text-[#424844]'
              }`}
            >
              {lang === 'ko' ? '조회' : 'Balance'}
            </button>
          </div>

          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#f2e6de] hover:bg-[#1b2e24] text-[#061910] hover:text-white border border-[#c2c8c2]/60 transition-all"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '시술 예약' : 'Book a Service'}</span>
          </a>

          {activeTab === 'staff' && (
            <button
              type="button"
              onClick={() => handleTabChange('buy')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#c5a059] bg-[#ffdea5]/40 text-[#5d4201] hover:bg-[#ffdea5] transition cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>{lang === 'ko' ? '직원 모드 종료' : 'Exit Staff'}</span>
            </button>
          )}

          {/* 언어 토글 */}
          <button
            type="button"
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[#c2c8c2]/70 bg-white/70 text-[11px] font-semibold text-[#424844] hover:text-[#061910] hover:bg-[#fef1e9] transition cursor-pointer"
            title="언어 전환 / Switch Language"
          >
            <Globe className="w-3 h-3 text-[#775a19]" />
            <span>{lang === 'ko' ? 'EN' : 'KO'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
