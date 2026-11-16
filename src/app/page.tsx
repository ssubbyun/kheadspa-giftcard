'use client';

import React, { useState } from 'react';
import PromotionBanner from '@/components/PromotionBanner';
import Header from '@/components/Header';
import GiftCardHero from '@/components/GiftCardHero';
import GiftCardForm from '@/components/GiftCardForm';
import BalanceTracker from '@/components/BalanceTracker';
import StaffTerminal from '@/components/StaffTerminal';
import Footer from '@/components/Footer';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'buy' | 'check' | 'staff'>('buy');
  const [amount, setAmount] = useState<number>(200);
  const [recipientName, setRecipientName] = useState<string>('소중한 분께');
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const discountRate = 20; // 11월 프로모션 20%

  const handleScrollToBuy = () => {
    setActiveTab('buy');
    const el = document.getElementById('buy-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1A1816]">
      {/* 1. 상단 프로모션 강조 배너 (요구사항 4) */}
      <PromotionBanner onScrollToBuy={handleScrollToBuy} lang={lang} />

      {/* 2. 네비게이션 헤더 */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
      />

      {/* 3. 메인 콘텐츠 영역 */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
        
        {/* TAB 1: 기프트 카드 구매 */}
        {activeTab === 'buy' && (
          <div className="space-y-12 animate-in fade-in duration-300">
            
            {/* 타이틀 헤더 */}
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <span className="text-xs uppercase tracking-widest text-amber-800 font-bold">
                {lang === 'ko' ? '홀리데이 특별 혜택' : 'HOLIDAY SPECIAL'}
              </span>
              <h1 className="font-serif-luxury text-4xl sm:text-5xl font-medium tracking-tight text-stone-900">
                {lang === 'ko' ? 'K-headspa 디지털 기프트 카드' : 'Digital Gift Cards'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                {lang === 'ko'
                  ? '두피 진단부터 세라믹 바신 샴푸 마사지까지, 소중한 분에게 깊은 휴식을 선물하세요. 맨해튼·포트리·노우드 3개 전 지점에서 구매일로부터 2년간 자유롭게 사용하실 수 있습니다.'
                  : 'Gift an immersive wellness ritual across Manhattan, Fort Lee, and Norwood. Stored values are valid for 2 years from purchase date.'}
              </p>
            </div>

            {/* 그리드 레이아웃: 카드 프리뷰 (좌) + 구매 폼 (우) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 lg:sticky lg:top-36">
                <GiftCardHero
                  amount={amount}
                  discountRate={discountRate}
                  recipientName={recipientName}
                  lang={lang}
                />
              </div>

              <div className="lg:col-span-7">
                <GiftCardForm
                  amount={amount}
                  setAmount={setAmount}
                  discountRate={discountRate}
                  recipientName={recipientName}
                  setRecipientName={setRecipientName}
                  lang={lang}
                />
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: 잔액 조회 (Balance Tracking) */}
        {activeTab === 'check' && (
          <BalanceTracker lang={lang} />
        )}

        {/* TAB 3: 매장 직원용 차감 포털 (Staff POS) */}
        {activeTab === 'staff' && (
          <StaffTerminal lang={lang} />
        )}

      </main>

      {/* 4. 푸터 */}
      <Footer lang={lang} />
    </div>
  );
}
