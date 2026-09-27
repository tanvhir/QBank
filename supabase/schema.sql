-- Quanta v2 — Supabase schema for a large personal question bank.
-- Run once in Supabase SQL Editor.
-- Uses per-user RLS, normalized taxonomy paths, server-side import, review scheduling and analytics RPCs.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.taxonomy_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  chapter text not null,
  topic text not null,
  question_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, subject, chapter, topic)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taxonomy_path_id uuid references public.taxonomy_paths(id) on delete set null,
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
  last_rating text check (last_rating in ('easy','good','hard','wrong')),
  streak integer not null default 0,
  lapses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  content_key text generated always as (
    md5(lower(regexp_replace(trim(question), '\\s+', ' ', 'g')) || '|' || lower(trim(subject)) || '|' || lower(trim(chapter)) || '|' || lower(trim(topic)))
  ) stored,
  unique(user_id, content_key)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  session_type text not null check (session_type in ('practice','reading','exam')),
  session_id uuid,
  selected_answer text,
  is_correct boolean not null default false,
  confidence integer check (confidence between 1 and 5),
  review_rating text check (review_rating in ('easy','good','hard','wrong')),
  time_spent_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

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

-- Upgrade-safe additions when this SQL is run over the v1 project.
alter table public.questions add column if not exists taxonomy_path_id uuid references public.taxonomy_paths(id) on delete set null;
alter table public.questions add column if not exists last_rating text;
alter table public.questions add column if not exists streak integer not null default 0;
alter table public.questions add column if not exists lapses integer not null default 0;
alter table public.questions add column if not exists content_key text generated always as (
  md5(lower(regexp_replace(trim(question), '\\s+', ' ', 'g')) || '|' || lower(trim(subject)) || '|' || lower(trim(chapter)) || '|' || lower(trim(topic)))
) stored;
alter table public.attempts add column if not exists review_rating text;

alter table public.attempts drop constraint if exists attempts_session_type_check;
alter table public.attempts add constraint attempts_session_type_check check (session_type in ('practice','reading','exam'));

alter table public.questions drop constraint if exists questions_last_rating_check;
alter table public.questions add constraint questions_last_rating_check check (last_rating is null or last_rating in ('easy','good','hard','wrong'));
alter table public.attempts drop constraint if exists attempts_review_rating_check;
alter table public.attempts add constraint attempts_review_rating_check check (review_rating is null or review_rating in ('easy','good','hard','wrong'));

-- Backfill taxonomy paths for questions that existed in v1.
insert into public.taxonomy_paths(user_id,subject,chapter,topic)
select distinct user_id,subject,chapter,topic from public.questions
on conflict(user_id,subject,chapter,topic) do nothing;
update public.questions q
set taxonomy_path_id=p.id
from public.taxonomy_paths p
where p.user_id=q.user_id and p.subject=q.subject and p.chapter=q.chapter and p.topic=q.topic and q.taxonomy_path_id is null;
update public.taxonomy_paths p
set question_count=(select count(*) from public.questions q where q.taxonomy_path_id=p.id);

create unique index if not exists questions_user_content_key_uidx on public.questions(user_id,content_key);

create index if not exists questions_user_created_idx on public.questions(user_id, created_at desc);
create index if not exists questions_user_hierarchy_idx on public.questions(user_id, subject, chapter, topic);
create index if not exists questions_user_review_idx on public.questions(user_id, next_review_at);
create index if not exists questions_user_type_idx on public.questions(user_id, type);
create index if not exists questions_user_search_idx on public.questions using gin (
  (lower(coalesce(question,'') || ' ' || coalesce(answer,'') || ' ' || coalesce(subject,'') || ' ' || coalesce(chapter,'') || ' ' || coalesce(topic,''))) gin_trgm_ops
);
create index if not exists taxonomy_user_hierarchy_idx on public.taxonomy_paths(user_id, subject, chapter, topic);
create index if not exists attempts_user_time_idx on public.attempts(user_id, created_at desc);
create index if not exists attempts_question_time_idx on public.attempts(question_id, created_at desc);
create index if not exists attempts_user_rating_idx on public.attempts(user_id, review_rating, created_at desc);
create index if not exists exam_sessions_user_time_idx on public.exam_sessions(user_id, started_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists questions_touch_updated_at on public.questions;
create trigger questions_touch_updated_at before update on public.questions
for each row execute function public.touch_updated_at();

drop trigger if exists taxonomy_touch_updated_at on public.taxonomy_paths;
create trigger taxonomy_touch_updated_at before update on public.taxonomy_paths
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.taxonomy_paths enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.exam_sessions enable row level security;

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "taxonomy own rows" on public.taxonomy_paths;
create policy "taxonomy own rows" on public.taxonomy_paths for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "questions own rows" on public.questions;
create policy "questions own rows" on public.questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "attempts own rows" on public.attempts;
create policy "attempts own rows" on public.attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exam sessions own rows" on public.exam_sessions;
create policy "exam sessions own rows" on public.exam_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- One unique taxonomy path per user. Questions share the same taxonomy row.
create or replace function public.ensure_taxonomy_path(p_subject text, p_chapter text, p_topic text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; begin
  insert into public.taxonomy_paths(user_id,subject,chapter,topic)
  values(auth.uid(), trim(p_subject), trim(p_chapter), trim(p_topic))
  on conflict(user_id,subject,chapter,topic) do update set updated_at=now()
  returning id into v_id;
  return v_id;
end; $$;

-- Efficient batched import. Duplicated normalized questions are skipped; paths are upserted.
-- Important: every UPDATE below is explicitly scoped to the current authenticated user.
create or replace function public.import_questions(p_questions jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  item jsonb; path_id uuid; ins integer:=0; skip integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  for item in select * from jsonb_array_elements(coalesce(p_questions,'[]'::jsonb)) loop
    path_id := public.ensure_taxonomy_path(
      coalesce(item->>'subject','Uncategorized'),
      coalesce(item->>'chapter','General'),
      coalesce(item->>'topic','General')
    );

    insert into public.questions(
      user_id,taxonomy_path_id,type,question,options,answer,explanation,reference_tags,subject,chapter,topic,difficulty,
      next_review_at,review_interval,ease_factor,times_seen,times_correct
    ) values (
      auth.uid(),path_id,coalesce(item->>'type','short'),trim(item->>'question'),coalesce(item->'options','[]'::jsonb),trim(item->>'answer'),
      nullif(item->>'explanation',''),coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(item->'reference_tags','[]'::jsonb)) x), '{}'),
      trim(coalesce(item->>'subject','Uncategorized')),trim(coalesce(item->>'chapter','General')),trim(coalesce(item->>'topic','General')),
      coalesce(item->>'difficulty','medium'),coalesce(nullif(item->>'next_review_at','')::date,current_date),
      coalesce(nullif(item->>'review_interval','')::int,1),coalesce(nullif(item->>'ease_factor','')::numeric,2.5),0,0
    )
    on conflict (user_id,content_key) do nothing;

    if found then ins := ins + 1; else skip := skip + 1; end if;
  end loop;

  -- Refresh only this user's taxonomy counters; this avoids an unscoped UPDATE.
  update public.taxonomy_paths p
  set question_count = (select count(*) from public.questions q where q.taxonomy_path_id=p.id)
  where p.user_id = auth.uid();

  return jsonb_build_object('inserted',ins,'skipped',skip);
end; $$;

-- Review button logic: Easy / Good / Hard / Wrong. This keeps the process deterministic and editable.
create or replace function public.record_review(
  p_question_id uuid,
  p_rating text,
  p_selected_answer text default '',
  p_time_spent_seconds int default 0,
  p_session_type text default 'practice',
  p_session_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare q public.questions%rowtype; v_correct boolean:=false; v_interval int; v_ease numeric; v_next date; v_streak int; v_lapses int;
begin
  select * into q from public.questions where id=p_question_id and user_id=auth.uid() for update;
  if q.id is null then raise exception 'Question not found'; end if;
  v_correct := p_rating in ('easy','good');
  v_ease := coalesce(q.ease_factor,2.5);
  v_interval := coalesce(q.review_interval,1);
  v_streak := coalesce(q.streak,0);
  v_lapses := coalesce(q.lapses,0);
  if p_rating='easy' then
    v_interval := greatest(4, round(v_interval * greatest(v_ease,2.5) * 1.4)); v_ease := least(3.0,v_ease+0.12); v_streak:=v_streak+1;
  elsif p_rating='good' then
    v_interval := greatest(2, round(v_interval * greatest(v_ease,2.2))); v_ease := least(3.0,v_ease+0.03); v_streak:=v_streak+1;
  elsif p_rating='hard' then
    v_interval := greatest(1, round(v_interval * 1.25)); v_ease := greatest(1.6,v_ease-0.05);
  else
    v_interval := 1; v_ease := greatest(1.6,v_ease-0.20); v_streak:=0; v_lapses:=v_lapses+1;
  end if;
  v_next := current_date + least(v_interval,3650);
  update public.questions set
    next_review_at=v_next, review_interval=v_interval, ease_factor=round(v_ease,2),
    times_seen=times_seen+1, times_correct=times_correct + case when v_correct then 1 else 0 end,
    last_rating=p_rating, streak=v_streak, lapses=v_lapses, updated_at=now()
  where id=q.id;
  insert into public.attempts(user_id,question_id,session_type,session_id,selected_answer,is_correct,review_rating,time_spent_seconds)
  values(auth.uid(),q.id,p_session_type,p_session_id,p_selected_answer,v_correct,p_rating,greatest(0,coalesce(p_time_spent_seconds,0)));
  return jsonb_build_object('is_correct',v_correct,'next_review_at',v_next,'review_interval',v_interval,'ease_factor',round(v_ease,2),'streak',v_streak);
end; $$;

create or replace function public.get_practice_pool(p_subject text default null,p_chapter text default null,p_topic text default null,p_mode text default 'due',p_limit int default 30,p_offset int default 0)
returns setof public.questions language sql security invoker as $$
  select q.* from public.questions q
  where q.user_id=auth.uid()
    and (p_subject is null or q.subject=p_subject)
    and (p_chapter is null or q.chapter=p_chapter)
    and (p_topic is null or q.topic=p_topic)
    and (
      p_mode='all' or (p_mode='due' and (q.next_review_at is null or q.next_review_at<=current_date))
      or (p_mode='weak' and (q.last_rating='wrong' or q.times_seen>0 and q.times_correct*100.0/greatest(q.times_seen,1)<60))
      or (p_mode='unseen' and q.times_seen=0)
    )
  order by case when p_mode='weak' then q.times_correct*1.0/greatest(q.times_seen,1) else 1 end asc, case when p_mode='exam' then random() end, q.next_review_at nulls first, q.created_at
  limit greatest(1,least(p_limit,200)) offset greatest(0,p_offset);
$$;

create or replace function public.get_dashboard_stats()
returns jsonb language sql security invoker as $$
  with q as (select * from public.questions where user_id=auth.uid()),
  a as (select * from public.attempts where user_id=auth.uid() and created_at>=current_date-30)
  select jsonb_build_object(
    'total_questions',(select count(*) from q),
    'total_mcq',(select count(*) from q where type='mcq'),
    'total_short',(select count(*) from q where type='short'),
    'due',(select count(*) from q where next_review_at is null or next_review_at<=current_date),
    'seen',(select coalesce(sum(times_seen),0) from q),
    'correct',(select coalesce(sum(times_correct),0) from q),
    'accuracy',(select coalesce(round(sum(times_correct)*100.0/nullif(sum(times_seen),0),0),0) from q),
    'sessions_30d',(select count(distinct coalesce(session_id,id)) from a),
    'daily',(select coalesce(jsonb_agg(x order by x.day),'[]'::jsonb) from (select created_at::date as day,count(*) total,count(*) filter(where is_correct) correct from a group by created_at::date) x),
    'subjects',(select coalesce(jsonb_agg(x order by x.accuracy asc),'[]'::jsonb) from (select subject,count(*) questions,coalesce(round(sum(times_correct)*100.0/nullif(sum(times_seen),0),0),0) accuracy from q group by subject) x)
  );
$$;

create or replace function public.get_scope_analytics(p_subject text default null,p_chapter text default null,p_topic text default null)
returns jsonb language sql security invoker as $$
with scoped as (
  select * from public.questions q where q.user_id=auth.uid()
    and (p_subject is null or q.subject=p_subject) and (p_chapter is null or q.chapter=p_chapter) and (p_topic is null or q.topic=p_topic)
), weak as (
  select id,question,subject,chapter,topic,times_seen,times_correct,
    coalesce(round(times_correct*100.0/nullif(times_seen,0),0),0) accuracy,last_rating,next_review_at
  from scoped where times_seen>0 and (last_rating='wrong' or times_correct*100.0/greatest(times_seen,1)<60)
  order by accuracy asc,times_seen desc limit 25
), by_subject as (
  select subject,count(*) questions,coalesce(round(sum(times_correct)*100.0/nullif(sum(times_seen),0),0),0) accuracy,
    count(*) filter(where last_rating='easy') easy,count(*) filter(where last_rating='hard') hard,count(*) filter(where last_rating='wrong') wrong
  from scoped group by subject order by accuracy asc
), by_chapter as (
  select chapter,count(*) questions,coalesce(round(sum(times_correct)*100.0/nullif(sum(times_seen),0),0),0) accuracy
  from scoped group by chapter order by accuracy asc
), by_topic as (
  select topic,count(*) questions,coalesce(round(sum(times_correct)*100.0/nullif(sum(times_seen),0),0),0) accuracy
  from scoped group by topic order by accuracy asc
), days as (
  select date_trunc('day',a.created_at)::date day,count(*) total,count(*) filter(where is_correct) correct
  from public.attempts a join scoped q on q.id=a.question_id where a.user_id=auth.uid() and a.created_at>=current_date-30 group by 1 order by 1
)
select jsonb_build_object(
 'summary',jsonb_build_object('questions',(select count(*) from scoped),'seen',(select coalesce(sum(times_seen),0) from scoped),'correct',(select coalesce(sum(times_correct),0) from scoped),'accuracy',(select coalesce(round(sum(times_correct)*100.0/nullif(sum(times_seen),0),0),0) from scoped),'easy',(select count(*) from scoped where last_rating='easy'),'good',(select count(*) from scoped where last_rating='good'),'hard',(select count(*) from scoped where last_rating='hard'),'wrong',(select count(*) from scoped where last_rating='wrong'),'due',(select count(*) from scoped where next_review_at is null or next_review_at<=current_date)),
 'subjects',coalesce((select jsonb_agg(by_subject) from by_subject),'[]'::jsonb),
 'chapters',coalesce((select jsonb_agg(by_chapter) from by_chapter),'[]'::jsonb),
 'topics',coalesce((select jsonb_agg(by_topic) from by_topic),'[]'::jsonb),
 'weak_questions',coalesce((select jsonb_agg(weak) from weak),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(days) from days),'[]'::jsonb)
);
$$;

grant execute on function public.import_questions(jsonb) to authenticated;
grant execute on function public.record_review(uuid,text,text,int,text,uuid) to authenticated;
grant execute on function public.get_practice_pool(text,text,text,text,int,int) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.get_scope_analytics(text,text,text) to authenticated;
grant execute on function public.ensure_taxonomy_path(text,text,text) to authenticated;
