const {createClient}=supabase;
const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const PRICE=24900;
let user=null;

async function init(){
 const {data}=await client.auth.getUser(); user=data?.user||null;
 if(!user){document.getElementById('status').textContent='Please log in before upgrading.';return;}
 const {data:sub}=await client.from('subscriptions').select('*').eq('user_id',user.id).eq('status','active').order('expires_at',{ascending:false}).limit(1).maybeSingle();
 if(sub && (!sub.expires_at || new Date(sub.expires_at)>new Date())){
   document.getElementById('status').textContent=`Premium active until ${new Date(sub.expires_at).toLocaleDateString('en-IN')}.`;
   document.getElementById('payBtn').disabled=true; document.getElementById('payBtn').textContent='Premium Active'; return;
 }
 document.getElementById('status').textContent='You are currently on the Free plan.';
}
document.getElementById('payBtn').addEventListener('click',async()=>{
 if(!user){alert('Please log in first.');return;}
 if(typeof Razorpay==='undefined'){alert('Payment checkout is not available yet. Add your Razorpay key in config.js.');return;}
 const key=window.RAZORPAY_KEY_ID;
 if(!key || key.includes('YOUR_')){alert('Razorpay is not configured yet. Add the Razorpay Key ID to config.js.');return;}
 const options={key,amount:PRICE,currency:'INR',name:'AxomPrep',description:'AxomPrep Premium - 1 month',prefill:{email:user.email||''},
 handler:async function(response){
   const {error}=await client.from('payments').insert({user_id:user.id,amount:249,currency:'INR',status:'paid',provider:'razorpay',provider_payment_id:response.razorpay_payment_id});
   if(error){alert('Payment received, but recording the payment failed. Contact admin.');console.error(error);return;}
   alert('Payment successful. Your subscription will be activated after payment verification.');
   await init();
 }};
 new Razorpay(options).open();
});
init();
