const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const PLANS = {
  premium_monthly: {
    code: 'premium_monthly',
    name: '1 Month',
    amountPaise: 4900,
    amountRupees: 49,
    durationDays: 30,
  },
  premium_quarterly: {
    code: 'premium_quarterly',
    name: '3 Months',
    amountPaise: 12900,
    amountRupees: 129,
    durationDays: 90,
  }
};

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function json(res, status, body) {
  res.status(status).json(body);
}

function getBearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

async function requireUser(req) {
  const token = getBearer(req);
  if (!token) throw Object.assign(new Error('Missing authorization token'), { statusCode: 401 });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('Invalid session'), { statusCode: 401 });
  return data.user;
}

async function razorpayRequest(path, options = {}) {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data?.error?.description || 'Razorpay API request failed');
    e.statusCode = response.status;
    throw e;
  }
  return data;
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const actual = Buffer.from(signature || '');
  const expectedBuf = Buffer.from(expected);
  return actual.length === expectedBuf.length && crypto.timingSafeEqual(expectedBuf, actual);
}

function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const actual = Buffer.from(signature || '');
  const expectedBuf = Buffer.from(expected);
  return actual.length === expectedBuf.length && crypto.timingSafeEqual(expectedBuf, actual);
}

function getPlan(planCode) {
  return PLANS[planCode] || null;
}

async function activatePremium(userId, paymentId, orderId, amountPaise, planCode) {
  const plan = getPlan(planCode);
  if (!plan) throw Object.assign(new Error('Invalid premium plan'), { statusCode: 400 });
  if (Number(amountPaise) !== plan.amountPaise) {
    throw Object.assign(new Error('Payment amount does not match the selected premium plan'), { statusCode: 400 });
  }

  // Idempotency: avoid granting the same payment more than once when
  // Razorpay webhook and browser verification arrive close together.
  const { data: existingSubscription } = await admin.from('premium_subscriptions_v1')
    .select('expires_at')
    .eq('provider_payment_id', paymentId)
    .maybeSingle();
  if (existingSubscription?.expires_at) return new Date(existingSubscription.expires_at);

  const now = new Date();

  const { error: paymentError } = await admin.from('premium_payments_v1').upsert({
    user_id: userId,
    order_id: orderId,
    payment_id: paymentId,
    amount: Number(amountPaise),
    currency: 'INR',
    status: 'captured'
  }, { onConflict: 'payment_id' });

  if (paymentError) throw paymentError;

  const { error: orderError } = await admin.from('premium_orders_v1')
    .update({ status: 'paid', razorpay_payment_id: paymentId, paid_at: now.toISOString() })
    .eq('razorpay_order_id', orderId);

  if (orderError) throw orderError;

  // Extend an existing active plan instead of losing remaining paid time.
  const { data: current } = await admin.from('premium_subscriptions_v1')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', now.toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const starts = current?.expires_at && new Date(current.expires_at) > now
    ? new Date(current.expires_at)
    : now;
  const end = new Date(starts.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const { error: subError } = await admin.from('premium_subscriptions_v1').insert({
    user_id: userId,
    plan_code: plan.code,
    amount: plan.amountRupees,
    currency: 'INR',
    status: 'active',
    starts_at: starts.toISOString(),
    expires_at: end.toISOString(),
    provider: 'razorpay',
    provider_payment_id: paymentId
  });
  if (subError) {
    // A concurrent webhook/verification may have inserted the same payment.
    const { data: racedSubscription } = await admin.from('premium_subscriptions_v1')
      .select('expires_at')
      .eq('provider_payment_id', paymentId)
      .maybeSingle();
    if (racedSubscription?.expires_at) return new Date(racedSubscription.expires_at);
    throw subError;
  }

  return end;
}

module.exports = {
  admin,
  json,
  requireUser,
  razorpayRequest,
  verifyPaymentSignature,
  verifyWebhookSignature,
  activatePremium,
  getPlan,
  PLANS
};
