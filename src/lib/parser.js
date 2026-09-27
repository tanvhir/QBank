// Quanta v7 — tolerant local parser used as a fast fallback and preview safety net.
// The primary importer is the Supabase Edge Function + Gemini/Gemma, but this parser
// understands the common NotebookLM/Markdown shapes without requiring AI.

function uid(){
  return globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now();
}
function today(){ return new Date().toISOString().slice(0,10); }
function stripInvisible(s){ return String(s??'').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\u00A0/g,' '); }
function normalizeDigits(s){ return String(s??'').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))); }

export function normalizeText(s){
  return stripInvisible(s).replace(/\r\n?/g,'\n').replace(/\t/g,' ').replace(/[ ]{2,}/g,' ').trim();
}

export function cleanMarkdown(value){
  let s = String(value??'');
  s = s.replace(/<br\s*\/?>(?:\s*)/gi, '\n');
  s = s.replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g,'$1');
  s = s.replace(/`([^`]+)`/g,'$1');
  s = s.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1');
  s = s.replace(/\*([^*]+)\*/g,'$1').replace(/_([^_]+)_/g,'$1');
  s = s.replace(/^[>#]+\s*/,'');
  return s.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}

function normalizeMath(s){
  // Keep math explicit and readable. Convert double-escaped delimiters produced by Markdown copy.
  return String(s??'')
    .replace(/\\\\\((.*?)\\\\\)/g, '\\($1\\)')
    .replace(/\\\\\[(.*?)\\\\\]/g, '\\[$1\\]');
}

function isQuestionStart(line){
  const s = cleanMarkdown(line).replace(/^[•*-]+\s*/,'').trim();
  return /^(?:Q|Question)\s*[0-9০-৯]+\s*(?:[.)\-:]|\\\.)\s*/i.test(s);
}

export function parseQuestionStart(line){
  let s = stripInvisible(line).trim();
  s = s.replace(/^[`*_>#]+\s*/,'').replace(/^[•*-]+\s*/,'');
  s = s.replace(/\\([.!])/g,'$1');
  // Some transformed text can glue a format token to the path/question; strip only known tokens.
  s = s.replace(/^(?:short|mcq)\s+(?=(?:Q|Question)\s*\d)/i,'');
  const m = s.match(/^(?:Q|Question)\s*([0-9০-৯]+)\s*(?:[.)\-:]|\\\.)\s*(.*)$/i);
  if(!m) return null;
  return {number:normalizeDigits(m[1]),body:normalizeMath(cleanMarkdown(m[2]))};
}

function parsePathLine(line){
  let s = cleanMarkdown(line).replace(/^[-*+•]\s*/,'').trim();
  // Remove accidental format labels before a path.
  s = s.replace(/^(?:short|mcq)\s+(?=[^/]+\/)/i,'');
  if(!s.includes('/') || /^https?:\/\//i.test(s)) return null;
  const parts = s.split('/').map(x=>cleanMarkdown(x)).filter(Boolean);
  if(parts.length < 3) return null;
  return {subject:parts[0], chapter:parts[1], topic:parts.slice(2).join(' / ')};
}

function extractReferenceTags(raw){
  const refs=[];
  for(const m of String(raw??'').matchAll(/\[([^\]]+)\]/g)){
    const inner=cleanMarkdown(m[1]).trim();
    // Numeric citations like [১], [25], [১, ২৫] are not PYQ tags.
    if(!inner || /^[0-9০-৯\s,.;:+\-–—]+$/.test(inner)) continue;
    if(/[A-Za-z]/.test(inner) || /(?:\b\d{2,4}\s*[-–—]\s*\d{2,4}\b)/.test(inner)){
      for(const x of inner.split(/\s*,\s*/).map(v=>v.trim()).filter(Boolean)) refs.push(x);
    }
  }
  return [...new Set(refs)];
}

function removeReferenceTags(s){
  return String(s??'').replace(/\s*\[[^\]]+\]/g,'').replace(/\s{2,}/g,' ').trim();
}

function splitAnswerLabel(text){
  const s = String(text??'');
  const re = /(?:^|[\s|])(?:উত্তর|উত্তরঃ|answer|ans|correct\s+answer)\s*[:：\-–—]\s*/i;
  const m = re.exec(s);
  if(!m) return null;
  const left=s.slice(0,m.index).trim();
  let right=s.slice(m.index+m[0].length).trim();
  let explanation='';
  const em=/^(.*?)(?:\s+)(?:ব্যাখ্যা|explanation|কারণ|reason|কেন)\s*[:：\-–—]\s*(.+)$/is.exec(right);
  if(em){ right=em[1].trim(); explanation=em[2].trim(); }
  return {left,right,explanation};
}

function normalizeRecord(o){
  const q=normalizeMath(cleanMarkdown(o.question||o.q||''));
  const rawAns=normalizeMath(cleanMarkdown(o.answer||o.ans||''));
  const opts=Array.isArray(o.options)?o.options.map(x=>normalizeMath(cleanMarkdown(x))).filter(Boolean):[];
  const answer=removeReferenceTags(rawAns);
  const type=(String(o.type||'').toLowerCase()==='mcq'||opts.length>0)?'mcq':'short';
  const refs=[...(Array.isArray(o.reference_tags)?o.reference_tags:[])].map(cleanMarkdown).filter(Boolean);
  const fromText=extractReferenceTags(`${q} ${rawAns} ${o.explanation||''}`);
  const question=removeReferenceTags(q);
  return {
    id:o.id||uid(), type, question, options:opts, answer,
    explanation:normalizeMath(cleanMarkdown(o.explanation||'')),
    reference_tags:[...new Set([...refs,...fromText])],
    subject:cleanMarkdown(o.subject||'Uncategorized')||'Uncategorized',
    chapter:cleanMarkdown(o.chapter||'General')||'General',
    topic:cleanMarkdown(o.topic||'General')||'General',
    difficulty:['easy','medium','hard'].includes(o.difficulty)?o.difficulty:'medium',
    next_review_at:o.next_review_at||today(), review_interval:Number(o.review_interval||1), ease_factor:Number(o.ease_factor||2.5),
    times_seen:Number(o.times_seen||0), times_correct:Number(o.times_correct||0), last_rating:o.last_rating||null, streak:Number(o.streak||0), lapses:Number(o.lapses||0),
    _number:o._number||null, _raw:o._raw||'', _complete:Boolean(question&&answer), _status:o._status||o.parse_status||null,
  };
}

function splitBlocks(lines){
  const blocks=[]; let current=null;
  for(const raw of lines){
    const line=stripInvisible(raw).trim();
    const start=parseQuestionStart(line);
    if(start){ if(current) blocks.push(current); current={number:start.number,lines:[start.body],raw:[raw]}; continue; }
    if(current){ current.lines.push(line); current.raw.push(raw); }
  }
  if(current) blocks.push(current);
  return blocks;
}

export function parseNotebook(text){
  const lines=normalizeText(text).split('\n');
  let subject='Uncategorized',chapter='General',topic='General';
  const records=[];
  let current=null;
  const push=()=>{
    if(!current) return;
    const full=current.lines.join('\n');
    // Find the first answer label anywhere in the block, even when it follows a multiline question.
    const am=full.match(/(?:^|\n)(?:উত্তর|উত্তরঃ|answer|ans|correct\s+answer)\s*[:：\-–—]\s*/i);
    let question='',answer='',explanation='';
    if(am){
      const at=am.index+(am[0].startsWith('\n')?1:0);
      question=full.slice(0,at).trim();
      const rest=full.slice(at+am[0].replace(/^\n/,'').length).trim();
      const em=rest.match(/(?:^|\n)(?:ব্যাখ্যা|explanation|কারণ|reason|কেন)\s*[:：\-–—]\s*([\s\S]*)$/i);
      if(em){ answer=rest.slice(0,em.index).trim(); explanation=em[1].trim(); }
      else answer=rest;
    } else {
      const inline=splitAnswerLabel(full);
      if(inline){question=inline.left;answer=inline.right;explanation=inline.explanation;}
      else {question=full;answer='';}
    }
    // Remove option prefixes from the question if a copied option list was included before answer.
    const options=[];
    const qLines=question.split('\n').map(x=>x.trim()).filter(Boolean);
    const kept=[];
    for(const l of qLines){
      const om=l.match(/^(?:\(?([A-E])\)?)[.)\-]\s+(.+)$/i);
      if(om){options.push(om[2]);continue;} kept.push(l);
    }
    const refs=extractReferenceTags(`${question} ${answer}`);
    records.push(normalizeRecord({question:kept.join(' '),answer,explanation,reference_tags:refs,options,type:options.length?'mcq':'short',subject,chapter,topic,_number:current.number,_raw:current.raw.join('\n')}));
    current=null;
  };

  for(const raw of lines){
    const line=stripInvisible(raw).trim(); if(!line) continue;
    if(/^(?:---+|\.\s*\.)$/.test(line)) continue;
    const path=parsePathLine(line);
    const isAnswerLine=/^(?:উত্তর|উত্তরঃ|answer|ans|correct\s+answer)\s*[:：\-–—]/i.test(line);
    if(path && !parseQuestionStart(line) && !isAnswerLine){
      push(); subject=path.subject;chapter=path.chapter;topic=path.topic; continue;
    }
    const qs=parseQuestionStart(line);
    if(qs){
      push();
      current={number:qs.number,lines:[qs.body],raw:[raw]};
      continue;
    }
    if(current) current.lines.push(line), current.raw.push(raw);
  }
  push();
  return records;
}

function parseJson(text){
  try{
    const raw=JSON.parse(text); const arr=Array.isArray(raw)?raw:(Array.isArray(raw?.questions)?raw.questions:[]);
    return arr.map(normalizeRecord);
  }catch{return [];}
}

function splitCsvLine(line){
  const out=[];let cur='';let quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;
}
function parseCsv(text){
  const lines=String(text||'').split('\n').filter(x=>x.trim());if(lines.length<2)return [];
  const head=splitCsvLine(lines[0]).map(x=>cleanMarkdown(x).toLowerCase());
  return lines.slice(1).map(line=>normalizeRecord(Object.fromEntries(head.map((h,i)=>[h,splitCsvLine(line)[i]||'']))));
}

export function normalizeAIResults(items){ return (Array.isArray(items)?items:[]).map(normalizeRecord); }

export function countQuestionMarkers(text){ return normalizeText(text).split('\n').reduce((n,l)=>n+(parseQuestionStart(l)?1:0),0); }
export function isImportable(q){ return Boolean(q&&q.question&&q.answer&&q.subject&&q.chapter&&q.topic); }
export function parseAny(text){
  const t=normalizeText(text); if(!t)return [];
  if(/^\s*[\[{]/.test(t)){const j=parseJson(t);if(j.length)return j;}
  if(/^(?:type|question|q|subject)\s*,/i.test(t.split('\n')[0])){const c=parseCsv(t);if(c.length)return c;}
  return parseNotebook(t);
}
export function cleanForAI(text){ return normalizeText(text); }
