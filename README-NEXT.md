# AxomPrep — Admin Build

This package keeps the current homepage and adds the first real content-management layer.

## Included
- `admin.html` — Supabase-authenticated admin area
- Add individual questions
- Question status: Draft / Review / Approved / Published
- Bulk CSV question import
- Current affairs entry + publish toggle
- Basic admin statistics
- Admin-only database policies in `supabase-admin-policies.sql`

## Important
The Supabase publishable/browser key in `config.js` is intended to be exposed to the browser. Never put a Supabase service-role/secret key in this project.

## One-time Supabase step
1. Create your AxomPrep user account from the website.
2. Open Supabase → SQL Editor.
3. Open `supabase-admin-policies.sql`.
4. Replace `YOUR-ADMIN-EMAIL-HERE` with your login email.
5. Run the SQL.
6. Open `https://axomprep.online/admin.html` and log in.

This is the next development build, not yet the final commercial production release. Payments, full mock-test engine, advanced analytics, moderation, and further security hardening are still planned.
