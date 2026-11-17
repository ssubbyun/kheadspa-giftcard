const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 스캐너 입력(하이픈 생략, 전체 바우처 URL 등)을 표준 기프트 카드 코드(KSPA-XXXX-XXXX-XXXX)로 정규화합니다.
 */
export function normalizeGiftCardCode(raw: string): string {
  let value = (raw || '').trim();
  if (!value) return '';

  // 바우처 URL인 경우 ?card= 파라미터 추출
  if (/^https?:\/\//i.test(value) || value.includes('card=')) {
    try {
      const parsed = new URL(value.startsWith('http') ? value : `https://example.com/${value.replace(/^\/+/, '')}`);
      const cardParam = parsed.searchParams.get('card');
      if (cardParam) {
        value = cardParam.trim();
      }
    } catch {
      const match = value.match(/[?&]card=([^&]+)/i);
      if (match?.[1]) {
        value = decodeURIComponent(match[1]).trim();
      }
    }
  }

  const compact = value.replace(/\s+/g, '').toUpperCase();
  const compact16 = compact.match(/^KSPA([A-Z0-9]{4})([A-Z0-9]{4})([A-Z0-9]{4})$/);
  if (compact16) {
    return `KSPA-${compact16[1]}-${compact16[2]}-${compact16[3]}`;
  }

  return compact;
}

/**
 * 미국/국제 전화번호를 E.164(+1XXXXXXXXXX) 형식으로 정규화합니다.
 */
export function normalizeUsPhone(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length >= 8 && digits.length <= 15) {
      return `+${digits}`;
    }
    return undefined;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  return undefined;
}

/**
 * ISO/IEC 15417 Code 128B 규격 1D 바코드 SVG 문자열을 생성합니다.
 */
export function generateCode128Svg(
  text: string,
  opts?: { height?: number; moduleWidth?: number; showText?: boolean }
): string {
  const height = opts?.height ?? 68;
  const moduleWidth = opts?.moduleWidth ?? 2;
  const showText = opts?.showText ?? true;

  const cleanText = (text || '').trim();
  if (!cleanText) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"></svg>';
  }

  const START_CODE_B = 104;
  const STOP_CODE = 106;

  const symbols: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < cleanText.length; i++) {
    const charCode = cleanText.charCodeAt(i);
    if (charCode < 32 || charCode > 126) {
      throw new Error(`Unsupported character for Code 128B: "${cleanText[i]}"`);
    }
    const code = charCode - 32;
    symbols.push(code);
    checksum += code * (i + 1);
  }

  symbols.push(checksum % 103);
  symbols.push(STOP_CODE);

  const quietModules = 10;
  const barPatterns = symbols.map((idx) => CODE128_PATTERNS[idx]);
  let totalModules = quietModules * 2;
  for (const pat of barPatterns) {
    for (let i = 0; i < pat.length; i++) {
      totalModules += Number(pat[i]);
    }
  }

  const totalWidth = totalModules * moduleWidth;
  const paddingTop = 8;
  const textHeight = showText ? 22 : 8;
  const totalHeight = paddingTop + height + textHeight;

  const rects: string[] = [];
  let cursor = quietModules;

  for (const pat of barPatterns) {
    for (let i = 0; i < pat.length; i++) {
      const widthModules = Number(pat[i]);
      const isBar = i % 2 === 0;
      if (isBar) {
        rects.push(
          `<rect x="${cursor * moduleWidth}" y="${paddingTop}" width="${widthModules * moduleWidth}" height="${height}" fill="#111111" />`
        );
      }
      cursor += widthModules;
    }
  }

  const textNode = showText
    ? `<text x="${totalWidth / 2}" y="${paddingTop + height + 16}" text-anchor="middle" font-family="monospace" font-size="13" font-weight="700" letter-spacing="1.5" fill="#1A1816">${escapeXml(cleanText)}</text>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" role="img" aria-label="${escapeXml(cleanText)}">`,
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="#FFFFFF" />`,
    ...rects,
    textNode,
    `</svg>`,
  ]
    .filter(Boolean)
    .join('');
}

/**
 * Code 128B 바코드의 base64 SVG Data URL을 생성합니다.
 */
export function generateCode128DataUrl(
  text: string,
  opts?: { height?: number; moduleWidth?: number; showText?: boolean }
): string {
  const svg = generateCode128Svg(text, opts);
  if (typeof Buffer !== 'undefined') {
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
  }
  const encoded = encodeURIComponent(svg);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
