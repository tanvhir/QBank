import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3, BookOpen, Brain, Check, ChevronDown, ChevronRight, CircleHelp,
  Clock3, Download, FileJson, Filter, Flame, FolderTree, Gauge, History,
  Import, LayoutDashboard, LogIn, Menu, Moon, MoreHorizontal, Plus,
  Search, Settings, Sparkles, Target, TrendingUp, Upload, X, Zap
} from 'lucide-react';
import './styles.css';
import { supabase, fetchQuestionPage, fetchSubjects, insertQuestions, updateQuestion, deleteQuestion, insertAttempts } from './lib/db';

const demoQuestions = [
  { id:'q1', type:'mcq', question:'What is the capital of Bangladesh?', options:['Dhaka','Chittagong','Rajshahi','Sylhet'], answer:'Dhaka', explanation:'Dhaka is the capital and largest city of Bangladesh.', reference_tags:['PYQ','BCS','2023'], subject:'Geography', chapter:'South Asia', topic:'Capitals', difficulty:'easy', times_seen:18, times_correct:15, next_review_at:'2026-09-28' },
  { id:'q2', type:'mcq', question:'Which gas is most abundant in Earth’s atmosphere?', options:['Oxygen','Nitrogen','Carbon dioxide','Argon'], answer:'Nitrogen', explanation:'Nitrogen makes up about 78% of Earth’s atmosphere by volume.', reference_tags:['PYQ','General Science'], subject:'Science', chapter:'Earth Science', topic:'Atmosphere', difficulty:'easy', times_seen:22, times_correct:20, next_review_at:'2026-10-01' },
  { id:'q3', type:'short', question:'Define opportunity cost in one sentence.', options:[], answer:'The value of the next best alternative forgone.', explanation:'Opportunity cost measures what you give up when choosing one option over the next best alternative.', reference_tags:['Economics','Concept'], subject:'Economics', chapter:'Microeconomics', topic:'Basic Concepts', difficulty:'medium', times_seen:9, times_correct:4, next_review_at:'2026-09-28' },
  { id:'q4', type:'mcq', question:'Which data structure follows LIFO order?', options:['Queue','Stack','Graph','Heap'], answer:'Stack', explanation:'A stack removes the most recently inserted item first (Last In, First Out).', reference_tags:['DSA','Interview'], subject:'Computer Science', chapter:'Data Structures', topic:'Stack', difficulty:'medium', times_seen:13, times_correct:7, next_review_at:'2026-09-28' },
  { id:'q5', type:'mcq', question:'If a train travels 120 km in 2 hours, what is its average speed?', options:['40 km/h','50 km/h','60 km/h','80 km/h'], answer:'60 km/h', explanation:'Average speed = distance ÷ time = 120 ÷ 2 = 60 km/h.', reference_tags:['Math','Formula'], subject:'Mathematics', chapter:'Arithmetic', topic:'Speed Time Distance', difficulty:'easy', times_seen:11, times_correct:10, next_review_at:'2026-09-30' },
  { id:'q6', type:'mcq', question:'Which branch of government typically interprets laws?', options:['Legislature','Executive','Judiciary','Civil Service'], answer:'Judiciary', explanation:'Courts and judges within the judiciary interpret and apply laws.', reference_tags:['Civics','PYQ'], subject:'Civics', chapter:'Government', topic:'Branches', difficulty:'medium', times_seen:7, times_correct:3, next_review_at:'2026-09-28' },
  { id:'q7', type:'short', question:'What does GDP stand for?', options:[], answer:'Gross Domestic Product', explanation:'GDP is the monetary value of final goods and services produced within a country during a given period.', reference_tags:['Economics','Basics'], subject:'Economics', chapter:'Macroeconomics', topic:'National Income', difficulty:'easy', times_seen:8, times_correct:7, next_review_at:'2026-10-04' },
  { id:'q8', type:'mcq', question:'What is the hexadecimal representation of decimal 15?', options:['E','F','10','D'], answer:'F', explanation:'Hexadecimal digits go 0–9 followed by A–F, so decimal 15 is F.', reference_tags:['CS','PYQ'], subject:'Computer Science', chapter:'Number Systems', topic:'Hexadecimal', difficulty:'medium', times_seen:10, times_correct:6, next_review_at:'2026-09-28' },
];

const demoAttempts = [
  { date:'2026-09-22', correct:18, total:25 }, { date:'2026-09-23', correct:20, total:25 },
  { date:'2026-09-24', correct:16, total:25 }, { date:'2026-09-25', correct:22, total:28 },
  { date:'2026-09-26', correct:24, total:30 }, { date:'2026-09-27', correct:25, total:30 },
  { date:'2026-09-28', correct:7, total:8 },
];

const nav = [
  ['dashboard','Dashboard',LayoutDashboard], ['questions','Question bank',BookOpen], ['practice','Practice',Brain],
  ['exams','Exams',Target], ['analytics','Analytics',BarChart3],
];

function cx(...xs){ return xs.filter(Boolean).join(' '); }
function percent(a,b){ return b ? Math.round((a/b)*100) : 0; }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function App(){
  const [page,setPage]=useState('dashboard');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [questions,setQuestions]=useState(demoQuestions);
  const [attempts,setAttempts]=useState(demoAttempts);
  const [user,setUser]=useState(null);
  const [toast,setToast]=useState('');
  const [search,setSearch]=useState('');
  const [authOpen,setAuthOpen]=useState(false);

  useEffect(()=>{
    const savedQ = localStorage.getItem('quanta_questions');
    const savedA = localStorage.getItem('quanta_attempts');
    if(savedQ) setQuestions(JSON.parse(savedQ));
    if(savedA) setAttempts(JSON.parse(savedA));
    if(supabase){ supabase.auth.getSession().then(({data})=>setUser(data.session?.user ?? null));
      const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user ?? null));
      return ()=>sub.subscription.unsubscribe();
    }
  },[]);
  useEffect(()=>{
    if(!supabase || !user) return;
    (async()=>{
      try {
        const {rows} = await fetchQuestionPage({userId:user.id, page:0, pageSize:1000});
        if(rows.length) setQuestions(rows);
      } catch(e) { setToast('Supabase sync error: '+e.message); }
    })();
  },[user]);
  useEffect(()=>{ if(!user) localStorage.setItem('quanta_questions',JSON.stringify(questions)); },[questions,user]);
  useEffect(()=>{ if(!user) localStorage.setItem('quanta_attempts',JSON.stringify(attempts)); },[attempts,user]);
  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),2800); return ()=>clearTimeout(t); } },[toast]);

  const stats = useMemo(()=>{
    const total = questions.length;
    const seen = questions.reduce((s,q)=>s+Number(q.times_seen||0),0);
    const correct = questions.reduce((s,q)=>s+Number(q.times_correct||0),0);
    const due = questions.filter(q=>!q.next_review_at || q.next_review_at <= new Date().toISOString().slice(0,10)).length;
    return {total,seen,correct,accuracy:percent(correct,seen),due};
  },[questions]);
  const changePage = p => { setPage(p); setSidebarOpen(false); };
  const saveQuestion = async (q)=>{
    setQuestions(prev=>prev.map(x=>x.id===q.id?q:x));
    if(supabase && user){ try{ await updateQuestion(user.id,q); setToast('Saved to Supabase'); } catch(e){ setToast('Save failed: '+e.message); } }
  };
  const removeQuestion = async (id)=>{
    setQuestions(prev=>prev.filter(x=>x.id!==id));
    if(supabase && user){ try{ await deleteQuestion(user.id,id); setToast('Deleted from Supabase'); } catch(e){ setToast('Delete failed: '+e.message); } }
  };
  const importQuestionBatch = async (batch)=>{
    setQuestions(prev=>[...batch,...prev]);
    if(supabase && user){ try{ await insertQuestions(user.id,batch); setToast(`${batch.length} questions imported to Supabase`); } catch(e){ setToast('Import failed: '+e.message); } }
  };
  const createQuestion = async (q)=>{
    setQuestions(prev=>[q,...prev]);
    if(supabase && user){ try{ await insertQuestions(user.id,[q]); setToast('Question created in Supabase'); } catch(e){ setToast('Create failed: '+e.message); } }
  };
  const recordAttempt = async (a)=>{
    if(supabase && user && a.question_id){ try{ await insertAttempts(user.id,[a]); } catch(e){ setToast('Attempt sync failed: '+e.message); } }
  };

  async function signOut(){ if(supabase) await supabase.auth.signOut(); setUser(null); setToast('Signed out'); }

  return <div className="app-shell">
    <aside className={cx('sidebar',sidebarOpen&&'open')}>
      <div className="brand"><div className="brand-mark"><span></span><span></span></div><div><strong>Quanta</strong><small>question bank</small></div></div>
      <div className="workspace">PERSONAL</div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={cx('nav-item',page===id&&'active')} onClick={()=>changePage(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-spacer"/>
      <button className="nav-item" onClick={()=>changePage('import')}><Import size={18}/><span>Import / export</span></button>
      <button className="nav-item" onClick={()=>changePage('settings')}><Settings size={18}/><span>Settings</span></button>
      <div className="profile-mini"><div className="avatar">{user?.email?.slice(0,1).toUpperCase() || 'T'}</div><div><strong>{user?.email?.split('@')[0] || 'Tanvir'}</strong><small>{supabase ? (user ? 'Synced with Supabase' : 'Local demo') : 'Local demo'}</small></div><button title="More"><MoreHorizontal size={17}/></button></div>
    </aside>
    {sidebarOpen && <div className="mobile-backdrop" onClick={()=>setSidebarOpen(false)}/>} 
    <main className="main">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button>
        <div className="breadcrumbs"><span>Quanta</span><ChevronRight size={14}/><strong>{nav.find(n=>n[0]===page)?.[1] || page[0].toUpperCase()+page.slice(1)}</strong></div>
        <div className="top-actions">
          <div className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions…"/></div>
          <button className="icon-btn" onClick={()=>setToast('Focus mode: keep only the current task visible')} title="Focus"><Zap size={18}/></button>
          {user ? <button className="user-pill" onClick={signOut}><div className="avatar small">{user.email?.slice(0,1).toUpperCase()}</div><span>Sign out</span></button> : <button className="signin-btn" onClick={()=>setAuthOpen(true)}><LogIn size={16}/> Sign in</button>}
        </div>
      </header>
      <div className="page-wrap">
        {page==='dashboard' && <Dashboard stats={stats} questions={questions} attempts={attempts} onPage={changePage}/>} 
        {page==='questions' && <QuestionBank questions={questions} setQuestions={setQuestions} saveQuestion={saveQuestion} removeQuestion={removeQuestion} createQuestion={createQuestion} query={search} onToast={setToast}/>} 
        {page==='import' && <ImportExport questions={questions} setQuestions={setQuestions} importQuestionBatch={importQuestionBatch} onToast={setToast}/>} 
        {page==='practice' && <Practice questions={questions} setQuestions={setQuestions} saveQuestion={saveQuestion} recordAttempt={recordAttempt} setAttempts={setAttempts} onToast={setToast}/>} 
        {page==='exams' && <Exams questions={questions} setQuestions={setQuestions} setAttempts={setAttempts} onToast={setToast}/>} 
        {page==='analytics' && <Analytics questions={questions} attempts={attempts}/>} 
        {page==='settings' && <SettingsPage user={user} setToast={setToast}/>} 
      </div>
    </main>
    {toast && <div className="toast"><Check size={15}/>{toast}</div>}
    {authOpen && <AuthModal close={()=>setAuthOpen(false)} onAuthed={(u)=>{setUser(u);setAuthOpen(false);setToast('Welcome to Quanta')}}/>}
  </div>
}

function Dashboard({stats,questions,attempts,onPage}){
  const weak = [...questions].sort((a,b)=>percent(a.times_correct,a.times_seen)-percent(b.times_correct,b.times_seen)).slice(0,4);
  const subjects = [...new Set(questions.map(q=>q.subject))].slice(0,5);
  return <>
    <div className="page-title-row"><div><p className="eyebrow">TODAY · ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</p><h1>Keep your streak going.</h1><p className="subtle">A calm view of your question bank, reviews, and performance.</p></div><button className="primary" onClick={()=>onPage('practice')}><Brain size={17}/> Start practice</button></div>
    <section className="stat-grid four">
      <StatCard icon={<BookOpen size={18}/>} label="Questions" value={stats.total.toLocaleString()} note="in your bank"/>
      <StatCard icon={<Target size={18}/>} label="Accuracy" value={`${stats.accuracy}%`} note={`${stats.seen.toLocaleString()} attempts recorded`}/>
      <StatCard icon={<Brain size={18}/>} label="Due today" value={stats.due.toLocaleString()} note="spaced repetition"/>
      <StatCard icon={<Flame size={18}/>} label="7 day streak" value="6" note="best: 12 days"/>
    </section>
    <section className="dashboard-grid">
      <Panel title="Progress" action={<button className="link-btn" onClick={()=>onPage('analytics')}>View analysis <ChevronRight size={14}/></button>} className="progress-panel">
        <MiniTrend attempts={attempts}/>
        <div className="legend-row"><span><i className="dot"/> Daily accuracy</span><span>Last 7 study days</span></div>
      </Panel>
      <Panel title="Review queue" action={<button className="link-btn" onClick={()=>onPage('practice')}>Practice due <ChevronRight size={14}/></button>}>
        <div className="queue-number">{stats.due}</div><p className="subtle">questions are ready for review</p>
        <div className="progress-bar"><span style={{width:`${Math.min(100,(stats.seen?stats.due/stats.total*100:0)+8)}%`}}/></div>
        <div className="micro-grid"><div><strong>{questions.filter(q=>q.difficulty==='easy').length}</strong><small>easy</small></div><div><strong>{questions.filter(q=>q.difficulty==='medium').length}</strong><small>medium</small></div><div><strong>{questions.filter(q=>q.difficulty==='hard').length}</strong><small>hard</small></div></div>
      </Panel>
    </section>
    <section className="dashboard-grid lower">
      <Panel title="Weak areas" action={<button className="link-btn" onClick={()=>onPage('analytics')}>All analysis <ChevronRight size={14}/></button>}>
        <div className="weak-list">{weak.map(q=>{const p=percent(q.times_correct,q.times_seen);return <button className="weak-item" key={q.id} onClick={()=>onPage('practice')}><div><strong>{q.subject}</strong><span>{q.chapter} · {q.topic}</span></div><div className="weak-score"><span>{p}%</span><div className="thin"><i style={{width:`${p}%`}}/></div></div></button>})}</div>
      </Panel>
      <Panel title="Study map" action={<button className="link-btn" onClick={()=>onPage('questions')}>Open bank <ChevronRight size={14}/></button>}>
        <div className="subject-list">{subjects.map(s=>{const n=questions.filter(q=>q.subject===s).length;return <div key={s} className="subject-row"><span>{s}</span><span>{n}<small> questions</small></span></div>})}</div>
        <div className="hint"><Sparkles size={15}/> Organize everything as <strong>Subject → Chapter → Topic</strong>.</div>
      </Panel>
    </section>
  </>
}

function StatCard({icon,label,value,note}){return <div className="stat-card"><div className="stat-top"><span className="soft-icon">{icon}</span><span className="stat-label">{label}</span></div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div>}

function Panel({title,action,children,className=''}){return <section className={cx('panel',className)}><div className="panel-head"><h2>{title}</h2>{action}</div>{children}</section>}

function MiniTrend({attempts}){
  const vals=attempts.slice(-7).map(a=>percent(a.correct,a.total));
  const max=Math.max(...vals,100), min=Math.min(...vals,0);
  const w=620,h=190,pad=16;
  const pts=vals.map((v,i)=>[pad+i*((w-pad*2)/Math.max(vals.length-1,1)), h-pad-(v-min)/(max-min||1)*(h-pad*2)]);
  const d=pts.map((p,i)=>(i?'L':'M')+p[0]+','+p[1]).join(' ');
  return <div className="trend-wrap"><svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="trend-svg"><path d={`M${pad},${h-pad} H${w-pad}`} className="axis"/><path d={d} className="trend-line"/>{pts.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="4" className="trend-dot"/>)}<text x={pad} y="18" className="chart-label">100%</text><text x={pad} y={h-2} className="chart-label">0%</text></svg><div className="trend-dates">{attempts.slice(-7).map(a=><span key={a.date}>{new Date(a.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>)}</div></div>
}

function QuestionBank({questions,setQuestions,saveQuestion,removeQuestion,createQuestion,query,onToast}){
  const [subject,setSubject]=useState('All'); const [type,setType]=useState('all'); const [selected,setSelected]=useState(null);
  const filtered=questions.filter(q=>(subject==='All'||q.subject===subject)&&(type==='all'||q.type===type)&&((q.question+' '+q.subject+' '+q.chapter+' '+q.topic+' '+(q.reference_tags||[]).join(' ')).toLowerCase().includes(query.toLowerCase())));
  const subjects=['All',...new Set(questions.map(q=>q.subject))];
  function add(){const q={id:uid(),type:'mcq',question:'New question',options:['Option A','Option B','Option C','Option D'],answer:'Option A',explanation:'',reference_tags:[],subject:'Uncategorized',chapter:'General',topic:'General',difficulty:'medium',times_seen:0,times_correct:0,next_review_at:new Date().toISOString().slice(0,10)};if(createQuestion) createQuestion(q); else setQuestions([q,...questions]); setSelected(q);onToast('Question created');}
  function remove(id){setQuestions(questions.filter(q=>q.id!==id));setSelected(null);onToast('Question deleted');}
  return <>
    <div className="page-title-row compact"><div><p className="eyebrow">LIBRARY</p><h1>Question bank</h1><p className="subtle">Fast search across a large bank without clutter.</p></div><button className="primary" onClick={add}><Plus size={17}/> New question</button></div>
    <div className="toolbar"><div className="seg"><button className={type==='all'?'active':''} onClick={()=>setType('all')}>All</button><button className={type==='mcq'?'active':''} onClick={()=>setType('mcq')}>MCQ</button><button className={type==='short'?'active':''} onClick={()=>setType('short')}>Short</button></div><div className="select-wrap"><Filter size={15}/><select value={subject} onChange={e=>setSubject(e.target.value)}>{subjects.map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={14}/></div><span className="result-count">{filtered.length.toLocaleString()} shown</span></div>
    <div className="content-split"><div className="question-table panel"><div className="table-head"><span>Question</span><span>Structure</span><span>Accuracy</span><span>Review</span></div>{filtered.map(q=><button key={q.id} className={cx('q-row',selected?.id===q.id&&'selected')} onClick={()=>setSelected(q)}><div className="q-main"><div className="badges"><span className="badge">{q.type==='mcq'?'MCQ':'SHORT'}</span>{(q.reference_tags||[]).slice(0,2).map(t=><span key={t} className="badge muted">{t}</span>)}</div><strong>{q.question}</strong><small>{q.subject} · {q.chapter} · {q.topic}</small></div><div>{q.subject}<small>{q.chapter}</small></div><div><strong>{percent(q.times_correct,q.times_seen)}%</strong><small>{q.times_seen||0} attempts</small></div><div><span className={cx('due-dot',(!q.next_review_at||q.next_review_at<=new Date().toISOString().slice(0,10))&&'due')}/>{q.next_review_at ? new Date(q.next_review_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : 'Now'}</div></button>)}</div><QuestionDetail q={selected} remove={removeQuestion||remove} setQuestions={setQuestions} saveQuestion={saveQuestion} questions={questions} onToast={onToast}/></div>
  </>
}

function QuestionDetail({q,remove,saveQuestion,setQuestions,questions,onToast}){
  if(!q) return <div className="panel detail-empty"><CircleHelp size={28}/><strong>Select a question</strong><span>Inspect, edit, or jump into practice.</span></div>;
  const update=(patch)=>setQuestions(questions.map(x=>x.id===q.id?{...x,...patch}:x));
  return <aside className="panel detail-panel"><div className="detail-head"><div><span className="badge">{q.type.toUpperCase()}</span><h3>Question details</h3></div><button className="icon-btn" onClick={()=>remove(q.id)} title="Delete"><X size={17}/></button></div><label>Question<textarea value={q.question} onChange={e=>update({question:e.target.value})}/></label>{q.type==='mcq'&&<div className="option-stack">{q.options.map((o,i)=><label key={i}>Option {String.fromCharCode(65+i)}<input value={o} onChange={e=>update({options:q.options.map((x,j)=>j===i?e.target.value:x)})}/></label>)}</div>}<label>Answer<input value={q.answer} onChange={e=>update({answer:e.target.value})}/></label><div className="two-col"><label>Subject<input value={q.subject} onChange={e=>update({subject:e.target.value})}/></label><label>Chapter<input value={q.chapter} onChange={e=>update({chapter:e.target.value})}/></label></div><label>Topic<input value={q.topic} onChange={e=>update({topic:e.target.value})}/></label><label>Reference tags<input value={(q.reference_tags||[]).join(', ')} onChange={e=>update({reference_tags:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})}/></label><label>Explanation<textarea value={q.explanation||''} onChange={e=>update({explanation:e.target.value})}/></label><button className="secondary full" onClick={()=>saveQuestion?saveQuestion(questions.find(x=>x.id===q.id)||q):onToast('Changes saved locally.')}>Save changes</button></aside>
}

function ImportExport({questions,setQuestions,importQuestionBatch,onToast}){
  const [text,setText]=useState(''); const [format,setFormat]=useState('auto'); const [preview,setPreview]=useState([]);
  const parse=()=>{const items = format==='json' ? parseJson(text) : format==='csv' ? parseCsv(text) : parsePasted(text); setPreview(items); onToast(`${items.length} question(s) detected`)};
  const commit=()=>{if(!preview.length)return;if(importQuestionBatch) importQuestionBatch(preview); else setQuestions([...preview,...questions]);setText('');setPreview([]);onToast(`${preview.length} questions imported`)};
  const exportJson=()=>downloadFile('quanta-questions.json',JSON.stringify(questions,null,2),'application/json');
  const exportCsv=()=>{const rows=[['type','question','options','answer','explanation','reference_tags','subject','chapter','topic','difficulty'],...questions.map(q=>[q.type,q.question,(q.options||[]).join(' | '),q.answer,q.explanation||'',(q.reference_tags||[]).join(' | '),q.subject,q.chapter,q.topic,q.difficulty])];downloadFile('quanta-questions.csv',rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n'),'text/csv')};
  return <><div className="page-title-row compact"><div><p className="eyebrow">DATA</p><h1>Import / export</h1><p className="subtle">Paste from NotebookLM, AI tools, notes, JSON, or CSV.</p></div><div className="export-actions"><button className="secondary" onClick={exportJson}><FileJson size={16}/> JSON</button><button className="secondary" onClick={exportCsv}><Download size={16}/> CSV</button></div></div><div className="import-grid"><section className="panel"><div className="panel-head"><h2>Smart import</h2><span className="ai-note"><Sparkles size={14}/> auto-detect</span></div><div className="import-format"><div className="seg"><button className={format==='auto'?'active':''} onClick={()=>setFormat('auto')}>Auto</button><button className={format==='json'?'active':''} onClick={()=>setFormat('json')}>JSON</button><button className={format==='csv'?'active':''} onClick={()=>setFormat('csv')}>CSV</button></div><label className="file-btn"><Upload size={15}/> Choose file<input type="file" accept=".json,.csv,.txt,.md" onChange={async e=>{const f=e.target.files?.[0];if(f)setText(await f.text())}} hidden/></label></div><textarea className="big-import" value={text} onChange={e=>setText(e.target.value)} placeholder={'Paste questions here…\n\nQuestion: …\nA. …\nB. …\nAnswer: B\nSubject: …\nChapter: …\nTopic: …\nTags: PYQ, 2025\nExplanation: …'} /><div className="import-foot"><span>{text.length.toLocaleString()} characters</span><button className="primary" onClick={parse}><Sparkles size={16}/> Detect questions</button></div></section><section className="panel"><div className="panel-head"><h2>Preview</h2><span>{preview.length} detected</span></div>{preview.length===0?<div className="preview-empty"><Sparkles size={24}/><strong>Nothing to review yet</strong><span>Detect first. You can fix fields before importing.</span></div>:<><div className="preview-list">{preview.slice(0,6).map((q,i)=><div className="preview-item" key={i}><span className="badge">{q.type.toUpperCase()}</span><strong>{q.question}</strong><small>{q.subject} · {q.chapter} · {q.topic}</small></div>)}</div><button className="primary full" onClick={commit}>Import {preview.length} questions</button></>}</section></div></>
}

function Practice({questions,setQuestions,saveQuestion,recordAttempt,setAttempts,onToast}){
  const [filters,setFilters]=useState({subject:'All',chapter:'All',topic:'All',mode:'due'}); const [idx,setIdx]=useState(0); const [answer,setAnswer]=useState(''); const [revealed,setRevealed]=useState(false); const [done,setDone]=useState(false); const [results,setResults]=useState([]);
  const subjects=['All',...new Set(questions.map(q=>q.subject))];
  const pool=questions.filter(q=>(filters.subject==='All'||q.subject===filters.subject)&&(filters.chapter==='All'||q.chapter===filters.chapter)&&(filters.topic==='All'||q.topic===filters.topic)&&(filters.mode==='all'||!q.next_review_at||q.next_review_at<=new Date().toISOString().slice(0,10))).slice(0,30);
  function reset(){setIdx(0);setAnswer('');setRevealed(false);setDone(false);setResults([])}
  function submit(){const q=pool[idx]; const ok=normalize(answer)===normalize(q.answer) || (q.type==='mcq' && q.options.some(o=>o===answer) && normalize(oToLetter(q.options,answer))===normalize(q.answer)); setRevealed(true); const next=review(q,ok); setQuestions(prev=>prev.map(x=>x.id===q.id?next:x)); if(saveQuestion) saveQuestion(next); if(recordAttempt) recordAttempt({question_id:q.id,session_type:'practice',selected_answer:answer,is_correct:ok}); setResults(r=>[...r,{ok,qId:q.id}]);}
  function next(){if(idx+1>=pool.length){setDone(true);setAttempts(a=>[...a,{date:new Date().toISOString().slice(0,10),correct:results.filter(x=>x.ok).length+(revealed&&results.length && results.at(-1).ok?0:0),total:pool.length}]);onToast('Practice session recorded');}else{setIdx(idx+1);setAnswer('');setRevealed(false)}}
  return <><div className="page-title-row compact"><div><p className="eyebrow">ADAPTIVE PRACTICE</p><h1>Practice</h1><p className="subtle">Work only on what needs attention.</p></div><button className="secondary" onClick={reset}><History size={16}/> Reset session</button></div><div className="practice-layout"><section className="panel practice-side"><h2>Session</h2><label>Subject<select value={filters.subject} onChange={e=>{setFilters({...filters,subject:e.target.value});reset()}}>{subjects.map(s=><option key={s}>{s}</option>)}</select></label><label>Mode<select value={filters.mode} onChange={e=>{setFilters({...filters,mode:e.target.value});reset()}}><option value="due">Due for review</option><option value="all">All questions</option></select></label><div className="practice-summary"><span><strong>{pool.length}</strong> queued</span><span><strong>{results.filter(r=>r.ok).length}</strong> correct</span></div></section><section className="panel practice-card">{done?<ResultCard results={results} pool={pool} reset={reset}/>:pool.length===0?<div className="empty-state"><Brain size={28}/><strong>Nothing due here.</strong><span>Try “All questions” or choose another subject.</span></div>:<><div className="practice-progress"><span>Question {idx+1} / {pool.length}</span><div><i style={{width:`${((idx)/pool.length)*100}%`}}/></div></div><div className="question-hero"><span className="badge">{pool[idx].type.toUpperCase()}</span><span className="eyebrow-inline">{pool[idx].subject} · {pool[idx].chapter} · {pool[idx].topic}</span><h2>{pool[idx].question}</h2>{pool[idx].type==='mcq'?<div className="answer-list">{pool[idx].options.map((o,i)=><button key={o} className={cx('answer-option',revealed&&o===pool[idx].answer&&'correct',revealed&&answer===o&&o!==pool[idx].answer&&'incorrect',answer===o&&!revealed&&'picked')} onClick={()=>!revealed&&setAnswer(o)}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>:<textarea className="short-answer" value={answer} onChange={e=>!revealed&&setAnswer(e.target.value)} placeholder="Type your answer…"/>}{revealed&&<div className={cx('answer-feedback',results.at(-1)?.ok?'ok':'bad')}><strong>{results.at(-1)?.ok?'Correct':'Review this one'}</strong><span>{pool[idx].explanation}</span><small>Answer: {pool[idx].answer}</small></div>}<div className="practice-actions">{!revealed?<button className="primary" onClick={submit} disabled={!answer}>Check answer</button>:<button className="primary" onClick={next}>{idx+1===pool.length?'Finish':'Next question'} <ChevronRight size={16}/></button>}</div></div></>}</section></div></>
}

function ResultCard({results,pool,reset}){const c=results.filter(r=>r.ok).length,t=results.length;return <div className="result-card"><div className="result-ring"><strong>{percent(c,t)}%</strong><small>accuracy</small></div><h2>Session complete</h2><p>{c} correct out of {t}. Questions you missed are now weighted more heavily in review scheduling.</p><button className="primary" onClick={reset}>Practice again</button></div>}

function Exams({questions,setQuestions,setAttempts,onToast}){
  const [active,setActive]=useState(false); const [title,setTitle]=useState('Quick exam'); const [count,setCount]=useState(10); const [selected,setSelected]=useState([]); const [answers,setAnswers]=useState({}); const [finished,setFinished]=useState(false);
  const [subject,setSubject]=useState('All'); const subjects=['All',...new Set(questions.map(q=>q.subject))];
  const pool=useMemo(()=>questions.filter(q=>subject==='All'||q.subject===subject).slice(0,Math.min(Number(count)||10,questions.length)),[questions,subject,count]);
  if(active&&!finished) return <ExamRunner title={title} pool={pool} answers={answers} setAnswers={setAnswers} finish={()=>{const correct=pool.filter(q=>normalize(answers[q.id])===normalize(q.answer)).length;setAttempts(a=>[...a,{date:new Date().toISOString().slice(0,10),correct,total:pool.length}]);setFinished({correct,total:pool.length});onToast('Exam submitted');}} />;
  return <><div className="page-title-row compact"><div><p className="eyebrow">EXAM MODE</p><h1>{finished?'Exam result':'Build an exam'}</h1><p className="subtle">Use the same bank, with a separate timed experience.</p></div></div>{finished?<div className="panel exam-result"><div className="result-ring big"><strong>{percent(finished.correct,finished.total)}%</strong><small>score</small></div><div><h2>{title}</h2><p className="subtle">{finished.correct} / {finished.total} correct. Your attempts are included in analytics.</p><button className="primary" onClick={()=>{setFinished(false);setActive(false);setAnswers({})}}>Create another exam</button></div></div>:<div className="exam-builder"><div className="panel builder-main"><div className="builder-icon"><Target size={24}/></div><label>Exam title<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)}>{subjects.map(s=><option key={s}>{s}</option>)}</select></label><label>Questions<input type="number" min="1" max={questions.length||1} value={count} onChange={e=>setCount(e.target.value)}/></label><button className="primary" onClick={()=>setActive(true)} disabled={!questions.length}>Start exam <ChevronRight size={16}/></button></div><div className="panel builder-side"><h2>What gets tracked</h2><div className="track-row"><Check size={16}/><span>Question-level accuracy</span></div><div className="track-row"><Check size={16}/><span>Subject / chapter / topic gaps</span></div><div className="track-row"><Check size={16}/><span>Exam score & time</span></div><div className="track-row"><Check size={16}/><span>Future review scheduling</span></div></div></div>}</>
}

function ExamRunner({title,pool,answers,setAnswers,finish}){const [idx,setIdx]=useState(0);return <div className="exam-runner"><div className="exam-top"><div><span className="eyebrow">{title.toUpperCase()}</span><h1>Question {idx+1} of {pool.length}</h1></div><button className="secondary" onClick={finish}>Submit exam</button></div><div className="panel exam-question"><span className="badge">{pool[idx].type.toUpperCase()}</span><span className="eyebrow-inline">{pool[idx].subject} · {pool[idx].chapter}</span><h2>{pool[idx].question}</h2>{pool[idx].type==='mcq'?<div className="answer-list">{pool[idx].options.map((o,i)=><button key={o} className={cx('answer-option',answers[pool[idx].id]===o&&'picked')} onClick={()=>setAnswers({...answers,[pool[idx].id]:o})}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>:<textarea className="short-answer" value={answers[pool[idx].id]||''} onChange={e=>setAnswers({...answers,[pool[idx].id]:e.target.value})}/>}<div className="exam-nav"><button className="secondary" disabled={idx===0} onClick={()=>setIdx(idx-1)}>Previous</button>{idx===pool.length-1?<button className="primary" onClick={finish}>Submit</button>:<button className="primary" onClick={()=>setIdx(idx+1)}>Next <ChevronRight size={16}/></button>}</div></div></div>}

function Analytics({questions,attempts}){
  const subjectStats=[...new Set(questions.map(q=>q.subject))].map(s=>{const arr=questions.filter(q=>q.subject===s);const seen=arr.reduce((x,q)=>x+(q.times_seen||0),0);const cor=arr.reduce((x,q)=>x+(q.times_correct||0),0);return {s,p:percent(cor,seen),n:arr.length}}).sort((a,b)=>a.p-b.p);
  const avg=Math.round(attempts.reduce((s,a)=>s+percent(a.correct,a.total),0)/Math.max(attempts.length,1));
  return <><div className="page-title-row compact"><div><p className="eyebrow">INSIGHTS</p><h1>Analysis</h1><p className="subtle">Turn every attempt into a small, useful signal.</p></div><div className="analysis-kpi"><TrendingUp size={17}/><strong>{avg}%</strong><span>avg session accuracy</span></div></div><section className="analytics-grid"><Panel title="Accuracy trend" className="wide"><MiniTrend attempts={attempts}/></Panel><Panel title="Study load"><div className="load-ring"><strong>{questions.reduce((s,q)=>s+(q.times_seen||0),0)}</strong><span>answered</span></div><div className="micro-grid"><div><strong>{attempts.length}</strong><small>sessions</small></div><div><strong>{questions.filter(q=>q.next_review_at&&q.next_review_at<=new Date().toISOString().slice(0,10)).length}</strong><small>due</small></div><div><strong>{questions.filter(q=>q.difficulty==='hard').length}</strong><small>hard</small></div></div></Panel></section><section className="panel"><div className="panel-head"><h2>Weakness map</h2><span>sorted by accuracy</span></div><div className="analysis-list">{subjectStats.map(x=><div className="analysis-row" key={x.s}><div><strong>{x.s}</strong><span>{x.n} questions</span></div><div className="analysis-bar"><i style={{width:`${x.p}%`}}/></div><b>{x.p}%</b></div>)}</div></section><section className="analytics-grid lower"><Panel title="Spaced repetition" action={<span className="tiny-status"><Clock3 size={14}/> active</span>}><p className="subtle">Questions you miss are shortened to repeat sooner. Correct answers increase the next interval.</p><div className="schedule"><span>Today</span><strong>{questions.filter(q=>q.next_review_at&&q.next_review_at<=new Date().toISOString().slice(0,10)).length}</strong><span>Tomorrow</span><strong>{questions.filter(q=>q.next_review_at===new Date(Date.now()+86400000).toISOString().slice(0,10)).length}</strong><span>This week</span><strong>{questions.filter(q=>q.next_review_at&&q.next_review_at>new Date().toISOString().slice(0,10)).length}</strong></div></Panel><Panel title="Readiness estimate"><div className="readiness"><div className="readiness-score">{Math.min(99,Math.max(20,Math.round(avg*0.82+18)))}<span>/100</span></div><p>Estimate from recent accuracy, coverage, and review freshness. Use it as a trend signal—not a guarantee.</p></div></Panel></section></>
}

function SettingsPage({user,setToast}){return <><div className="page-title-row compact"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="subtle">Keep the system quiet and personal.</p></div></div><div className="settings-grid"><section className="panel"><h2>Account</h2><div className="settings-row"><div><strong>{user?.email||'Demo mode'}</strong><span>{user?'Supabase session connected':'Local storage only'}</span></div><button className="secondary" onClick={()=>setToast('Account preference saved')}>Save</button></div></section><section className="panel"><h2>Practice defaults</h2><div className="settings-row"><div><strong>Daily review cap</strong><span>Start small and increase only when you need it.</span></div><input className="mini-input" defaultValue="40"/></div><div className="settings-row"><div><strong>Show explanation after answer</strong><span>Recommended for learning mode.</span></div><input type="checkbox" defaultChecked/></div></section></div></>}

function AuthModal({close,onAuthed}){const [mode,setMode]=useState('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');async function submit(e){e.preventDefault();setBusy(true);setErr('');try{if(!supabase)throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');const fn=mode==='signin'?supabase.auth.signInWithPassword({email,password}):supabase.auth.signUp({email,password,options:{data:{display_name:name}}});const {data,error}=await fn;if(error)throw error;if(mode==='signup'&&!data.session){setErr('Account created. Check your email to confirm, then sign in.')}else onAuthed(data.user);}catch(e){setErr(e.message)}finally{setBusy(false)}}return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={close}><X size={18}/></button><div className="modal-logo"><span className="brand-mark small-mark"><span></span><span></span></span><strong>Quanta</strong></div><h2>{mode==='signin'?'Welcome back':'Create your account'}</h2><p className="subtle">{mode==='signin'?'Sign in to sync your question bank.':'Your bank stays scoped to your account with Supabase RLS.'}</p><form onSubmit={submit}>{mode==='signup'&&<label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"/></label>{err&&<div className="error-box">{err}</div>}<button className="primary full" disabled={busy}>{busy?'Working…':mode==='signin'?'Sign in':'Create account'}</button></form><button className="switch-auth" onClick={()=>setMode(mode==='signin'?'signup':'signin')}>{mode==='signin'?'Need an account? Sign up':'Already have an account? Sign in'}</button></div></div>}

function normalize(v){return String(v??'').trim().toLowerCase().replace(/[.。]$/,'');}
function oToLetter(opts,value){const i=opts.indexOf(value);return i<0?value:String.fromCharCode(65+i)}
function review(q,ok){const seen=(q.times_seen||0)+1,correct=(q.times_correct||0)+(ok?1:0);let interval=q.review_interval||1;let ease=Number(q.ease_factor||2.5);if(ok){interval=Math.max(2,Math.round(interval*ease));ease=Math.min(3, ease+0.08)}else{interval=1;ease=Math.max(1.6,ease-0.2)}const d=new Date();d.setDate(d.getDate()+interval);return {...q,times_seen:seen,times_correct:correct,review_interval:interval,ease_factor:Number(ease.toFixed(2)),next_review_at:d.toISOString().slice(0,10)}}
function parseJson(text){try{const raw=JSON.parse(text);const arr=Array.isArray(raw)?raw:(raw.questions||[]);return arr.map(normalizeImported);}catch{return []}}
function parseCsv(text){const lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const head=splitCsv(lines[0]).map(x=>x.toLowerCase());return lines.slice(1).map(line=>{const vals=splitCsv(line);const obj=Object.fromEntries(head.map((h,i)=>[h,vals[i]??'']));return normalizeImported(obj)})}
function splitCsv(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q}else if(c===','&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}
function parsePasted(text){const blocks=text.split(/\n\s*\n+/).filter(Boolean);return blocks.map(block=>{const lines=block.split(/\r?\n/);let q='',answer='',explanation='',subject='Uncategorized',chapter='General',topic='General',tags=[],options=[],type='mcq';const optRe=/^\s*([A-E])\s*[\).:-]\s*(.+)$/i;for(const line of lines){const m=line.match(/^\s*(question|q)\s*:\s*(.+)$/i);if(m){q=m[2];continue}const a=line.match(/^\s*(answer|ans|correct answer)\s*:\s*(.+)$/i);if(a){answer=a[2];continue}const ex=line.match(/^\s*(explanation|why)\s*:\s*(.+)$/i);if(ex){explanation=ex[2];continue}const s=line.match(/^\s*subject\s*:\s*(.+)$/i);if(s){subject=s[1];continue}const c=line.match(/^\s*chapter\s*:\s*(.+)$/i);if(c){chapter=c[1];continue}const t=line.match(/^\s*topic\s*:\s*(.+)$/i);if(t){topic=t[1];continue}const tg=line.match(/^\s*(tags?|reference tags?)\s*:\s*(.+)$/i);if(tg){tags=tg[2].split(/[,|]/).map(s=>s.trim()).filter(Boolean);continue}const o=line.match(optRe);if(o){options.push(o[2]);continue}if(!q && line.trim()) q=line.trim();if(!explanation&&/^\s*[-–]?(explanation|reason)\s*$/i.test(line.trim())){} }if(options.length===0)type='short';if(/^\s*[A-E]\b/i.test(answer)){const letter=answer.trim().charAt(0).toUpperCase();const idx=letter.charCodeAt(0)-65;if(options[idx])answer=options[idx]}return normalizeImported({type,question:q,options,answer,explanation,reference_tags:tags,subject,chapter,topic})}).filter(q=>q.question&&q.answer)}
function normalizeImported(o){const options=Array.isArray(o.options)?o.options:String(o.options||'').split(/\s*[|;]\s*/).filter(Boolean);return {id:uid(),type:o.type==='short'||!options.length?'short':'mcq',question:String(o.question||o.q||'').trim(),options,answer:String(o.answer||o.ans||'').trim(),explanation:String(o.explanation||'').trim(),reference_tags:Array.isArray(o.reference_tags)?o.reference_tags:String(o.reference_tags||o.tags||'').split(/[,|]/).map(s=>s.trim()).filter(Boolean),subject:String(o.subject||'Uncategorized').trim(),chapter:String(o.chapter||'General').trim(),topic:String(o.topic||'General').trim(),difficulty:['easy','medium','hard'].includes(o.difficulty)?o.difficulty:'medium',times_seen:0,times_correct:0,next_review_at:new Date().toISOString().slice(0,10),review_interval:1,ease_factor:2.5}}
function downloadFile(name,content,type){const blob=new Blob([content],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

createRoot(document.getElementById('root')).render(<App/>);
