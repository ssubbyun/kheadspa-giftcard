'use client';

import React from 'react';
import { CreditCard, Search, ShieldCheck, Globe } from 'lucide-react';

interface HeaderProps {
  activeTab: 'buy' | 'check' | 'staff';
  setActiveTab: (tab: 'buy' | 'check' | 'staff') => void;
  lang: 'ko' | 'en';
  setLang: (lang: 'ko' | 'en') => void;
}

export default function Header({ activeTab, setActiveTab, lang, setLang }: HeaderProps) {
  return (
    <header className="border-b border-[#EBE7DF] bg-[#FBF9F5]/80 backdrop-blur-md sticky top-12 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        
        {/* 브랜드 로고 */}
        <div className="cursor-pointer" onClick={() => setActiveTab('buy')}>
          <div className="flex items-center gap-2">
            <span className="font-serif-luxury text-2xl sm:text-3xl font-semibold tracking-wider text-stone-900 uppercase">
              K-headspa & wellness
            </span>
          </div>
          <span className="block text-[10px] uppercase tracking-widest text-stone-500 font-medium">
            Manhattan · Norwood · Fort Lee
          </span>
        </div>

        {/* 네비게이션 탭 & 언어 전환 */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          <button
            onClick={() => setActiveTab('buy')}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs font-semibold transition ${
              activeTab === 'buy'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '기프트 카드 구매' : 'Buy Card'}</span>
          </button>

          <button
            onClick={() => setActiveTab('check')}
            className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs font-semibold transition ${
              activeTab === 'check'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{lang === 'ko' ? '잔액 조회' : 'Check Balance'}</span>
          </button>

          <button
            onClick={() => setActiveTab('staff')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition ${
              activeTab === 'staff'
                ? 'border-amber-700 bg-amber-50 text-amber-900'
                : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:border-stone-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">{lang === 'ko' ? '매장 카운터' : 'Staff Portal'}</span>
            <span className="sm:hidden">{lang === 'ko' ? '직원' : 'Staff'}</span>
          </button>

          {/* 언어 토글 */}
          <button
            onClick={() => setLang(lang === 'ko' ? 'en' : 'ko')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition ml-1"
            title="언어 전환 / Language"
          >
            <Globe className="w-3 h-3 text-stone-500" />
            <span>{lang === 'ko' ? 'EN' : 'KO'}</span>
          </button>

        </div>

      </div>
    </header>
  );
}
