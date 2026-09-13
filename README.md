# AxomPrep Website — Supabase Connected Starter

This package is the first connected website build for axomprep.online.

## Included
- Responsive AxomPrep landing page
- ADRE / APSC / SSC / Assam Police sections
- Practice by subject
- Daily quiz connected to Supabase published questions
- Current Affairs connected to Supabase
- Login / registration through Supabase Auth
- Premium and mock-test presentation
- Books/affiliate presentation
- Mobile-first styling

## Supabase configuration
`config.js` contains the Supabase project URL and publishable browser key supplied during setup.

Never add a secret/service-role key to the browser.

## Deployment
This is a static frontend and can be deployed to Vercel, Netlify, GitHub Pages (with suitable configuration), or other static hosting.

For production:
1. Connect the repository/folder to your hosting provider.
2. Add `axomprep.online` as the custom domain.
3. Configure DNS at GoDaddy using the records shown by the hosting provider.
4. Keep Supabase Row Level Security enabled.
5. Add admin-only policies before enabling question editing.
6. Add real payment verification before selling subscriptions.

## Current limitation
The visual admin dashboard, full mock-test engine, discussions, and payment checkout are staged for the next build. The database schema from the previous step already contains the tables needed for these modules.
