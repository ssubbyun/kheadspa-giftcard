'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import PromotionBanner from '@/components/PromotionBanner';
import Header from '@/components/Header';
import GiftCardHero from '@/components/GiftCardHero';
import GiftCardForm from '@/components/GiftCardForm';
import BalanceTracker from '@/components/BalanceTracker';
import StaffTerminal from '@/components/StaffTerminal';
import GiftCardVoucher from '@/components/GiftCardVoucher';
import Footer from '@/components/Footer';
import { GiftCardDesignId } from '@/types/gift-card';
import { normalizeGiftCardCode } from '@/lib/barcode';

function subscribeLocationSearch(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onStoreChange();
  window.addEventListener('popstate', handler);
  window.addEventListener('kheadspa-urlchange', handler);
  return () => {
    window.removeEventListener('popstate', handler);
    window.removeEventListener('kheadspa-urlchange', handler);
  };
}

function getLocationSearchClient(): string {
  return typeof window !== 'undefined' ? window.location.search : '';
}

function notifyUrlChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kheadspa-urlchange'));
  }
}

export default function Home() {
  const locationSearch = useSyncExternalStore(
    subscribeLocationSearch,
    getLocationSearchClient,
    () => ''
  );
  const [manualTab, setManualTab] = useState<'buy' | 'check' | 'staff' | null>(null);
  const [amount, setAmount] = useState<number>(200);
  const [recipientName, setRecipientName] = useState<string>('');
  const [designId, setDesignId] = useState<GiftCardDesignId>('signature-gold');
  const [lang, setLang] = useState<'ko' | 'en'>('en');
  const [discountRate, setDiscountRate] = useState<number>(20);
  const [isPromoActive, setIsPromoActive] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/promotions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const active = Boolean(data.isPromoActive);
        const rate = Number(data.sampleCalculation?.discountRate ?? 0);
        setIsPromoActive(active);
        setDiscountRate(active && rate > 0 ? rate : 0);
      })
      .catch(() => {
        // Keep initial promo state on transient network error
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchParams = new URLSearchParams(locationSearch);
  const cardParam = searchParams.get('card');
  const modeParam = searchParams.get('mode');
  const voucherCode = cardParam ? normalizeGiftCardCode(cardParam) : null;

  const activeTab: 'buy' | 'check' | 'staff' =
    manualTab ?? (modeParam === 'staff' ? 'staff' : modeParam === 'check' ? 'check' : 'buy');

  const openVoucher = (code: string) => {
    const normalized = normalizeGiftCardCode(code);
    if (!normalized || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('card', normalized);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url.toString());
    notifyUrlChange();
  };

  const exitVoucher = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('card')) {
      url.searchParams.delete('card');
      window.history.replaceState({}, '', url.toString());
      notifyUrlChange();
    }
  };

  const handleSetTab = (tab: 'buy' | 'check' | 'staff') => {
    exitVoucher();
    setManualTab(tab);
  };

  const handleScrollToBuy = () => {
    handleSetTab('buy');
    setTimeout(() => {
      const el = document.getElementById('buy-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1A1816]">
      {/* 1. 상단 프로모션 강조 배너 */}
      {isPromoActive && discountRate > 0 && (
        <PromotionBanner onScrollToBuy={handleScrollToBuy} lang={lang} />
      )}

      {/* 2. 네비게이션 헤더 */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleSetTab}
        lang={lang}
        setLang={setLang}
        onResetVoucher={exitVoucher}
      />

      {/* 3. 메인 콘텐츠 영역 */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14">
        {voucherCode ? (
          <GiftCardVoucher code={voucherCode} lang={lang} onBack={exitVoucher} />
        ) : (
          <>
            {/* TAB 1: 기프트 카드 구매 */}
            {activeTab === 'buy' && (
              <div className="space-y-12 animate-in fade-in duration-300">
                <div className="text-center max-w-2xl mx-auto space-y-3">
                  <span className="text-xs uppercase tracking-widest text-amber-800 font-bold">
                    {isPromoActive && discountRate > 0
                      ? lang === 'ko'
                        ? '홀리데이 특별 혜택'
                        : 'HOLIDAY SPECIAL'
                      : lang === 'ko'
                        ? 'K-HEADSPA & WELLNESS'
                        : 'SIGNATURE WELLNESS GIFT'}
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-5 lg:sticky lg:top-36">
                    <GiftCardHero
                      amount={amount}
                      discountRate={discountRate}
                      recipientName={recipientName}
                      designId={designId}
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
                      designId={designId}
                      setDesignId={setDesignId}
                      lang={lang}
                      onOpenVoucher={openVoucher}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 잔액 조회 */}
            {activeTab === 'check' && (
              <BalanceTracker lang={lang} onOpenVoucher={openVoucher} />
            )}

            {/* TAB 3: 매장 직원용 차감 POS */}
            {activeTab === 'staff' && <StaffTerminal lang={lang} />}
          </>
        )}
      </main>

      {/* 4. 푸터 */}
      <Footer
        lang={lang}
        onOpenStaff={() => {
          handleSetTab('staff');
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />
    </div>
  );
}
