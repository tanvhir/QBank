-- Quanta question bank schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('mcq','short')),
  question text not null,
  options jsonb not null default '[]'::jsonb,
  answer text not null,
  explanation text,
  reference_tags text[] not null default '{}',
  subject text not null default 'Uncategorized',
  chapter text not null default 'General',
  topic text not null default 'General',
  difficulty text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  next_review_at date,
  review_interval integer not null default 1,
  ease_factor numeric(4,2) not null default 2.50,
  times_seen integer not null default 0,
  times_correct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_user_subject_idx on public.questions(user_id, subject);
create index if not exists questions_user_hierarchy_idx on public.questions(user_id, subject, chapter, topic);
create index if not exists questions_user_review_idx on public.questions(user_id, next_review_at);
create index if not exists questions_user_type_idx on public.questions(user_id, type);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  session_type text not null check (session_type in ('practice','exam')),
  session_id uuid,
  selected_answer text,
  is_correct boolean not null default false,
  confidence integer check (confidence between 1 and 5),
  time_spent_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_time_idx on public.attempts(user_id, created_at desc);
create index if not exists attempts_question_idx on public.attempts(question_id, created_at desc);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  total_questions integer not null default 0,
  correct_answers integer not null default 0,
  duration_seconds integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists exam_sessions_user_time_idx on public.exam_sessions(user_id, started_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at before update on public.questions
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.exam_sessions enable row level security;

create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "questions own rows" on public.questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "attempts own rows" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exam sessions own rows" on public.exam_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Optional profile auto-create
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
