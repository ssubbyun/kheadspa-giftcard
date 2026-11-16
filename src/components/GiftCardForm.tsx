'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import confetti from 'canvas-confetti';
import { GiftCard } from '@/types/gift-card';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const isValidPublishableKey =
  publishableKey.startsWith('pk_test_') &&
  !publishableKey.includes('placeholder') &&
  !publishableKey.includes('sample');

const stripePromise = isValidPublishableKey ? loadStripe(publishableKey) : null;

interface GiftCardFormProps {
  amount: number;
  setAmount: (amt: number) => void;
  discountRate: number;
  recipientName: string;
  setRecipientName: (name: string) => void;
  lang: 'ko' | 'en';
}

// Stripe Elements 내부 결제 승인 및 발급 서브 컴포넌트
function StripeCheckoutStep({
  paymentIntentId,
  finalChargeAmount,
  currentFaceValue,
  buyerName,
  buyerEmail,
  recipientType,
  recipientName,
  recipientEmail,
  message,
  lang,
  onSuccess,
  onCancel,
}: {
  paymentIntentId: string;
  finalChargeAmount: number;
  currentFaceValue: number;
  buyerName: string;
  buyerEmail: string;
  recipientType: 'self' | 'gift';
  recipientName: string;
  recipientEmail: string;
  message: string;
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
      // 1. 실제 Stripe 카드 결제 승인 수행 (지적사항 #1 해결: 화면에서 실제 confirmPayment 완료 후에만 발급 호출)
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message || '카드 결제 승인에 실패했습니다.');
      }

      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error(`결제가 완료되지 않았습니다. (상태: ${paymentIntent?.status || 'unknown'})`);
      }

      // 2. 서버에서 PaymentIntent 성공 여부 및 금액 검증 후 기프트 카드 발급
      const issueRes = await fetch('/api/gift-cards/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceValue: currentFaceValue,
          buyerName,
          buyerEmail,
          recipientType,
          recipientName: recipientType === 'gift' ? recipientName : buyerName,
          recipientEmail: recipientType === 'gift' ? recipientEmail : buyerEmail,
          message,
          stripePaymentIntentId: paymentIntent.id || paymentIntentId,
        }),
      });

      const issueData = await issueRes.json();
      if (!issueRes.ok) {
        throw new Error(issueData.error || '기프트 카드 발급 검증에 실패했습니다.');
      }

      onSuccess(issueData.giftCard);
    } catch (err: any) {
      setErrorMsg(err.message || '결제 처리 중 오류가 발생했습니다.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <form onSubmit={handleConfirmPayment} className="space-y-4 pt-4 border-t border-stone-200">
      <div className="p-4 rounded-xl border border-stone-300 bg-[#FAF7F2]">
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
          className="px-4 py-3.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold hover:bg-stone-100 transition"
        >
          {lang === 'ko' ? '이전 단계' : 'Back'}
        </button>

        <button
          type="submit"
          disabled={!stripe || isConfirming}
          className="flex-1 py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isConfirming ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{lang === 'ko' ? 'Stripe 결제 승인 확인 중...' : 'Confirming Payment...'}</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>
                ${finalChargeAmount.toFixed(2)} {lang === 'ko' ? '결제 승인 및 카드 발급' : 'Confirm & Issue Card'}
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
  lang,
}: GiftCardFormProps) {
  const [recipientType, setRecipientType] = useState<'self' | 'gift'>('self');
  const [buyerName, setBuyerName] = useState('김민서');
  const [buyerEmail, setBuyerEmail] = useState('minseo.kim@example.com');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // PaymentIntent 단계 상태
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isCreatingIntent, setIsCreatingIntent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 발급 완료 모달 상태
  const [issuedCard, setIssuedCard] = useState<GiftCard | null>(null);
  const [copied, setCopied] = useState(false);

  const currentFaceValue = isCustom ? Number(customAmount) || 0 : amount;
  const discountAmount = Math.round(currentFaceValue * (discountRate / 100) * 100) / 100;
  const finalChargeAmount = Math.round((currentFaceValue - discountAmount) * 100) / 100;

  const handleSelectPreset = (val: number) => {
    setIsCustom(false);
    setAmount(val);
    setClientSecret(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    setIsCustom(true);
    setClientSecret(null);
  };

  // 1단계: 서버에 실제 Stripe PaymentIntent 생성 요청
  const handlePrepareCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (currentFaceValue < 20) {
      setFormError(lang === 'ko' ? '최소 $20 이상 선택해 주세요.' : 'Minimum amount is $20.');
      return;
    }

    if (!buyerName || !buyerEmail) {
      setFormError(lang === 'ko' ? '구매자 성함과 이메일을 입력해 주세요.' : 'Please enter buyer name and email.');
      return;
    }

    if (recipientType === 'gift' && !recipientEmail) {
      setFormError(lang === 'ko' ? '받는 분 이메일을 입력해 주세요.' : 'Please enter recipient email.');
      return;
    }

    if (!stripePromise) {
      setFormError(
        '유효한 NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY가 설정되지 않았습니다. .env.local에 실제 Stripe Test Key를 설정해 주세요.'
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
          buyerName,
          buyerEmail,
          recipientType,
          recipientName: recipientType === 'gift' ? recipientName : buyerName,
        }),
      });

      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        throw new Error(intentData.error || 'Stripe 결제 준비에 실패했습니다.');
      }

      setClientSecret(intentData.clientSecret);
      setPaymentIntentId(intentData.paymentIntentId);
    } catch (err: any) {
      setFormError(err.message || '결제 초기화 중 오류가 발생했습니다.');
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

  return (
    <div id="buy-section" className="bg-white rounded-2xl p-6 sm:p-8 border border-[#EBE7DF] luxury-card-shadow space-y-6">
      <div className="space-y-6">
        {/* 1. 금액 선택 */}
        <div>
          <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-2.5">
            1. {lang === 'ko' ? '기프트 카드 금액 선택' : 'Select Amount'}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
            {[100, 200, 300, 500].map((val) => {
              const discounted = Math.round(val * (1 - discountRate / 100));
              const isSelected = !isCustom && amount === val;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={Boolean(clientSecret)}
                  onClick={() => handleSelectPreset(val)}
                  className={`py-3.5 px-3 rounded-xl border text-center transition ${
                    isSelected
                      ? 'border-2 border-stone-900 bg-stone-50 font-bold shadow-sm'
                      : 'border-stone-200 hover:border-stone-400 bg-white'
                  } disabled:opacity-60`}
                >
                  <span className="block text-base text-stone-900">${val}</span>
                  <span className="block text-[11px] text-amber-700 font-medium">
                    ${discounted} {lang === 'ko' ? '결제' : 'pay'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-sm font-semibold text-stone-400">$</span>
            <input
              type="text"
              disabled={Boolean(clientSecret)}
              placeholder={lang === 'ko' ? '직접 금액 입력 ($50 ~ $2,000)' : 'Custom amount ($50 ~ $2,000)'}
              value={customAmount}
              onChange={handleCustomChange}
              className={`w-full pl-8 pr-4 py-2.5 rounded-xl border text-sm transition focus:outline-none focus:ring-1 focus:ring-stone-900 ${
                isCustom ? 'border-2 border-stone-900 bg-stone-50' : 'border-stone-200'
              } disabled:opacity-60`}
            />
          </div>
        </div>

        {/* 2. 선물 대상 설정 */}
        <div>
          <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-2.5">
            2. {lang === 'ko' ? '수신자 선택' : 'Recipient Type'}
          </label>
          <div className="grid grid-cols-2 gap-3 mb-3 text-xs font-semibold">
            <button
              type="button"
              disabled={Boolean(clientSecret)}
              onClick={() => {
                setRecipientType('self');
                setRecipientName(buyerName);
              }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition ${
                recipientType === 'self'
                  ? 'border-2 border-stone-900 bg-stone-900 text-white shadow-sm'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50'
              } disabled:opacity-60`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '나에게 보내기 (본인)' : 'For Myself'}</span>
            </button>

            <button
              type="button"
              disabled={Boolean(clientSecret)}
              onClick={() => {
                setRecipientType('gift');
                setRecipientName('');
              }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border transition ${
                recipientType === 'gift'
                  ? 'border-2 border-stone-900 bg-stone-900 text-white shadow-sm'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50'
              } disabled:opacity-60`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '선물하기 (타인)' : 'Send as Gift'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-stone-600 mb-1">{lang === 'ko' ? '구매자 성함' : 'Buyer Name'}</label>
              <input
                type="text"
                required
                disabled={Boolean(clientSecret)}
                value={buyerName}
                onChange={(e) => {
                  setBuyerName(e.target.value);
                  if (recipientType === 'self') setRecipientName(e.target.value);
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:bg-stone-100"
              />
            </div>
            <div>
              <label className="block text-stone-600 mb-1">{lang === 'ko' ? '구매자 이메일 (영수증 수령)' : 'Buyer Email'}</label>
              <input
                type="email"
                required
                disabled={Boolean(clientSecret)}
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:bg-stone-100"
              />
            </div>
          </div>

          {recipientType === 'gift' && (
            <div className="mt-3 p-4 bg-[#FAF7F2] rounded-xl border border-stone-200 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 mb-1">{lang === 'ko' ? '받는 분 성함' : 'Recipient Name'}</label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(clientSecret)}
                    placeholder={lang === 'ko' ? '받으실 분 성함' : 'Full Name'}
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:bg-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 mb-1">{lang === 'ko' ? '받는 분 이메일 (카드 전송)' : 'Recipient Email'}</label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(clientSecret)}
                    placeholder="friend@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:bg-stone-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-stone-600 mb-1">{lang === 'ko' ? '선물 축하 메시지 (선택)' : 'Personal Message'}</label>
                <textarea
                  rows={2}
                  disabled={Boolean(clientSecret)}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={lang === 'ko' ? '따뜻한 헤드스파 힐링을 선물합니다.' : 'Wishing you relaxing moments at K-headspa.'}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900 disabled:bg-stone-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. 결제 금액 계산 박스 */}
        <div className="border-t border-b border-stone-200 py-4 space-y-2 text-xs">
          <div className="flex justify-between text-stone-600">
            <span>{lang === 'ko' ? '기프트 카드 충전 액면가' : 'Card Stored Value'}</span>
            <span className="font-semibold text-stone-900">${currentFaceValue.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-amber-700 font-medium">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {lang === 'ko' ? `11월 특별 프로모션 (${discountRate}% 할인)` : `November Promo (${discountRate}% OFF)`}
            </span>
            <span>-${discountAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between items-baseline pt-2.5 border-t border-dashed border-stone-200">
            <div>
              <span className="text-sm font-bold text-stone-900 block">
                {lang === 'ko' ? '최종 Stripe 결제 금액' : 'Total Stripe Charge'}
              </span>
              <span className="text-[11px] text-stone-500">
                {lang === 'ko' ? '유효기간: 발급일로부터 2년' : '2-Year Validity Included'}
              </span>
            </div>
            <span className="font-serif-luxury text-3xl font-bold text-stone-900">
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

        {/* 4. Stripe Elements 결제창 또는 결제 준비 버튼 */}
        {!clientSecret ? (
          <button
            type="button"
            onClick={handlePrepareCheckout}
            disabled={isCreatingIntent || currentFaceValue < 20}
            className="w-full py-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isCreatingIntent ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === 'ko' ? 'Stripe 보안 결제창 불러오는 중...' : 'Initializing Stripe...'}</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>
                  ${finalChargeAmount.toFixed(2)} {lang === 'ko' ? 'Stripe 카드 결제 진행하기' : 'Proceed to Stripe Payment'}
                </span>
              </>
            )}
          </button>
        ) : (
          stripePromise &&
          paymentIntentId && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripeCheckoutStep
                paymentIntentId={paymentIntentId}
                finalChargeAmount={finalChargeAmount}
                currentFaceValue={currentFaceValue}
                buyerName={buyerName}
                buyerEmail={buyerEmail}
                recipientType={recipientType}
                recipientName={recipientName}
                recipientEmail={recipientEmail}
                message={message}
                lang={lang}
                onCancel={() => {
                  setClientSecret(null);
                  setPaymentIntentId(null);
                }}
                onSuccess={(card) => {
                  setIssuedCard(card);
                  setClientSecret(null);
                  setPaymentIntentId(null);
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

      {/* 발급 완료 모달 */}
      {issuedCard && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 text-center space-y-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase text-amber-700">Payment Confirmed</span>
              <h3 className="font-serif-luxury text-3xl font-medium text-stone-900 mt-1">
                기프트 카드가 성공적으로 발급되었습니다!
              </h3>
              <p className="text-xs text-stone-600 mt-1.5">
                Stripe 결제가 정상 승인되었으며 디지털 카드가 발급되었습니다.
              </p>
            </div>

            <div className="bg-[#FAF7F2] p-5 rounded-2xl border border-stone-200 text-left space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-bold block mb-1">고유 기프트 카드 코드</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-stone-900 tracking-wider">
                      {issuedCard.code}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-200 text-stone-700 transition"
                      title="코드 복사"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {issuedCard.qrCodeDataUrl && (
                  <div className="bg-white p-2 rounded-xl border border-stone-200 shadow-sm shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={issuedCard.qrCodeDataUrl} alt="Gift card QR" className="w-20 h-20" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs border-t border-stone-200/80 pt-3">
                <div>
                  <span className="text-stone-500 block">충전 액면가 (Store Value):</span>
                  <strong className="text-stone-900 text-sm">${issuedCard.initialBalance.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">실제 결제액 (Stripe):</span>
                  <strong className="text-amber-800 text-sm">${issuedCard.paidAmount.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">받는 분:</span>
                  <strong className="text-stone-900">{issuedCard.recipientName}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block">유효기간 (구매일+2년):</span>
                  <strong className="text-emerald-700 font-mono text-[11px]">
                    {new Date(issuedCard.expiresAt).toLocaleDateString()}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIssuedCard(null)}
                className="flex-1 py-3.5 bg-stone-900 text-white rounded-xl text-xs font-semibold hover:bg-stone-800 transition"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
