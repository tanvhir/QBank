import { parseAny, isImportable } from '../src/lib/parser.js';
const src=`Botany/জীবের পরিবেশ, বিস্তার ও সংরক্ষণ/টপিক ০২: ইকোসিস্টেম বা বাস্তুতন্ত্র

Q47\. বায়োমাসের পিরামিডে ব্যবহৃত পরিমাপের একক কী?

উত্তর: গ্রাম/বর্গমিটার (\\(g/m^2\\))।

Q48\. শক্তির পিরামিডের পরিমাপের একক কী?

উত্তর: কিলোক্যালোরি/বর্গমিটার/বছর (\\(kcal/m^2/yr\\))।`;
const out=parseAny(src);
if(out.length!==2 || out.some(q=>!isImportable(q)) || !out[0].answer.includes('g/m^2') || !out[1].answer.includes('kcal/m^2/yr')) throw new Error(JSON.stringify(out,null,2));
console.log('Problem-case parser passed:',out.map(q=>({q:q.question,a:q.answer,path:[q.subject,q.chapter,q.topic].join(' > ')})));
