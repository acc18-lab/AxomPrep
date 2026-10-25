const cfg = window.AXOMPREP_CONFIG;
const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
const PLANS = {
  premium_monthly: {
    code: 'premium_monthly',
    name: '1 Month',
    price: 49,
    durationLabel: '30 days',
    description: 'Full Premium access for 1 month.'
  },
  premium_quarterly: {
    code: 'premium_quarterly',
    name: '3 Months',
    price: 129,
    durationLabel: '90 days',
    description: 'Full Premium access for 3 months.'
  }
};
let user = null;
let activePlan = null;
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

function setStatus(message) {
  $('status').textContent = message;
}

function setButtons(disabled, activeText = 'Premium Active') {
  document.querySelectorAll('.plan-pay-btn').forEach(btn => {
    btn.disabled = disabled;
    btn.textContent = disabled ? activeText : `Get Premium — ₹${btn.dataset.price}`;
  });
}

async function initPremium() {
  const { data, error } = await client.auth.getUser();
  if (error) console.error(error);
  user = data?.user || null;

  if (!user) {
    setStatus('Please log in from AxomPrep before upgrading.');
    return;
  }

  const sub = await getActiveSubscription();
  if (sub) {
    activePlan = sub;
    const plan = PLANS[sub.plan_code];
    const name = plan?.name || 'Premium';
    setStatus(`${name} plan active until ${new Date(sub.expires_at).toLocaleDateString('en-IN')}.`);
    setButtons(true);
  } else {
    setStatus('You are currently on the Free plan. Choose a Premium plan to continue.');
  }
}

document.querySelectorAll('.plan-pay-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
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

    const planCode = btn.dataset.plan;
    const plan = PLANS[planCode];
    if (!plan) {
      alert('Invalid Premium plan.');
      return;
    }

    setButtons(true, 'Processing...');
    try {
      const session = (await client.auth.getSession()).data.session;
      if (!session) throw new Error('Your login session has expired. Please log in again.');

      const orderResponse = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ plan_code: planCode })
      });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || 'Could not create payment order.');

      const options = {
        key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'AxomPrep',
        description: `AxomPrep Premium — ${plan.name}`,
        prefill: { email: user.email || '' },
        theme: { color: '#f28c28' },
        handler: async function (response) {
          setStatus('Verifying payment...');
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

          setStatus(`${plan.name} plan active until ${new Date(result.expires_at).toLocaleDateString('en-IN')}.`);
          setButtons(true);
          alert('Payment verified. AxomPrep Premium is now active.');
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        console.error(response.error);
        setStatus('Payment was not completed. You can try again.');
        alert('Payment failed or was cancelled.');
        setButtons(false);
      });
      rzp.on('modal.closed', function () {
        if (!activePlan) setButtons(false);
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Unable to start payment.');
      setButtons(false);
    }
  });
});

initPremium();
