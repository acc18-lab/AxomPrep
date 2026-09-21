# AxomPrep Production Email Confirmation Fix v2

## What this fixes
- Keeps Supabase Confirm Email ON for normal student accounts.
- All new confirmation and resend links explicitly return to:
  https://www.axomprep.online/
- Prevents unconfirmed users from staying logged in.
- Adds a resend confirmation-email action in the AxomPrep login modal.
- Removes dependence on a localhost default redirect in the frontend.
- Includes a branded confirmation-email template.

## 1. Replace app.js
Replace the existing root `app.js` with the `app.js` in this package.
No new auth JavaScript file is required.

## 2. Supabase URL configuration
Supabase Dashboard -> Authentication -> URL Configuration

Site URL:
https://www.axomprep.online/

Add to Redirect URLs:
https://www.axomprep.online/

Do not use localhost as the production Site URL.

## 3. Confirm Email
Supabase Dashboard -> Authentication -> Sign In / Providers -> Email

Confirm Email = ON

Keep this enabled for normal student accounts.

## 4. Confirm signup email template
Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup

Subject:
Confirm your AxomPrep account

Replace the email body with the contents of `confirm-signup-template.html`.

Important: the confirmation button must use:
{{ .ConfirmationURL }}

Do not build the link from `{{ .SiteURL }}` when you need the runtime redirect supplied by the signup request.

## 5. Make the sender look like AxomPrep
The default Supabase SMTP service is not intended for production and uses Supabase's sending identity. To control the sender name/address, configure Custom SMTP in Supabase.

Example sender settings:
Display / sender name: AxomPrep
From address: no-reply@YOUR-AUTH-DOMAIN

If you want the visible name to say `AxomPrep Admin`, use that as the sender name.

A common provider is Resend, but any SMTP provider supported by Supabase can be used.

You will need the provider's SMTP host, port, username and password, then enter them in Supabase Authentication SMTP settings.

## 6. Important for an already-created unconfirmed user
Any old confirmation email that was generated with localhost may still point to localhost.

After changing the settings and deploying the new `app.js`:
1. Open AxomPrep.
2. Try to log in with the unconfirmed account.
3. Click `Resend confirmation email`.
4. Use the NEW email.

## 7. Admin/test accounts
Do not disable Confirm Email for testing.

Manually confirm admin/test accounts from:
Authentication -> Users -> select the user -> confirm email.

## 8. Test flow
1. Create a fresh student account.
2. Confirm the email arrives with AxomPrep branding.
3. Click Confirm my email.
4. It should return to https://www.axomprep.online/ .
5. Log in with the student credentials.
