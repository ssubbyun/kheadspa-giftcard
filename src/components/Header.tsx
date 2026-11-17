'use client';

import React from 'react';
import { CreditCard, Search, CalendarCheck, Globe, LogOut } from 'lucide-react';

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
    <header className="border-b border-[#EBE7DF] bg-[#FBF9F5]/85 backdrop-blur-md sticky top-12 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
        {/* 브랜드 로고 */}
        <div
          className="cursor-pointer shrink-0"
          onClick={() => handleTabChange('buy')}
        >
          <div className="flex items-center gap-2">
            <span className="font-serif-luxury text-xl sm:text-3xl font-semibold tracking-wider text-stone-900 uppercase">
              K-headspa &amp; wellness
            </span>
          </div>
          <span className="block text-[10px] uppercase tracking-widest text-stone-500 font-medium">
            Manhattan · Norwood · Fort Lee
          </span>
        </div>

        {/* 네비게이션 탭 & 예약 버튼 & 언어 전환 */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => handleTabChange('buy')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeTab === 'buy'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '기프트 카드 구매' : 'Buy Gift Card'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('check')}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
              activeTab === 'check'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '잔액 조회' : 'Check Balance'}</span>
          </button>

          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white transition"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '시술 예약' : 'Book a Service'}</span>
          </a>

          {activeTab === 'staff' && (
            <button
              type="button"
              onClick={() => handleTabChange('buy')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-amber-700 bg-amber-50 text-amber-900 hover:bg-amber-100 transition cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>{lang === 'ko' ? '직원 모드 종료' : 'Exit Staff Mode'}</span>
            </button>
          )}

          {/* 언어 토글 */}
          <button
            type="button"
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
            title="언어 전환 / Switch Language"
          >
            <Globe className="w-3 h-3 text-stone-500" />
            <span>{lang === 'ko' ? 'EN' : 'KO'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
