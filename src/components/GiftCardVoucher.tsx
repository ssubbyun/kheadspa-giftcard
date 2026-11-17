'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  History,
  Loader2,
  Printer,
  Share2,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { getCardDesign } from '@/lib/card-designs';
import { getErrorMessage } from '@/lib/barcode';

const BOOKING_URL =
  process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com';

interface VoucherCard {
  code: string;
  initialBalance: number;
  currentBalance: number;
  currency: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED';
  designId?: string;
  recipientMaskedName: string;
  senderMaskedName?: string;
  qrCodeDataUrl?: string;
  barcodeDataUrl?: string;
  deliveryStatus?: string;
  scheduledDeliveryDate?: string;
  createdAt: string;
  expiresAt: string;
}

interface VoucherTransaction {
  id: string;
  transactionType: 'INITIAL_PURCHASE' | 'REDEEM' | 'REFUND';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  location?: string;
  summary: string;
  createdAt: string;
}

interface GiftCardVoucherProps {
  code: string;
  lang: 'ko' | 'en';
  onBack: () => void;
}

export default function GiftCardVoucher({ code, lang, onBack }: GiftCardVoucherProps) {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<VoucherCard | null>(null);
  const [transactions, setTransactions] = useState<VoucherTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchVoucher() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/gift-cards/check?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Gift card not found.');
        }
        if (!cancelled) {
          setCard(data.card);
          setTransactions(data.transactions || []);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(err, 'Failed to load gift card voucher.'));
          setCard(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchVoucher();
    return () => {
      cancelled = true;
    };
  }, [code]);

  const design = getCardDesign(card?.designId);

  const handleCopyCode = () => {
    if (!card) return;
    navigator.clipboard.writeText(card.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareLink = async () => {
    if (typeof window === 'undefined' || !card) return;
    const shareUrl = `${window.location.origin}/?card=${encodeURIComponent(card.code)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'K-headspa & wellness Gift Card',
          text: `Digital Gift Card (${card.code})`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    navigator.clipboard.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#424844] hover:text-[#061910] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{lang === 'ko' ? '기프트 카드 홈으로' : 'Back to Gift Cards'}</span>
        </button>

        {card && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShareLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#c2c8c2] bg-white text-xs font-semibold text-[#061910] hover:bg-[#fef1e9] transition cursor-pointer"
            >
              {copiedShare ? (
                <Check className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Share2 className="w-3.5 h-3.5 text-[#775a19]" />
              )}
              <span>{copiedShare ? (lang === 'ko' ? '링크 복사됨' : 'Copied') : (lang === 'ko' ? '공유' : 'Share Link')}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#c2c8c2] bg-white text-xs font-semibold text-[#061910] hover:bg-[#fef1e9] transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-[#775a19]" />
              <span>{lang === 'ko' ? '인쇄/저장' : 'Print / Save'}</span>
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-3xl p-12 border border-[#ece0d8] text-center space-y-3 luxury-card-shadow">
          <Loader2 className="w-7 h-7 animate-spin text-[#1b2e24] mx-auto" />
          <p className="text-xs text-[#424844]">
            {lang === 'ko' ? '디지털 바우처를 불러오는 중...' : 'Loading your digital voucher...'}
          </p>
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center space-y-4 luxury-card-shadow">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="font-serif-luxury text-2xl font-medium text-[#061910]">
              {lang === 'ko' ? '기프트 카드를 찾을 수 없습니다' : 'Gift Card Not Found'}
            </h3>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-2.5 rounded-full bg-[#1b2e24] text-white text-xs font-semibold hover:bg-[#061910] transition cursor-pointer"
          >
            {lang === 'ko' ? '돌아가기' : 'Return Home'}
          </button>
        </div>
      )}

      {!loading && card && (
        <div className="space-y-6">
          {/* 상단 테마 카드 */}
          <div
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${design.gradientClass} p-6 sm:p-8 text-[#fff8f5] shadow-2xl border ${design.borderClass} space-y-6`}
          >
            <div className="absolute inset-2.5 rounded-2xl border border-[#e9c176]/25 pointer-events-none" />
            <div className="relative z-10 flex justify-between items-start gap-2">
              <div>
                <span className={`font-serif-luxury text-xl tracking-wider uppercase font-semibold ${design.accentTextClass}`}>
                  K-headspa &amp; wellness
                </span>
                <p className="text-[11px] uppercase tracking-[0.16em] text-stone-300 mt-0.5">
                  {design.headlineEn}
                </p>
              </div>
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
            </div>

            <div className="relative z-10">
              <span className="text-[11px] uppercase tracking-[0.14em] text-stone-300/85 block">
                {lang === 'ko' ? '현재 사용 가능 잔액' : 'Available Balance'}
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="font-serif-luxury text-5xl font-semibold text-white tracking-tight">
                  ${card.currentBalance.toFixed(2)}
                </span>
                <span className="text-xs text-stone-300">
                  / ${card.initialBalance.toFixed(2)} {lang === 'ko' ? '원금' : 'initial'}
                </span>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-3 text-xs border-t border-[#ffdea5]/20 pt-4 text-stone-200">
              <div>
                <span className="text-[10px] uppercase text-stone-400 block">
                  {lang === 'ko' ? '받는 분 / 보내는 분' : 'Recipient / From'}
                </span>
                <span className="font-medium">
                  {card.recipientMaskedName}
                  {card.senderMaskedName ? ` · From ${card.senderMaskedName}` : ''}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-stone-400 flex items-center justify-end gap-1">
                  <Calendar className="w-3 h-3 text-[#e9c176]" />
                  {lang === 'ko' ? '만료일 (2년 유효)' : 'Valid Through'}
                </span>
                <span className="font-mono font-semibold text-[#ffdea5]">
                  {new Date(card.expiresAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* 스캔용 고대비 바코드 & QR 패드 */}
          <div className="bg-white rounded-3xl p-6 border border-[#ece0d8] luxury-card-shadow space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#775a19] block">
                  In-Store Checkout Pass
                </span>
                <h3 className="font-serif-luxury text-xl font-medium text-[#061910]">
                  {lang === 'ko'
                    ? '매장 카운터 스캔용 바코드 & QR'
                    : 'Scan Barcode or QR at Checkout'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#c2c8c2] bg-[#fef1e9] text-xs font-mono font-bold text-[#061910] hover:bg-[#f8ece4] transition cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-[#775a19]" />}
                <span>{card.code}</span>
              </button>
            </div>

            <div className="bg-white border border-[#ece0d8] rounded-2xl p-4 flex flex-col items-center gap-4">
              {card.barcodeDataUrl && (
                <div className="w-full flex justify-center bg-white p-2 rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.barcodeDataUrl}
                    alt={`Barcode ${card.code}`}
                    className="max-w-full h-auto"
                  />
                </div>
              )}

              {card.qrCodeDataUrl && (
                <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-[#ece0d8] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.qrCodeDataUrl}
                    alt={`QR ${card.code}`}
                    className="w-32 h-32 p-1.5 border border-[#ece0d8] rounded-xl bg-white"
                  />
                  <span className="text-[11px] text-[#737874]">
                    {lang === 'ko' ? '직원 POS 카메라 QR 스캔 가능' : 'QR code for mobile POS scan'}
                  </span>
                </div>
              )}
            </div>

            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-full bg-[#1b2e24] hover:bg-[#061910] text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-md print:hidden"
            >
              <span>Book a service</span>
              <ExternalLink className="w-4 h-4 text-[#ffdea5]" />
            </a>

            {/* 사용 안내 */}
            <div className="bg-[#fef1e9] rounded-2xl p-4 border border-[#ece0d8] text-xs text-[#424844] space-y-1.5 leading-relaxed">
              <strong className="text-[#061910] block">How to use it:</strong>
              <p>
                Present this barcode or 16-character redemption code at check-in across{' '}
                <strong>Manhattan</strong>, <strong>Norwood</strong>, and <strong>Fort Lee</strong>.
                Balances may be redeemed across multiple visits within 2 years of purchase.
              </p>
            </div>
          </div>

          {/* 거래 내역 */}
          <div className="bg-white rounded-3xl p-6 border border-[#ece0d8] luxury-card-shadow space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-[#061910] uppercase tracking-[0.12em] flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#775a19]" />
                <span>{lang === 'ko' ? '사용 및 충전 이력' : 'Transaction History'}</span>
              </h4>
              <span className="text-[11px] text-[#737874]">{transactions.length} records</span>
            </div>

            <div className="space-y-2">
              {transactions.length === 0 ? (
                <p className="text-xs text-[#424844] text-center py-4 bg-[#fef1e9] rounded-xl">
                  {lang === 'ko' ? '거래 내역이 없습니다.' : 'No transactions recorded yet.'}
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
  );
}
