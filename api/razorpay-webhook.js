const { admin, json, verifyWebhookSignature, activatePremium, getPlan } = require('./_common');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return json(res, 400, { error: 'Missing Razorpay signature' });

    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verifyWebhookSignature(raw, signature)) return json(res, 400, { error: 'Invalid webhook signature' });

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const event = payload?.event;

    if (event === 'payment.captured') {
      const entity = payload?.payload?.payment?.entity;
      if (!entity || entity.currency !== 'INR') {
        return json(res, 400, { error: 'Unexpected payment payload' });
      }

      const orderId = entity.order_id;
      const { data: order } = await admin.from('premium_orders_v1')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      if (!order) return json(res, 404, { error: 'Order not found' });

      const plan = getPlan(order.plan_code);
      if (!plan || Number(entity.amount) !== plan.amountPaise || Number(order.amount) !== plan.amountPaise) {
        return json(res, 400, { error: 'Unexpected payment amount or plan' });
      }

      const { data: existing } = await admin.from('premium_payments_v1')
        .select('id')
        .eq('payment_id', entity.id)
        .maybeSingle();

      if (!existing) {
        await activatePremium(order.user_id, entity.id, orderId, Number(entity.amount), order.plan_code);
      }
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Webhook processing failed' });
  }
};
