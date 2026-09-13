const { admin, json, requireUser, razorpayRequest } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const user = await requireUser(req);

    const { data: active } = await admin.from('premium_subscriptions_v1')
      .select('expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active) return json(res, 409, { error: 'Premium is already active', expires_at: active.expires_at });

    const order = await razorpayRequest('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: 24900,
        currency: 'INR',
        receipt: `axomprep_${Date.now()}`,
        notes: { user_id: user.id, plan_code: 'premium_monthly' }
      })
    });

    const { error } = await admin.from('premium_orders_v1').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount: 24900,
      currency: 'INR',
      plan_code: 'premium_monthly',
      status: 'created'
    });
    if (error) throw error;

    return json(res, 200, { id: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    console.error(e);
    return json(res, e.statusCode || 500, { error: e.message || 'Unable to create order' });
  }
};
