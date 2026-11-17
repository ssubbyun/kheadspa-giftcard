'use client';

import React, { useState, useSyncExternalStore } from 'react';
import {
  CreditCard,
  Gift,
  User,
  Sparkles,
  Check,
  Copy,
  Loader2,
  AlertCircle,
  Lock,
  CalendarClock,
  ExternalLink,
  Smartphone,
  Palette,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import confetti from 'canvas-confetti';
import { GiftCard, GiftCardDesignId } from '@/types/gift-card';
import { CARD_DESIGNS, getCardDesign } from '@/lib/card-designs';
import { getErrorMessage } from '@/lib/barcode';

const emptySubscribe = () => () => {};

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const isValidPublishableKey =
  (publishableKey.startsWith('pk_test_') || publishableKey.startsWith('pk_live_')) &&
  !publishableKey.includes('placeholder') &&
  !publishableKey.includes('sample');

const stripePromise = isValidPublishableKey ? loadStripe(publishableKey) : null;
const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

const AMOUNT_PRESETS: Array<{ value: number; tagEn: string; tagKo: string; popular?: boolean }> = [
  { value: 100, tagEn: 'Scalp Detox Express', tagKo: '스캘프 디톡스 케어' },
  { value: 150, tagEn: 'Herbal Steam Ritual', tagKo: '허벌 스팀 리추얼' },
  { value: 200, tagEn: 'Signature Sanctuary', tagKo: '시그니처 헤드스파', popular: true },
  { value: 500, tagEn: 'VIP & Dual Retreat', tagKo: 'VIP · 커플 패키지' },
];

const MESSAGE_INSPIRATIONS: Array<{ labelEn: string; labelKo: string; textEn: string; textKo: string }> = [
  {
    labelEn: 'Deep Rest',
    labelKo: '깊은 휴식',
    textEn: 'Wishing you moments of quiet restoration and pure relaxation at K-headspa.',
    textKo: '바쁜 일상 속에서 잠시 멈추어, 따뜻하고 깊은 힐링의 시간을 보내시길 바랍니다.',
  },
  {
    labelEn: 'Birthday',
    labelKo: '생일 축하',
    textEn: 'Happy Birthday! Treat yourself to a rejuvenating Korean head spa ritual.',
    textKo: '생일을 진심으로 축하합니다! 특별한 하루, 편안한 두피 스파로 선물을 누려보세요.',
  },
  {
    labelEn: 'Thank You',
    labelKo: '감사 인사',
    textEn: 'With heartfelt gratitude—enjoy a serene sanctuary session on me.',
    textKo: '늘 감사한 마음을 담아, 지친 몸과 마음을 다독이는 스파 시간을 선물합니다.',
  },
];

interface GiftCardFormProps {
  amount: number;
  setAmount: (amt: number) => void;
  discountRate: number;
  recipientName: string;
  setRecipientName: (name: string) => void;
  designId: GiftCardDesignId;
  setDesignId: (id: GiftCardDesignId) => void;
  lang: 'ko' | 'en';
  onOpenVoucher?: (code: string) => void;
}

function getTomorrowEstDate(): string {
  const now = new Date();
  const estNowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);
  const [y, m, d] = estNowStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

// Stripe Elements 내부 결제 승인 및 발급 서브 컴포넌트
function StripeCheckoutStep({
  paymentIntentId,
  finalChargeAmount,
  currentFaceValue,
  designId,
  buyerName,
  buyerEmail,
  buyerPhone,
  recipientType,
  recipientName,
  recipientEmail,
  recipientPhone,
  message,
  scheduledDeliveryDate,
  lang,
  onSuccess,
  onCancel,
}: {
  paymentIntentId: string;
  finalChargeAmount: number;
  currentFaceValue: number;
  designId: GiftCardDesignId;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  recipientType: 'self' | 'gift';
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  message: string;
  scheduledDeliveryDate: string;
  lang: 'ko' | 'en';
  onSuccess: (card: GiftCard) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsConfirming(true);
    setErrorMsg(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message || (lang === 'ko' ? '카드 결제 승인에 실패했습니다.' : 'Payment authorization failed.'));
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error(
          lang === 'ko'
            ? `결제가 완료되지 않았습니다. (상태: ${paymentIntent?.status || 'unknown'})`
            : `Payment not completed. (Status: ${paymentIntent?.status || 'unknown'})`
        );
      }

      const issueRes = await fetch('/api/gift-cards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceValue: currentFaceValue,
          designId,
          buyerName,
          buyerEmail,
          buyerPhone,
          recipientType,
          recipientName: recipientType === 'gift' ? recipientName : buyerName,
          recipientEmail: recipientType === 'gift' ? recipientEmail : buyerEmail,
          recipientPhone: recipientType === 'gift' ? recipientPhone : buyerPhone,
          message,
          scheduledDeliveryDate: scheduledDeliveryDate || undefined,
          stripePaymentIntentId: paymentIntent.id || paymentIntentId,
        }),
      });

      const issueData = await issueRes.json();
      if (!issueRes.ok) {
        throw new Error(issueData.error || 'Gift card issuance verification failed.');
      }

      onSuccess(issueData.giftCard);
    } catch (err: unknown) {
      setErrorMsg(
        getErrorMessage(
          err,
          lang === 'ko' ? '결제 처리 중 오류가 발생했습니다.' : 'An error occurred during payment.'
        )
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <form onSubmit={handleConfirmPayment} className="space-y-4 pt-4 border-t border-[#ece0d8]">
      <div className="p-4 rounded-2xl border border-[#ece0d8] bg-[#fff8f5]">
        <PaymentElement />
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="px-4 py-3.5 rounded-xl border border-[#c2c8c2] text-[#424844] text-xs font-semibold hover:bg-[#fef1e9] transition cursor-pointer"
        >
          {lang === 'ko' ? '이전 단계' : 'Back'}
        </button>

        <button
          type="submit"
          disabled={!stripe || isConfirming}
          className="flex-1 py-3.5 rounded-xl bg-[#1b2e24] hover:bg-[#061910] text-white font-semibold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === 'ko' ? 'Stripe 결제 승인 확인 중...' : 'Confirming Payment...'}</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 text-[#ffdea5]" />
              <span>
                ${finalChargeAmount.toFixed(2)}{' '}
                {lang === 'ko' ? '결제 승인 및 카드 발급' : 'Confirm & Issue Card'}
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function GiftCardForm({
  amount,
  setAmount,
  discountRate,
  recipientName,
  setRecipientName,
  designId,
  setDesignId,
  lang,
  onOpenVoucher,
}: GiftCardFormProps) {
  const [recipientType, setRecipientType] = useState<'self' | 'gift'>('gift');
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [message, setMessage] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // 예약 발송 옵션
  const [deliveryMode, setDeliveryMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledDate, setScheduledDate] = useState('');
  const tomorrowEst = useSyncExternalStore(emptySubscribe, getTomorrowEstDate, () => '');

  // PaymentIntent 단계 상태
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [authorizedCharge, setAuthorizedCharge] = useState<number | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 발급 완료 모달 상태
  const [issuedCard, setIssuedCard] = useState<GiftCard | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentFaceValue = isCustom ? Number(customAmount) || 0 : amount;
  const discountAmount = Math.round(currentFaceValue * (discountRate / 100) * 100) / 100;
  const finalChargeAmount = Math.round((currentFaceValue - discountAmount) * 100) / 100;
  const currentDesign = getCardDesign(designId);

  const handleSelectPreset = (val: number) => {
    setIsCustom(false);
    setAmount(val);
    setClientSecret(null);
    setAuthorizedCharge(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setIsCustom(true);
    const numeric = Number(val);
    if (numeric >= 20 && numeric <= 2000) {
      setAmount(numeric);
    }
    setClientSecret(null);
    setAuthorizedCharge(null);
  };

  // 1단계: 서버에 실제 Stripe PaymentIntent 생성 요청
  const handlePrepareCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (currentFaceValue < 20 || currentFaceValue > 2000) {
      setFormError(
        lang === 'ko'
          ? '금액은 $20 ~ $2,000 사이로 입력해 주세요.'
          : 'Please choose an amount between $20 and $2,000.'
      );
      return;
    }

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setFormError(
        lang === 'ko'
          ? '구매자 성함과 이메일을 입력해 주세요.'
          : 'Please enter your name and email address.'
      );
      return;
    }

    if (recipientType === 'gift' && (!recipientName.trim() || !recipientEmail.trim())) {
      setFormError(
        lang === 'ko'
          ? '받는 분 성함과 이메일을 입력해 주세요.'
          : 'Please enter the recipient name and email address.'
      );
      return;
    }

    if (deliveryMode === 'scheduled' && !scheduledDate) {
      setFormError(
        lang === 'ko'
          ? '예약 발송 날짜를 선택해 주세요.'
          : 'Please select a scheduled delivery date.'
      );
      return;
    }

    if (!stripePromise) {
      setFormError(
        lang === 'ko'
          ? '유효한 Stripe 공개키(NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_test_ 또는 pk_live_)가 설정되지 않았습니다.'
          : 'Stripe Publishable Key (pk_test_ or pk_live_) is not configured yet.'
      );
      return;
    }

    setIsCreatingIntent(true);

    try {
      const intentRes = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceValue: currentFaceValue,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          recipientType,
          recipientName: recipientType === 'gift' ? recipientName.trim() : buyerName.trim(),
          recipientEmail: recipientType === 'gift' ? recipientEmail.trim() : buyerEmail.trim(),
        }),
      });

      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        throw new Error(intentData.error || 'Failed to initialize Stripe payment.');
      }

      setClientSecret(intentData.clientSecret);
      setPaymentIntentId(intentData.paymentIntentId);
      setAuthorizedCharge(
        typeof intentData.chargeAmount === 'number' ? intentData.chargeAmount : finalChargeAmount
      );
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(
          err,
          lang === 'ko' ? '결제 초기화 중 오류가 발생했습니다.' : 'Error initializing payment.'
        )
      );
    } finally {
      setIsCreatingIntent(false);
    }
  };

  const copyCode = () => {
    if (!issuedCard) return;
    navigator.clipboard.writeText(issuedCard.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyVoucherLink = () => {
    if (!issuedCard || typeof window === 'undefined') return;
    const url = `${window.location.origin}/?card=${encodeURIComponent(issuedCard.code)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const issuedDesign = getCardDesign(issuedCard?.designId);

  return (
    <div
      id="buy-section"
      className="bg-white rounded-3xl p-6 sm:p-8 lg:p-9 border border-[#ece0d8] luxury-card-shadow space-y-8 scroll-mt-32"
    >
      <div className="space-y-8">
        {/* STEP 1: 금액 선택 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#061910] text-white flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              <h2 className="font-serif-luxury text-xl sm:text-2xl font-medium text-[#061910]">
                {lang === 'ko' ? '기프트 카드 금액 선택' : 'Select Stored Value'}
              </h2>
            </div>
            {discountRate > 0 && (
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#775a19]">
                {discountRate}% {lang === 'ko' ? '할인 자동 적용' : 'Holiday Savings Applied'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AMOUNT_PRESETS.map((preset) => {
              const val = preset.value;
              const discounted = Math.round(val * (1 - discountRate / 100) * 100) / 100;
              const savings = Math.round((val - discounted) * 100) / 100;
              const isSelected = !isCustom && amount === val;

              return (
                <button
                  key={val}
                  type="button"
                  disabled={Boolean(clientSecret)}
                  onClick={() => handleSelectPreset(val)}
                  className={`relative text-left p-4 rounded-2xl transition-all flex flex-col justify-between gap-2.5 cursor-pointer disabled:opacity-60 ${
                    isSelected
                      ? 'bg-[#f8ece4] ring-2 ring-[#775a19] shadow-sm'
                      : 'bg-[#fef1e9]/70 hover:bg-[#f8ece4] border border-[#ece0d8]'
                  }`}
                >
                  {preset.popular && (
                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full bg-[#775a19] text-[#fff8f5] text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      {lang === 'ko' ? '인기 선택' : 'Most Gifted'}
                    </span>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-serif-luxury text-2xl font-semibold text-[#061910] block leading-tight">
                        ${val}{' '}
                        <span className="font-sans text-xs font-normal text-[#424844]">
                          {lang === 'ko' ? '액면가' : 'Value'}
                        </span>
                      </span>
                      {discountRate > 0 && (
                        <span className="text-xs font-semibold text-[#775a19] block mt-0.5">
                          {lang === 'ko' ? `실제 결제 $${discounted}` : `Pay $${discounted.toFixed(0)}`}
                        </span>
                      )}
                    </div>
                    {discountRate > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#ffdea5] text-[#261900] text-[10px] font-bold uppercase tracking-wide shrink-0">
                        {lang === 'ko' ? `-$${savings} 할인` : `Save $${savings}`}
                      </span>
                    ) : (
                      <CheckCircle2
                        className={`w-4 h-4 transition-opacity ${
                          isSelected ? 'text-[#1b2e24] opacity-100' : 'opacity-20 text-[#737874]'
                        }`}
                      />
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#c2c8c2]/40 flex items-center justify-between text-[11px] text-[#424844]">
                    <span>{lang === 'ko' ? preset.tagKo : preset.tagEn}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#775a19] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Denomination */}
          <div className="p-4 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#061910]">
                {lang === 'ko' ? '직접 금액 입력 ($20 ~ $2,000)' : 'Or Enter Custom Amount ($20 ~ $2,000)'}
              </label>
              {isCustom && currentFaceValue >= 20 && (
                <span className="text-[11px] font-semibold text-[#775a19]">
                  {discountRate > 0
                    ? `$${currentFaceValue} → $${finalChargeAmount.toFixed(2)}`
                    : `$${currentFaceValue.toFixed(2)}`}
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-serif-luxury text-lg font-semibold text-[#737874]">
                $
              </span>
              <input
                type="text"
                disabled={Boolean(clientSecret)}
                placeholder={lang === 'ko' ? '원하시는 금액 입력 (예: 250)' : 'e.g. 250'}
                value={customAmount}
                onChange={handleCustomChange}
                className={`w-full pl-8 pr-4 py-2.5 rounded-xl bg-white text-sm text-[#061910] font-medium transition focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:opacity-60 ${
                  isCustom ? 'ring-2 ring-[#775a19]' : 'border border-[#c2c8c2]/70'
                }`}
              />
            </div>
          </div>
        </div>

        {/* STEP 2: 카드 디자인 선택 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#061910] text-white flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              <h2 className="font-serif-luxury text-xl sm:text-2xl font-medium text-[#061910] flex items-center gap-2">
                <span>{lang === 'ko' ? '기프트 카드 디자인' : 'Choose Card Edition'}</span>
                <Palette className="w-4 h-4 text-[#775a19]" />
              </h2>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#775a19]">
              {lang === 'ko' ? currentDesign.labelKo : currentDesign.labelEn}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CARD_DESIGNS.map((design) => {
              const selected = design.id === designId;
              return (
                <button
                  key={design.id}
                  type="button"
                  disabled={Boolean(clientSecret)}
                  onClick={() => setDesignId(design.id)}
                  className={`group relative rounded-2xl p-2.5 text-left transition-all cursor-pointer disabled:opacity-60 ${
                    selected
                      ? 'bg-[#f8ece4] ring-2 ring-[#775a19] shadow-sm'
                      : 'bg-[#fef1e9]/75 hover:bg-[#f8ece4] border border-[#ece0d8]'
                  }`}
                >
                  <div
                    className={`relative h-12 rounded-xl bg-gradient-to-br ${design.gradientClass} p-2 flex flex-col justify-between mb-2 border ${design.borderClass} overflow-hidden`}
                  >
                    <div className="absolute inset-1 rounded-lg border border-white/15 pointer-events-none" />
                    <span className={`relative z-10 text-[8px] uppercase tracking-[0.16em] font-semibold ${design.accentTextClass}`}>
                      K-headspa
                    </span>
                    <span className="relative z-10 text-[10px] font-serif-luxury text-white truncate">
                      {design.headlineEn}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold text-[#061910] truncate">
                      {lang === 'ko' ? design.labelKo : design.labelEn}
                    </span>
                    {selected && <Check className="w-3 h-3 text-[#775a19] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 3: 수신자 및 연락처 설정 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[#061910] text-white flex items-center justify-center text-[11px] font-bold">
              3
            </span>
            <h2 className="font-serif-luxury text-xl sm:text-2xl font-medium text-[#061910]">
              {lang === 'ko' ? '받는 분 정보 및 선물 메시지' : 'Recipient & Personal Note'}
            </h2>
          </div>

          <div className="inline-flex p-1 rounded-full bg-[#fef1e9] border border-[#ece0d8] text-xs font-semibold">
            <button
              type="button"
              disabled={Boolean(clientSecret)}
              onClick={() => {
                setRecipientType('gift');
                setRecipientName('');
              }}
              className={`flex items-center gap-2 py-2 px-5 rounded-full transition cursor-pointer disabled:opacity-60 ${
                recipientType === 'gift'
                  ? 'bg-[#061910] text-white shadow-sm'
                  : 'text-[#424844] hover:text-[#061910]'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '선물하기 (타인)' : 'Someone else'}</span>
            </button>

            <button
              type="button"
              disabled={Boolean(clientSecret)}
              onClick={() => {
                setRecipientType('self');
                setRecipientName(buyerName);
              }}
              className={`flex items-center gap-2 py-2 px-5 rounded-full transition cursor-pointer disabled:opacity-60 ${
                recipientType === 'self'
                  ? 'bg-[#061910] text-white shadow-sm'
                  : 'text-[#424844] hover:text-[#061910]'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '나에게 보내기 (본인)' : 'For Myself'}</span>
            </button>
          </div>

          {recipientType === 'gift' ? (
            <div className="space-y-3 text-xs">
              <div className="p-4 sm:p-5 bg-[#fef1e9] rounded-2xl border border-[#ece0d8] space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#775a19] block">
                  {lang === 'ko' ? '받는 분 정보 (이메일 & 문자 동시 발송)' : 'Recipient Details (Email & SMS Delivery)'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#424844] font-medium mb-1">
                      {lang === 'ko' ? '받는 분 성함 *' : 'Recipient Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(clientSecret)}
                      placeholder={lang === 'ko' ? '받으실 분 성함' : 'e.g. Jane Doe'}
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-white text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:bg-[#f2e6de]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#424844] font-medium mb-1">
                      {lang === 'ko' ? '받는 분 이메일 *' : 'Recipient Email *'}
                    </label>
                    <input
                      type="email"
                      required
                      disabled={Boolean(clientSecret)}
                      placeholder="recipient@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-white text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:bg-[#f2e6de]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#424844] font-medium mb-1 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#775a19]" />
                    <span>
                      {lang === 'ko'
                        ? '받는 분 휴대폰 번호 (SMS 바코드 링크 발송용, 선택)'
                        : 'Recipient Mobile Phone (For SMS barcode delivery, optional)'}
                    </span>
                  </label>
                  <input
                    type="tel"
                    disabled={Boolean(clientSecret)}
                    placeholder="+1 (201) 555-0123"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-white text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:bg-[#f2e6de]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#424844] font-medium mb-1">
                    {lang === 'ko' ? '보내는 분 성함 *' : 'Sender Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(clientSecret)}
                    placeholder={lang === 'ko' ? '보내시는 분 성함' : 'Your full name'}
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-[#fef1e9]/60 text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] focus:bg-white disabled:bg-[#f2e6de]"
                  />
                </div>
                <div>
                  <label className="block text-[#424844] font-medium mb-1">
                    {lang === 'ko' ? '구매자 이메일 (결제 영수증 수령) *' : 'Your Email (Receipt) *'}
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(clientSecret)}
                    placeholder="you@example.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-[#fef1e9]/60 text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] focus:bg-white disabled:bg-[#f2e6de]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-[#fef1e9] rounded-2xl border border-[#ece0d8] space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#424844] font-medium mb-1">
                    {lang === 'ko' ? '성함 *' : 'Your Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(clientSecret)}
                    placeholder={lang === 'ko' ? '성함 입력' : 'Full name'}
                    value={buyerName}
                    onChange={(e) => {
                      setBuyerName(e.target.value);
                      setRecipientName(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-white text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:bg-[#f2e6de]"
                  />
                </div>
                <div>
                  <label className="block text-[#424844] font-medium mb-1">
                    {lang === 'ko' ? '이메일 (바우처 및 영수증 수신) *' : 'Email (Voucher & Receipt) *'}
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(clientSecret)}
                    placeholder="you@example.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-white text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:bg-[#f2e6de]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#424844] font-medium mb-1 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-[#775a19]" />
                  <span>
                    {lang === 'ko'
                      ? '휴대폰 번호 (SMS 바코드 링크 수령용, 선택)'
                      : 'Mobile Phone (Optional, for SMS voucher)'}
                  </span>
                </label>
                <input
                  type="tel"
                  disabled={Boolean(clientSecret)}
                  placeholder="+1 (201) 555-0123"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-white text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] disabled:bg-[#f2e6de]"
                />
              </div>
            </div>
          )}

          {/* 선물 메시지 + 영감 칩 */}
          <div className="space-y-2 text-xs">
            <label className="block text-[#424844] font-medium">
              {lang === 'ko' ? '개인 메시지 (선택)' : 'Personal Message (Optional)'}
            </label>
            <textarea
              rows={2}
              disabled={Boolean(clientSecret)}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                lang === 'ko'
                  ? '따뜻한 헤드스파 힐링을 선물합니다.'
                  : 'Thank you! Enjoy a relaxing head spa session.'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2]/80 bg-[#fef1e9]/60 text-[#201b16] focus:outline-none focus:ring-2 focus:ring-[#c5a059] focus:bg-white disabled:bg-[#f2e6de]"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737874] mr-1">
                {lang === 'ko' ? '추천 문구:' : 'Quick notes:'}
              </span>
              {MESSAGE_INSPIRATIONS.map((item) => (
                <button
                  key={item.labelEn}
                  type="button"
                  disabled={Boolean(clientSecret)}
                  onClick={() => setMessage(lang === 'ko' ? item.textKo : item.textEn)}
                  className="px-2.5 py-1 rounded-full bg-[#f8ece4] hover:bg-[#ffdea5] text-[11px] font-medium text-[#424844] hover:text-[#061910] transition cursor-pointer disabled:opacity-50"
                >
                  {lang === 'ko' ? item.labelKo : item.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 4: 발송 시점 선택 */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[#061910] text-white flex items-center justify-center text-[11px] font-bold">
              4
            </span>
            <h2 className="font-serif-luxury text-xl sm:text-2xl font-medium text-[#061910] flex items-center gap-2">
              <span>{lang === 'ko' ? '발송 시점 선택' : 'Dispatch Schedule'}</span>
              <CalendarClock className="w-4 h-4 text-[#775a19]" />
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <button
              type="button"
              disabled={Boolean(clientSecret)}
              onClick={() => {
                setDeliveryMode('immediate');
                setScheduledDate('');
              }}
              className={`p-4 rounded-2xl text-left transition cursor-pointer disabled:opacity-60 ${
                deliveryMode === 'immediate'
                  ? 'bg-[#f8ece4] ring-2 ring-[#775a19] shadow-sm'
                  : 'bg-[#fef1e9]/75 hover:bg-[#f8ece4] border border-[#ece0d8]'
              }`}
            >
              <span className="font-bold text-[#061910] block">
                {lang === 'ko' ? '결제 즉시 발송' : 'Send Immediately'}
              </span>
              <span className="text-[11px] text-[#424844] block mt-0.5">
                {lang === 'ko' ? '결제 확인 직후 이메일과 문자로 전달' : 'Dispatched right after Stripe confirmation'}
              </span>
            </button>

            <button
              type="button"
              disabled={Boolean(clientSecret)}
              onClick={() => {
                setDeliveryMode('scheduled');
                if (!scheduledDate) setScheduledDate(tomorrowEst);
              }}
              className={`p-4 rounded-2xl text-left transition cursor-pointer disabled:opacity-60 ${
                deliveryMode === 'scheduled'
                  ? 'bg-[#f8ece4] ring-2 ring-[#775a19] shadow-sm'
                  : 'bg-[#fef1e9]/75 hover:bg-[#f8ece4] border border-[#ece0d8]'
              }`}
            >
              <span className="font-bold text-[#061910] block">
                {lang === 'ko' ? '발송 날짜 예약' : 'Schedule for Later'}
              </span>
              <span className="text-[11px] text-[#424844] block mt-0.5">
                {lang === 'ko' ? '기념일 오전 8:00 EST 자동 발송' : 'Auto-delivered 8:00 AM EST on chosen date'}
              </span>
            </button>
          </div>

          {deliveryMode === 'scheduled' && (
            <div className="p-4 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-1.5 text-xs">
              <label className="block text-[#061910] font-semibold">
                {lang === 'ko' ? '예약 발송일' : 'Scheduled delivery date'}
              </label>
              <input
                type="date"
                min={tomorrowEst}
                disabled={Boolean(clientSecret)}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#c2c8c2] bg-white focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
              />
              <p className="text-[11px] text-[#775a19]">
                {lang === 'ko'
                  ? '예약일 오전 8:00 AM EST에 이메일과 문자로 자동 발송됩니다.'
                  : 'Delivered at 8:00 AM EST on the scheduled date.'}
              </p>
            </div>
          )}
        </div>

        {/* Atelier Order Summary Receipt Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#c2c8c2]/50">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#061910]">
              <Receipt className="w-4 h-4 text-[#775a19]" />
              {lang === 'ko' ? '주문 요약 영수증' : 'Atelier Order Summary'}
            </span>
            <span className="text-[11px] text-[#737874] font-medium">
              {lang === 'ko' ? '유효기간 2년 포함' : '2-Year Validity Included'}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-[#424844]">
              <span>{lang === 'ko' ? '기프트 카드 충전 액면가' : 'Card Stored Value'}</span>
              <span className="font-semibold text-[#061910]">${currentFaceValue.toFixed(2)}</span>
            </div>

            {discountRate > 0 && (
              <div className="flex justify-between text-[#775a19] font-semibold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {lang === 'ko'
                    ? `11월 특별 프로모션 (${discountRate}% 할인)`
                    : `Holiday Promo (${discountRate}% OFF)`}
                </span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-[#424844]">
              <span>{lang === 'ko' ? '이메일 & SMS 바코드 발급' : 'Email, SMS & Checkout Barcode'}</span>
              <span className="font-medium text-[#1b2e24]">
                {lang === 'ko' ? '무료 ($0.00)' : 'Complimentary'}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-3 border-t border-dashed border-[#c2c8c2]">
              <div>
                <span className="text-sm font-bold text-[#061910] block">
                  {lang === 'ko' ? '최종 Stripe 결제 금액' : 'Total Stripe Charge'}
                </span>
                <span className="text-[11px] text-[#737874]">
                  {lang === 'ko' ? 'Manhattan · Norwood · Fort Lee 공통' : 'Redeemable across all 3 studios'}
                </span>
              </div>
              <span className="font-serif-luxury text-3xl sm:text-4xl font-semibold text-[#061910]">
                ${finalChargeAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Stripe Elements 결제창 또는 결제 준비 버튼 */}
          {!clientSecret ? (
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handlePrepareCheckout}
                disabled={isCreatingIntent || currentFaceValue < 20}
                className="w-full py-4 rounded-xl bg-[#1b2e24] hover:bg-[#061910] text-white font-semibold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isCreatingIntent ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {lang === 'ko' ? 'Stripe 보안 결제창 불러오는 중...' : 'Initializing Stripe...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-[#ffdea5]" />
                    <span>
                      ${finalChargeAmount.toFixed(2)}{' '}
                      {lang === 'ko' ? 'Stripe 카드 결제 진행하기' : 'Proceed to Secure Checkout'}
                    </span>
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-[#737874]">
                {lang === 'ko'
                  ? '256-bit 암호화 결제 · 기프트 카드는 구매 확정 후 환불이 불가합니다.'
                  : '256-bit SSL via Stripe · Gift card sales are final and non-refundable.'}
              </p>
            </div>
          ) : (
            stripePromise &&
            paymentIntentId && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripeCheckoutStep
                  paymentIntentId={paymentIntentId}
                  finalChargeAmount={authorizedCharge ?? finalChargeAmount}
                  currentFaceValue={currentFaceValue}
                  designId={designId}
                  buyerName={buyerName.trim()}
                  buyerEmail={buyerEmail.trim()}
                  buyerPhone={buyerPhone.trim()}
                  recipientType={recipientType}
                  recipientName={recipientType === 'gift' ? recipientName.trim() : buyerName.trim()}
                  recipientEmail={recipientType === 'gift' ? recipientEmail.trim() : buyerEmail.trim()}
                  recipientPhone={recipientType === 'gift' ? recipientPhone.trim() : buyerPhone.trim()}
                  message={message.trim()}
                  scheduledDeliveryDate={deliveryMode === 'scheduled' ? scheduledDate : ''}
                  lang={lang}
                  onCancel={() => {
                    setClientSecret(null);
                    setPaymentIntentId(null);
                    setAuthorizedCharge(null);
                  }}
                  onSuccess={(card) => {
                    setIssuedCard(card);
                    setClientSecret(null);
                    setPaymentIntentId(null);
                    setAuthorizedCharge(null);
                    confetti({
                      particleCount: 100,
                      spread: 70,
                      origin: { y: 0.6 },
                    });
                  }}
                />
              </Elements>
            )
          )}
        </div>
      </div>

      {/* 발급 완료 모달 */}
      {issuedCard && (
        <div className="fixed inset-0 bg-[#061910]/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#fff8f5] rounded-3xl max-w-lg w-full p-6 sm:p-8 text-center space-y-5 shadow-2xl border border-[#ece0d8] my-auto">
            <div className="w-14 h-14 rounded-full bg-[#d1e8d9] text-[#061910] mx-auto flex items-center justify-center">
              <Check className="w-7 h-7 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#775a19]">
                {lang === 'ko' ? issuedDesign.badgeKo : issuedDesign.badgeEn} · Payment Confirmed
              </span>
              <h3 className="font-serif-luxury text-2xl sm:text-3xl font-medium text-[#061910] mt-1">
                {lang === 'ko' ? '기프트 카드가 발급되었습니다!' : 'Your Gift Card is Ready!'}
              </h3>
              <p className="text-xs text-[#424844] mt-1">
                {issuedCard.deliveryStatus === 'PENDING_SCHEDULED'
                  ? lang === 'ko'
                    ? `${issuedCard.scheduledDeliveryDate} 오전 8:00(EST)에 예약 발송됩니다.`
                    : `Scheduled for delivery on ${issuedCard.scheduledDeliveryDate} at 8:00 AM EST.`
                  : issuedCard.deliveryStatus === 'SENT'
                    ? lang === 'ko'
                      ? '이메일과 문자(SMS)로 바코드 바우처가 발송되었습니다.'
                      : 'Delivered via Email and SMS.'
                    : issuedCard.deliveryStatus === 'PARTIAL'
                      ? lang === 'ko'
                        ? '이메일 또는 SMS 일부 채널로 발송되었습니다.'
                        : 'Delivered to available contact channel.'
                      : lang === 'ko'
                        ? '자동 발송 API 키 연결 전 상태입니다. 아래 바우처 링크를 복사해 바로 전달하세요.'
                        : 'Auto-delivery keys not connected yet. Share the voucher link below.'}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#ece0d8] text-left space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-[#737874] uppercase font-bold block mb-1">
                    Redemption Code
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base sm:text-lg font-bold text-[#061910] tracking-wider">
                      {issuedCard.code}
                    </span>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="p-1.5 rounded-lg border border-[#c2c8c2] hover:bg-[#fef1e9] text-[#424844] transition cursor-pointer"
                      title="Copy code"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {issuedCard.qrCodeDataUrl && (
                  <div className="bg-white p-2 rounded-xl border border-[#ece0d8] shadow-sm shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={issuedCard.qrCodeDataUrl} alt="Gift card QR" className="w-20 h-20" />
                  </div>
                )}
              </div>

              {issuedCard.barcodeDataUrl && (
                <div className="bg-white p-3 rounded-xl border border-[#ece0d8] text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={issuedCard.barcodeDataUrl}
                    alt={`Barcode ${issuedCard.code}`}
                    className="mx-auto max-w-full h-auto"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs border-t border-[#ece0d8] pt-3">
                <div>
                  <span className="text-[#737874] block">
                    {lang === 'ko' ? '충전 액면가:' : 'Card Value:'}
                  </span>
                  <strong className="text-[#061910] text-sm">${issuedCard.initialBalance.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[#737874] block">
                    {lang === 'ko' ? '실제 결제액:' : 'Amount Paid:'}
                  </span>
                  <strong className="text-[#775a19] text-sm">${issuedCard.paidAmount.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[#737874] block">{lang === 'ko' ? '받는 분:' : 'Recipient:'}</span>
                  <strong className="text-[#061910]">{issuedCard.recipientName}</strong>
                </div>
                <div>
                  <span className="text-[#737874] block">{lang === 'ko' ? '유효기간:' : 'Valid Thru:'}</span>
                  <strong className="text-[#1b2e24] font-mono text-[11px]">
                    {new Date(issuedCard.expiresAt).toLocaleDateString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const code = issuedCard.code;
                    setIssuedCard(null);
                    onOpenVoucher?.(code);
                  }}
                  className="py-3 px-4 rounded-xl border border-[#061910] text-[#061910] font-semibold text-xs hover:bg-[#fef1e9] transition cursor-pointer"
                >
                  {lang === 'ko' ? '모바일 바우처 열기' : 'Open Mobile Voucher'}
                </button>
                <button
                  type="button"
                  onClick={copyVoucherLink}
                  className="py-3 px-4 rounded-xl border border-[#c2c8c2] text-[#424844] font-semibold text-xs hover:bg-[#fef1e9] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? (lang === 'ko' ? '링크 복사됨' : 'Link Copied') : (lang === 'ko' ? '바우처 링크 복사' : 'Copy Voucher Link')}</span>
                </button>
              </div>

              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-[#1b2e24] hover:bg-[#061910] text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>Book a service</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => setIssuedCard(null)}
                className="w-full py-2.5 text-[#737874] hover:text-[#061910] text-xs font-medium cursor-pointer"
              >
                {lang === 'ko' ? '닫기' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
