const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

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
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function activatePremium(userId, paymentId, orderId, amount) {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: paymentError } = await admin.from('premium_payments_v1').upsert({
    user_id: userId,
    order_id: orderId,
    payment_id: paymentId,
    amount,
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
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const starts = current && current.expires_at && new Date(current.expires_at) > now
    ? new Date(current.expires_at)
    : now;
  const end = new Date(starts.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: subError } = await admin.from('premium_subscriptions_v1').insert({
    user_id: userId,
    plan_code: 'premium_monthly',
    amount: 249,
    currency: 'INR',
    status: 'active',
    starts_at: starts.toISOString(),
    expires_at: end.toISOString(),
    provider: 'razorpay',
    provider_payment_id: paymentId
  });
  if (subError) throw subError;

  return end;
}

module.exports = { admin, json, requireUser, razorpayRequest, verifyPaymentSignature, verifyWebhookSignature, activatePremium };
