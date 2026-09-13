const { admin, json, requireUser, razorpayRequest, verifyPaymentSignature, activatePremium } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json(res, 400, { error: 'Missing payment verification fields' });
    }

    const { data: order, error: orderError } = await admin.from('premium_orders_v1')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (orderError || !order) return json(res, 404, { error: 'Order not found' });

    if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return json(res, 400, { error: 'Invalid payment signature' });
    }

    const payment = await razorpayRequest(`/payments/${encodeURIComponent(razorpay_payment_id)}`);
    if (payment.status !== 'captured' || Number(payment.amount) !== 24900 || payment.order_id !== razorpay_order_id) {
      return json(res, 400, { error: 'Payment is not a verified ₹249 captured payment' });
    }

    const expiresAt = await activatePremium(user.id, razorpay_payment_id, razorpay_order_id, 24900);
    return json(res, 200, { ok: true, status: 'active', expires_at: expiresAt.toISOString() });
  } catch (e) {
    console.error(e);
    return json(res, e.statusCode || 500, { error: e.message || 'Payment verification failed' });
  }
};
