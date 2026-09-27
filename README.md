# Quanta — Personal Question Bank

A minimal question-bank web app built around a Supabase-ready architecture. It is designed for 20,000+ questions and supports MCQ + short-answer questions, import/export, subject → chapter → topic organization, practice, exams, performance tracking, spaced repetition, and trend analysis.

## Quick start

```bash
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Open the local Vite URL.

### Supabase setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Enable Email/Password auth under Authentication.
4. Add your Supabase URL + anon key to `.env.local`.

The UI includes a local demo fallback so the interface and import/export workflows can be explored before connecting Supabase. When credentials are present, sign in/up and data writes use Supabase.

## Import formats

The importer accepts JSON, CSV and pasted plain text. The text parser is intentionally forgiving and understands blocks such as:

```
Question: What is the capital of Bangladesh?
A. Dhaka
B. Chittagong
C. Rajshahi
D. Sylhet
Answer: A
Subject: Geography
Chapter: South Asia
Topic: Capitals
Tags: PYQ, BCS, 2023
Explanation: Dhaka is the capital of Bangladesh.
```

It also recognizes `Q:`, `Ans:`, `Correct Answer:`, `Explanation:`, `Subject:`, `Chapter:`, `Topic:` and common Markdown-style options.

## Scale notes

- Questions are indexed by user/subject/chapter/topic and question type.
- Attempt history is append-only and separated from question rows for efficient analytics.
- RLS policies scope all data to the authenticated user.
- The dashboard fetches lightweight aggregates rather than loading the complete question table.
