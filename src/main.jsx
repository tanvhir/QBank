import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3, BookOpen, Brain, Check, ChevronRight, CircleHelp, Clock3, Download,
  FileJson, FolderTree, Gauge, Import, LayoutDashboard, LogIn, Menu,
  Search, Settings, Sparkles, Target, TrendingUp, Upload, X, Zap, BookMarked,
  SlidersHorizontal, RotateCcw, Eye, TimerReset, Layers3, AlertTriangle
} from 'lucide-react';
import './styles.css';
import { parseAny, countQuestionMarkers, isImportable } from './lib/parser';
import { AI_MODELS, getSavedAIModel, saveAIModel, getSavedAIKey, saveAIKey, clearAIKey, smartParseImport } from './lib/ai';
import {
  supabase, fetchQuestionPage, fetchHierarchy, fetchDashboardStats, fetchAnalytics,
  fetchPracticePool, insertQuestions, updateQuestion, deleteQuestion, applyReview,
  insertExamSession, insertAttempts, signIn, signUp
} from './lib/db';


const nav = [
  ['dashboard','Dashboard',LayoutDashboard],
  ['questions','Question bank',BookOpen],
  ['read','Reading',BookMarked],
  ['practice','Practice',Brain],
  ['exams','Exams',Target],
  ['analytics','Analytics',BarChart3],
];

function cx(...xs){return xs.filter(Boolean).join(' ')}
function percent(a,b){return b?Math.round((Number(a)/Number(b))*100):0}
function uid(){return crypto?.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now()}
function today(){return new Date().toISOString().slice(0,10)}
function normalize(v){return String(v??'').trim().toLowerCase().replace(/[.。:]+$/,'')}
function downloadFile(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function pathKey(s,c,t){return [s,c,t].map(v=>String(v||'').trim().toLowerCase()).join(' › ')}
function prettyCount(n){return Number(n||0).toLocaleString()}

function App(){
  const [page,setPage]=useState('dashboard');
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [user,setUser]=useState(null);
  const [search,setSearch]=useState('');
  const [authOpen,setAuthOpen]=useState(false);
  const [toast,setToast]=useState('');
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(timer)},[toast]);
  const [questions,setQuestions]=useState([]);
  const [questionCount,setQuestionCount]=useState(0);
  const [hierarchy,setHierarchy]=useState([]);
  const [dash,setDash]=useState(null);
  const [loading,setLoading]=useState(false);
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    if(!supabase) return;
    supabase.auth.getSession().then(({data})=>setUser(data.session?.user||null));
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setUser(s?.user||null));
    return ()=>sub.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!user){setQuestions([]);setQuestionCount(0);setHierarchy([]);setDash(null);return}
    (async()=>{
      try{
        const [h,d]=await Promise.all([fetchHierarchy(user.id),fetchDashboardStats(user.id)]);
        setHierarchy(h);setDash(d);
      }catch(e){setToast(e.message)}
    })();
  },[user,refresh]);

  const go = (next)=>{
    const gated = ['questions','read','practice','exams','analytics','import'];
    if(gated.includes(next) && !user){setAuthOpen(true);setToast('Sign in is required for tracked study and exams.');return}
    setPage(next);setSidebarOpen(false);
  };
  const save = async q=>{
    setQuestions(prev=>prev.map(x=>x.id===q.id?q:x));
    if(user){await updateQuestion(user.id,q);setToast('Saved');setRefresh(x=>x+1)}
  };
  const remove = async id=>{setQuestions(prev=>prev.filter(x=>x.id!==id));if(user){await deleteQuestion(user.id,id);setToast('Deleted');setRefresh(x=>x+1)}};
  const doImport = async batch=>{
    if(!user){setAuthOpen(true);setToast('Sign in before importing into your personal bank.');return}
    setLoading(true);try{const r=await insertQuestions(user.id,batch);setToast(`${r.inserted} imported · ${r.skipped} duplicates skipped`);setRefresh(x=>x+1)}catch(e){setToast(e.message)}finally{setLoading(false)}};
  const signout = async()=>{if(supabase) await supabase.auth.signOut();setUser(null);setPage('dashboard');setToast('Signed out')};

  return <div className="app-shell">
    <aside className={cx('sidebar',sidebarOpen&&'open')}>
      <div className="brand"><div className="brand-mark"><span></span><span></span></div><div><strong>Quanta</strong><small>question bank</small></div></div>
      <div className="workspace">PERSONAL</div>
      <nav>{nav.map(([id,label,Icon])=><button key={id} className={cx('nav-item',page===id&&'active')} onClick={()=>go(id)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-spacer"/>
      <button className="nav-item" onClick={()=>go('import')}><Import size={18}/><span>Import / export</span></button>
      <button className="nav-item" onClick={()=>go('settings')}><Settings size={18}/><span>Settings</span></button>
      <div className="profile-mini"><div className="avatar">{user?.email?.slice(0,1).toUpperCase()||'Q'}</div><div><strong>{user?.email?.split('@')[0]||'Guest'}</strong><small>{user?'Supabase synced':'Sign in required'}</small></div>{user?<button onClick={signout} title="Sign out"><LogIn size={16}/></button>:<button onClick={()=>setAuthOpen(true)} title="Sign in"><LogIn size={16}/></button>}</div>
    </aside>
    {sidebarOpen&&<div className="mobile-backdrop" onClick={()=>setSidebarOpen(false)}/>} 
    <main className="main">
      <header className="topbar">
        <button className="icon-btn mobile-menu" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button>
        <div className="breadcrumbs"><span>Quanta</span><ChevronRight size={14}/><strong>{page==='import'?'Import / export':page[0].toUpperCase()+page.slice(1)}</strong></div>
        <div className="top-actions">
          <div className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions…"/></div>
          <button className="icon-btn" onClick={()=>setToast(user?'Synced workspace':'Preview mode')} title="Status"><Zap size={18}/></button>
          {user?<button className="user-pill" onClick={signout}><span>{user.email}</span><X size={14}/></button>:<button className="signin-btn" onClick={()=>setAuthOpen(true)}><LogIn size={14}/><span>Sign in</span></button>}
        </div>
      </header>
      <div className="page-wrap">
        {page==='dashboard'&&<Dashboard user={user} stats={dash} onGo={go} questions={questions} questionCount={questionCount} />}
        {page==='questions'&&<QuestionBank user={user} count={questionCount} search={search} hierarchy={hierarchy} refreshKey={refresh} onSave={save} onRemove={remove} onToast={setToast} />}
        {page==='import'&&<ImportExport user={user} questions={questions} onImport={doImport} onToast={setToast} />}
        {page==='read'&&<StudyMode user={user} mode="reading" hierarchy={hierarchy} onToast={setToast} />}
        {page==='practice'&&<StudyMode user={user} mode="practice" hierarchy={hierarchy} onToast={setToast} />}
        {page==='exams'&&<Exams user={user} hierarchy={hierarchy} onToast={setToast} />}
        {page==='analytics'&&<Analytics user={user} hierarchy={hierarchy} />}
        {page==='settings'&&<SettingsPage user={user} />}
      </div>
    </main>
    {toast&&toast!=='Signed in'&&<div className="toast"><Check size={15}/>{toast}</div>}
    {authOpen&&<AuthModal close={()=>setAuthOpen(false)} onAuthed={u=>{setUser(u);setAuthOpen(false);setToast('')}}/>}
    {loading&&<div className="loading-bar"/>}
  </div>
}

function Dashboard({user,stats,onGo,questions,questionCount}){
  const localSeen=questions.reduce((s,q)=>s+(q.times_seen||0),0),localCorrect=questions.reduce((s,q)=>s+(q.times_correct||0),0);
  const total=user?Number(stats?.total_questions||0):0;
  const due=user?Number(stats?.due||0):0;
  const accuracy=user?Number(stats?.accuracy||0):0;
  const daily=stats?.daily||[];
  const subjects=stats?.subjects||[];
  return <>
    <div className="page-title-row"><div><p className="eyebrow">OVERVIEW</p><h1>Welcome back{user?.email?`, ${user.email.split('@')[0]}`:''}</h1><p className="subtle">A quiet place to store, read, practice and understand your questions.</p></div><div className="title-actions"><button className="primary" onClick={()=>onGo('import')}><Import size={15}/>Import</button><button className="secondary" onClick={()=>onGo('exams')}><Target size={15}/>Exam</button></div></div>
    {!user&&<div className="hint"><CircleHelp size={14}/><span><strong>Sign in required.</strong> Your private question bank, reading, practice, exams and analytics are available after you sign in.</span><button className="link-btn" onClick={()=>onGo('questions')}>Sign in</button></div>}
    <div className="stat-grid four">
      <StatCard icon={<Layers3 size={17}/>} label="Questions" value={prettyCount(total)} note="MCQ + short answer"/>
      <StatCard icon={<Clock3 size={17}/>} label="Review due" value={prettyCount(due)} note="Ready for spaced review"/>
      <StatCard icon={<Gauge size={17}/>} label="Current accuracy" value={`${accuracy}%`} note="Based on tracked attempts"/>
      <StatCard icon={<TrendingUp size={17}/>} label="Questions format" value={user?`${stats?.total_short||0} short`:'—'} note="Short-answer first"/>
    </div>
    <div className="dashboard-grid">
      <Panel title="Progress trend" action={<span>Last 30 days</span>}><Trend daily={daily}/></Panel>
      <Panel title="Today"><div className="queue-number">{prettyCount(due)}</div><div className="subtle">questions due now</div><div className="progress-bar"><span style={{width:`${Math.min(100,(1000/(due+1000))*100)}%`}}/></div><div className="micro-grid"><div><strong>{prettyCount(stats?.seen||localSeen)}</strong><small>Seen</small></div><div><strong>{prettyCount(stats?.correct||localCorrect)}</strong><small>Correct</small></div><div><strong>{prettyCount(stats?.sessions_30d||0)}</strong><small>Sessions</small></div></div></Panel>
    </div>
    <div className="dashboard-grid lower">
      <Panel title="Weakest subjects" action={<button className="link-btn" onClick={()=>onGo('analytics')}>Open analysis <ChevronRight size={13}/></button>}><div className="weak-list">{subjects.length?subjects.slice(0,5).map((s,i)=><div className="weak-item" key={s.subject||i}><div><strong>{s.subject}</strong><span>{s.questions||0} questions</span></div><div className="weak-score"><span>{s.accuracy||0}%</span><div className="thin"><i style={{width:`${s.accuracy||0}%`}}/></div></div></div>):<div className="detail-empty compact-empty">Sign in and track questions to build subject analysis.</div>}</div></Panel>
      <Panel title="Fast actions"><div className="action-grid"><button onClick={()=>onGo('read')}><BookMarked size={18}/><span>Read</span><small>Scroll Q → A</small></button><button onClick={()=>onGo('practice')}><Brain size={18}/><span>Review</span><small>Easy · Good · Hard · Wrong</small></button><button onClick={()=>onGo('exams')}><Target size={18}/><span>Exam</span><small>Timed + flexible</small></button><button onClick={()=>onGo('import')}><Upload size={18}/><span>Import</span><small>Paste NotebookLM output</small></button></div></Panel>
    </div>
  </>
}
function StatCard({icon,label,value,note}){return <div className="stat-card"><div className="stat-top"><span className="soft-icon">{icon}</span><span className="stat-label">{label}</span></div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span></div>}
function Panel({title,action,children,className=''}){return <section className={cx('panel',className)}><div className="panel-head"><h2>{title}</h2>{action}</div>{children}</section>}
function Trend({daily}){
  if(!daily?.length) return <div className="chart-empty"><TrendingUp size={24}/><span>Your tracked sessions will build the trend here.</span></div>;
  const data=daily.slice(-14);const max=Math.max(1,...data.map(d=>Number(d.total||0)));const points=data.map((d,i)=>`${(i/(Math.max(1,data.length-1)))*96+2},${92-(Number(d.correct||0)/max)*72}`).join(' ');
  return <div className="trend-wrap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trend-svg"><line x1="2" y1="92" x2="98" y2="92" className="axis"/><line x1="2" y1="56" x2="98" y2="56" className="axis"/><line x1="2" y1="20" x2="98" y2="20" className="axis"/><polyline points={points} className="trend-line"/></svg><div className="trend-dates"><span>{data[0].day}</span><span>{data[data.length-1].day}</span></div></div>
}

function QuestionBank({user,count,search,hierarchy,refreshKey,onSave,onRemove,onToast}){
  const [page,setPage]=useState(0),[rows,setRows]=useState([]),[selected,setSelected]=useState(null),[editOpen,setEditOpen]=useState(false),[subject,setSubject]=useState(''),[chapter,setChapter]=useState(''),[topic,setTopic]=useState(''),[type,setType]=useState('all'),[remoteCount,setRemoteCount]=useState(count);
  const pageSize=40;
  useEffect(()=>{setPage(0)},[search,subject,chapter,topic,type]);
  useEffect(()=>{
    if(!user){setRows([]);setSelected(null);setEditOpen(false);setRemoteCount(0);return}
    let alive=true;
    (async()=>{
      try{
        const r=await fetchQuestionPage({userId:user.id,page,pageSize,search,subject,chapter,topic,type});
        if(alive){
          setRows(r.rows);
          setRemoteCount(r.count);
          if(selected && !r.rows.some(x=>x.id===selected.id)){setSelected(null);setEditOpen(false)}
        }
      }catch(e){onToast(e.message)}
    })();
    return()=>{alive=false};
  },[user,page,search,subject,chapter,topic,type,refreshKey]);
  const subjects=[...new Set(hierarchy.map(x=>x.subject))].sort();
  const chapters=[...new Set(hierarchy.filter(x=>!subject||x.subject===subject).map(x=>x.chapter))].sort();
  const topics=[...new Set(hierarchy.filter(x=>(!subject||x.subject===subject)&&(!chapter||x.chapter===chapter)).map(x=>x.topic))].sort();
  const total=user?remoteCount:0;
  const openEdit=(q)=>{setSelected(q);setEditOpen(true)};
  const saveAndClose=async(q)=>{await onSave(q);setSelected(q);setEditOpen(false)};
  return <>
    <div className="page-title-row"><div><p className="eyebrow">LIBRARY</p><h1>Question bank</h1><p className="subtle">Search thousands of questions without loading the whole database.</p></div><div className="title-actions"><button className="primary" onClick={()=>document.getElementById('import-anchor')?.scrollIntoView()}><SlidersHorizontal size={15}/>Use Import</button></div></div>
    <div className="toolbar"><div className="seg">{[['all','All'],['short','Short'],['mcq','MCQ']].map(([v,l])=><button key={v} className={type===v?'active':''} onClick={()=>setType(v)}>{l}</button>)}</div><Select label="Subject" value={subject} options={subjects} onChange={v=>{setSubject(v);setChapter('');setTopic('')}}/><Select label="Chapter" value={chapter} options={chapters} onChange={v=>{setChapter(v);setTopic('')}} disabled={!subjects.length}/><Select label="Topic" value={topic} options={topics} onChange={setTopic} disabled={!chapters.length}/><span className="result-count">{prettyCount(total)} questions</span></div>
    <section className="panel question-table full-table"><div className="table-head"><span>Question</span><span>Path</span><span>Type</span><span>Review</span></div>{rows.length?rows.map(q=><button className="q-row" key={q.id} onClick={()=>openEdit(q)}><div className="q-main"><div className="badges">{q.reference_tags?.slice(0,2).map(t=><span className="badge" key={t}>{t}</span>)}</div><strong>{q.question}</strong><small>{q.answer}</small></div><div className="q-path">{q.subject}<small>{q.chapter} · {q.topic}</small></div><div><span className="badge muted">{q.type}</span></div><div className="q-review"><span className={cx('due-dot',q.next_review_at&&q.next_review_at<=today()&&'due')}></span>{q.next_review_at&&q.next_review_at<=today()?'Due':'Later'}</div></button>):<div className="detail-empty"><BookOpen size={25}/><strong>No questions in this filter</strong><span>Try another path or import your notes.</span></div>}</section>
    {user&&total>pageSize&&<div className="pager"><button className="secondary" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} · {Math.ceil(total/pageSize)}</span><button className="secondary" disabled={(page+1)*pageSize>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
    {editOpen&&selected&&<QuestionEditModal q={selected} onClose={()=>setEditOpen(false)} onSave={saveAndClose} onRemove={async(id)=>{await onRemove(id);setEditOpen(false);setSelected(null)}} />}
  </>
}

function Select({label,value,options,onChange,disabled}){return <label className="select-wrap"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}><option value="">All</option>{options.map(x=><option key={x}>{x}</option>)}</select></label>}
function QuestionEditModal({q,onClose,onSave,onRemove}){
  const [draft,setDraft]=useState(q);
  const [busy,setBusy]=useState(false);
  useEffect(()=>setDraft(q),[q?.id]);
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape'&&!busy)onClose()};
    document.addEventListener('keydown',onKey); return()=>document.removeEventListener('keydown',onKey);
  },[onClose,busy]);
  const patch=(key,value)=>setDraft(d=>({...d,[key]:value}));
  const save=async()=>{setBusy(true);try{await onSave(draft)}finally{setBusy(false)}};
  const remove=async()=>{if(!confirm('Delete this question permanently?'))return;setBusy(true);try{await onRemove(draft.id)}finally{setBusy(false)}};
  return <div className="modal-backdrop edit-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
    <div className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-question-title">
      <div className="edit-modal-head"><div><p className="eyebrow">QUESTION EDITOR</p><h2 id="edit-question-title">Edit question</h2><p className="subtle">Changes are saved directly to your Supabase question bank.</p></div><button className="icon-btn" onClick={onClose} disabled={busy}><X size={17}/></button></div>
      <div className="edit-modal-body">
        <label>Question<textarea className="editor-lg" value={draft.question||''} onChange={e=>patch('question',e.target.value)}/></label>
        <label>Answer<textarea className="editor-md" value={draft.answer||''} onChange={e=>patch('answer',e.target.value)}/></label>
        {draft.type==='mcq'&&<label>Options<textarea className="editor-md" value={(draft.options||[]).join('\n')} onChange={e=>patch('options',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))} placeholder="One option per line"/></label>}
        <label>Explanation<textarea className="editor-md" value={draft.explanation||''} onChange={e=>patch('explanation',e.target.value)}/></label>
        <div className="two-col"><label>Subject<input value={draft.subject||''} onChange={e=>patch('subject',e.target.value)}/></label><label>Chapter<input value={draft.chapter||''} onChange={e=>patch('chapter',e.target.value)}/></label></div>
        <label>Topic<input value={draft.topic||''} onChange={e=>patch('topic',e.target.value)}/></label>
        <label>Reference / PYQ tags<input value={(draft.reference_tags||[]).join(', ')} onChange={e=>patch('reference_tags',e.target.value.split(',').map(x=>x.trim()).filter(Boolean))}/></label>
        <div className="two-col"><label>Type<select value={draft.type||'short'} onChange={e=>patch('type',e.target.value)}><option value="short">Short answer</option><option value="mcq">MCQ</option></select></label><label>Difficulty<select value={draft.difficulty||'medium'} onChange={e=>patch('difficulty',e.target.value)}><option>easy</option><option>medium</option><option>hard</option></select></label></div>
      </div>
      <div className="edit-modal-foot"><button className="danger-btn" onClick={remove} disabled={busy}>Delete</button><div><button className="secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" onClick={save} disabled={busy}>{busy?'Saving…':'Save changes'}</button></div></div>
    </div>
  </div>;
}

function ImportExport({user,questions,onImport,onToast}){
  const [text,setText]=useState('');
  const [preview,setPreview]=useState([]);
  const [fileName,setFileName]=useState('');
  const [analysis,setAnalysis]=useState({markers:0,complete:0,issues:0,mode:'none',warnings:[]});
  const [aiModel,setAiModel]=useState(()=>getSavedAIModel());
  const [busy,setBusy]=useState(false);
  const setModel=(model)=>setAiModel(saveAIModel(model));
  const applyPreview=(parsed,mode='local',warnings=[])=>{
    const markers=countQuestionMarkers(text);
    const complete=parsed.filter(isImportable).length;
    setPreview(parsed);
    setAnalysis({markers,complete,issues:Math.max(0,parsed.length-complete),mode,warnings});
  };
  const analyzeLocal=()=>{const parsed=parseAny(text);applyPreview(parsed,'local');onToast(`${parsed.length} question${parsed.length===1?'':'s'} detected locally`);};
  const analyzeSmart=async()=>{
    if(!user){onToast('Sign in before using Smart Import.');return}
    if(!text.trim()){onToast('Paste your source text first.');return}
    setBusy(true);
    try{
      const result=await smartParseImport(user.id,text,aiModel);
      applyPreview(result.questions,'ai',result.warnings);
      onToast(`${result.questions.length} questions extracted with ${AI_MODELS.find(x=>x.id===result.model)?.label||result.model}`);
    }catch(e){
      const parsed=parseAny(text);
      applyPreview(parsed,'fallback',[`Smart Import unavailable: ${e.message}`]);
      onToast(`Smart Import failed; local parser previewed ${parsed.length} questions.`);
    }finally{setBusy(false)}
  };
  const importNow=()=>{
    if(!user){onToast('Sign in before importing into your personal bank.');return}
    const valid=preview.filter(isImportable);
    if(!valid.length){onToast('Nothing importable. Analyze the pasted source first.');return}
    onImport(valid);
  };
  const exportAll=async(format)=>{
    if(!user){onToast('Sign in to export your personal bank.');return}
    onToast('Preparing export…');
    try{
      const all=await fetchAllQuestions(user.id);
      if(format==='json') downloadFile('quanta-questions.json',JSON.stringify(all,null,2),'application/json');
      else {const head='type,question,answer,explanation,subject,chapter,topic,reference_tags,difficulty';const lines=all.map(q=>[q.type,q.question,q.answer,q.explanation,q.subject,q.chapter,q.topic,(q.reference_tags||[]).join(' | '),q.difficulty].map(csvQuote).join(','));downloadFile('quanta-questions.csv',[head,...lines].join('\n'),'text/csv')}
      onToast(`${all.length.toLocaleString()} questions exported`);
    }catch(e){onToast(e.message)}
  };
  const duplicateCount=preview.length-new Set(preview.map(q=>pathKey(q.subject,q.chapter,q.topic)+'|'+normalize(q.question))).size;
  const modelLabel=AI_MODELS.find(x=>x.id===aiModel)?.label||aiModel;
  return <>
    <div id="import-anchor" className="page-title-row"><div><p className="eyebrow">INGEST</p><h1>Import / export</h1><p className="subtle">Paste NotebookLM or AI notes in almost any Markdown shape. Smart Import reconstructs hierarchy, Q/A, references, explanations and math without inventing content.</p></div><div className="export-actions"><button className="secondary" onClick={()=>exportAll('json')}><FileJson size={15}/>JSON</button><button className="secondary" onClick={()=>exportAll('csv')}><Download size={15}/>CSV</button></div></div>
    <div className="import-grid">
      <section className="panel import-source">
        <div className="panel-head"><div><h2>Paste source</h2><span className="panel-sub">AI parser: {modelLabel}</span></div><span>{user?'Supabase + Smart Import':'Sign in before import'}</span></div>
        <textarea className="import-box" value={text} onChange={e=>setText(e.target.value)} placeholder={'Botany/জীবের পরিবেশ, বিস্তার ও সংরক্ষণ/টপিক ০১: ...\n\nQ1\\. ... [JU 18-19] উত্তর: ...\n\nQ2\\. ... উত্তর: ...'} />
        <div className="smart-tools">
          <div className="model-switch"><span>AI model</span>{AI_MODELS.map(m=><button key={m.id} type="button" className={cx('model-chip',aiModel===m.id&&'active')} onClick={()=>setModel(m.id)}>{m.label}</button>)}</div>
          <div className="import-actions"><button className="primary" onClick={analyzeSmart} disabled={busy||!user}>{busy?'Extracting…':'Smart analyze'} <Sparkles size={15}/></button><button className="secondary" onClick={analyzeLocal} disabled={busy}>Local fallback</button></div>
        </div>
        <div className="import-foot"><span><Sparkles size={13}/> AI-first extraction · exact source preservation · Markdown + LaTeX aware · no silent drops</span></div>
        <div className="file-row"><label className="secondary"><Upload size={14}/>Load JSON/CSV<input type="file" accept=".json,.csv,.txt,.md" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setFileName(f.name);f.text().then(setText)}} hidden/></label>{fileName&&<span>{fileName}</span>}</div>
      </section>
      <section className="panel import-preview">
        <div className="panel-head"><div><h2>Preview</h2><span className="panel-sub">{analysis.mode==='ai'?'AI structured result':analysis.mode==='fallback'?'Local fallback result':analysis.mode==='local'?'Local result':'Waiting for analysis'}</span></div><span>{preview.length} detected</span></div>
        {analysis.warnings?.map((w,i)=><div className="warning-box" key={i}>{w}</div>)}
        {preview.length?<>
          <div className="import-summary"><div><strong>{preview.length}</strong><span>detected</span></div><div><strong>{analysis.markers||preview.length}</strong><span>Q labels</span></div><div><strong>{analysis.complete}</strong><span>ready</span></div><div><strong>{duplicateCount}</strong><span>duplicates</span></div></div>
          {analysis.issues>0&&<div className="warning-box">{analysis.issues} question block{analysis.issues===1?' is':'s are'} incomplete. The parser could not confirm an answer; review the highlighted item instead of losing it.</div>}
          <div className="preview-list">{preview.slice(0,80).map((q,i)=><div className={cx('preview-item',!isImportable(q)&&'preview-invalid')} key={q.id||i}><div className="badges"><span className="badge">{q.type==='mcq'?'MCQ':'Short'}</span><span className="badge muted path-badge">{q.subject} › {q.chapter} › {q.topic}</span>{q.reference_tags?.slice(0,3).map(t=><span className="badge muted" key={t}>{t}</span>)}</div><strong className="preview-question">{q.question||`Question ${i+1}`}</strong><small className="preview-answer">{q.answer||'Answer not detected'}</small>{q.explanation&&<small className="preview-explanation">{q.explanation}</small>}</div>)}</div>
          {preview.length>80&&<div className="subtle preview-limit">Showing the first 80 of {preview.length.toLocaleString()} detected questions. All detected records remain included in the import payload.</div>}
          <button className="primary full" onClick={importNow} disabled={!user||busy}>{analysis.complete<preview.length?'Import complete items':'Import'} {analysis.complete<preview.length&&<span>({analysis.complete})</span>}</button>
        </>:<div className="preview-empty"><Import size={26}/><strong>Nothing analyzed yet</strong><span>Choose Smart analyze for robust AI extraction or Local fallback for a deterministic parser.</span></div>}
      </section>
    </div>
  </>
}
function csvQuote(v){const s=String(v??'');return `"${s.replaceAll('"','""')}"`}

function StudyMode({user,mode,hierarchy,onToast}){
  const reading=mode==='reading';const [subject,setSubject]=useState(''),[chapter,setChapter]=useState(''),[topic,setTopic]=useState(''),[count,setCount]=useState(reading?50:20),[pool,setPool]=useState([]),[idx,setIdx]=useState(0),[offset,setOffset]=useState(0),[readAll,setReadAll]=useState(reading),[revealed,setRevealed]=useState(false),[typed,setTyped]=useState(''),[busy,setBusy]=useState(false),[startedAt,setStartedAt]=useState(null),[done,setDone]=useState(false),[ratings,setRatings]=useState([]),[modeFilter,setModeFilter]=useState(reading?'all':'due');
  const subjects=[...new Set(hierarchy.map(x=>x.subject))].sort();const chapters=[...new Set(hierarchy.filter(x=>!subject||x.subject===subject).map(x=>x.chapter))].sort();const topics=[...new Set(hierarchy.filter(x=>(!subject||x.subject===subject)&&(!chapter||x.chapter===chapter)).map(x=>x.topic))].sort();
  async function start(){setBusy(true);try{const batch=Math.min(Number(count)||20,200);const r=await fetchPracticePool(user.id,{subject,chapter,topic,mode:reading?'all':modeFilter,limit:batch,offset:0});setPool(r);setOffset(batch);setIdx(0);setRevealed(false);setTyped('');setDone(false);setRatings([]);setStartedAt(Date.now());}catch(e){onToast(e.message)}finally{setBusy(false)}}
  async function rate(rating){const q=pool[idx];if(!q)return;setBusy(true);try{await applyReview(user.id,q,{rating,selected_answer:typed, time_spent_seconds:startedAt?Math.round((Date.now()-startedAt)/1000):0,session_type:reading?'reading':'practice'});setRatings(rs=>[...rs,{id:q.id,rating}]);setRevealed(true);setBusy(false);if(reading||!q.options.length){} }catch(e){onToast(e.message);setBusy(false)}}
  async function next(){if(idx<pool.length-1){setIdx(i=>i+1);setRevealed(false);setTyped('');setStartedAt(Date.now());return}if(reading&&readAll){setBusy(true);try{const batch=Math.min(Number(count)||50,200);const r=await fetchPracticePool(user.id,{subject,chapter,topic,mode:'all',limit:batch,offset});if(r.length){setPool(p=>p.concat(r));setOffset(o=>o+batch);setIdx(i=>i+1);setRevealed(false);setTyped('');setStartedAt(Date.now())}else setDone(true)}catch(e){onToast(e.message)}finally{setBusy(false)}}else setDone(true)}
  if(done)return <StudyResult mode={mode} ratings={ratings} pool={pool} reset={()=>setDone(false)} />;
  if(!pool.length)return <><div className="page-title-row"><div><p className="eyebrow">{reading?'READING':'SPACED REVIEW'}</p><h1>{reading?'Reading mode':'Practice'}</h1><p className="subtle">{reading?'Scroll question → answer. Rate each card only when you are ready.':'Turn weak questions into a small repeatable queue.'}</p></div></div><div className="study-builder"><div className="panel builder-main"><div className="builder-icon">{reading?<BookMarked size={22}/>:<Brain size={22}/>}</div><h2>{reading?'Build a reading queue':'Build a review queue'}</h2><p className="subtle">Select nothing for your whole bank, or narrow it to a Subject → Chapter → Topic.</p><div className="two-col"><label>Subject<select value={subject} onChange={e=>{setSubject(e.target.value);setChapter('');setTopic('')}}><option value="">All subjects</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label><label>Chapter<select value={chapter} onChange={e=>{setChapter(e.target.value);setTopic('')}}><option value="">All chapters</option>{chapters.map(x=><option key={x}>{x}</option>)}</select></label></div><label>Topic<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="">All topics</option>{topics.map(x=><option key={x}>{x}</option>)}</select></label>{!reading&&<label>Queue type<select value={modeFilter} onChange={e=>setModeFilter(e.target.value)}><option value="due">Due now</option><option value="weak">Weak questions</option><option value="unseen">Unseen</option><option value="all">All</option></select></label>}<label>Number of questions<input type="number" min="1" max="200" value={count} onChange={e=>setCount(e.target.value)}/></label>{reading&&<label className="check-line"><input type="checkbox" checked={readAll} onChange={e=>setReadAll(e.target.checked)}/><span>Keep loading all matching questions</span></label>}<button className="primary" onClick={start} disabled={busy}>{busy?'Loading…':reading?'Start reading':'Start practice'} <ChevronRight size={15}/></button></div><div className="panel builder-side"><h2>How tracking works</h2><div className="track-row"><Eye size={16}/><span>Try answering in your head first.</span></div><div className="track-row"><RotateCcw size={16}/><span>Reveal the answer and explanation.</span></div><div className="track-row"><Check size={16}/><span>Rate Easy, Good, Hard or Wrong.</span></div><div className="track-row"><TrendingUp size={16}/><span>Each rating updates future review spacing.</span></div></div></div></>;
  const q=pool[idx];const isLast=idx===pool.length-1;
  return <div className="study-runner"><div className="study-top"><div><span className="eyebrow">{reading?'READING':'PRACTICE'} · {idx+1}/{pool.length}</span><div className="progress-bar"><span style={{width:`${((idx+1)/pool.length)*100}%`}}/></div></div><button className="secondary" onClick={()=>setPool([])}>End</button></div><section className="panel study-card"><div className="badges"><span className="badge">{q.type}</span><span className="badge muted">{q.subject} › {q.chapter} › {q.topic}</span>{q.reference_tags?.map(t=><span className="badge muted" key={t}>{t}</span>)}</div><div className="study-question">{q.question}</div>{q.type==='short'&&<textarea className="study-self-answer" placeholder="Optional: type what you remember…" value={typed} onChange={e=>setTyped(e.target.value)} disabled={revealed}/>} {!revealed?<button className="primary" onClick={()=>setRevealed(true)}>Reveal answer <Eye size={15}/></button>:<><div className="answer-reveal"><p className="eyebrow">ANSWER</p><strong>{q.answer}</strong>{q.explanation&&<><p className="eyebrow explanation-label">EXPLANATION</p><p>{q.explanation}</p></>}</div><div className="rating-label">How did you recall it?</div><div className="rating-grid">{['easy','good','hard','wrong'].map(r=><button key={r} disabled={busy} className={cx('rating-btn',r)} onClick={()=>rate(r)}><strong>{r[0].toUpperCase()+r.slice(1)}</strong><small>{r==='easy'?'instant recall':r==='good'?'comfortable':r==='hard'?'took effort':'missed it'}</small></button>)}</div><div className="study-nav"><button className="secondary" onClick={next} disabled={ratings.length<idx+1||busy}> {isLast?'Finish':'Next'} <ChevronRight size={15}/></button></div></>}</section></div>
}
function StudyResult({mode,ratings,pool,reset}){const counts=ratings.reduce((a,x)=>(a[x.rating]=(a[x.rating]||0)+1,a),{});return <div className="result-card"><div className="result-ring"><strong>{percent((counts.easy||0)+(counts.good||0),pool.length)}</strong><small>positive recall</small></div><h2>{mode==='reading'?'Reading session complete':'Practice session complete'}</h2><p>{pool.length} questions tracked. Easy {counts.easy||0} · Good {counts.good||0} · Hard {counts.hard||0} · Wrong {counts.wrong||0}.</p><button className="primary" onClick={reset}>Start another session</button></div>}

function Exams({user,hierarchy,onToast}){
  const [subject,setSubject]=useState(''),[chapter,setChapter]=useState(''),[topic,setTopic]=useState(''),[count,setCount]=useState(20),[minutes,setMinutes]=useState(20),[pool,setPool]=useState([]),[answers,setAnswers]=useState({}),[started,setStarted]=useState(null),[done,setDone]=useState(false),[result,setResult]=useState(null),[busy,setBusy]=useState(false);
  const subjects=[...new Set(hierarchy.map(x=>x.subject))].sort();const chapters=[...new Set(hierarchy.filter(x=>!subject||x.subject===subject).map(x=>x.chapter))].sort();const topics=[...new Set(hierarchy.filter(x=>(!subject||x.subject===subject)&&(!chapter||x.chapter===chapter)).map(x=>x.topic))].sort();
  async function start(){setBusy(true);try{const r=await fetchPracticePool(user.id,{subject,chapter,topic,mode:'exam',limit:Math.min(Number(count)||20,200)});if(!r.length){onToast('No questions found for this filter.');return}setPool(r);setAnswers({});setStarted(Date.now());setDone(false);setResult(null)}catch(e){onToast(e.message)}finally{setBusy(false)}}
  async function finish(){if(!pool.length)return;setBusy(true);const startedAt=new Date(started||Date.now());const elapsed=Math.round((Date.now()-(started||Date.now()))/1000);const scored=pool.map(q=>({q,is_correct:normalize(answers[q.id])===normalize(q.answer)}));try{const sessionId=await insertExamSession(user.id,{title:[subject,chapter,topic].filter(Boolean).join(' › ')||'General exam',total_questions:pool.length,correct_answers:scored.filter(x=>x.is_correct).length,duration_seconds:(Number(minutes)||20)*60,started_at:startedAt.toISOString()});await insertAttempts(user.id,scored.map(({q,is_correct})=>({question_id:q.id,session_type:'exam',session_id:sessionId,selected_answer:answers[q.id]||'',is_correct,time_spent_seconds:Math.round(elapsed/pool.length)})));setResult({correct:scored.filter(x=>x.is_correct).length,total:pool.length,elapsed});setDone(true)}catch(e){onToast(e.message)}finally{setBusy(false)}}
  if(done)return <div className="panel exam-result"><div className="result-ring big"><strong>{percent(result.correct,result.total)}%</strong><small>accuracy</small></div><div><p className="eyebrow">EXAM COMPLETE</p><h2>{result.correct} / {result.total}</h2><p className="subtle">Time used {Math.floor(result.elapsed/60)}m {result.elapsed%60}s. Answers are recorded in your performance history.</p><button className="primary" onClick={()=>setDone(false)}>New exam</button></div></div>;
  if(!pool.length)return <><div className="page-title-row"><div><p className="eyebrow">TIMED MODE</p><h1>Exams</h1><p className="subtle">Choose exactly how many questions and how much time you want.</p></div></div><div className="exam-builder"><section className="panel builder-main"><div className="builder-icon"><Target size={22}/></div><div className="two-col"><label>Subject<select value={subject} onChange={e=>{setSubject(e.target.value);setChapter('');setTopic('')}}><option value="">All subjects</option>{subjects.map(x=><option key={x}>{x}</option>)}</select></label><label>Chapter<select value={chapter} onChange={e=>{setChapter(e.target.value);setTopic('')}}><option value="">All chapters</option>{chapters.map(x=><option key={x}>{x}</option>)}</select></label></div><label>Topic<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="">All topics</option>{topics.map(x=><option key={x}>{x}</option>)}</select></label><div className="two-col"><label>Questions<input type="number" min="1" max="200" value={count} onChange={e=>setCount(e.target.value)}/></label><label>Time (minutes)<input type="number" min="1" max="600" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label></div><button className="primary" onClick={start} disabled={busy}>{busy?'Preparing…':'Start timed exam'} <Clock3 size={15}/></button></section><section className="panel builder-side"><h2>Exam tracking</h2><div className="track-row"><TimerReset size={16}/><span>Countdown timer with automatic submission.</span></div><div className="track-row"><BarChart3 size={16}/><span>Score and speed are stored separately from reviews.</span></div><div className="track-row"><AlertTriangle size={16}/><span>Short answers are scored against the stored answer text.</span></div></section></div></>;
  return <ExamRunner pool={pool} answers={answers} setAnswers={setAnswers} started={started} minutes={Number(minutes)||20} finish={finish} busy={busy}/>;
}
function ExamRunner({pool,answers,setAnswers,started,minutes,finish,busy}){const [idx,setIdx]=useState(0);const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);const left=Math.max(0,minutes*60-Math.floor((now-started)/1000));useEffect(()=>{if(left===0)finish()},[left]);const q=pool[idx];return <div className="exam-runner"><div className="exam-top"><div><span className="eyebrow">TIMED EXAM</span><h1>Question {idx+1} of {pool.length}</h1></div><div className="timer-pill"><Clock3 size={16}/>{Math.floor(left/60).toString().padStart(2,'0')}:{(left%60).toString().padStart(2,'0')}</div><button className="secondary" disabled={busy} onClick={finish}>Submit exam</button></div><div className="exam-question panel"><div className="badges"><span className="badge">{q.type}</span><span className="badge muted">{q.subject} · {q.chapter}</span></div><h2>{q.question}</h2>{q.type==='mcq'?<div className="answer-list">{q.options.map((o,i)=><button key={o} className={cx('answer-option',answers[q.id]===o&&'picked')} onClick={()=>setAnswers({...answers,[q.id]:o})}><span>{String.fromCharCode(65+i)}</span>{o}</button>)}</div>:<textarea className="short-answer" value={answers[q.id]||''} onChange={e=>setAnswers({...answers,[q.id]:e.target.value})} placeholder="Write your answer…"/>}<div className="exam-nav"><button className="secondary" disabled={idx===0} onClick={()=>setIdx(i=>i-1)}>Previous</button><div className="subtle">{Object.keys(answers).length}/{pool.length} answered</div>{idx===pool.length-1?<button className="primary" onClick={finish}>Submit <Check size={15}/></button>:<button className="primary" onClick={()=>setIdx(i=>i+1)}>Next <ChevronRight size={15}/></button>}</div></div></div>}

function Analytics({user,hierarchy}){
  const [subject,setSubject]=useState(''),[chapter,setChapter]=useState(''),[topic,setTopic]=useState(''),[data,setData]=useState(null),[busy,setBusy]=useState(false);
  const subjects=[...new Set(hierarchy.map(x=>x.subject))].sort();const chapters=[...new Set(hierarchy.filter(x=>!subject||x.subject===subject).map(x=>x.chapter))].sort();const topics=[...new Set(hierarchy.filter(x=>(!subject||x.subject===subject)&&(!chapter||x.chapter===chapter)).map(x=>x.topic))].sort();
  useEffect(()=>{let live=true;(async()=>{setBusy(true);try{const d=await fetchAnalytics(user.id,{subject,chapter,topic});if(live)setData(d)}catch{}finally{if(live)setBusy(false)}})();return()=>{live=false}},[user,subject,chapter,topic]);
  const summary=data?.summary||{};
  return <><div className="page-title-row"><div><p className="eyebrow">PERFORMANCE</p><h1>Analytics</h1><p className="subtle">Select a subject, chapter or topic to inspect performance at that exact level.</p></div></div><div className="analytics-filters"><Select label="Subject" value={subject} options={subjects} onChange={v=>{setSubject(v);setChapter('');setTopic('')}}/><Select label="Chapter" value={chapter} options={chapters} onChange={v=>{setChapter(v);setTopic('')}}/><Select label="Topic" value={topic} options={topics} onChange={setTopic}/><div className="scope-pill"><FolderTree size={14}/>{[subject,chapter,topic].filter(Boolean).join(' › ')||'Entire bank'}</div></div>{busy&&!data?<div className="panel detail-empty">Loading analysis…</div>:<><div className="stat-grid four"><StatCard icon={<Layers3 size={17}/>} label="Questions" value={prettyCount(summary.questions)} note="Selected scope"/><StatCard icon={<Gauge size={17}/>} label="Accuracy" value={`${summary.accuracy||0}%`} note={`${prettyCount(summary.seen)} tracked answers`}/><StatCard icon={<Clock3 size={17}/>} label="Due" value={prettyCount(summary.due)} note="Review schedule"/><StatCard icon={<AlertTriangle size={17}/>} label="Wrong" value={prettyCount(summary.wrong)} note="Last-rating signal"/></div><div className="analytics-grid"><Panel title="Recall profile"><div className="rating-bars"><RatingBar name="Easy" value={summary.easy}/><RatingBar name="Good" value={summary.good}/><RatingBar name="Hard" value={summary.hard}/><RatingBar name="Wrong" value={summary.wrong}/></div></Panel><Panel title="Weak areas"><div className="analysis-list">{(data?.topics||[]).slice(0,6).map(x=><div className="analysis-row" key={x.topic}><div><strong>{x.topic}</strong><span>{x.questions} questions</span></div><div className="analysis-bar"><i style={{width:`${x.accuracy||0}%`}}/></div><b>{x.accuracy||0}%</b></div>)}</div></Panel><Panel title="Weak questions" className="wide"><div className="weak-question-list">{(data?.weak_questions||[]).slice(0,12).map(q=><div className="weak-q" key={q.id}><div><strong>{q.question}</strong><span>{q.subject} › {q.chapter} › {q.topic}</span></div><div><b>{q.accuracy||0}%</b><small>{q.last_rating||'—'}</small></div></div>)}</div></Panel><Panel title="30-day trend" className="wide"><Trend daily={data?.daily||[]}/></Panel></div></>}</>
}
function RatingBar({name,value=0}){return <div className="rating-row"><div><span>{name}</span><b>{prettyCount(value)}</b></div><div className="analysis-bar"><i style={{width:`${Math.min(100,Number(value)||0)}%`}}/></div></div>}

function SettingsPage({user}){
  const [aiModel,setAiModel]=useState(()=>getSavedAIModel());
  const [apiKey,setApiKey]=useState(()=>getSavedAIKey());
  const [showKey,setShowKey]=useState(false);
  const [saved,setSaved]=useState(false);
  const choose=(model)=>setAiModel(saveAIModel(model));
  const saveKey=()=>{saveAIKey(apiKey);setSaved(true);setTimeout(()=>setSaved(false),1600)};
  const forgetKey=()=>{clearAIKey();setApiKey('');setSaved(false)};
  return <><div className="page-title-row compact"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="subtle">Small controls for a focused personal workflow.</p></div></div><div className="settings-grid"><section className="panel"><h2>Account</h2><div className="settings-row"><div><strong>{user?.email||'Not signed in'}</strong><span>{user?'Supabase session connected':'Sign in to sync your bank'}</span></div><span className="badge muted">{supabase?'Supabase ready':'No client env'}</span></div></section><section className="panel"><div className="panel-head"><div><h2>Smart Import</h2><span className="panel-sub">Choose the model and add your personal Gemini API key.</span></div><Sparkles size={18}/></div><div className="model-setting-list">{AI_MODELS.map(m=><button key={m.id} type="button" className={cx('model-setting',aiModel===m.id&&'active')} onClick={()=>choose(m.id)}><span className="model-radio">{aiModel===m.id?'✓':''}</span><span><strong>{m.label}</strong><small>{m.detail}</small></span></button>)}</div><label className="api-key-field"><span>Gemini API key</span><div className="api-key-row"><input type={showKey?'text':'password'} value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Paste your Gemini API key" autoComplete="off" spellCheck="false"/><button type="button" className="secondary small-btn" onClick={()=>setShowKey(v=>!v)}><Eye size={14}/>{showKey?'Hide':'Show'}</button></div></label><div className="key-actions"><button className="primary" onClick={saveKey} disabled={!apiKey.trim()}>Save key</button><button className="secondary" onClick={forgetKey} disabled={!apiKey}>Remove key</button>{saved&&<span className="saved-note">Saved locally</span>}</div><p className="subtle settings-note">The key is stored only in this browser's localStorage and is used from your browser to call Google's Gemini API. It is not stored in your Supabase database or Netlify environment variables. A browser-stored API key can still be exposed to code running in the browser, so use a key with appropriate Google API restrictions.</p></section><section className="panel"><h2>Data model</h2><div className="settings-row"><div><strong>Taxonomy</strong><span>One unique Subject › Chapter › Topic path per account.</span></div></div><div className="settings-row"><div><strong>Scale</strong><span>Server-side pagination, trigram search and batched RPC imports for 20k+ questions.</span></div></div><div className="settings-row"><div><strong>Study tracking</strong><span>Reading / practice uses Easy · Good · Hard · Wrong; exams use scored attempts.</span></div></div></section></div></>}

function AuthModal({close,onAuthed}){const [mode,setMode]=useState('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');async function submit(e){e.preventDefault();setBusy(true);setErr('');try{if(!supabase)throw new Error('Supabase client is not configured.');if(mode==='signin'){const u=await signIn(email,password);onAuthed(u)}else{const r=await signUp(email,password,name);if(!r.session){setErr('Account created. Check your email, then sign in.');return}onAuthed(r.user)}}catch(e){setErr(e.message)}finally{setBusy(false)}}return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={close}><X size={18}/></button><div className="modal-logo"><span className="brand-mark small-mark"><span></span><span></span></span><strong>Quanta</strong></div><h2>{mode==='signin'?'Sign in':'Create account'}</h2><p className="subtle">Your questions, review history and exam data stay behind Supabase RLS.</p><form onSubmit={submit}>{mode==='signup'&&<label>Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/></label>}<label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" required placeholder="••••••••"/></label>{err&&<div className="error-box">{err}</div>}<button className="primary full" disabled={busy}>{busy?'Working…':mode==='signin'?'Sign in':'Create account'}</button></form><button className="switch-auth" onClick={()=>{setMode(mode==='signin'?'signup':'signin');setErr('')}}>{mode==='signin'?'Need an account? Sign up':'Already have an account? Sign in'}</button></div></div>}

createRoot(document.getElementById('root')).render(<App/>);
