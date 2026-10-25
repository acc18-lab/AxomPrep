const { admin, json, requireUser, razorpayRequest, getPlan } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const user = await requireUser(req);
    const planCode = req.body?.plan_code;
    const plan = getPlan(planCode);
    if (!plan) return json(res, 400, { error: 'Invalid premium plan selected.' });

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
        amount: plan.amountPaise,
        currency: 'INR',
        receipt: `axomprep_${plan.code}_${Date.now()}`.slice(0, 40),
        notes: { user_id: user.id, plan_code: plan.code }
      })
    });

    const { error } = await admin.from('premium_orders_v1').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount: plan.amountPaise,
      currency: 'INR',
      plan_code: plan.code,
      status: 'created'
    });
    if (error) throw error;

    return json(res, 200, {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      plan_code: plan.code,
      plan_name: plan.name
    });
  } catch (e) {
    console.error(e);
    return json(res, e.statusCode || 500, { error: e.message || 'Unable to create order' });
  }
};
