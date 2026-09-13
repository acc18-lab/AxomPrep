const cfg = window.AXOMPREP_CONFIG;
const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
const PRICE_PAISE = 24900;
let user = null;
const $ = id => document.getElementById(id);

async function getActiveSubscription() {
  const { data, error } = await client
    .from('premium_subscriptions_v1')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error(error);
  return data;
}

async function initPremium() {
  const { data, error } = await client.auth.getUser();
  if (error) console.error(error);
  user = data?.user || null;

  if (!user) {
    $('status').textContent = 'Please log in from AxomPrep before upgrading.';
    return;
  }

  const sub = await getActiveSubscription();
  if (sub) {
    $('status').textContent = `Premium active until ${new Date(sub.expires_at).toLocaleDateString('en-IN')}.`;
    $('payBtn').disabled = true;
    $('payBtn').textContent = 'Premium Active';
  } else {
    $('status').textContent = 'You are currently on the Free plan.';
  }
}

$('payBtn').addEventListener('click', async () => {
  if (!user) {
    alert('Please log in to AxomPrep first.');
    return;
  }
  if (typeof window.Razorpay === 'undefined') {
    alert('Razorpay Checkout could not be loaded. Please refresh.');
    return;
  }
  const key = window.RAZORPAY_KEY_ID;
  if (!key) {
    alert('Razorpay Key ID is missing in config.js.');
    return;
  }

  $('payBtn').disabled = true;
  $('payBtn').textContent = 'Creating secure order...';

  try {
    const session = (await client.auth.getSession()).data.session;
    if (!session) throw new Error('Your login session has expired. Please log in again.');

    const orderResponse = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    const order = await orderResponse.json();
    if (!orderResponse.ok) throw new Error(order.error || 'Could not create payment order.');

    const options = {
      key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
      name: 'AxomPrep',
      description: 'AxomPrep Premium — 1 Month',
      prefill: { email: user.email || '' },
      theme: { color: '#f28c28' },
      handler: async function (response) {
        $('status').textContent = 'Verifying payment...';
        const verifyResponse = await fetch('/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(response)
        });
        const result = await verifyResponse.json();
        if (!verifyResponse.ok) throw new Error(result.error || 'Payment verification failed.');

        $('status').textContent = `Premium active until ${new Date(result.expires_at).toLocaleDateString('en-IN')}.`;
        $('payBtn').textContent = 'Premium Active';
        alert('Payment verified. AxomPrep Premium is now active.');
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      console.error(response.error);
      $('status').textContent = 'Payment was not completed.';
      alert('Payment failed or was cancelled.');
      $('payBtn').disabled = false;
      $('payBtn').textContent = 'Upgrade for ₹249';
    });
    rzp.open();
  } catch (err) {
    console.error(err);
    alert(err.message || 'Unable to start payment.');
    $('payBtn').disabled = false;
    $('payBtn').textContent = 'Upgrade for ₹249';
  }
});

initPremium();
