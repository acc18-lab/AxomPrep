/* AxomPrep email-confirmation auth layer
   Keeps Supabase Confirm Email ON for normal student accounts.
   - New accounts must confirm their email before login.
   - Unconfirmed logins are blocked even if project settings are accidentally changed.
   - Users can request a fresh confirmation email.
   - Admin/test accounts should be manually confirmed from Supabase Dashboard > Authentication > Users.
*/
(function () {
  const cfg = window.AXOMPREP_CONFIG;
  if (!cfg || typeof supabase === 'undefined') return;

  const client = supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  let mode = 'login';

  const $ = (id) => document.getElementById(id);

  function setMessage(message, type) {
    const el = $('authMsg');
    if (!el) return;
    el.textContent = message || '';
    el.className = '';
    if (type) el.classList.add('auth-msg-' + type);
  }

  function getRedirectUrl() {
    return window.location.origin + '/';
  }

  function ensureResendButton() {
    let btn = $('resendConfirmationBtn');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'resendConfirmationBtn';
    btn.className = 'auth-resend-btn hidden';
    btn.textContent = 'Resend confirmation email';

    const form = $('authForm');
    const msg = $('authMsg');
    if (form && msg) form.insertBefore(btn, msg.nextSibling);

    btn.addEventListener('click', resendConfirmation);
    return btn;
  }

  function setResendVisible(show) {
    const btn = ensureResendButton();
    btn.classList.toggle('hidden', !show);
  }

  function applyAuthStyles() {
    if (document.getElementById('axomprep-auth-confirmation-css')) return;
    const style = document.createElement('style');
    style.id = 'axomprep-auth-confirmation-css';
    style.textContent = `
      #authMsg{margin:12px 0 0;line-height:1.45;}
      .auth-msg-success{color:#147a4b;}
      .auth-msg-error{color:#c7462e;}
      .auth-msg-info{color:#315f93;}
      .auth-resend-btn{margin:10px 0 0;padding:8px 0;border:0;background:transparent;color:#1553a0;font:600 13px/1.3 inherit;cursor:pointer;text-decoration:underline;}
      .auth-resend-btn:disabled{opacity:.55;cursor:wait;}
      .auth-confirm-note{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#eef6ff;color:#315f93;font-size:12px;line-height:1.45;}
    `;
    document.head.appendChild(style);
  }

  function ensureSignupNote() {
    let note = $('authConfirmNote');
    if (note) return note;
    note = document.createElement('div');
    note.id = 'authConfirmNote';
    note.className = 'auth-confirm-note hidden';
    note.textContent = 'After creating your account, check your inbox and confirm your email address before logging in.';
    const form = $('authForm');
    const msg = $('authMsg');
    if (form && msg) form.insertBefore(note, msg);
    return note;
  }

  function setMode(nextMode) {
    mode = nextMode === 'signup' ? 'signup' : 'login';
    const loginTab = $('tabLogin');
    const signupTab = $('tabSignup');
    const nameWrap = $('nameWrap');
    const submit = $('authSubmit');
    const note = ensureSignupNote();

    if (loginTab) loginTab.classList.toggle('active', mode === 'login');
    if (signupTab) signupTab.classList.toggle('active', mode === 'signup');
    if (nameWrap) nameWrap.classList.toggle('hidden', mode !== 'signup');
    if (submit) submit.textContent = mode === 'signup' ? 'Create account' : 'Login';
    if (note) note.classList.toggle('hidden', mode !== 'signup');
    setResendVisible(false);
    setMessage('', '');
  }

  window.openAuth = function (signup) {
    if ($('authModal')) $('authModal').classList.remove('hidden');
    setMode(signup ? 'signup' : 'login');
    $('email')?.focus();
  };

  window.closeModal = function () {
    $('authModal')?.classList.add('hidden');
    setResendVisible(false);
    setMessage('', '');
  };

  async function resendConfirmation() {
    const email = ($('email')?.value || '').trim();
    if (!email) {
      setMessage('Enter your email address first.', 'error');
      return;
    }

    const btn = ensureResendButton();
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: getRedirectUrl() }
      });
      if (error) throw error;
      setMessage('A new confirmation email has been requested. Check your inbox and spam folder.', 'success');
    } catch (error) {
      setMessage(error?.message || 'Could not send the confirmation email. Please try again later.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Resend confirmation email';
    }
  }

  async function submitAuth(event) {
    event.preventDefault();

    const email = ($('email')?.value || '').trim().toLowerCase();
    const password = $('password')?.value || '';
    const fullName = ($('fullName')?.value || '').trim();
    const submit = $('authSubmit');

    if (!email || !password) {
      setMessage('Enter your email and password.', 'error');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setMessage('Password must be at least 6 characters.', 'error');
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = mode === 'signup' ? 'Creating…' : 'Logging in…';
    }
    setResendVisible(false);
    setMessage(mode === 'signup' ? 'Creating your AxomPrep account…' : 'Checking your account…', 'info');

    try {
      if (mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: getRedirectUrl()
          }
        });

        if (error) throw error;

        // With Confirm Email enabled, Supabase returns a user but no session.
        if (data?.user && !data?.session) {
          $('password').value = '';
          setMessage('Account created. Please check your email and click the confirmation link before logging in.', 'success');
          setResendVisible(true);
          return;
        }

        // Safety fallback: if confirmations were accidentally disabled,
        // do not keep an unconfirmed session.
        if (data?.user && !data?.user.email_confirmed_at && !data?.user.confirmed_at) {
          await client.auth.signOut();
          setMessage('Account created, but the email is not confirmed yet. Please confirm it from your inbox before logging in.', 'error');
          setResendVisible(true);
          return;
        }

        setMessage('Account created successfully.', 'success');
        await window.updateAuthUI?.();
        setTimeout(() => window.closeModal(), 700);
        return;
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const user = data?.user;
      const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at);

      if (!confirmed) {
        await client.auth.signOut();
        setMessage('Please confirm your email address before logging in. Check your inbox or request a new confirmation email below.', 'error');
        setResendVisible(true);
        return;
      }

      setMessage('Logged in successfully.', 'success');
      await window.updateAuthUI?.();
      setTimeout(() => window.closeModal(), 500);
    } catch (error) {
      const raw = String(error?.message || '');
      const lower = raw.toLowerCase();
      if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
        setMessage('Your email is not confirmed yet. Please confirm it from your inbox, then log in again.', 'error');
        setResendVisible(true);
      } else {
        setMessage(raw || 'Authentication failed. Please try again.', 'error');
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = mode === 'signup' ? 'Create account' : 'Login';
      }
    }
  }

  function wire() {
    if (!$('authForm')) return;
    applyAuthStyles();
    ensureResendButton();
    ensureSignupNote();

    $('authForm').onsubmit = submitAuth;
    $('loginBtn')?.addEventListener('click', () => window.openAuth(false));
    $('signupBtn')?.addEventListener('click', () => window.openAuth(true));
    $('tabLogin')?.addEventListener('click', () => setMode('login'));
    $('tabSignup')?.addEventListener('click', () => setMode('signup'));

    // Make initial mode match the current tab without closing the modal.
    setMode($('tabSignup')?.classList.contains('active') ? 'signup' : 'login');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire, { once: true });
  } else {
    wire();
  }
})();
