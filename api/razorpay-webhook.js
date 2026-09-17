const { admin, json, verifyWebhookSignature, activatePremium, getRawBody } = require('./_common');

// Vercel's Node serverless runtime may otherwise parse req.body before the
// handler sees it. Razorpay signature verification must use the original bytes.
module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) return json(res, 400, { error: 'Missing Razorpay signature' });

    const rawBuffer = await getRawBody(req);
    const raw = rawBuffer.toString('utf8');

    if (!verifyWebhookSignature(rawBuffer, signature)) {
      return json(res, 400, { error: 'Invalid webhook signature' });
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json(res, 400, { error: 'Invalid webhook JSON' });
    }

    const eventId = req.headers['x-razorpay-event-id'];
    const event = payload?.event;

    // Razorpay can deliver the same event more than once. The payment_id
    // uniqueness check in activatePremium is the final idempotency barrier.
    if (event === 'payment.captured') {
      const entity = payload?.payload?.payment?.entity;
      if (!entity || Number(entity.amount) !== 24900 || entity.currency !== 'INR') {
        return json(res, 400, { error: 'Unexpected payment payload' });
      }

      const orderId = entity.order_id;
      const { data: order } = await admin.from('premium_orders_v1')
        .select('*')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();

      if (!order) return json(res, 404, { error: 'Order not found' });

      await activatePremium(order.user_id, entity.id, orderId, Number(entity.amount));
    }

    console.log('Razorpay webhook processed', { event, eventId });

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Webhook processing failed' });
  }
};