import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export function rowToQuestion(row){
  return {
    ...row,
    reference_tags: row.reference_tags || [],
    options: row.options || [],
  };
}

export async function fetchQuestionPage({userId, page=0, pageSize=50, search='', subject='All', type='all'}){
  if(!supabase || !userId) throw new Error('Supabase is not configured.');
  let q = supabase.from('questions').select('*', {count:'exact'}).eq('user_id', userId).order('created_at',{ascending:false});
  if(subject !== 'All') q = q.eq('subject', subject);
  if(type !== 'all') q = q.eq('type', type);
  if(search) q = q.or(`question.ilike.%${search}%,subject.ilike.%${search}%,chapter.ilike.%${search}%,topic.ilike.%${search}%`);
  const from = page * pageSize;
  const {data,error,count} = await q.range(from, from + pageSize - 1);
  if(error) throw error;
  return {rows:(data||[]).map(rowToQuestion), count:count||0};
}

export async function fetchSubjects(userId){
  if(!supabase || !userId) return [];
  const {data,error} = await supabase.from('questions').select('subject').eq('user_id',userId).limit(1000);
  if(error) throw error;
  return [...new Set((data||[]).map(x=>x.subject).filter(Boolean))].sort();
}

export async function insertQuestions(userId, questions){
  if(!supabase || !userId) return;
  const rows = questions.map(q=>({
    user_id:userId, type:q.type, question:q.question, options:q.options||[], answer:q.answer,
    explanation:q.explanation||'', reference_tags:q.reference_tags||[], subject:q.subject||'Uncategorized',
    chapter:q.chapter||'General', topic:q.topic||'General', difficulty:q.difficulty||'medium',
    next_review_at:q.next_review_at||new Date().toISOString().slice(0,10), review_interval:q.review_interval||1,
    ease_factor:q.ease_factor||2.5, times_seen:q.times_seen||0, times_correct:q.times_correct||0
  }));
  if(!rows.length) return;
  const {error} = await supabase.from('questions').insert(rows);
  if(error) throw error;
}

export async function updateQuestion(userId, q){
  if(!supabase || !userId) return;
  const {error} = await supabase.from('questions').update({
    type:q.type, question:q.question, options:q.options||[], answer:q.answer, explanation:q.explanation||'',
    reference_tags:q.reference_tags||[], subject:q.subject||'Uncategorized', chapter:q.chapter||'General',
    topic:q.topic||'General', difficulty:q.difficulty||'medium', next_review_at:q.next_review_at||null,
    review_interval:q.review_interval||1, ease_factor:q.ease_factor||2.5, times_seen:q.times_seen||0, times_correct:q.times_correct||0
  }).eq('id',q.id).eq('user_id',userId);
  if(error) throw error;
}

export async function deleteQuestion(userId,id){
  if(!supabase || !userId) return;
  const {error}=await supabase.from('questions').delete().eq('id',id).eq('user_id',userId);
  if(error) throw error;
}

export async function insertAttempts(userId, attempts){
  if(!supabase || !userId || !attempts?.length) return;
  const {error}=await supabase.from('attempts').insert(attempts.map(a=>({
    user_id:userId, question_id:a.question_id, session_type:a.session_type||'practice',
    selected_answer:a.selected_answer||'', is_correct:!!a.is_correct,
    confidence:a.confidence||null, time_spent_seconds:a.time_spent_seconds||0
  })));
  if(error) throw error;
}
