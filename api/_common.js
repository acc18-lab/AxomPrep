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

function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || ''), 'utf8');
    const bb = Buffer.from(String(b || ''), 'utf8');
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

function verifyWebhookSignature(rawBody, signature) {
  const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

function getRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return Promise.resolve(req.rawBody);
  if (typeof req.rawBody === 'string') return Promise.resolve(Buffer.from(req.rawBody));
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function activatePremium(userId, paymentId, orderId, amount) {
  const now = new Date();

  // Insert the payment first. The unique payment_id constraint is the idempotency gate.
  const { data: insertedPayment, error: paymentError } = await admin
    .from('premium_payments_v1')
    .insert({
      user_id: userId,
      order_id: orderId,
      payment_id: paymentId,
      amount,
      currency: 'INR',
      status: 'captured'
    })
    .select('id')
    .maybeSingle();

  if (paymentError && paymentError.code !== '23505') throw paymentError;

  // A duplicate webhook/callback for the same Razorpay payment must not create
  // another 30-day subscription.
  if (!insertedPayment) {
    const { data: existingSub, error: existingError } = await admin
      .from('premium_subscriptions_v1')
      .select('expires_at')
      .eq('provider_payment_id', paymentId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingSub) return new Date(existingSub.expires_at);
  }

  await admin.from('premium_orders_v1')
    .update({
      status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: now.toISOString()
    })
    .eq('razorpay_order_id', orderId);

  const { data: current, error: currentError } = await admin
    .from('premium_subscriptions_v1')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (currentError) throw currentError;

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

  if (subError) {
    // A race may have inserted the same payment between the idempotency check
    // and the subscription insert. Return the existing subscription when that happens.
    if (subError.code === '23505') {
      const { data: existingSub, error: existingError } = await admin
        .from('premium_subscriptions_v1')
        .select('expires_at')
        .eq('provider_payment_id', paymentId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingSub) return new Date(existingSub.expires_at);
    }
    throw subError;
  }

  return end;
}

module.exports = { admin, json, requireUser, razorpayRequest, verifyPaymentSignature, verifyWebhookSignature, activatePremium, getRawBody };
