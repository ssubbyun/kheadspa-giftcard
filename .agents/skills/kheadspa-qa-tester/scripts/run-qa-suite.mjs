import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, execSync } from 'child_process';
import { createRequire } from 'module';

const ROOT_DIR = process.cwd();
const require = createRequire(path.join(ROOT_DIR, 'package.json'));
const esbuild = require('esbuild');

const INVARIANTS_PATH = path.join(ROOT_DIR, '.agents', 'memory', 'system-invariants.json');
const REPORTS_DIR = path.join(ROOT_DIR, '.agents', 'reports');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf-8');
}

function listFilesRecursive(dir, extFilter) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, extFilter));
    } else if (!extFilter || extFilter.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function buildIsolatedRunnerScript() {
  return `
const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTests() {
  const results = [];
  async function test(id, name, fn) {
    const started = Date.now();
    try {
      await fn();
      results.push({ id, name, status: 'PASS', durationMs: Date.now() - started });
    } catch (err) {
      results.push({
        id,
        name,
        status: 'FAIL',
        durationMs: Date.now() - started,
        error: err && err.stack ? err.stack : String(err),
      });
    }
  }

  let mod = require('./bundle.cjs');
  // Allow seedInitialCard() if running on fresh tmp dir
  await new Promise((r) => setTimeout(r, 80));

  await test('QA-01', '20% promotion discount calculation precision', async () => {
    const calc200 = mod.calculatePromotionDiscount(200);
    assert.strictEqual(calc200.faceValue, 200);
    if (calc200.isPromoActive) {
      assert.strictEqual(calc200.discountRate, 20);
      assert.strictEqual(calc200.discountAmount, 40);
      assert.strictEqual(calc200.chargeAmount, 160);
    }
    const calc150 = mod.calculatePromotionDiscount(150);
    if (calc150.isPromoActive) {
      assert.strictEqual(calc150.chargeAmount, 120);
    }
  });

  await test('QA-02', 'CODE128B SVG & base64 Data URL generation and non-ASCII rejection', async () => {
    const svg = mod.generateCode128Svg('KSPA-8F2A-99B4-102C');
    assert(svg.startsWith('<svg') && svg.includes('<rect') && svg.includes('KSPA-8F2A-99B4-102C'));
    const dataUrl = mod.generateCode128DataUrl('KSPA-8F2A-99B4-102C');
    assert(dataUrl.startsWith('data:image/svg+xml;base64,'));
    assert.throws(() => mod.generateCode128Svg('KSPA-한글-TEST'), /Unsupported character/);
  });

  await test('QA-03', 'Gift card code normalization (compact, lowercase, voucher URL)', async () => {
    assert.strictEqual(mod.normalizeGiftCardCode('kspa8f2a99b4102c'), 'KSPA-8F2A-99B4-102C');
    assert.strictEqual(mod.normalizeGiftCardCode('test1234abcd5678'), 'TEST-1234-ABCD-5678');
    assert.strictEqual(
      mod.normalizeGiftCardCode('https://gift.kheadspawellness.com/?card=kspa-8f2a-99b4-102c'),
      'KSPA-8F2A-99B4-102C'
    );
    assert.strictEqual(
      mod.normalizeGiftCardCode('https://gift.kheadspawellness.com/?card=KSPA8F2A99B4102C'),
      'KSPA-8F2A-99B4-102C'
    );
  });

  await test('QA-04', 'US and international phone normalization', async () => {
    assert.strictEqual(mod.normalizeUsPhone('201-555-0123'), '+12015550123');
    assert.strictEqual(mod.normalizeUsPhone('1 (201) 555-0123'), '+12015550123');
    assert.strictEqual(mod.normalizeUsPhone('+821012345678'), '+821012345678');
    assert.strictEqual(mod.normalizeUsPhone('   '), undefined);
  });

  await test('QA-05', '8 card designs catalog and fallback', async () => {
    assert.strictEqual(mod.CARD_DESIGNS.length, 8);
    assert.strictEqual(mod.getCardDesign('happy-birthday').headlineEn, 'Happy Birthday');
    assert.strictEqual(mod.getCardDesign('non-existent-theme').id, 'signature-gold');
  });

  let issuedCode = '';
  const piId = 'pi_qa_test_0001';

  await test('QA-06', 'Issue gift card with unlimited validity (expiresAt: null), QR voucher URL, and 1D barcode', async () => {
    const card = await mod.issueGiftCard({
      faceValue: 200,
      paidAmount: 160,
      designId: 'happy-birthday',
      buyerName: 'June Cho',
      buyerEmail: 'june@example.com',
      buyerPhone: '201-555-0100',
      recipientType: 'gift',
      recipientName: 'Eunsook',
      recipientEmail: 'eunsook@example.com',
      recipientPhone: '201-555-0199',
      message: 'Happy Birthday!',
      stripePaymentIntentId: piId,
    });
    issuedCode = card.code;
    assert(card.code.startsWith('KSPA-'), 'Code format mismatch');
    assert.strictEqual(card.currentBalance, 200);
    assert.strictEqual(card.recipientPhone, '+12015550199');
    assert(card.qrCodeDataUrl && card.qrCodeDataUrl.startsWith('data:image/png;base64,'));
    assert(card.barcodeDataUrl && card.barcodeDataUrl.startsWith('data:image/svg+xml;base64,'));
    assert.strictEqual(card.expiresAt, null, 'Gift card must have unlimited validity (expiresAt: null)');
  });

  await test('QA-07', 'Prevent duplicate issuance for same PaymentIntent ID', async () => {
    await assert.rejects(
      () =>
        mod.issueGiftCard({
          faceValue: 200,
          paidAmount: 160,
          buyerName: 'June Cho',
          buyerEmail: 'june@example.com',
          recipientType: 'self',
          stripePaymentIntentId: piId,
        }),
      /PaymentIntent/
    );
  });

  await test('QA-08', 'Lookup via compact code and partial redemption ($200 - $150 = $50)', async () => {
    const compactCode = issuedCode.replace(/-/g, '');
    const lookup = await mod.getGiftCardByCodeAsync(compactCode);
    assert(lookup.card, 'Card should be found via compact code');
    assert.strictEqual(lookup.card.currentBalance, 200);

    const redeemRes = await mod.redeemGiftCardAsync({
      code: compactCode,
      redeemAmount: 150,
      location: 'Manhattan',
      staffName: 'Tester',
      staffNote: 'QA Partial Redeem',
    });
    assert.strictEqual(redeemRes.success, true);
    assert.strictEqual(redeemRes.remainingBalance, 50);

    const after = await mod.getGiftCardByCodeAsync(issuedCode);
    assert.strictEqual(after.card.currentBalance, 50);
    assert.strictEqual(after.card.status, 'ACTIVE');
    assert.strictEqual(after.transactions.length, 2);
  });

  await test('QA-09', 'Reject over-balance redemption ($60 on $50 balance)', async () => {
    const res = await mod.redeemGiftCardAsync({
      code: issuedCode,
      redeemAmount: 60,
      location: 'Norwood',
      staffName: 'Tester',
    });
    assert.strictEqual(res.success, false);
    const after = await mod.getGiftCardByCodeAsync(issuedCode);
    assert.strictEqual(after.card.currentBalance, 50);
  });

  await test('QA-10', 'Reject zero and negative redemption amounts', async () => {
    const resZero = await mod.redeemGiftCardAsync({
      code: issuedCode,
      redeemAmount: 0,
      location: 'Fort Lee',
      staffName: 'Tester',
    });
    assert.strictEqual(resZero.success, false);

    const resNeg = await mod.redeemGiftCardAsync({
      code: issuedCode,
      redeemAmount: -25,
      location: 'Fort Lee',
      staffName: 'Tester',
    });
    assert.strictEqual(resNeg.success, false);

    const after = await mod.getGiftCardByCodeAsync(issuedCode);
    assert.strictEqual(after.card.currentBalance, 50);
  });

  await test('QA-11', 'Mark card EXHAUSTED at $0 balance and block further redemption', async () => {
    const res = await mod.redeemGiftCardAsync({
      code: issuedCode,
      redeemAmount: 50,
      location: 'Fort Lee',
      staffName: 'Tester',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.remainingBalance, 0);

    const after = await mod.getGiftCardByCodeAsync(issuedCode);
    assert.strictEqual(after.card.status, 'EXHAUSTED');

    const blocked = await mod.redeemGiftCardAsync({
      code: issuedCode,
      redeemAmount: 1,
      location: 'Fort Lee',
      staffName: 'Tester',
    });
    assert.strictEqual(blocked.success, false);
  });

  await test('QA-12', 'Unlimited validity: legacy past expiresAt never expires while CANCELLED status blocks redemption', async () => {
    const expCard = await mod.issueGiftCard({
      faceValue: 100,
      paidAmount: 80,
      buyerName: 'Exp User',
      buyerEmail: 'exp@example.com',
      recipientType: 'self',
      stripePaymentIntentId: 'pi_qa_expired_test',
    });

    const storePath = path.join(process.cwd(), 'data', 'gift_cards_store.json');
    const storeJson = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    storeJson.cards[expCard.code].createdAt = '2015-01-01T00:00:00.000Z';
    storeJson.cards[expCard.code].expiresAt = '2020-01-01T00:00:00.000Z';
    fs.writeFileSync(storePath, JSON.stringify(storeJson, null, 2), 'utf-8');

    delete require.cache[require.resolve('./bundle.cjs')];
    mod = require('./bundle.cjs');
    await new Promise((r) => setTimeout(r, 40));

    const checked = await mod.getGiftCardByCodeAsync(expCard.code);
    assert.strictEqual(checked.card.status, 'ACTIVE');
    assert.strictEqual(checked.card.expiresAt, null);

    const redeemOk = await mod.redeemGiftCardAsync({
      code: expCard.code,
      redeemAmount: 10,
      location: 'Manhattan',
      staffName: 'Tester',
    });
    assert.strictEqual(redeemOk.success, true);
    assert.strictEqual(redeemOk.remainingBalance, 90);

    const cancelledJson = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    cancelledJson.cards[expCard.code].status = 'CANCELLED';
    fs.writeFileSync(storePath, JSON.stringify(cancelledJson, null, 2), 'utf-8');

    delete require.cache[require.resolve('./bundle.cjs')];
    mod = require('./bundle.cjs');
    await new Promise((r) => setTimeout(r, 40));

    const redeemBlocked = await mod.redeemGiftCardAsync({
      code: expCard.code,
      redeemAmount: 10,
      location: 'Manhattan',
      staffName: 'Tester',
    });
    assert.strictEqual(redeemBlocked.success, false);
  });

  await test('QA-13', 'Staff PIN authentication (missing, wrong, and timing-safe match)', async () => {
    const prevPin = process.env.STAFF_PORTAL_PIN;
    delete process.env.STAFF_PORTAL_PIN;
    assert.strictEqual(mod.verifyStaffAuth({ headers: new Headers({ 'x-staff-pin': '1234' }) }).authorized, false);

    process.env.STAFF_PORTAL_PIN = '9876';
    assert.strictEqual(mod.verifyStaffAuth({ headers: new Headers() }).authorized, false);
    assert.strictEqual(mod.verifyStaffAuth({ headers: new Headers({ 'x-staff-pin': '1234' }) }).authorized, false);
    assert.strictEqual(mod.verifyStaffAuth({ headers: new Headers({ 'x-staff-pin': '9876' }) }).authorized, true);
    assert.strictEqual(mod.verifyStaffAuth({ headers: new Headers({ authorization: 'Bearer 9876' }) }).authorized, true);

    if (prevPin === undefined) delete process.env.STAFF_PORTAL_PIN;
    else process.env.STAFF_PORTAL_PIN = prevPin;
  });

  await test('QA-14', 'Graceful SKIPPED_NO_CREDENTIALS when Email/SMS keys are empty', async () => {
    const card = await mod.issueGiftCard({
      faceValue: 100,
      paidAmount: 80,
      buyerName: 'NoKey Buyer',
      buyerEmail: 'nokey@example.com',
      recipientType: 'self',
      stripePaymentIntentId: 'pi_qa_nokey_001',
    });
    const dispatch = await mod.dispatchGiftCardNotifications(card);
    assert.strictEqual(dispatch.deliveryStatus, 'SKIPPED_NO_CREDENTIALS');
    assert.strictEqual(dispatch.email.skipped, true);
    assert.strictEqual(dispatch.sms.skipped, true);

    const updated = await mod.getGiftCardByCodeAsync(card.code);
    assert.strictEqual(updated.card.deliveryStatus, 'SKIPPED_NO_CREDENTIALS');
  });

  await test('QA-15', 'Scheduled future delivery status and due-date query filtering', async () => {
    const schedCard = await mod.issueGiftCard({
      faceValue: 300,
      paidAmount: 240,
      buyerName: 'Sched Buyer',
      buyerEmail: 'sched@example.com',
      recipientType: 'gift',
      recipientName: 'Future Friend',
      recipientEmail: 'future@example.com',
      scheduledDeliveryDate: '2099-12-31',
      stripePaymentIntentId: 'pi_qa_sched_001',
    });
    assert.strictEqual(schedCard.deliveryStatus, 'PENDING_SCHEDULED');

    const notDue = await mod.getDueScheduledGiftCardsAsync('2099-12-30');
    assert(!notDue.some((c) => c.code === schedCard.code), 'Should not appear before scheduled date');

    const due = await mod.getDueScheduledGiftCardsAsync('2099-12-31');
    assert(due.some((c) => c.code === schedCard.code), 'Should appear on or after scheduled date');
  });

  await test('QA-19', 'Reject sub-cent decimal and non-finite redemption amounts', async () => {
    const subCard = await mod.issueGiftCard({
      faceValue: 100,
      paidAmount: 80,
      buyerName: 'Cent Guard',
      buyerEmail: 'cent@example.com',
      recipientType: 'self',
      stripePaymentIntentId: 'pi_qa_subcent_001',
    });
    for (const badAmt of [0.004, 10.999, Number.NaN, Number.POSITIVE_INFINITY]) {
      const res = await mod.redeemGiftCardAsync({
        code: subCard.code,
        redeemAmount: badAmt,
        location: 'Manhattan',
        staffName: 'Tester',
      });
      assert.strictEqual(res.success, false, 'Expected rejection for amount ' + badAmt);
    }
    const after = await mod.getGiftCardByCodeAsync(subCard.code);
    assert.strictEqual(after.card.currentBalance, 100);
  });

  await test('QA-21', 'Validate resend contact inputs (reject invalid email or phone)', async () => {
    assert.strictEqual(typeof mod.validateResendContacts, 'function', 'validateResendContacts must be exported');
    assert.strictEqual(mod.validateResendContacts('', '').valid, true);
    assert.strictEqual(mod.validateResendContacts('invalid-email', '').valid, false);
    assert.strictEqual(mod.validateResendContacts('', '123').valid, false);
    const ok = mod.validateResendContacts('guest@example.com', '201-555-0144');
    assert.strictEqual(ok.valid, true);
    assert.strictEqual(ok.recipientEmail, 'guest@example.com');
    assert.strictEqual(ok.recipientPhone, '+12015550144');
  });

  await test('QA-26', 'Demo checkout HMAC verification, tamper rejection, and auto-disable in prod or with real Stripe key', async () => {
    const prevAllow = process.env.ALLOW_DEMO_CHECKOUT;
    const prevSecret = process.env.STRIPE_SECRET_KEY;
    const prevEnv = process.env.APP_ENV;

    try {
      process.env.APP_ENV = 'staging';
      process.env.ALLOW_DEMO_CHECKOUT = 'true';
      process.env.STRIPE_SECRET_KEY = 'sk_test_sample';
      assert.strictEqual(mod.isDemoCheckoutAllowed(), true);

      const demoIntent = await mod.createStripePaymentIntent({
        amountInDollars: 160,
        faceValue: 200,
        buyerEmail: 'demo-qa@example.com',
        demoMode: true,
      });
      assert.strictEqual(demoIntent.demoMode, true);
      assert(demoIntent.paymentIntentId.startsWith('pi_demo_'));

      const verified = await mod.verifySucceededPaymentIntent({
        paymentIntentId: demoIntent.paymentIntentId,
        expectedChargeDollars: 160,
        expectedFaceValue: 200,
      });
      assert.strictEqual(verified.status, 'succeeded');
      assert.strictEqual(verified.amount, 16000);

      await assert.rejects(
        () =>
          mod.verifySucceededPaymentIntent({
            paymentIntentId: demoIntent.paymentIntentId,
            expectedChargeDollars: 160,
            expectedFaceValue: 500,
          }),
        /액면가/
      );

      await assert.rejects(
        () =>
          mod.verifySucceededPaymentIntent({
            paymentIntentId: demoIntent.paymentIntentId.slice(0, -4) + 'ffff',
            expectedChargeDollars: 160,
            expectedFaceValue: 200,
          }),
        /서명/
      );

      // Production must block demo checkout even with ALLOW_DEMO_CHECKOUT=true and sk_test_sample
      process.env.APP_ENV = 'production';
      assert.strictEqual(mod.isDemoCheckoutAllowed(), false);

      // Back to staging with real Stripe key must also lock out demo mode
      process.env.APP_ENV = 'staging';
      process.env.STRIPE_SECRET_KEY = ['sk', 'live', 'qa_mock_123456789'].join('_');
      assert.strictEqual(mod.isDemoCheckoutAllowed(), false);

      await assert.rejects(
        () =>
          mod.verifySucceededPaymentIntent({
            paymentIntentId: demoIntent.paymentIntentId,
            expectedChargeDollars: 160,
            expectedFaceValue: 200,
          }),
        /비활성화/
      );
    } finally {
      if (prevAllow === undefined) delete process.env.ALLOW_DEMO_CHECKOUT;
      else process.env.ALLOW_DEMO_CHECKOUT = prevAllow;
      if (prevSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prevSecret;
      if (prevEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = prevEnv;
    }
  });

  await test('QA-27', 'Environment isolation: staging TEST- prefix issuance and cross-environment lookup/redeem rejection', async () => {
    const prevEnv = process.env.APP_ENV;
    try {
      process.env.APP_ENV = 'staging';
      const testCard = await mod.issueGiftCard({
        faceValue: 100,
        paidAmount: 80,
        buyerName: 'Staging Tester',
        buyerEmail: 'staging@example.com',
        recipientType: 'self',
        stripePaymentIntentId: 'pi_qa_staging_prefix_001',
      });
      assert(testCard.code.startsWith('TEST-'), 'Staging cards must start with TEST- prefix');
      assert.strictEqual(mod.validateCodeEnvironmentMatch('KSPA-AAAA-BBBB-CCCC').allowed, false);

      const stgLookup = await mod.getGiftCardByCodeAsync(testCard.code);
      assert(stgLookup.card && stgLookup.card.code === testCard.code);

      process.env.APP_ENV = 'production';
      assert.strictEqual(mod.validateCodeEnvironmentMatch(testCard.code).allowed, false);
      const prodLookup = await mod.getGiftCardByCodeAsync(testCard.code);
      assert.strictEqual(prodLookup.card, undefined);

      const prodRedeem = await mod.redeemGiftCardAsync({
        code: testCard.code,
        redeemAmount: 10,
        location: 'Manhattan',
        staffName: 'Tester',
      });
      assert.strictEqual(prodRedeem.success, false);
    } finally {
      if (prevEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = prevEnv;
    }
  });

  process.stdout.write(JSON.stringify(results));
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
}

function runStaticChecks(invariants) {
  const results = [];

  function check(id, name, fn) {
    const started = Date.now();
    try {
      fn();
      results.push({ id, name, status: 'PASS', durationMs: Date.now() - started });
    } catch (err) {
      results.push({
        id,
        name,
        status: 'FAIL',
        durationMs: Date.now() - started,
        error: err && err.message ? err.message : String(err),
      });
    }
  }

  // QA-16: Public /api/gift-cards/check PII exclusion check
  check('QA-16', 'Public check endpoint forbids exposing PII fields in safeCard', () => {
    const nextCheckSrc = readText('src/app/api/gift-cards/check/route.ts');
    const fnSrc = readText('functions/src/index.ts');

    const extractSafeCardBlock = (src, label) => {
      const match = src.match(/const\s+safeCard\s*=\s*\{([\s\S]*?)\};/);
      if (!match) {
        throw new Error(`Could not locate safeCard object in ${label}`);
      }
      return match[1];
    };

    const nextSafeCard = extractSafeCardBlock(nextCheckSrc, 'check/route.ts');
    const fnSafeCard = extractSafeCardBlock(fnSrc, 'functions/src/index.ts');

    for (const forbidden of invariants.forbiddenPublicCheckFields) {
      const keyRegex = new RegExp(`\\b${forbidden}\\s*:`);
      if (keyRegex.test(nextSafeCard)) {
        throw new Error(`Forbidden PII key "${forbidden}" returned in Next.js safeCard`);
      }
      if (keyRegex.test(fnSafeCard)) {
        throw new Error(`Forbidden PII key "${forbidden}" returned in Functions safeCard`);
      }
    }
  });

  // QA-17: Dual-backend route parity & Cache-Control: no-store
  check('QA-17', 'Dual-backend route parity and no-store cache headers across all 6 endpoints', () => {
    const fnSrc = readText('functions/src/index.ts');
    if (!fnSrc.includes('no-store')) {
      throw new Error('functions/src/index.ts is missing Cache-Control: no-store');
    }
    for (const route of invariants.requiredApiRoutes) {
      if (!fs.existsSync(path.join(ROOT_DIR, route.nextRouteFile))) {
        throw new Error(`Missing Next.js route file: ${route.nextRouteFile}`);
      }
      const routeSrc = readText(route.nextRouteFile);
      if (!routeSrc.includes('no-store')) {
        throw new Error(`${route.nextRouteFile} is missing Cache-Control: no-store`);
      }
      if (!fnSrc.includes(route.functionsPattern)) {
        throw new Error(`functions/src/index.ts is missing handler for ${route.path}`);
      }
    }
  });

  // QA-18: Next.js 16 prerender safety & Stripe pk_live_ support
  check('QA-18', 'Next.js 16 prerender safety (no render-time Date/useMemo) & pk_live_ support', () => {
    const formSrc = readText('src/components/GiftCardForm.tsx');
    if (!formSrc.includes("pk_live_") || !formSrc.includes("pk_test_")) {
      throw new Error('GiftCardForm.tsx must allow both pk_test_ and pk_live_ keys');
    }

    const uiFiles = [
      ...listFilesRecursive(path.join(ROOT_DIR, 'src', 'components'), ['.tsx']),
      path.join(ROOT_DIR, 'src', 'app', 'page.tsx'),
      path.join(ROOT_DIR, 'src', 'app', 'layout.tsx'),
    ];

    for (const file of uiFiles) {
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, 'utf-8');
      if (/useMemo\s*\([^)]*new\s+Date\s*\(/.test(src) || /useMemo\s*\(\s*\(\)\s*=>\s*getTomorrow/.test(src)) {
        throw new Error(`Unsafe new Date() inside useMemo in ${path.relative(ROOT_DIR, file)}`);
      }
    }
  });

  // QA-20: Promotion expiry & frontend-server price sync check
  check('QA-20', 'Frontend syncs live promotion discount from /api/promotions and server chargeAmount', () => {
    const pageSrc = readText('src/app/page.tsx');
    const heroSrc = readText('src/components/GiftCardHero.tsx');
    const formSrc = readText('src/components/GiftCardForm.tsx');

    if (/const\s+discountRate\s*=\s*20\b/.test(pageSrc)) {
      throw new Error('src/app/page.tsx still hardcodes const discountRate = 20');
    }
    if (!pageSrc.includes('/api/promotions')) {
      throw new Error('src/app/page.tsx must fetch /api/promotions to sync active promo status');
    }
    if (!heroSrc.includes('discountRate > 0')) {
      throw new Error('GiftCardHero.tsx must guard promo badge and You Pay subtitle with discountRate > 0');
    }
    if (!formSrc.includes('discountRate > 0') || !formSrc.includes('intentData.chargeAmount')) {
      throw new Error('GiftCardForm.tsx must guard discount row with discountRate > 0 and sync intentData.chargeAmount');
    }
  });

  // QA-22: Server-side gift recipientEmail and $20~$2,000 cap parity
  check('QA-22', 'Dual backends enforce $20~$2000 range and gift recipientEmail validation', () => {
    const cpiSrc = readText('src/app/api/create-payment-intent/route.ts');
    const issueSrc = readText('src/app/api/gift-cards/issue/route.ts');
    const fnSrc = readText('functions/src/index.ts');

    for (const [label, src] of [
      ['create-payment-intent/route.ts', cpiSrc],
      ['gift-cards/issue/route.ts', issueSrc],
      ['functions/src/index.ts', fnSrc],
    ]) {
      if (!src.includes('isValidDollarCents(amount, 20, 2000)')) {
        throw new Error(`${label} missing isValidDollarCents(amount, 20, 2000)`);
      }
      if (!src.includes('isValidEmail(')) {
        throw new Error(`${label} missing isValidEmail validation`);
      }
    }
  });

  // QA-23: Repository-wide ESLint zero-error gate
  check('QA-23', 'Repository-wide ESLint check passes with 0 errors', () => {
    try {
      execSync('pnpm lint', { cwd: ROOT_DIR, stdio: 'pipe', encoding: 'utf-8' });
    } catch (err) {
      const out = (err && (err.stdout || err.stderr)) ? String(err.stdout || err.stderr) : 'ESLint failed';
      throw new Error(`pnpm lint failed:\n${out.slice(0, 1200)}`);
    }
  });

  // QA-24: Stitch UI design tokens, buy-section anchor, and zero external CDN script leakage
  check('QA-24', 'Stitch UI design tokens, buy-section anchor, and zero external CDN script leakage', () => {
    const cssSrc = readText('src/app/globals.css');
    if (!cssSrc.includes('--stitch-bg') || !cssSrc.includes('--stitch-primary')) {
      throw new Error('src/app/globals.css is missing --stitch-* design tokens');
    }

    const formSrc = readText('src/components/GiftCardForm.tsx');
    if (!formSrc.includes('id="buy-section"')) {
      throw new Error('src/components/GiftCardForm.tsx must preserve id="buy-section" anchor');
    }

    const uiFiles = [
      ...listFilesRecursive(path.join(ROOT_DIR, 'src', 'components'), ['.tsx']),
      path.join(ROOT_DIR, 'src', 'app', 'page.tsx'),
      path.join(ROOT_DIR, 'src', 'app', 'layout.tsx'),
    ];
    for (const file of uiFiles) {
      if (!fs.existsSync(file)) continue;
      const src = fs.readFileSync(file, 'utf-8');
      if (src.includes('cdn.tailwindcss.com') || src.includes('lh3.googleusercontent.com/aida')) {
        throw new Error(`External Stitch CDN script or mockup URL leaked into ${path.relative(ROOT_DIR, file)}`);
      }
    }
  });

  // QA-25: Unlimited gift card validity check (zero 2-year copy or new Date(expiresAt))
  check('QA-25', 'Zero leftover 2-year expiry copy or unsafe new Date(card.expiresAt) calls', () => {
    const tsFiles = [
      ...listFilesRecursive(path.join(ROOT_DIR, 'src'), ['.ts', '.tsx']),
      ...listFilesRecursive(path.join(ROOT_DIR, 'functions', 'src'), ['.ts']),
    ];
    const forbiddenPattern = /2-Year|2-year|2 years|24-month|24개월|2년|2년간|new Date\([^)]*expiresAt\)/;
    for (const file of tsFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      if (forbiddenPattern.test(src)) {
        throw new Error(`Legacy 2-year expiry reference or new Date(expiresAt) found in ${path.relative(ROOT_DIR, file)}`);
      }
    }
  });

  return results;
}

async function main() {
  const invariants = JSON.parse(fs.readFileSync(INVARIANTS_PATH, 'utf-8'));
  const tmpWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kheadspa-qa-'));

  let runtimeResults = [];
  let staticResults = [];

  try {
    const entryTs = path.join(tmpWorkDir, 'entry.ts');
    const bundleCjs = path.join(tmpWorkDir, 'bundle.cjs');
    const runnerJs = path.join(tmpWorkDir, 'runner.js');

    const entryContent = [
      `export * from ${JSON.stringify(path.join(ROOT_DIR, 'src/lib/barcode.ts').replace(/\\/g, '/'))};`,
      `export * from ${JSON.stringify(path.join(ROOT_DIR, 'src/lib/card-designs.ts').replace(/\\/g, '/'))};`,
      `export * from ${JSON.stringify(path.join(ROOT_DIR, 'src/lib/storage.ts').replace(/\\/g, '/'))};`,
      `export * from ${JSON.stringify(path.join(ROOT_DIR, 'src/lib/notifications.ts').replace(/\\/g, '/'))};`,
      `export * from ${JSON.stringify(path.join(ROOT_DIR, 'src/lib/auth.ts').replace(/\\/g, '/'))};`,
      `export * from ${JSON.stringify(path.join(ROOT_DIR, 'src/lib/stripe.ts').replace(/\\/g, '/'))};`,
    ].join('\n');

    fs.writeFileSync(entryTs, entryContent, 'utf-8');

    await esbuild.build({
      entryPoints: [entryTs],
      outfile: bundleCjs,
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      tsconfig: path.join(ROOT_DIR, 'tsconfig.json'),
      external: ['firebase-admin', 'firebase-admin/*', 'qrcode', 'stripe'],
    });

    fs.writeFileSync(runnerJs, buildIsolatedRunnerScript(), 'utf-8');

    const cleanEnv = {
      ...process.env,
      APP_ENV: 'production',
      NEXT_PUBLIC_APP_ENV: 'production',
      NODE_PATH: path.join(ROOT_DIR, 'node_modules'),
      NEXT_PUBLIC_APP_URL: 'https://gift.kheadspawellness.com',
      NEXT_PUBLIC_BOOKING_URL: 'https://kheadspawellness.glossgenius.com',
      RESEND_API_KEY: '',
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_FROM_NUMBER: '',
      FIREBASE_PROJECT_ID: '',
      FIREBASE_CLIENT_EMAIL: '',
      FIREBASE_PRIVATE_KEY: '',
      FUNCTION_TARGET: '',
      K_SERVICE: '',
      FIREBASE_CONFIG: '',
    };

    const stdout = execFileSync(process.execPath, [runnerJs], {
      cwd: tmpWorkDir,
      env: cleanEnv,
      encoding: 'utf-8',
    });

    runtimeResults = JSON.parse(stdout);
    staticResults = runStaticChecks(invariants);
  } finally {
    fs.rmSync(tmpWorkDir, { recursive: true, force: true });
  }

  const allResults = [...runtimeResults, ...staticResults];
  const passed = allResults.filter((r) => r.status === 'PASS').length;
  const failed = allResults.filter((r) => r.status === 'FAIL').length;

  const summary = {
    generatedAt: new Date().toISOString(),
    total: allResults.length,
    passed,
    failed,
    results: allResults,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'qa-report.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  const mdLines = [
    '# K-HeadSpa QA Test Report',
    '',
    `- **Generated At**: ${summary.generatedAt}`,
    `- **Total**: ${summary.total} | **Passed**: ${passed} | **Failed**: ${failed}`,
    '',
    '| ID | Status | Duration | Scenario |',
    '| :--- | :---: | :---: | :--- |',
    ...allResults.map(
      (r) => `| ${r.id} | ${r.status === 'PASS' ? 'PASS' : 'FAIL'} | ${r.durationMs}ms | ${r.name} |`
    ),
  ];

  const failures = allResults.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    mdLines.push('', '## Failures');
    for (const f of failures) {
      mdLines.push(`### ${f.id}: ${f.name}`, '```text', f.error || 'Unknown error', '```');
    }
  }

  fs.writeFileSync(path.join(REPORTS_DIR, 'qa-report.md'), `${mdLines.join('\n')}\n`, 'utf-8');

  console.log(`\n[QA SUITE] Total: ${summary.total}, Passed: ${passed}, Failed: ${failed}`);
  for (const r of allResults) {
    console.log(`  [${r.status}] ${r.id} - ${r.name} (${r.durationMs}ms)`);
    if (r.status === 'FAIL') {
      console.error(`    -> ${r.error}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[QA SUITE ERROR]', err);
  process.exit(1);
});
