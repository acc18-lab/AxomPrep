# AxomPrep Practice Engine v1

Adds a dedicated `practice.html` experience using the existing published `questions` Question Bank.

## Features
- Exam → Subject → Topic cascading filters
- Difficulty filter
- 10 / 20 / 50 question sessions
- Randomized published questions
- One-question-at-a-time interface
- Countdown timer
- Instant answer + explanation
- Question navigation
- Score, accuracy, attempted count and time
- Answer review
- Saves logged-in attempts to `practice_attempts_v1` / `practice_answers_v1`

## Setup
1. Run `practice-schema.sql` in Supabase SQL Editor.
2. Copy `practice.html`, `practice.js`, `practice.css`, `config.js`, and `styles.css` to the production site root.
3. Add/link `practice.html` from the homepage navigation and exam/subject practice buttons.

The browser only uses the existing Supabase publishable key. Never place a service-role key in these files.
