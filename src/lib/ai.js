import { normalizeAIResults, cleanForAI, parseQuestionStart } from './parser';

export const AI_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', detail: 'Fast · recommended for large imports' },
  { id: 'gemma-4-31b-it', label: 'Gemma 4 31B', detail: 'Alternative model · switch from Settings' },
];

export function getSavedAIModel(){
  const saved = localStorage.getItem('quanta_ai_model');
  return AI_MODELS.some(x=>x.id===saved) ? saved : AI_MODELS[0].id;
}
export function saveAIModel(model){
  const next = AI_MODELS.some(x=>x.id===model) ? model : AI_MODELS[0].id;
  localStorage.setItem('quanta_ai_model', next);
  return next;
}

const GEMINI_KEY_STORAGE = 'quanta_gemini_api_key';
export function getSavedAIKey(){
  try { return localStorage.getItem(GEMINI_KEY_STORAGE) || ''; } catch { return ''; }
}
export function saveAIKey(key){
  const next = String(key||'').trim();
  try {
    if(next) localStorage.setItem(GEMINI_KEY_STORAGE, next);
    else localStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {}
  return next;
}
export function clearAIKey(){
  try { localStorage.removeItem(GEMINI_KEY_STORAGE); } catch {}
}

function splitLargeSource(source, maxChars=140000){
  const clean=cleanForAI(source);
  if(clean.length<=maxChars) return [clean];
  const lines=clean.split('\n'); const chunks=[]; let current=[]; let currentLen=0; let lastPath='';
  const pathLike=/^[^/\n]+\/[^/\n]+\/[^/\n]+/;
  const qStart=(line)=>Boolean(parseQuestionStart(line));
  for(const line of lines){
    if(pathLike.test(line) && !qStart(line)) lastPath=line.trim();
    const projected=currentLen+line.length+1;
    if(projected>maxChars && current.some(qStart)){
      chunks.push((lastPath && !current.some(x=>x.trim()===lastPath)?[lastPath,...current]:current).join('\n'));
      current=[]; currentLen=0;
    }
    current.push(line); currentLen+=line.length+1;
  }
  if(current.length) chunks.push(current.join('\n'));
  return chunks.filter(Boolean);
}

function dedupe(records){
  const seen=new Set(); const out=[];
  for(const q of records){
    const key=[q.subject,q.chapter,q.topic,q.question].map(v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ')).join('|');
    if(!key || seen.has(key)) continue; seen.add(key); out.push(q);
  }
  return out;
}

export async function smartParseImport(userId, text, model=getSavedAIModel(), apiKey=getSavedAIKey()){
  if(!userId) throw new Error('Sign in before using Smart Import.');
  const key=String(apiKey||'').trim();
  if(!key) throw new Error('Add your Gemini API key in Settings first.');
  const chosen=AI_MODELS.some(x=>x.id===model)?model:AI_MODELS[0].id;
  const chunks=splitLargeSource(text);
  const all=[]; const warnings=[];
  for(let i=0;i<chunks.length;i++){
    const raw=await callGeminiBrowser(chosen,chunks[i],key);
    const questions=Array.isArray(raw)?raw:(Array.isArray(raw?.questions)?raw.questions:[]);
    if(!questions.length) throw new Error(`AI returned no questions for chunk ${i+1}/${chunks.length}.`);
    all.push(...normalizeAIResults(questions));
    if(Array.isArray(raw?.warnings)) warnings.push(...raw.warnings);
  }
  return {model:chosen,questions:dedupe(all),sourceQuestionCount:all.length,warnings:[...new Set(warnings)]};
}

function stripCodeFence(text){
  return String(text||'').replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
}
function extractJson(text){
  const c=stripCodeFence(text);
  try{return JSON.parse(c)}catch{}
  const firstObj=c.indexOf('{'),lastObj=c.lastIndexOf('}');
  if(firstObj>=0&&lastObj>firstObj){try{return JSON.parse(c.slice(firstObj,lastObj+1))}catch{}}
  const firstArr=c.indexOf('['),lastArr=c.lastIndexOf(']');
  if(firstArr>=0&&lastArr>firstArr){try{return JSON.parse(c.slice(firstArr,lastArr+1))}catch{}}
  throw new Error('AI returned invalid JSON.');
}

const AI_PROMPT=(source)=>`You are Quanta Smart Import, a strict educational question-bank extraction engine.
Convert the supplied source into structured question records. The source may be Markdown copied from NotebookLM, AI notes, plain text, or mixed formatting.

RULES:
1. Extract only. Never invent, rewrite, answer, correct, or summarize facts.
2. Preserve question and answer wording as closely as possible. Remove only numbering, Markdown decoration, and structural labels.
3. A hierarchy line is Subject/Chapter/Topic. Use the latest hierarchy for following questions. If there are more than 3 slash-separated parts, Subject=part 1, Chapter=part 2, Topic=the remaining parts joined by '/'.
4. Recognize Q1., Q1:, Q1), Q1\., Question 1., Bengali digits, and Markdown-wrapped variants such as **Q1\.**.
5. Answers may be on the same line or later. Recognize উত্তর:, উত্তরঃ, উত্তর -, Answer:, Ans:, Correct Answer:.
6. Square-bracket references such as [JU-D 18-19, MBBS 22-23] become reference_tags. Pure numeric citations such as [১], [1], [২৫] are not reference tags.
7. Explanation only when explicitly present in the source.
8. Default type=short. Use mcq only when options are clearly present.
9. Preserve mathematics and scientific notation. Keep TeX/LaTeX exactly where possible, including \(g/m^2\), \frac{g}{m^2}, CH_4, x^2, subscripts and superscripts. Slash characters inside an answer are never hierarchy separators.
10. Ignore Markdown separators, page commentary, and empty lines.
11. Never drop a numbered question because an answer is missing. Mark parse_status='incomplete' and retain the best question text plus raw_block.
12. Never merge two numbered questions and never create a question from an answer line.
13. If input has artifacts like 'shortBotany' or 'short' glued to a field, remove the artifact.
14. Keep hierarchy values clean and exact; do not invent missing hierarchy. Use Uncategoriz​ed/General/General only when truly unavailable.

Return ONLY JSON in this exact shape:
{"questions":[{"type":"short","question":"","options":[],"answer":"","explanation":"","reference_tags":[],"subject":"","chapter":"","topic":"","difficulty":"medium","parse_status":"complete","raw_block":""}],"warnings":[]}

SOURCE START
${source}
SOURCE END`;

async function requestGemini(model,source,key){
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body={contents:[{role:'user',parts:[{text:AI_PROMPT(source)}]}],generationConfig:{temperature:0,maxOutputTokens:32768,responseMimeType:'application/json'}};
  let last='';
  for(let attempt=0;attempt<3;attempt++){
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const raw=await res.text();
    let payload={}; try{payload=raw?JSON.parse(raw):{}}catch{}
    if(res.ok) return payload;
    last=payload?.error?.message || `Gemini request failed (${res.status}).`;
    if(!(res.status===429||res.status>=500)||attempt===2) break;
    const retryAfter=Number(res.headers.get('retry-after')||'0');
    const delay=Math.min(8000,Math.max(700,retryAfter*1000 || 700*(attempt+1)));
    await new Promise(r=>setTimeout(r,delay));
  }
  throw new Error(last);
}

async function callGeminiBrowser(model,source,key){
  try{
    const payload=await requestGemini(model,source,key);
    const text=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(!text) throw new Error('The model returned an empty response.');
    return extractJson(text);
  }catch(err){
    const msg=err instanceof Error?err.message:'';
    if(!/mime|schema|unsupported|invalid argument|INVALID_ARGUMENT/i.test(msg)) throw err;
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const body={contents:[{role:'user',parts:[{text:AI_PROMPT(source)}]}],generationConfig:{temperature:0,maxOutputTokens:32768}};
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const payload=await res.json();
    if(!res.ok) throw new Error(payload?.error?.message || `Gemini request failed (${res.status}).`);
    const text=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(!text) throw new Error('The model returned an empty response.');
    return extractJson(text);
  }
}

