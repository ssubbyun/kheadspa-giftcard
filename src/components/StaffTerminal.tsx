'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
  Camera,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { getErrorMessage, normalizeGiftCardCode } from '@/lib/barcode';

interface StaffTerminalProps {
  lang: 'ko' | 'en';
}

interface SafeCardView {
  code: string;
  initialBalance: number;
  currentBalance: number;
  status: string;
  recipientMaskedName?: string;
  recipientName?: string;
  deliveryStatus?: string;
  expiresAt: string | null;
}

export default function StaffTerminal({ lang }: StaffTerminalProps) {
  const [staffPin, setStaffPin] = useState('');
  const [location, setLocation] = useState<'Manhattan' | 'Norwood' | 'Fort Lee'>('Manhattan');
  const [staffName, setStaffName] = useState('');
  const [code, setCode] = useState('');
  const [card, setCard] = useState<SafeCardView | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [staffNote, setStaffNote] = useState('');

  // 스캐너 모달 & 재발송 패널 상태
  const [showScanner, setShowScanner] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendPhone, setResendPhone] = useState('');
  const [isResending, setIsResending] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const lookupCode = async (rawCode: string) => {
    const normalized = normalizeGiftCardCode(rawCode);
    if (!normalized) return;

    setCode(normalized);
    setIsSearching(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(normalized)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Card not found.');
      setCard(data.card);
      setRedeemAmount(Math.min(data.card.currentBalance, 150).toString());
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Card lookup failed'));
      setCard(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await lookupCode(code);
  };

  const handleExecuteRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;

    if (!staffPin.trim()) {
      setError(lang === 'ko' ? '매장 관리자/직원 보안 PIN 번호를 입력해 주세요.' : 'Please enter Staff PIN.');
      return;
    }

    const amt = Number(redeemAmount);
    if (!amt || amt <= 0) {
      setError(lang === 'ko' ? '올바른 차감 금액을 입력해 주세요.' : 'Please enter a valid amount.');
      return;
    }

    if (amt > card.currentBalance) {
      setError(
        lang === 'ko'
          ? `현재 카드 잔액($${card.currentBalance})보다 큰 금액은 차감할 수 없습니다.`
          : `Amount exceeds current balance ($${card.currentBalance.toFixed(2)}).`
      );
      return;
    }

    setIsRedeeming(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/gift-cards/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-pin': staffPin.trim(),
        },
        body: JSON.stringify({
          code: card.code,
          redeemAmount: amt,
          location,
          staffName: staffName.trim() || 'Authorized Staff',
          staffNote: staffNote.trim() || 'Spa Service Redemption',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Redemption failed.');

      setSuccessMsg(
        lang === 'ko'
          ? `성공적으로 $${amt.toFixed(2)} 차감 완료되었습니다! (남은 잔액: $${data.remainingBalance.toFixed(2)})`
          : `Redeemed $${amt.toFixed(2)} successfully! (Remaining: $${data.remainingBalance.toFixed(2)})`
      );
      setCard(data.card);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Redemption error'));
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleResendVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;

    if (!staffPin.trim()) {
      setError(lang === 'ko' ? '재발송하려면 직원 보안 PIN을 먼저 입력해 주세요.' : 'Please enter Staff PIN to resend.');
      return;
    }

    setIsResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/gift-cards/resend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-staff-pin': staffPin.trim(),
        },
        body: JSON.stringify({
          code: card.code,
          recipientEmail: resendEmail.trim() || undefined,
          recipientPhone: resendPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Resend failed.');

      const status = data.delivery?.deliveryStatus;
      if (status === 'SENT') {
        setSuccessMsg(lang === 'ko' ? '이메일 및 SMS 재발송이 완료되었습니다.' : 'Voucher resent via Email & SMS.');
      } else if (status === 'PARTIAL') {
        setSuccessMsg(lang === 'ko' ? '일부 채널(이메일 또는 SMS)로 재발송되었습니다.' : 'Voucher resent to available channel.');
      } else if (status === 'SKIPPED_NO_CREDENTIALS') {
        setSuccessMsg(
          lang === 'ko'
            ? '연락처는 저장되었으나 Resend/Twilio API 키가 아직 비어 있어 발송이 스킵되었습니다.'
            : 'Contact updated, but Email/SMS API keys are not configured yet.'
        );
      } else {
        setError(lang === 'ko' ? '발송 API 호출에 실패했습니다. 키와 주소를 확인해 주세요.' : 'Delivery API returned an error.');
      }
      setShowResend(false);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Resend error'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* 매장 카운터 헤더 배너 */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#1b2e24] to-[#061910] text-[#fff8f5] shadow-xl flex items-center justify-between border border-[#c5a059]/30">
        <div>
          <span className="text-[10px] tracking-[0.16em] text-[#ffdea5] font-bold uppercase block">
            Staff POS Redemption Terminal
          </span>
          <h2 className="text-2xl font-normal font-serif-luxury tracking-wide mt-0.5">
            {lang === 'ko' ? '매장 카운터 기프트 카드 차감 POS' : 'Staff Gift Card POS'}
          </h2>
          <p className="text-xs text-[#d1e8d9]/85 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-[#e9c176]" />
            <span>
              {location} · {staffName.trim() || (lang === 'ko' ? '담당자 미입력' : 'Staff')}
            </span>
          </p>
        </div>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
        </span>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#ece0d8] luxury-card-shadow space-y-6 text-xs">
        {/* 직원 보안 PIN 및 지점/직원 설정 */}
        <div className="space-y-3.5 pb-5 border-b border-[#ece0d8]">
          <div>
            <label className="block text-[#061910] font-bold mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#775a19]" />
              <span>{lang === 'ko' ? '매장 직원 보안 PIN (필수 인증)' : 'Staff Security PIN (Required)'}</span>
            </label>
            <input
              type="password"
              placeholder={lang === 'ko' ? '직원 전용 보안 PIN 입력' : 'Enter Staff PIN'}
              value={staffPin}
              onChange={(e) => setStaffPin(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2] bg-[#fef1e9] font-mono text-[#061910] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#424844] font-medium mb-1">
                {lang === 'ko' ? '근무 지점' : 'Location'}
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as 'Manhattan' | 'Norwood' | 'Fort Lee')}
                className="w-full px-3 py-2.5 rounded-xl border border-[#c2c8c2] bg-[#fef1e9] font-semibold text-[#061910] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
              >
                <option value="Manhattan">Manhattan Flagship</option>
                <option value="Norwood">Norwood Studio</option>
                <option value="Fort Lee">Fort Lee Studio</option>
              </select>
            </div>
            <div>
              <label className="block text-[#424844] font-medium mb-1">
                {lang === 'ko' ? '담당 직원 성함' : 'Staff Name'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ko' ? '담당자 이름' : 'e.g. Sarah K.'}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#c2c8c2] bg-[#fef1e9] text-[#061910] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
              />
            </div>
          </div>
        </div>

        {/* 1. 코드 조회 & 바코드/QR 스캔 */}
        <form onSubmit={handleLookup} className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block font-bold text-[#061910] uppercase tracking-[0.12em]">
              1. {lang === 'ko' ? '고객 기프트 카드 코드 조회' : 'Lookup Customer Gift Card'}
            </label>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffdea5] border border-[#e9c176] text-[#261900] font-bold text-[11px] hover:bg-[#e9c176] transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{lang === 'ko' ? '바코드 / QR 스캔' : 'Scan Barcode / QR'}</span>
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="KSPA-XXXX-XXXX-XXXX (or scan with barcode reader)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 font-mono uppercase px-3.5 py-2.5 rounded-xl border border-[#c2c8c2] bg-[#fef1e9] text-[#061910] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
            />
            <button
              type="submit"
              disabled={isSearching || !code.trim()}
              className="px-5 py-2.5 bg-[#1b2e24] hover:bg-[#061910] text-white font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (lang === 'ko' ? '조회' : 'Lookup')}
            </button>
          </div>
        </form>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 성공 메시지 */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-[#d1e8d9] border border-[#b6ccbd] text-[#0c1f16] flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1b2e24]" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 조회된 카드 정보 & 재발송 패널 */}
        {card && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#fef1e9] border border-[#ece0d8] space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-[#737874] uppercase font-semibold">
                  {lang === 'ko' ? '소지자 / 상태' : 'Holder / Status'}
                </span>
                <p className="font-bold text-sm text-[#061910]">
                  {card.recipientName || card.recipientMaskedName || 'Guest'} ({card.status})
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#737874] uppercase font-semibold">
                  {lang === 'ko' ? '사용 가능 잔여 잔액' : 'Available Balance'}
                </span>
                <p className="font-serif-luxury text-2xl font-bold text-[#1b2e24]">
                  ${card.currentBalance.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-[#737874] border-t border-[#ece0d8] pt-2">
              <span>{lang === 'ko' ? '최초 충전액:' : 'Initial:'} ${card.initialBalance.toFixed(2)}</span>
              <span>
                {lang === 'ko' ? '유효기간: 무제한' : 'Validity: No Expiration'}
              </span>
            </div>

            {/* 이메일 / SMS 재발송 접이식 패널 */}
            <div className="border-t border-[#ece0d8] pt-2.5">
              <button
                type="button"
                onClick={() => setShowResend((prev) => !prev)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-[#424844] hover:text-[#061910] cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#775a19]" />
                  <span>{lang === 'ko' ? '이메일 / SMS 바우처 재발송' : 'Resend Email / SMS Voucher'}</span>
                </span>
                {showResend ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showResend && (
                <form onSubmit={handleResendVoucher} className="mt-3 space-y-2.5 bg-white p-3.5 rounded-xl border border-[#ece0d8]">
                  <p className="text-[11px] text-[#737874]">
                    {lang === 'ko'
                      ? '연락처를 변경해 재발송할 경우에만 입력하고, 기존 연락처로 재발송하려면 비워두고 전송하세요.'
                      : 'Leave blank to resend to the existing contact, or enter an updated email/phone.'}
                  </p>
                  <input
                    type="email"
                    placeholder={lang === 'ko' ? '수정할 수신 이메일 (선택)' : 'Updated recipient email (optional)'}
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#c2c8c2] text-xs focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                  />
                  <input
                    type="tel"
                    placeholder={lang === 'ko' ? '수정할 수신 휴대폰 (+1... 선택)' : 'Updated recipient phone (+1..., optional)'}
                    value={resendPhone}
                    onChange={(e) => setResendPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#c2c8c2] text-xs focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                  />
                  <button
                    type="submit"
                    disabled={isResending}
                    className="w-full py-2.5 rounded-xl bg-[#1b2e24] hover:bg-[#061910] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#ffdea5]" />}
                    <span>{lang === 'ko' ? '바우처 즉시 재발송' : 'Send Voucher Now'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 2. 시술 금액 차감 입력 */}
        {card && card.currentBalance > 0 && (
          <form onSubmit={handleExecuteRedeem} className="space-y-4 border-t border-[#ece0d8] pt-5">
            <div>
              <label className="block font-bold text-[#061910] mb-1.5 uppercase tracking-[0.12em]">
                2. {lang === 'ko' ? '현장 시술 차감 금액 입력 (USD)' : 'Redeem Amount (USD)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base font-bold text-[#737874]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={card.currentBalance}
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 text-base font-bold font-mono rounded-xl border border-[#c2c8c2] bg-[#fef1e9] text-[#061910] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
                />
              </div>
              <p className="text-[11px] text-[#737874] mt-1">
                {lang === 'ko'
                  ? '* 전액 차감 시 남은 시술 차액은 카운터 신용카드 또는 현금으로 복합 결제 가능합니다.'
                  : '* Remaining treatment balance can be settled via card or cash at checkout.'}
              </p>
            </div>

            <div>
              <label className="block font-medium text-[#424844] mb-1">
                {lang === 'ko' ? '시술 명칭 및 메모' : 'Service / Staff Note'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ko' ? '예: Signature Wet Head Spa 차감' : 'e.g. Signature Wet Head Spa'}
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#c2c8c2] bg-[#fef1e9] text-[#061910] focus:outline-none focus:ring-2 focus:ring-[#c5a059]"
              />
            </div>

            <button
              type="submit"
              disabled={isRedeeming}
              className="w-full py-3.5 rounded-xl bg-[#775a19] hover:bg-[#5d4201] text-white font-bold text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isRedeeming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#ffdea5]" />
                  <span>
                    {lang === 'ko'
                      ? `기프트 카드 차감 승인 (Redeem $${redeemAmount || '0'})`
                      : `Confirm Redemption ($${redeemAmount || '0'})`}
                  </span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {showScanner && (
        <BarcodeScannerModal
          lang={lang}
          onDetected={(detectedCode) => {
            setShowScanner(false);
            lookupCode(detectedCode);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
