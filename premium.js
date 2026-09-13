const cfg = window.AXOMPREP_CONFIG;
const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
const PRICE_PAISE = 24900;
let user = null;

const $ = id => document.getElementById(id);

async function initPremium() {
  try {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    user = data?.user || null;

    if (!user) {
      $('status').textContent = 'Please log in from AxomPrep before upgrading.';
      return;
    }

    const { data: sub, error: subError } = await client
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!subError && sub && (!sub.expires_at || new Date(sub.expires_at) > new Date())) {
      $('status').textContent = `Premium active until ${new Date(sub.expires_at).toLocaleDateString('en-IN')}.`;
      $('payBtn').disabled = true;
      $('payBtn').textContent = 'Premium Active';
      return;
    }

    $('status').textContent = 'You are currently on the Free plan.';
  } catch (err) {
    console.error('Premium init error:', err);
    $('status').textContent = 'Please log in to continue.';
  }
}

$('payBtn').addEventListener('click', async () => {
  if (!user) {
    alert('Please log in to AxomPrep first, then open Premium again.');
    return;
  }

  if (typeof window.Razorpay === 'undefined') {
    alert('Razorpay Checkout could not be loaded. Please refresh the page.');
    return;
  }

  const key = window.RAZORPAY_KEY_ID;
  if (!key || key.includes('YOUR_')) {
    alert('Razorpay Key ID is missing in config.js.');
    return;
  }

  const options = {
    key: key,
    amount: PRICE_PAISE,
    currency: 'INR',
    name: 'AxomPrep',
    description: 'AxomPrep Premium — 1 Month',
    prefill: { email: user.email || '' },
    theme: { color: '#f28c28' },
    handler: async function (response) {
      console.log('Razorpay test payment:', response);

      // Payment verification and Premium activation must be done server-side
      // through a Razorpay webhook before this is used for real customers.
      $('status').textContent = 'Payment received. Premium activation requires payment verification.';
      alert('Payment successful in Razorpay Test Mode. Server-side verification is required before Premium is activated.');
    }
  };

  const razorpay = new window.Razorpay(options);
  razorpay.on('payment.failed', function (response) {
    console.error('Razorpay payment failed:', response.error);
    alert('Payment failed or was cancelled. Please try again.');
  });
  razorpay.open();
});

initPremium();
