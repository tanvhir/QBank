import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;

export function rowToQuestion(row){
  return {
    ...row,
    reference_tags: row.reference_tags || [],
    options: row.options || [],
  };
}

export async function fetchQuestionPage({userId, page=0, pageSize=40, search='', subject='', chapter='', topic='', type='all'}){
  if(!supabase || !userId) throw new Error('Sign in to access your question bank.');
  let q = supabase.from('questions').select('*', {count:'exact'}).eq('user_id', userId).order('created_at',{ascending:false});
  if(subject) q = q.eq('subject', subject);
  if(chapter) q = q.eq('chapter', chapter);
  if(topic) q = q.eq('topic', topic);
  if(type !== 'all') q = q.eq('type', type);
  if(search) {
    const needle = search.trim().replace(/[%_]/g, '\\$&');
    q = q.or(`question.ilike.%${needle}%,answer.ilike.%${needle}%,subject.ilike.%${needle}%,chapter.ilike.%${needle}%,topic.ilike.%${needle}%`);
  }
  const from = page * pageSize;
  const {data,error,count} = await q.range(from, from + pageSize - 1);
  if(error) throw error;
  return {rows:(data||[]).map(rowToQuestion), count:count||0};
}

export async function fetchHierarchy(userId){
  if(!supabase || !userId) return [];
  const {data,error} = await supabase.from('taxonomy_paths').select('id,subject,chapter,topic,question_count').eq('user_id',userId).order('subject').order('chapter').order('topic');
  if(error) throw error;
  return data || [];
}

export async function fetchDashboardStats(userId){
  if(!supabase || !userId) throw new Error('Sign in to view synced analytics.');
  const {data,error} = await supabase.rpc('get_dashboard_stats');
  if(error) throw error;
  return data || {};
}

export async function fetchAnalytics(userId,{subject='',chapter='',topic=''}={}){
  if(!supabase || !userId) throw new Error('Sign in to view analytics.');
  const {data,error} = await supabase.rpc('get_scope_analytics', {p_subject: subject || null, p_chapter: chapter || null, p_topic: topic || null});
  if(error) throw error;
  return data || {summary:{},subjects:[],chapters:[],topics:[],weak_questions:[],daily:[]};
}

export async function fetchPracticePool(userId,{subject='',chapter='',topic='',mode='due',limit=30,offset=0}={}){
  if(!supabase || !userId) throw new Error('Sign in to practice.');
  const {data,error} = await supabase.rpc('get_practice_pool', {
    p_subject: subject || null,
    p_chapter: chapter || null,
    p_topic: topic || null,
    p_mode: mode,
    p_limit: Math.min(Math.max(Number(limit)||30,1),200),
    p_offset: Math.max(0,Number(offset)||0),
  });
  if(error) throw error;
  return (data||[]).map(rowToQuestion);
}

export async function fetchAllQuestions(userId,{search='',subject='',chapter='',topic='',type='all'}={}){
  if(!supabase || !userId) throw new Error('Sign in to export your bank.');
  const pageSize=500; let page=0, out=[], total=null;
  while(total===null || out.length<total){
    const r=await fetchQuestionPage({userId,page,pageSize,search,subject,chapter,topic,type});
    out=out.concat(r.rows); total=r.count; if(!r.rows.length) break; page+=1;
  }
  return out;
}

export async function insertQuestions(userId, questions){
  if(!supabase || !userId) throw new Error('Sign in before importing questions.');
  if(!questions?.length) return {inserted:0, skipped:0};
  const chunkSize = 500;
  let inserted = 0, skipped = 0;
  for(let i=0;i<questions.length;i+=chunkSize){
    const chunk = questions.slice(i,i+chunkSize).map(q=>({
      type:q.type, question:q.question, options:q.options||[], answer:q.answer,
      explanation:q.explanation||'', reference_tags:q.reference_tags||[], subject:q.subject||'Uncategorized',
      chapter:q.chapter||'General', topic:q.topic||'General', difficulty:q.difficulty||'medium',
      next_review_at:q.next_review_at||new Date().toISOString().slice(0,10), review_interval:q.review_interval||1,
      ease_factor:q.ease_factor||2.5, times_seen:q.times_seen||0, times_correct:q.times_correct||0,
    }));
    const {data,error}=await supabase.rpc('import_questions', {p_questions:chunk});
    if(error) throw error;
    inserted += Number(data?.inserted||0);
    skipped += Number(data?.skipped||0);
  }
  return {inserted,skipped};
}

export async function updateQuestion(userId, q){
  if(!supabase || !userId) return;
  const {error} = await supabase.from('questions').update({
    type:q.type, question:q.question, options:q.options||[], answer:q.answer, explanation:q.explanation||'',
    reference_tags:q.reference_tags||[], subject:q.subject||'Uncategorized', chapter:q.chapter||'General',
    topic:q.topic||'General', difficulty:q.difficulty||'medium', next_review_at:q.next_review_at||null,
    review_interval:q.review_interval||1, ease_factor:q.ease_factor||2.5, times_seen:q.times_seen||0,
    times_correct:q.times_correct||0, last_rating:q.last_rating||null, streak:q.streak||0, lapses:q.lapses||0,
  }).eq('id',q.id).eq('user_id',userId);
  if(error) throw error;
}

export async function applyReview(userId,q,{rating,selected_answer='',time_spent_seconds=0,session_type='practice',session_id=null}={}){
  if(!supabase || !userId) throw new Error('Sign in to save review progress.');
  const {data,error} = await supabase.rpc('record_review', {
    p_question_id:q.id,
    p_rating:rating,
    p_selected_answer:selected_answer,
    p_time_spent_seconds:Math.max(0,Math.round(Number(time_spent_seconds)||0)),
    p_session_type:session_type,
    p_session_id:session_id,
  });
  if(error) throw error;
  return data;
}

export async function deleteQuestion(userId,id){
  if(!supabase || !userId) return;
  const {error}=await supabase.from('questions').delete().eq('id',id).eq('user_id',userId);
  if(error) throw error;
}

export async function insertExamSession(userId,session){
  if(!supabase || !userId) throw new Error('Sign in to save an exam.');
  const {data,error}=await supabase.from('exam_sessions').insert({
    user_id:userId, title:session.title, total_questions:session.total_questions,
    correct_answers:session.correct_answers||0, duration_seconds:session.duration_seconds||0,
    started_at:session.started_at||new Date().toISOString(), completed_at:session.completed_at||new Date().toISOString(),
  }).select('id').single();
  if(error) throw error;
  return data?.id;
}

export async function insertAttempts(userId, attempts){
  if(!supabase || !userId || !attempts?.length) return;
  const {error}=await supabase.from('attempts').insert(attempts.map(a=>({
    user_id:userId, question_id:a.question_id, session_type:a.session_type||'practice', session_id:a.session_id||null,
    selected_answer:a.selected_answer||'', is_correct:!!a.is_correct, confidence:a.confidence||null,
    review_rating:a.review_rating||null, time_spent_seconds:Math.max(0,Math.round(Number(a.time_spent_seconds)||0)),
  })));
  if(error) throw error;
}

export async function signIn(email,password){
  if(!supabase) throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data?.user;
}

export async function signUp(email,password,name){
  if(!supabase) throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name}}});
  if(error) throw error;
  return data;
}
