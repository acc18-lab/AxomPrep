AXOMPREP JOBS FEED

What changed:
- Daily Vercel cron now checks configured public job listing pages and JSON feeds, imports matching recruitment posts, and rewrites summaries from extracted facts instead of copying article text.
- Each imported row is viewable on AxomPrep at /job.html?id=<row-id> (or /job/<row-id>).
- Homepage Latest Job Alerts now reads active rows from current_jobs_v1 and links each card to its own AxomPrep detail page.
- Current Jobs listing also links to the internal detail page.

Deployment requirements:
- Keep Vercel environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set for the cron. CRON_SECRET remains optional depending on the Vercel cron setup.
- The existing Supabase current_jobs_v1 table must permit public SELECT for the fields used by the website, as the current jobs list already expects. No new table is created.
- The current feed parser only extracts fields it can identify reliably; it does not guarantee every field exists on every source post. Always check official notification links.
- The Vercel cron is scheduled at 18:30 UTC (00:00 IST the next day).
