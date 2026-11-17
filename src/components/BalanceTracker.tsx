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
  ExternalLink,
  QrCode,
} from 'lucide-react';
import { getErrorMessage, normalizeGiftCardCode } from '@/lib/barcode';

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

interface BalanceTrackerProps {
  lang: 'ko' | 'en';
  onOpenVoucher?: (code: string) => void;
}

interface SafeGiftCard {
  code: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED';
  designId?: string;
  recipientMaskedName: string;
  qrCodeDataUrl?: string;
  barcodeDataUrl?: string;
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

export default function BalanceTracker({ lang, onOpenVoucher }: BalanceTrackerProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState<SafeGiftCard | null>(null);
  const [transactions, setTransactions] = useState<SafeTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const normalized = normalizeGiftCardCode(code);
    if (!normalized) return;

    setCode(normalized);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(normalized)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gift card lookup failed.');
      }

      setCard(data.card);
      setTransactions(data.transactions || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load gift card information.'));
      setCard(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* 타이틀 */}
      <div className="text-center space-y-2.5">
        <span className="inline-flex px-3 py-1 rounded-full bg-[#ffdea5] text-[#261900] text-[10px] uppercase tracking-[0.14em] font-bold">
          {lang === 'ko' ? '실시간 잔액 추적' : 'Real-time Balance Tracking'}
        </span>
        <h2 className="font-serif-luxury text-3xl sm:text-4xl font-normal text-[#061910]">
          {lang === 'ko' ? '기프트 카드 잔액 및 사용 내역 조회' : 'Check Gift Card Balance'}
        </h2>
        <p className="text-xs sm:text-sm text-[#424844] max-w-md mx-auto leading-relaxed">
          {lang === 'ko'
            ? '소지하신 16자리 기프트 카드 번호를 입력하시면 잔여 금액, 바코드 바우처 및 유효기간을 확인하실 수 있습니다.'
            : 'Enter your 16-character gift card code to view remaining balance, checkout barcode, and 2-year expiration date.'}
        </p>
      </div>

      {/* 검색 입력창 */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#ece0d8] luxury-card-shadow space-y-5">
        <form onSubmit={handleLookup} className="space-y-3">
          <label className="block text-[11px] font-bold text-[#061910] uppercase tracking-[0.14em]">
            {lang === 'ko' ? '기프트 카드 코드 (16자리)' : 'Gift Card Code'}
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              placeholder="KSPA-XXXX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 font-mono uppercase text-sm px-4 py-3 rounded-xl border border-[#c2c8c2] focus:outline-none focus:ring-2 focus:ring-[#c5a059] bg-[#fef1e9] text-[#061910]"
            />
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-6 py-3 bg-[#1b2e24] hover:bg-[#061910] text-white text-xs font-semibold tracking-wide rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 text-[#ffdea5]" />}
              <span>{lang === 'ko' ? '조회하기' : 'Check Balance'}</span>
            </button>
          </div>
        </form>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 카드 조회 결과 */}
        {card && (
          <div className="space-y-6 pt-5 border-t border-[#ece0d8]">
            {/* 잔액 요약 카드 */}
            <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-[#1b2e24] to-[#061910] text-[#fff8f5] shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border border-[#c5a059]/30">
              <div className="absolute inset-2 rounded-xl border border-[#ffdea5]/15 pointer-events-none" />
              <div className="relative z-10">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#ffdea5] font-bold block mb-1">
                  {lang === 'ko' ? '현재 사용 가능 잔액 (Available Balance)' : 'Available Balance'}
                </span>
                <span className="font-serif-luxury text-4xl sm:text-5xl font-medium tracking-tight text-white">
                  ${card.currentBalance.toFixed(2)}
                </span>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-[#d1e8d9]/85">
                  <span>
                    {lang === 'ko' ? '최초 충전액:' : 'Initial Value:'} ${card.initialBalance.toFixed(2)}
                  </span>
                  <span>·</span>
                  <span>
                    {lang === 'ko' ? '소지자:' : 'Recipient:'} {card.recipientMaskedName}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-start sm:items-end gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                    card.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                      : card.status === 'EXHAUSTED'
                        ? 'bg-stone-500/20 text-stone-300 border-stone-400/40'
                        : 'bg-rose-500/20 text-rose-200 border-rose-400/40'
                  }`}
                >
                  {card.status}
                </span>

                <div className="text-[11px] text-[#d1e8d9]/80 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3 text-[#e9c176]" />
                  <span>
                    {lang === 'ko' ? '만료일:' : 'Expires:'}{' '}
                    {new Date(card.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 바코드 & QR & 액션 버튼 */}
            <div className="p-4 sm:p-5 rounded-2xl border border-[#ece0d8] bg-[#fef1e9] space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#ece0d8]">
                {card.barcodeDataUrl && (
                  <div className="flex-1 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.barcodeDataUrl}
                      alt={`Barcode ${card.code}`}
                      className="max-w-full h-auto"
                    />
                  </div>
                )}
                {card.qrCodeDataUrl && (
                  <div className="shrink-0 p-1.5 border border-[#ece0d8] rounded-xl bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.qrCodeDataUrl} alt="Gift card QR" className="w-20 h-20" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenVoucher?.(card.code)}
                  className="py-3 px-4 rounded-xl border border-[#061910] bg-white text-[#061910] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#f8ece4] transition cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>{lang === 'ko' ? '전체 바코드 바우처 열기' : 'Open Full Voucher'}</span>
                </button>
                <a
                  href={BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 px-4 rounded-xl bg-[#1b2e24] hover:bg-[#061910] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Book a service</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#ffdea5]" />
                </a>
              </div>
            </div>

            {/* 사용 내역 타임라인 (Tracking History) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-bold text-[#061910] uppercase tracking-[0.12em] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#775a19]" />
                  <span>{lang === 'ko' ? '카드 사용 및 충전 이력' : 'Transaction History'}</span>
                </h4>
                <span className="text-[11px] text-[#737874]">{transactions.length} records</span>
              </div>

              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-xs text-[#424844] text-center py-4 bg-[#fef1e9] rounded-xl">
                    {lang === 'ko' ? '아직 사용 내역이 없습니다.' : 'No transactions recorded yet.'}
                  </p>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl border border-[#ece0d8] bg-[#fef1e9] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            tx.amount < 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-[#d1e8d9] text-[#0c1f16]'
                          }`}
                        >
                          {tx.amount < 0 ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[#061910]">{tx.summary}</p>
                          <p className="text-[10px] text-[#737874] mt-0.5">
                            {new Date(tx.createdAt).toLocaleString()}
                            {tx.location && ` · ${tx.location}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono font-bold text-sm ${
                            tx.amount < 0 ? 'text-rose-700' : 'text-[#1b2e24]'
                          }`}
                        >
                          {tx.amount < 0
                            ? `-$${Math.abs(tx.amount).toFixed(2)}`
                            : `+$${tx.amount.toFixed(2)}`}
                        </span>
                        <span className="block text-[10px] text-[#737874]">
                          Bal: ${tx.balanceAfter.toFixed(2)}
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
