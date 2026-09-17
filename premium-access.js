window.AxomPrepPremium=(()=>{
  const cfg=window.AXOMPREP_CONFIG||{};
  const client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  let cache=null;

  async function getState(force=false){
    if(cache&&!force)return cache;
    const {data,error}=await client.auth.getUser();
    if(error||!data?.user){
      cache={active:false,loading:false,error:error||new Error('Not logged in'),user:null};
      return cache;
    }
    const user=data.user;
    const r=await client.from('premium_subscriptions_v1')
      .select('id,plan_code,status,starts_at,expires_at')
      .eq('user_id',user.id)
      .eq('status','active')
      .gt('expires_at',new Date().toISOString())
      .order('expires_at',{ascending:false})
      .limit(1)
      .maybeSingle();

    cache={active:!!r.data,loading:false,error:r.error||null,user,subscription:r.data||null};
    return cache;
  }

  function isTaggedPremium(tags){
    const arr=Array.isArray(tags)?tags:String(tags||'').split(',');
    return arr.some(t=>String(t).trim().toUpperCase()==='PREMIUM');
  }

  async function requirePremium(){
    const state=await getState();
    if(!state.active){
      location.href='premium.html';
      return false;
    }
    return true;
  }

  function invalidate(){cache=null}
  return {getState,isTaggedPremium,requirePremium,invalidate};
})();