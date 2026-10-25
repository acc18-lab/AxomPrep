AxomPrep Jobs Update Fix

Files changed:
- api/cron/current-jobs.js: reads the AssamCareer Blogger JSON feed as well as the homepage, latest-updates page, and search page; filters employment-related posts; imports up to 100 recent matching posts; upserts last_verified and updated_at timestamps; returns source/feed counts and parsing errors.
- current-jobs.js: uses last_verified (when present) for the sync timestamp and labels it "Jobs last synced" rather than implying a source publication date.

Deploy:
1. Replace these two files in the root repository at the same paths.
2. Keep vercel.json's existing jobs schedule at 30 18 * * * (00:00 IST).
3. Confirm Vercel environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist. If CRON_SECRET is configured, ensure Vercel cron authorization is configured as expected.
4. Commit and deploy.
5. In Vercel -> Project -> Logs, inspect the /api/cron/current-jobs run after midnight IST. The JSON response should show feedsChecked, articlesFound, importedOrUpdated, and articleFetchErrors.
6. Verify current_jobs_v1 contains newer records, then hard-refresh current-jobs.html.

This change does not delete older job records. Check deadlines and official notifications before relying on job details. Do not expose service-role keys in frontend files.
