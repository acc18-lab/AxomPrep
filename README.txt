AxomPrep Link Repair Pack v2

IMPORTANT
- This package fixes the broken current-affairs page and provides route aliases for the missing pages.
- The new current-affairs.html is dynamic: it reads published records from current_affairs, then falls back to current_affairs_v1.
- Do NOT replace your existing index.html, config.js, styles.css, homepage.css, brand-logo.css, axomprep-mobile-optimized.css, app.js or homepage-live.js with files from this pack.
- Upload the HTML files/folders to the website ROOT.
- If your deployment uses extensionless routes such as /current-affairs or /mock-tests, upload the matching folders too.
- This pack does not invent current-affairs facts when the database is empty.

Supabase tables used by current affairs
1) current_affairs: title, content, category, published_date, is_published
2) current_affairs_v1 compatibility: title, summary/content, category, published_date, source_name, status

