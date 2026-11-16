'use client';

import React, { useState } from 'react';
import {
  Search,
  Calendar,
  History,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface BalanceTrackerProps {
  lang: 'ko' | 'en';
}

interface SafeGiftCard {
  code: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED';
  recipientMaskedName: string;
  createdAt: string;
  expiresAt: string;
}

interface SafeTransaction {
  id: string;
  transactionType: 'INITIAL_PURCHASE' | 'REDEEM' | 'REFUND';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  location?: string;
  summary: string;
  createdAt: string;
}

export default function BalanceTracker({ lang }: BalanceTrackerProps) {
  const [code, setCode] = useState('KSPA-HOLIDAY-2026');
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<SafeGiftCard | null>(null);
  const [transactions, setTransactions] = useState<SafeTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '조회에 실패했습니다.');
      }

      setCard(data.card);
      setTransactions(data.transactions || []);
    } catch (err: any) {
      setError(err.message || '카드 정보를 불러오지 못했습니다.');
      setCard(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* 타이틀 */}
      <div className="text-center space-y-2">
        <span className="text-[11px] uppercase tracking-widest text-stone-500 font-semibold">
          {lang === 'ko' ? '실시간 잔액 추적' : 'Real-time Balance Tracking'}
        </span>
        <h2 className="font-serif-luxury text-3xl sm:text-4xl font-medium text-stone-900">
          {lang === 'ko' ? '기프트 카드 잔액 및 사용 내역 조회' : 'Check Gift Card Balance'}
        </h2>
        <p className="text-xs text-stone-600 max-w-md mx-auto">
          {lang === 'ko'
            ? '소지하신 16자리 기프트 카드 번호를 입력하시면 잔여 금액과 구매일로부터 2년 유효기간을 확인하실 수 있습니다.'
            : 'Enter your 16-character gift card code to check remaining balance and your 2-year expiration date.'}
        </p>
      </div>

      {/* 검색 입력창 */}
      <div className="bg-white p-6 sm:p-7 rounded-2xl border border-[#EBE7DF] luxury-card-shadow space-y-4">
        <form onSubmit={handleLookup} className="space-y-3">
          <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider">
            {lang === 'ko' ? '기프트 카드 코드 (16자리)' : 'Gift Card Code'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="KSPA-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 font-mono uppercase text-sm px-4 py-3 rounded-xl border border-stone-300 focus:outline-none focus:ring-1 focus:ring-stone-900 bg-[#FAF7F2]"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{lang === 'ko' ? '조회하기' : 'Check'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
            <span>
              {lang === 'ko' ? '데모 테스트 코드:' : 'Demo Code:'} <code>KSPA-HOLIDAY-2026</code>
            </span>
            <button
              type="button"
              onClick={() => {
                setCode('KSPA-HOLIDAY-2026');
                setTimeout(() => handleLookup(), 50);
              }}
              className="text-amber-800 font-semibold hover:underline"
            >
              {lang === 'ko' ? '데모 카드 자동 입력' : 'Use Demo Code'}
            </button>
          </div>
        </form>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 카드 조회 결과 */}
        {card && (
          <div className="space-y-6 pt-5 border-t border-stone-200">
            {/* 잔액 요약 카드 */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#1C1917] to-[#2B2724] text-[#FBF9F5] shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block mb-1">
                  {lang === 'ko' ? '현재 사용 가능 잔액 (Available Balance)' : 'Available Balance'}
                </span>
                <span className="font-serif-luxury text-4xl sm:text-5xl font-bold tracking-tight text-white">
                  ${card.currentBalance.toFixed(2)}
                </span>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-300">
                  <span>
                    {lang === 'ko' ? '최초 충전액:' : 'Initial Value:'} ${card.initialBalance.toFixed(2)}
                  </span>
                  <span>·</span>
                  <span>
                    {lang === 'ko' ? '소지자:' : 'Recipient:'} {card.recipientMaskedName} 님
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    card.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : card.status === 'EXHAUSTED'
                      ? 'bg-stone-500/20 text-stone-400 border-stone-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  }`}
                >
                  {card.status}
                </span>

                <div className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3 text-amber-400" />
                  <span>
                    {lang === 'ko' ? '만료일(구매일+2년):' : 'Expires:'}{' '}
                    {new Date(card.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 사용 내역 타임라인 (Tracking History) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-stone-500" />
                  <span>{lang === 'ko' ? '카드 사용 및 충전 이력' : 'Transaction History'}</span>
                </h4>
                <span className="text-[11px] text-stone-500">총 {transactions.length}건</span>
              </div>

              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-xs text-stone-500 text-center py-4 bg-stone-50 rounded-xl">
                    {lang === 'ko' ? '아직 사용 내역이 없습니다.' : 'No transactions recorded yet.'}
                  </p>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-xl border border-stone-200 bg-[#FAF7F2] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            tx.amount < 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {tx.amount < 0 ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-stone-900">{tx.summary}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">
                            {new Date(tx.createdAt).toLocaleString()}
                            {tx.location && ` · ${tx.location} 지점`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            tx.amount < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {tx.amount < 0
                            ? `-$${Math.abs(tx.amount).toFixed(2)}`
                            : `+$${tx.amount.toFixed(2)}`}
                        </span>
                        <span className="block text-[10px] text-stone-400">
                          잔액: ${tx.balanceAfter.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
