'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
} from 'lucide-react';

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
  expiresAt: string;
}

export default function StaffTerminal({ lang }: StaffTerminalProps) {
  const [staffPin, setStaffPin] = useState('');
  const [location, setLocation] = useState<'Manhattan' | 'Norwood' | 'Fort Lee'>('Manhattan');
  const [staffName, setStaffName] = useState('Sarah K.');
  const [code, setCode] = useState('KSPA-HOLIDAY-2026');
  const [card, setCard] = useState<SafeCardView | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('50');
  const [staffNote, setStaffNote] = useState('Signature Wet Head Spa 차감 결제');

  const [isSearching, setIsSearching] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code.trim()) return;

    setIsSearching(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '카드를 찾을 수 없습니다.');
      setCard(data.card);
      setRedeemAmount(Math.min(data.card.currentBalance, 150).toString());
    } catch (err: any) {
      setError(err.message || '카드 조회 실패');
      setCard(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleExecuteRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card) return;

    if (!staffPin.trim()) {
      setError('매장 관리자/직원 보안 PIN 번호를 입력해 주세요.');
      return;
    }

    const amt = Number(redeemAmount);
    if (!amt || amt <= 0) {
      setError('올바른 차감 금액을 입력해 주세요.');
      return;
    }

    if (amt > card.currentBalance) {
      setError(`현재 카드 잔액($${card.currentBalance})보다 큰 금액은 차감할 수 없습니다.`);
      return;
    }

    setIsRedeeming(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 지적사항 #2 해결: 요청 헤더에 직원 인증 PIN(`x-staff-pin`) 전달
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
          staffName,
          staffNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '차감 처리에 실패했습니다.');

      setSuccessMsg(
        `성공적으로 $${amt.toFixed(2)} 차감 완료되었습니다! (남은 잔액: $${data.remainingBalance.toFixed(2)})`
      );
      setCard(data.card);
    } catch (err: any) {
      setError(err.message || '차감 처리 중 오류 발생');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* 매장 카운터 헤더 배너 */}
      <div className="p-5 rounded-2xl bg-[#1C1917] text-[#FBF9F5] shadow-lg flex items-center justify-between border border-stone-800">
        <div>
          <span className="text-[10px] tracking-widest text-amber-400 font-bold uppercase block">
            Staff POS Redemption Terminal
          </span>
          <h2 className="text-xl font-bold font-serif-luxury tracking-wide">
            {lang === 'ko' ? '매장 카운터 기프트 카드 차감 POS' : 'Staff Gift Card POS'}
          </h2>
          <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-amber-400" />
            <span>
              현재 지점: <strong>{location}</strong> (담당: {staffName})
            </span>
          </p>
        </div>
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
        </span>
      </div>

      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#EBE7DF] luxury-card-shadow space-y-5 text-xs">
        {/* 직원 보안 PIN 및 지점/직원 설정 */}
        <div className="space-y-3 pb-4 border-b border-stone-200">
          <div>
            <label className="block text-stone-800 font-bold mb-1 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span>매장 직원 보안 PIN (필수 인증)</span>
            </label>
            <input
              type="password"
              placeholder="직원 전용 보안 PIN 입력 (예: 1234)"
              value={staffPin}
              onChange={(e) => setStaffPin(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-[#FAF7F2] font-mono text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-600 font-medium mb-1">근무 지점</label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-[#FAF7F2] font-semibold text-stone-800 focus:outline-none"
              >
                <option value="Manhattan">Manhattan Flagship</option>
                <option value="Norwood">Norwood Studio</option>
                <option value="Fort Lee">Fort Lee Spa</option>
              </select>
            </div>
            <div>
              <label className="block text-stone-600 font-medium mb-1">담당 테라피스트 / 직원</label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-[#FAF7F2] text-stone-800 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 1. 코드 조회 */}
        <form onSubmit={handleLookup} className="space-y-2">
          <label className="block font-bold text-stone-900 uppercase tracking-wider">
            1. 고객 기프트 카드 코드 조회
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="KSPA-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 font-mono uppercase px-3.5 py-2.5 rounded-xl border border-stone-300 bg-[#FAF7F2] focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition cursor-pointer"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '조회'}
            </button>
          </div>
        </form>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 성공 메시지 */}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 조회된 카드 정보 */}
        {card && (
          <div className="p-4 rounded-xl bg-[#FAF7F2] border border-stone-200 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] text-stone-500 uppercase font-semibold">소지자 / 상태</span>
                <p className="font-bold text-sm text-stone-900">
                  {card.recipientName || card.recipientMaskedName || '고객'} 님 ({card.status})
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-500 uppercase font-semibold">사용 가능 잔여 잔액</span>
                <p className="font-serif-luxury text-2xl font-bold text-emerald-700">
                  ${card.currentBalance.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-stone-500 border-t border-stone-200 pt-2">
              <span>최초 충전액: ${card.initialBalance.toFixed(2)}</span>
              <span>유효기간: {new Date(card.expiresAt).toLocaleDateString()} (2년)</span>
            </div>
          </div>
        )}

        {/* 2. 시술 금액 차감 입력 */}
        {card && card.currentBalance > 0 && (
          <form onSubmit={handleExecuteRedeem} className="space-y-4 border-t border-stone-200 pt-4">
            <div>
              <label className="block font-bold text-stone-900 mb-1.5 uppercase tracking-wider">
                2. 현장 시술 차감 금액 입력 (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base font-bold text-stone-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={card.currentBalance}
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 text-base font-bold font-mono rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                * 전액 차감 시 남은 시술 차액은 카운터 신용카드 또는 현금으로 복합 결제 가능합니다.
              </p>
            </div>

            <div>
              <label className="block font-medium text-stone-700 mb-1">
                시술 명칭 및 메모 (영수증에 기록됨)
              </label>
              <input
                type="text"
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isRedeeming}
              className="w-full py-3.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs uppercase tracking-wider transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isRedeeming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>기프트 카드 차감 승인 (Redeem ${redeemAmount})</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
