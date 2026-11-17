'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Sparkles,
  Verified,
  MapPin,
  Droplets,
  Microscope,
  HeartHandshake,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';
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

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

const STUDIO_LOCATIONS = [
  {
    regionEn: 'New York City',
    regionKo: '뉴욕 맨해튼',
    nameEn: 'Manhattan Flagship',
    nameKo: '맨해튼 플래그십',
    address: '820 Washington St, New York, NY',
    noteEn: 'Heart of Meatpacking District',
    noteKo: '미트패킹 디스트릭트 본점',
  },
  {
    regionEn: 'Bergen County, NJ',
    regionKo: '뉴저지 노우드',
    nameEn: 'Norwood Studio',
    nameKo: '노우드 스튜디오',
    address: '450 Livingston St, Norwood, NJ',
    noteEn: 'Serene Private Scalp Chambers',
    noteKo: '프라이빗 두피 테라피 룸 완비',
  },
  {
    regionEn: 'Hudson Palisades, NJ',
    regionKo: '뉴저지 포트리',
    nameEn: 'Fort Lee Studio',
    nameKo: '포트리 스튜디오',
    address: '204 Tom Hunter Rd, Fort Lee, NJ',
    noteEn: 'Minutes from George Washington Bridge',
    noteKo: '조지 워싱턴 브릿지 인접',
  },
];

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
    <div className="min-h-screen flex flex-col bg-[#fff8f5] text-[#201b16]">
      {/* 1. 통합 Sticky 프로모션 배너 + 네비게이션 헤더 */}
      <div className="sticky top-0 z-50">
        {isPromoActive && discountRate > 0 && (
          <PromotionBanner onScrollToBuy={handleScrollToBuy} lang={lang} />
        )}

        <Header
          activeTab={activeTab}
          setActiveTab={handleSetTab}
          lang={lang}
          setLang={setLang}
          onResetVoucher={exitVoucher}
        />
      </div>

      {/* 2. 메인 콘텐츠 영역 */}
      <main className="flex-1 w-full relative overflow-hidden">
        {/* Ambient Stitch Sanctuary Glow */}
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[340px] bg-gradient-to-b from-[#ffdea5]/25 via-[#f2e6de]/40 to-transparent blur-3xl pointer-events-none rounded-full"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
          {voucherCode ? (
            <GiftCardVoucher code={voucherCode} lang={lang} onBack={exitVoucher} />
          ) : (
            <>
              {/* TAB 1: 기프트 카드 구매 */}
              {activeTab === 'buy' && (
                <div className="space-y-20 animate-in fade-in duration-300">
                  {/* Editorial Boutique Hero Header */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                    <div className="lg:col-span-8 space-y-4">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ffdea5] text-[#261900] text-[11px] font-bold uppercase tracking-[0.14em]">
                        <Sparkles className="w-3.5 h-3.5 text-[#775a19]" />
                        <span>
                          {isPromoActive && discountRate > 0
                            ? lang === 'ko'
                              ? '홀리데이 특별 혜택 · 20% 할인'
                              : 'Seasonal Privilege · 20% Advantage'
                            : lang === 'ko'
                              ? '프리미엄 보태니컬 헤드스파 기프트'
                              : 'Korean Scalp Sanctuary Boutique'}
                        </span>
                      </div>

                      <h1 className="font-serif-luxury text-4xl sm:text-5xl lg:text-[54px] font-normal tracking-tight text-[#061910] leading-[1.08]">
                        {lang === 'ko'
                          ? '두피 깊은 곳까지, 온전한 쉼을 선물하세요'
                          : 'Curate an Immersive Botanical Head Spa Experience'}
                      </h1>

                      <p className="text-sm sm:text-base text-[#424844] max-w-2xl leading-relaxed">
                        {lang === 'ko'
                          ? '정밀 두피 진단부터 세라믹 워터폴 바신 테라피까지. 맨해튼·노우드·포트리 3개 지점에서 2년간 자유롭게 사용할 수 있는 바코드 디지털 바우처를 즉시 또는 예약 발송하세요.'
                          : 'Gift restorative Korean scalp diagnosis, herbal steam infusion, and waterfall ceramic basin therapy across Manhattan, Norwood, and Fort Lee. Delivered via Email and SMS with a scannable 2-year pass.'}
                      </p>
                    </div>

                    <div className="lg:col-span-4">
                      <div className="p-5 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] shadow-sm space-y-2.5">
                        <div className="flex items-center gap-2 text-[#061910]">
                          <Verified className="w-4 h-4 text-[#775a19]" />
                          <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                            {lang === 'ko' ? '디지털 기프트 보증' : 'Sanctuary Guarantees'}
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-[#424844]">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#775a19] shrink-0" />
                            <span>
                              {lang === 'ko'
                                ? '1D 바코드 · QR 코드 즉시 발급'
                                : 'Instant Email & SMS Barcode + QR Pass'}
                            </span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#775a19] shrink-0" />
                            <span>
                              {lang === 'ko'
                                ? '구매일로부터 2년 유효기간 (전 지점 사용)'
                                : '24-month validity across all 3 studios'}
                            </span>
                          </li>
                          <li className="flex items-center gap-2 text-[#775a19] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#775a19] shrink-0" />
                            <span>
                              {isPromoActive && discountRate > 0
                                ? lang === 'ko'
                                  ? `${discountRate}% 프로모션 할인 자동 적용`
                                  : `${discountRate}% seasonal privilege applied automatically`
                                : lang === 'ko'
                                  ? '잔액 분할 사용 및 수수료 무료'
                                  : 'Multi-visit partial redemption supported'}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </section>

                  {/* 12-Column Interactive Customizer Split */}
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
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
                  </section>

                  {/* Below-the-Fold 1: Signature Scalp Rituals */}
                  <section id="rituals" className="pt-12 border-t border-[#ece0d8] space-y-8 scroll-mt-32">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div className="space-y-1.5 max-w-xl">
                        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#775a19]">
                          {lang === 'ko' ? '시그니처 시술 안내' : 'Treatment Repertoire'}
                        </span>
                        <h2 className="font-serif-luxury text-3xl sm:text-4xl font-normal text-[#061910]">
                          {lang === 'ko'
                            ? '기프트 카드로 경험하는 K-headspa 리추얼'
                            : 'Signature Rituals Redeemable With Every Card'}
                        </h2>
                      </div>
                      <a
                        href={BOOKING_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#775a19] hover:text-[#061910] transition"
                      >
                        <span>{lang === 'ko' ? '전체 시술 메뉴 예약 보기' : 'Explore Booking Menu'}</span>
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="rounded-3xl bg-[#fef1e9] border border-[#ece0d8] p-6 flex flex-col justify-between gap-5 shadow-sm">
                        <div className="space-y-4">
                          <div className="h-32 rounded-2xl bg-gradient-to-br from-[#1b2e24] to-[#061910] p-4 flex flex-col justify-between text-[#fff8f5]">
                            <div className="flex justify-between items-center">
                              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold uppercase tracking-wider">
                                45 Min · Detox
                              </span>
                              <Microscope className="w-5 h-5 text-[#ffdea5]" />
                            </div>
                            <span className="font-serif-luxury text-xl text-[#ffdea5]">
                              {lang === 'ko' ? '스캘프 디톡스 익스프레스' : 'Scalp Detox Express'}
                            </span>
                          </div>
                          <p className="text-xs text-[#424844] leading-relaxed">
                            {lang === 'ko'
                              ? '초고배율 마이크로 카메라 정밀 두피 진단, 모공 각질 스케일링 및 보태니컬 미스트로 상쾌한 두피 밸런스를 회복합니다.'
                              : 'Includes microscopic scalp analysis, gentle exfoliation cleansing, and soothing botanical steam mist.'}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-[#c2c8c2]/40 flex items-center justify-between text-xs">
                          <span className="font-serif-luxury text-xl font-semibold text-[#061910]">$100+</span>
                          <span className="text-[#775a19] font-semibold">
                            {lang === 'ko' ? '$100 카드 추천' : 'Ideal with $100 Pass'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-[#fef1e9] border border-[#ece0d8] p-6 flex flex-col justify-between gap-5 shadow-sm">
                        <div className="space-y-4">
                          <div className="h-32 rounded-2xl bg-gradient-to-br from-[#2b3b5e] to-[#111827] p-4 flex flex-col justify-between text-[#fff8f5]">
                            <div className="flex justify-between items-center">
                              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold uppercase tracking-wider">
                                75 Min · Signature
                              </span>
                              <Droplets className="w-5 h-5 text-[#ffdea5]" />
                            </div>
                            <span className="font-serif-luxury text-xl text-[#ffdea5]">
                              {lang === 'ko' ? '15단계 시그니처 워터폴 스파' : '15-Step Waterfall Sanctuary'}
                            </span>
                          </div>
                          <p className="text-xs text-[#424844] leading-relaxed">
                            {lang === 'ko'
                              ? '세라믹 바신 골든 워터폴, 허브 찜질, 림프 경락 데콜테·두피 마사지가 어우러진 대표 힐링 코스입니다.'
                              : 'Our signature ceramic basin waterfall halo therapy paired with herbal steam and lymphatic neck-shoulder release.'}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-[#c2c8c2]/40 flex items-center justify-between text-xs">
                          <span className="font-serif-luxury text-xl font-semibold text-[#061910]">$200</span>
                          <span className="text-[#775a19] font-semibold">
                            {lang === 'ko' ? '$200 베스트 추천' : 'Most Gifted $200 Pass'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-3xl bg-[#fef1e9] border border-[#ece0d8] p-6 flex flex-col justify-between gap-5 shadow-sm">
                        <div className="space-y-4">
                          <div className="h-32 rounded-2xl bg-gradient-to-br from-[#423222] to-[#2e2216] p-4 flex flex-col justify-between text-[#fff8f5]">
                            <div className="flex justify-between items-center">
                              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[10px] font-semibold uppercase tracking-wider">
                                90 Min · Bespoke
                              </span>
                              <HeartHandshake className="w-5 h-5 text-[#ffdea5]" />
                            </div>
                            <span className="font-serif-luxury text-xl text-[#ffdea5]">
                              {lang === 'ko' ? 'VIP · 커플 프리미엄 리트리트' : 'VIP & Couples Botanical Retreat'}
                            </span>
                          </div>
                          <p className="text-xs text-[#424844] leading-relaxed">
                            {lang === 'ko'
                              ? '소중한 분과 함께 프라이빗 스위트에서 두피·스킨·아로마 케어를 풀코스로 누리며 분할 사용도 가능합니다.'
                              : 'Designed for multi-session self-care journeys or shared VIP sanctuary rituals with full balance flexibility.'}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-[#c2c8c2]/40 flex items-center justify-between text-xs">
                          <span className="font-serif-luxury text-xl font-semibold text-[#061910]">$500</span>
                          <span className="text-[#775a19] font-semibold">
                            {lang === 'ko' ? '$500 VIP 패스' : 'Ideal with $500 Pass'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Below-the-Fold 2: 3 Real Studio Locations */}
                  <section id="locations" className="pt-12 border-t border-[#ece0d8] space-y-8 scroll-mt-32">
                    <div className="space-y-1.5 max-w-xl">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#775a19]">
                        {lang === 'ko' ? '전 지점 통합 사용' : 'Studio Locations'}
                      </span>
                      <h2 className="font-serif-luxury text-3xl sm:text-4xl font-normal text-[#061910]">
                        {lang === 'ko'
                          ? '뉴욕·뉴저지 3개 지점 안내'
                          : 'Three Studios, One Seamless Gift Pass'}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {STUDIO_LOCATIONS.map((loc) => (
                        <div
                          key={loc.address}
                          className="p-6 rounded-3xl bg-[#f8ece4] border border-[#ece0d8] flex flex-col justify-between gap-5 shadow-sm"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#775a19] block">
                                  {lang === 'ko' ? loc.regionKo : loc.regionEn}
                                </span>
                                <h3 className="font-serif-luxury text-2xl font-medium text-[#061910] mt-0.5">
                                  {lang === 'ko' ? loc.nameKo : loc.nameEn}
                                </h3>
                              </div>
                              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#1b2e24] shadow-sm">
                                <MapPin className="w-4 h-4" />
                              </span>
                            </div>
                            <div className="text-xs text-[#424844] space-y-1">
                              <p className="font-semibold text-[#061910]">{loc.address}</p>
                              <p>{lang === 'ko' ? loc.noteKo : loc.noteEn}</p>
                            </div>
                          </div>

                          <a
                            href={BOOKING_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pt-3 border-t border-[#c2c8c2]/50 inline-flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#061910] hover:text-[#775a19] transition"
                          >
                            <span>{lang === 'ko' ? '시술 예약하기' : 'Book a Service'}</span>
                            <ArrowUpRight className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Below-the-Fold 3: Concise Gifting FAQ */}
                  <section className="max-w-4xl mx-auto pt-8 space-y-5">
                    <div className="text-center space-y-1">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#775a19] inline-flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" />
                        {lang === 'ko' ? '기프트 카드 이용 안내' : 'Gifting Protocols'}
                      </span>
                      <h2 className="font-serif-luxury text-2xl sm:text-3xl font-normal text-[#061910]">
                        {lang === 'ko' ? '자주 묻는 질문' : 'Frequently Asked Questions'}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-5 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-1.5">
                        <h3 className="font-bold text-[#061910]">
                          {lang === 'ko' ? '어떻게 전달되고 사용하나요?' : 'How is the pass delivered?'}
                        </h3>
                        <p className="text-[#424844] leading-relaxed">
                          {lang === 'ko'
                            ? '결제 즉시(또는 지정 날짜 오전 8시 EST) 이메일과 SMS로 16자리 코드, 1D 바코드 및 QR 바우처 링크가 발송됩니다.'
                            : 'Sent via Email and SMS with a 16-character redemption code, 1D barcode, and QR link immediately or on your scheduled date.'}
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-1.5">
                        <h3 className="font-bold text-[#061910]">
                          {lang === 'ko' ? '다른 시술에도 사용할 수 있나요?' : 'Flexible across services?'}
                        </h3>
                        <p className="text-[#424844] leading-relaxed">
                          {lang === 'ko'
                            ? '네. 충전된 액면가 금액 그대로 원하시는 모든 두피 케어·헤드스파 시술에 자유롭게 차감 및 분할 사용하실 수 있습니다.'
                            : 'Yes. The full stored face value can be applied toward any treatment or split across multiple studio visits.'}
                        </p>
                      </div>

                      <div className="p-5 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-1.5">
                        <h3 className="font-bold text-[#061910]">
                          {lang === 'ko' ? '유효기간은 어떻게 되나요?' : 'What is the validity period?'}
                        </h3>
                        <p className="text-[#424844] leading-relaxed">
                          {lang === 'ko'
                            ? '모든 기프트 카드는 구매일로부터 2년(24개월) 동안 유효하며 별도의 유지 수수료가 없습니다.'
                            : 'Every digital card remains valid for 2 full years from purchase across Manhattan, Norwood, and Fort Lee.'}
                        </p>
                      </div>
                    </div>
                  </section>
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
        </div>
      </main>

      {/* 3. 푸터 */}
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
