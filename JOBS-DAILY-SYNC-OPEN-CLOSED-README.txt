AxomPrep current jobs update + open/closed tabs

Changes included:
- Vercel current-jobs cron scheduled daily at 19:00 UTC = 00:30 IST.
- Current Jobs page reloads at 00:45 IST, after the importer is expected to finish.
- Added Open jobs and Closed jobs tabs with live counts.
- Closed status uses application_last_date when present, falling back to the stored status when the date is unavailable.

Deploy these files to the existing AxomPrep repository, preserving other current files:
- vercel.json
- current-jobs.html
- current-jobs.js
- current-jobs.css

Important:
1. Vercel Cron runs only for the deployed production deployment and uses UTC schedules.
2. Check Vercel -> Project -> Settings -> Cron Jobs after deployment. It should show /api/cron/current-jobs at 19:00 UTC daily (00:30 IST).
3. After deploy, manually run the cron once and inspect its response/logs. If it returns HTTP 500, the scheduled import will not update records until that underlying error is fixed.
4. The page label shows the schedule, not proof that the last run succeeded. Verify the cron response and updated last_verified/updated_at fields in Supabase.
