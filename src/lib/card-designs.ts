import { GiftCardDesignId } from '@/types/gift-card';

export interface CardDesign {
  id: GiftCardDesignId;
  labelEn: string;
  labelKo: string;
  badgeEn: string;
  badgeKo: string;
  headlineEn: string;
  gradientClass: string;
  borderClass: string;
  accentTextClass: string;
  emailBgGradient: string;
  emailTextColor: string;
  emailAccentColor: string;
}

export const CARD_DESIGNS: CardDesign[] = [
  {
    id: 'signature-gold',
    labelEn: 'Signature Black & Gold',
    labelKo: '시그니처 블랙 & 골드',
    badgeEn: 'Signature Pass',
    badgeKo: '시그니처 패스',
    headlineEn: 'Digital Spa Ritual Pass',
    gradientClass: 'from-[#1C1917] via-[#2A2624] to-[#141211]',
    borderClass: 'border-stone-800',
    accentTextClass: 'text-amber-200',
    emailBgGradient: 'linear-gradient(135deg, #1C1917 0%, #2A2624 55%, #141211 100%)',
    emailTextColor: '#FBF9F5',
    emailAccentColor: '#FCD34D',
  },
  {
    id: 'holiday-emerald',
    labelEn: 'Happy Holidays',
    labelKo: '해피 홀리데이',
    badgeEn: 'Holiday Edition',
    badgeKo: '홀리데이 에디션',
    headlineEn: 'Happy Holidays',
    gradientClass: 'from-[#0E2F26] via-[#154538] to-[#0A221B]',
    borderClass: 'border-emerald-900',
    accentTextClass: 'text-amber-200',
    emailBgGradient: 'linear-gradient(135deg, #0E2F26 0%, #154538 55%, #0A221B 100%)',
    emailTextColor: '#FBF9F5',
    emailAccentColor: '#FDE68A',
  },
  {
    id: 'happy-birthday',
    labelEn: 'Happy Birthday',
    labelKo: '생일 축하합니다',
    badgeEn: 'Birthday Gift',
    badgeKo: '생일 축하 기프트',
    headlineEn: 'Happy Birthday',
    gradientClass: 'from-[#3D242C] via-[#59333F] to-[#2B171D]',
    borderClass: 'border-rose-900/60',
    accentTextClass: 'text-rose-200',
    emailBgGradient: 'linear-gradient(135deg, #3D242C 0%, #59333F 55%, #2B171D 100%)',
    emailTextColor: '#FFF8F6',
    emailAccentColor: '#FECDD3',
  },
  {
    id: 'thank-you',
    labelEn: 'Thank You',
    labelKo: '감사합니다',
    badgeEn: 'With Gratitude',
    badgeKo: '감사의 마음',
    headlineEn: 'Thank You',
    gradientClass: 'from-[#2A332A] via-[#3E4C3D] to-[#1D241D]',
    borderClass: 'border-emerald-950/60',
    accentTextClass: 'text-amber-100',
    emailBgGradient: 'linear-gradient(135deg, #2A332A 0%, #3E4C3D 55%, #1D241D 100%)',
    emailTextColor: '#FBF9F5',
    emailAccentColor: '#E7D4B5',
  },
  {
    id: 'congratulations',
    labelEn: 'Congratulations',
    labelKo: '축하합니다',
    badgeEn: 'Celebration',
    badgeKo: '축하 선물',
    headlineEn: 'Congratulations',
    gradientClass: 'from-[#1B253B] via-[#2B3B5E] to-[#111827]',
    borderClass: 'border-slate-700',
    accentTextClass: 'text-amber-200',
    emailBgGradient: 'linear-gradient(135deg, #1B253B 0%, #2B3B5E 55%, #111827 100%)',
    emailTextColor: '#F8FAFC',
    emailAccentColor: '#FDE68A',
  },
  {
    id: 'parents-day',
    labelEn: "Happy Parents' Day",
    labelKo: '부모님 감사합니다',
    badgeEn: 'Family Wellness',
    badgeKo: '효도 선물',
    headlineEn: "Happy Parents' Day",
    gradientClass: 'from-[#423222] via-[#5C4732] to-[#2E2216]',
    borderClass: 'border-amber-900/60',
    accentTextClass: 'text-amber-100',
    emailBgGradient: 'linear-gradient(135deg, #423222 0%, #5C4732 55%, #2E2216 100%)',
    emailTextColor: '#FFFBEB',
    emailAccentColor: '#FCD34D',
  },
  {
    id: 'wellness-retreat',
    labelEn: 'Pure Spa Retreat',
    labelKo: '프리미엄 스파 힐링',
    badgeEn: 'Head Spa Ritual',
    badgeKo: '스파 힐링',
    headlineEn: 'Pure Spa Retreat',
    gradientClass: 'from-[#2D3839] via-[#3F4E4F] to-[#1F2728]',
    borderClass: 'border-teal-950/60',
    accentTextClass: 'text-teal-100',
    emailBgGradient: 'linear-gradient(135deg, #2D3839 0%, #3F4E4F 55%, #1F2728 100%)',
    emailTextColor: '#F8FAFC',
    emailAccentColor: '#A7F3D0',
  },
  {
    id: 'for-you-rose',
    labelEn: 'Especially For You',
    labelKo: '소중한 당신께',
    badgeEn: 'Warm Wishes',
    badgeKo: '따뜻한 선물',
    headlineEn: 'Especially For You',
    gradientClass: 'from-[#4A2C2A] via-[#6B3F3B] to-[#361E1C]',
    borderClass: 'border-amber-900/50',
    accentTextClass: 'text-amber-100',
    emailBgGradient: 'linear-gradient(135deg, #4A2C2A 0%, #6B3F3B 55%, #361E1C 100%)',
    emailTextColor: '#FFF8F6',
    emailAccentColor: '#FDE68A',
  },
];

export function getCardDesign(id?: string): CardDesign {
  return CARD_DESIGNS.find((d) => d.id === id) || CARD_DESIGNS[0];
}
