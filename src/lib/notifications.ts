import { DeliveryStatus, GiftCard } from '@/types/gift-card';
import { getCardDesign } from './card-designs';
import {
  generateCode128DataUrl,
  getErrorMessage,
  isTestEnvironment,
  normalizeUsPhone,
} from './barcode';
import {
  getAppBaseUrl,
  getTodayEstDateString,
  getVoucherUrl,
  isFutureScheduledDate,
  updateGiftCardDeliveryAsync,
} from './storage';

export { getTodayEstDateString, isFutureScheduledDate };

export interface ChannelDispatchResult {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export interface NotificationDispatchSummary {
  deliveryStatus: DeliveryStatus;
  scheduledFor?: string;
  email: ChannelDispatchResult;
  sms: ChannelDispatchResult;
  buyerReceipt?: ChannelDispatchResult;
}

function getBookingUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BOOKING_URL || 'https://kheadspawellness.glossgenius.com'
  ).replace(/\/+$/, '');
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasResendKey(): string | null {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key || key.includes('sample') || key.includes('placeholder')) {
    return null;
  }
  return key;
}

function getTwilioCredentials(): {
  accountSid: string;
  authToken: string;
  fromNumber: string;
} | null {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = (process.env.TWILIO_FROM_NUMBER || '').trim();

  if (
    !accountSid ||
    !authToken ||
    !fromNumber ||
    accountSid.includes('sample') ||
    accountSid.includes('placeholder')
  ) {
    return null;
  }
  return { accountSid, authToken, fromNumber };
}

function buildRecipientEmailHtml(card: GiftCard): string {
  const design = getCardDesign(card.designId);
  const voucherUrl = getVoucherUrl(card.code);
  const bookingUrl = getBookingUrl();
  const appUrl = getAppBaseUrl();
  const barcodeSrc = card.barcodeDataUrl || generateCode128DataUrl(card.code);
  const headline =
    card.recipientType === 'gift'
      ? `${escapeHtml(card.buyerName)} sent you a gift card`
      : 'Your K-headspa &amp; wellness Gift Card';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>K-headspa &amp; wellness Gift Card</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#FBF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1816;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #EBE7DF;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(26,24,22,0.06);">
    <div style="background:${design.emailBgGradient};padding:28px 24px;text-align:center;color:${design.emailTextColor};">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${design.emailAccentColor};font-weight:700;margin-bottom:8px;">
        K-headspa &amp; wellness
      </div>
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:600;line-height:1.25;">
        ${escapeHtml(design.headlineEn)}
      </div>
    </div>

    <div style="padding:28px 24px;">
      <h1 style="margin:0 0 22px;font-size:24px;line-height:1.3;font-weight:700;text-align:center;color:#1A1816;">
        ${headline}
      </h1>

      <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:22px;font-size:14px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;color:#6E675F;width:140px;">Gift card value</td>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;font-weight:700;font-size:16px;color:#1A1816;">$${card.initialBalance.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;color:#6E675F;">Redemption code</td>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;font-family:monospace;font-weight:700;font-size:15px;letter-spacing:0.5px;color:#1A1816;">${escapeHtml(card.code)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;color:#6E675F;">Purchaser</td>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;font-weight:600;color:#1A1816;">${escapeHtml(card.buyerName)}</td>
        </tr>
        ${
          card.message
            ? `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;color:#6E675F;vertical-align:top;">Message</td>
          <td style="padding:10px 0;border-bottom:1px solid #F0ECE4;color:#1A1816;">${escapeHtml(card.message)}</td>
        </tr>`
            : ''
        }
        <tr>
          <td style="padding:10px 0;color:#6E675F;">Validity</td>
          <td style="padding:10px 0;font-weight:600;color:#047857;">No Expiration (Unlimited Validity)</td>
        </tr>
      </table>

      <div style="background:#FAF7F2;border:1px solid #EBE7DF;border-radius:14px;padding:18px;text-align:center;margin-bottom:22px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#6E675F;font-weight:700;margin-bottom:10px;">
          Scan Barcode at Checkout
        </div>
        <img src="${barcodeSrc}" alt="Gift card barcode ${escapeHtml(card.code)}" style="max-width:100%;height:auto;border-radius:6px;background:#FFFFFF;padding:6px;" />
        ${
          card.qrCodeDataUrl
            ? `<div style="margin-top:12px;">
          <img src="${card.qrCodeDataUrl}" alt="Gift card QR code" width="110" height="110" style="border-radius:8px;border:1px solid #E5E0D8;background:#FFFFFF;padding:4px;" />
        </div>`
            : ''
        }
      </div>

      <div style="margin-bottom:12px;">
        <a href="${escapeHtml(bookingUrl)}" style="display:block;width:100%;box-sizing:border-box;padding:15px 20px;border-radius:999px;background-color:#111111;color:#FFFFFF;text-decoration:none;text-align:center;font-weight:700;font-size:15px;">
          Book a service
        </a>
      </div>

      <div style="margin-bottom:24px;">
        <a href="${escapeHtml(voucherUrl)}" style="display:block;width:100%;box-sizing:border-box;padding:13px 20px;border-radius:999px;border:1.5px solid #1A1816;color:#1A1816;text-decoration:none;text-align:center;font-weight:600;font-size:14px;">
          Open Barcode Voucher &amp; Balance
        </a>
      </div>

      <div style="border-top:1px solid #EBE7DF;padding-top:18px;font-size:12px;line-height:1.6;color:#57534E;">
        <strong style="display:block;color:#1A1816;margin-bottom:4px;">How to use it:</strong>
        Present this barcode or redemption code at check-in across our <strong>Manhattan</strong>, <strong>Norwood</strong>, and <strong>Fort Lee</strong> studios. Remaining balances never expire and carry over across visits.<br />
        매장 방문 시 위 바코드 또는 16자리 코드를 카운터에 제시해 주세요. 잔액은 유효기간 제한 없이 분할 사용 가능합니다.<br />
        <span style="display:inline-block;margin-top:8px;color:#78716C;">Check balance anytime at <a href="${escapeHtml(appUrl)}" style="color:#92400E;">${escapeHtml(appUrl)}</a></span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildBuyerReceiptHtml(card: GiftCard, isScheduledFuture: boolean): string {
  const voucherUrl = getVoucherUrl(card.code);
  const deliveryLine = isScheduledFuture
    ? `Scheduled for delivery on <strong>${escapeHtml(card.scheduledDeliveryDate || '')} at 8:00 AM EST</strong>.`
    : `Delivered to <strong>${escapeHtml(card.recipientEmail || card.buyerEmail)}</strong>.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px 12px;background-color:#FBF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1816;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #EBE7DF;border-radius:16px;padding:24px;">
    <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#92400E;font-weight:700;">Purchase Confirmation</div>
    <h2 style="margin:6px 0 14px;font-size:20px;color:#1A1816;">Thank you for your gift card order, ${escapeHtml(card.buyerName)}</h2>
    <p style="font-size:14px;line-height:1.6;color:#44403C;">${deliveryLine}</p>
    <div style="background:#FAF7F2;border-radius:12px;padding:16px;font-size:13px;line-height:1.7;margin:16px 0;">
      <div><strong>Card Value:</strong> $${card.initialBalance.toFixed(2)}</div>
      <div><strong>Amount Paid (Stripe):</strong> $${card.paidAmount.toFixed(2)}</div>
      <div><strong>Recipient:</strong> ${escapeHtml(card.recipientName || card.buyerName)}</div>
      <div><strong>Gift Code:</strong> <span style="font-family:monospace;font-weight:700;">${escapeHtml(card.code)}</span></div>
    </div>
    <a href="${escapeHtml(voucherUrl)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1A1816;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;">View Digital Voucher</a>
    <p style="font-size:11px;color:#78716C;margin-top:18px;">Gift card sales are final and non-refundable.</p>
  </div>
</body>
</html>`;
}

async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<ChannelDispatchResult> {
  const apiKey = hasResendKey();
  if (!apiKey) {
    return { sent: false, skipped: true, reason: 'RESEND_API_KEY not configured' };
  }

  const from =
    (process.env.EMAIL_FROM || '').trim() ||
    'K-headspa & wellness <noreply@kheadspawellness.com>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, error: `Resend API ${res.status}: ${errText}` };
    }

    return { sent: true };
  } catch (err: unknown) {
    return { sent: false, error: getErrorMessage(err, 'Resend request failed') };
  }
}

async function sendTwilioSms(params: {
  to?: string;
  body: string;
}): Promise<ChannelDispatchResult> {
  const creds = getTwilioCredentials();
  if (!creds) {
    return { sent: false, skipped: true, reason: 'Twilio credentials not configured' };
  }

  const normalizedTo = normalizeUsPhone(params.to);
  if (!normalizedTo) {
    return { sent: false, skipped: true, reason: 'No valid recipient phone number' };
  }

  try {
    const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
    const form = new URLSearchParams({
      To: normalizedTo,
      From: creds.fromNumber,
      Body: params.body,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { sent: false, error: `Twilio API ${res.status}: ${errText}` };
    }

    return { sent: true };
  } catch (err: unknown) {
    return { sent: false, error: getErrorMessage(err, 'Twilio request failed') };
  }
}

export async function dispatchGiftCardNotifications(
  card: GiftCard,
  opts?: { forceImmediate?: boolean }
): Promise<NotificationDispatchSummary> {
  const isFuture = !opts?.forceImmediate && isFutureScheduledDate(card.scheduledDeliveryDate);
  const recipientEmail = (card.recipientEmail || card.buyerEmail || '').trim();
  const recipientPhone = card.recipientPhone || (card.recipientType === 'self' ? card.buyerPhone : undefined);

  const subjectPrefix = isTestEnvironment() ? '[TEST] ' : '';

  if (isFuture) {
    let buyerReceipt: ChannelDispatchResult | undefined;
    if (card.buyerEmail) {
      buyerReceipt = await sendResendEmail({
        to: card.buyerEmail,
        subject: `${subjectPrefix}[K-headspa & wellness] Gift Card Order Scheduled (${card.scheduledDeliveryDate})`,
        html: buildBuyerReceiptHtml(card, true),
      });
    }

    await updateGiftCardDeliveryAsync(card.code, {
      deliveryStatus: 'PENDING_SCHEDULED',
    });

    return {
      deliveryStatus: 'PENDING_SCHEDULED',
      scheduledFor: card.scheduledDeliveryDate,
      email: { sent: false, skipped: true, reason: `Scheduled for ${card.scheduledDeliveryDate} 8:00 AM EST` },
      sms: { sent: false, skipped: true, reason: `Scheduled for ${card.scheduledDeliveryDate} 8:00 AM EST` },
      buyerReceipt,
    };
  }

  // 즉시 발송 처리 (이메일 + SMS 동시 시도)
  const recipientSubject =
    card.recipientType === 'gift'
      ? `${card.buyerName} sent you a $${card.initialBalance.toFixed(0)} K-headspa & wellness Gift Card`
      : `Your $${card.initialBalance.toFixed(0)} K-headspa & wellness Gift Card`;

  const emailPromise = recipientEmail
    ? sendResendEmail({
        to: recipientEmail,
        subject: `${subjectPrefix}${recipientSubject}`,
        html: buildRecipientEmailHtml(card),
      })
    : Promise.resolve<ChannelDispatchResult>({
        sent: false,
        skipped: true,
        reason: 'No recipient email',
      });

  const voucherUrl = getVoucherUrl(card.code);
  const smsBody =
    card.recipientType === 'gift'
      ? `${subjectPrefix}[K-headspa & wellness] ${card.buyerName} sent you a $${card.initialBalance.toFixed(2)} Gift Card! Code: ${card.code}. Show barcode at checkout or book a service: ${voucherUrl}`
      : `${subjectPrefix}[K-headspa & wellness] Your $${card.initialBalance.toFixed(2)} Gift Card is ready! Code: ${card.code}. Show barcode or book a service: ${voucherUrl}`;

  const smsPromise = sendTwilioSms({
    to: recipientPhone,
    body: smsBody,
  });

  const buyerReceiptPromise =
    card.recipientType === 'gift' &&
    card.buyerEmail &&
    card.buyerEmail.toLowerCase() !== recipientEmail.toLowerCase()
      ? sendResendEmail({
          to: card.buyerEmail,
          subject: `${subjectPrefix}[K-headspa & wellness] Gift Card Receipt & Delivery Confirmation`,
          html: buildBuyerReceiptHtml(card, false),
        })
      : Promise.resolve<ChannelDispatchResult | undefined>(undefined);

  const [emailRes, smsRes, buyerReceipt] = await Promise.all([
    emailPromise,
    smsPromise,
    buyerReceiptPromise,
  ]);

  const nowIso = new Date().toISOString();
  const attemptedResults = [emailRes, smsRes].filter((r) => !r.skipped);
  let deliveryStatus: DeliveryStatus;

  if (attemptedResults.length === 0) {
    deliveryStatus = 'SKIPPED_NO_CREDENTIALS';
  } else {
    const anySuccess = attemptedResults.some((r) => r.sent);
    const anyFailure = attemptedResults.some((r) => !r.sent);
    if (anySuccess && !anyFailure) {
      deliveryStatus = 'SENT';
    } else if (anySuccess && anyFailure) {
      deliveryStatus = 'PARTIAL';
    } else {
      deliveryStatus = 'FAILED';
    }
  }

  await updateGiftCardDeliveryAsync(card.code, {
    deliveryStatus,
    ...(emailRes.sent ? { emailSentAt: nowIso } : {}),
    ...(smsRes.sent ? { smsSentAt: nowIso } : {}),
  });

  return {
    deliveryStatus,
    email: emailRes,
    sms: smsRes,
    ...(buyerReceipt ? { buyerReceipt } : {}),
  };
}
