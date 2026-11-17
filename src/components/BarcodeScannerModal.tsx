'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';
import { normalizeGiftCardCode } from '@/lib/barcode';

interface BarcodeScannerModalProps {
  lang: 'ko' | 'en';
  onDetected: (normalizedCode: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({
  lang,
  onDetected,
  onClose,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let rafId = 0;

    async function startScanner() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error(
            lang === 'ko'
              ? '이 브라우저는 카메라 스캔을 지원하지 않습니다. HTTPS 환경 또는 바코드 리더기를 이용해 주세요.'
              : 'Camera scanning requires HTTPS and a compatible browser.'
          );
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setInitializing(false);

        const DetectorCtor = (window as any).BarcodeDetector;
        const detector = DetectorCtor
          ? new DetectorCtor({ formats: ['code_128', 'qr_code'] })
          : null;

        const scanFrame = async () => {
          if (!active) return;
          const v = videoRef.current;
          const canvas = canvasRef.current;
          if (v && v.readyState >= 2) {
            if (detector) {
              try {
                const barcodes = await detector.detect(v);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  const normalized = normalizeGiftCardCode(barcodes[0].rawValue);
                  if (normalized) {
                    onDetected(normalized);
                    return;
                  }
                }
              } catch {
                // Fall back to jsQR below
              }
            }

            if (canvas && v.videoWidth > 0 && v.videoHeight > 0) {
              canvas.width = v.videoWidth;
              canvas.height = v.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const qr = jsQR(imgData.data, imgData.width, imgData.height);
                if (qr?.data) {
                  const normalized = normalizeGiftCardCode(qr.data);
                  if (normalized) {
                    onDetected(normalized);
                    return;
                  }
                }
              }
            }
          }
          rafId = requestAnimationFrame(scanFrame);
        };

        rafId = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        if (active) {
          setInitializing(false);
          setError(
            err?.message ||
              (lang === 'ko' ? '카메라를 시작할 수 없습니다.' : 'Unable to start camera.')
          );
        }
      }
    }

    startScanner();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [lang, onDetected]);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-700" />
            <h3 className="text-sm font-bold text-stone-900">
              {lang === 'ko' ? '바코드 / QR 코드 스캔' : 'Scan Barcode or QR Code'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden bg-stone-900 aspect-[4/3] flex items-center justify-center">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {initializing && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-xs gap-2 bg-stone-900/70">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{lang === 'ko' ? '카메라 준비 중...' : 'Starting camera...'}</span>
            </div>
          )}

          {!initializing && !error && (
            <div className="pointer-events-none absolute inset-8 border-2 border-amber-400/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-[11px] text-stone-500 text-center">
          {lang === 'ko'
            ? '고객 휴대폰 화면의 바코드 또는 QR 코드를 사각형 안에 맞춰 주세요. (iOS Safari는 QR 스캔 자동 지원)'
            : 'Align the customer barcode or QR code inside the frame.'}
        </p>
      </div>
    </div>
  );
}
