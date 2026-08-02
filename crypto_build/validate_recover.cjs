const fs = require('fs');
const crypto = require('crypto');
const en = fs.readFileSync('../assets/english.txt','utf8').trim().split(/\s+/);

function sha(bytes){ return crypto.createHash('sha256').update(Buffer.from(bytes)).digest(); }
function freeEntropyBits(known, total){
  const N=total, EB=total===12?128:256;
  const fixed=new Array(EB).fill(false);
  for(let i=0;i<N;i++){ if(known[i]!=null){ const idx=known[i]; for(let j=0;j<11;j++){ const p=i*11+j; if(p<EB) fixed[p]=true; } } }
  const out=[]; for(let p=0;p<EB;p++) if(!fixed[p]) out.push(p);
  return out;
}
function* genRecover(known, list, total, cap){
  const N=total, EB=total===12?128:256, csBits=total===12?4:8, shaFn=sha;
  const freeEB=freeEntropyBits(known,total), e=freeEB.length;
  const maxC=(e<=53)?(1n<<BigInt(e)):null, limit=(maxC!==null)?Math.min(cap,Number(maxC)):cap;
  const template=new Uint8Array(EB/8);
  for(let i=0;i<N;i++){ if(known[i]!=null){ const idx=known[i]; for(let j=0;j<11;j++){ const p=i*11+j; if(p<EB && ((idx>>j)&1)) template[p>>3]|=(1<<(7-(p&7))); } } }
  const spanCheck=[]; for(let i=0;i<N;i++){ if(known[i]!=null && (i*11+10)>=EB) spanCheck.push(i); }
  const entBytes=new Uint8Array(EB/8);
  for(let counter=0;counter<limit;counter++){
    entBytes.set(template);
    for(let k=0;k<e;k++){ const p=freeEB[k]; if((counter>>k)&1) entBytes[p>>3]|=(1<<(7-(p&7))); }
    const hash=shaFn(entBytes), csTop=hash[0];
    let ok=true;
    for(const i of spanCheck){ let idx=0; for(let j=0;j<11;j++){ const p=i*11+j; const bit=p<EB?(entBytes[p>>3]>>(7-(p&7)))&1:(csTop>>(7-(p-EB)))&1; if(bit) idx|=(1<<j); } if(idx!==known[i]){ ok=false; break; } }
    if(!ok) continue;
    const words=[];
    for(let i=0;i<N;i++){ if(known[i]!=null){ words.push(list[known[i]]); continue; } let idx=0; for(let j=0;j<11;j++){ const p=i*11+j; const bit=p<EB?(entBytes[p>>3]>>(7-(p&7)))&1:(csTop>>(7-(p-EB)))&1; if(bit) idx|=(1<<j); } words.push(list[idx]); }
    yield words.join(' ');
  }
}
// INDEPENDENT validator: recompute checksum from first ENT bits, compare to last CS bits
function isValidBIP39(m, total){
  const ws=m.split(' ');
  if(ws.length!==total) return false;
  const idxs=ws.map(w=>en.indexOf(w));
  if(idxs.some(x=>x<0)) return false;
  const EB=total===12?128:256, csBits=total===12?4:8;
  let bits='';
  for(const idx of idxs) bits += idx.toString(2).padStart(11,'0');
  const entBits=bits.slice(0,EB);
  const csBitsStr=bits.slice(EB,EB+csBits);
  const bytes=[]; for(let i=0;i<EB;i+=8) bytes.push(parseInt(entBits.slice(i,i+8),2));
  const h=sha(Buffer.from(bytes));
  const expect=[]; for(let b=0;b<csBits;b++) expect.push((h[0]>>(7-b))&1);
  const got=csBitsStr.split('').map(c=>parseInt(c,10));
  return expect.every((v,i)=>v===got[i]);
}

function runCase(name, known, total, sampleN){
  const gen=genRecover(known, en, total, sampleN+50);
  let n=0, bad=0;
  for(const m of gen){ if(n>=sampleN) break; n++; if(!isValidBIP39(m, total)) bad++; }
  console.log((bad===0?'PASS':'FAIL'), name, 'validated', n, 'mnemonics, invalid='+bad);
  if(bad>0) process.exitCode=1;
}

// Case A: 12 words, last 2 blank (prefix-style)
let k=new Array(12).fill(0); k[10]=null; k[11]=null;
runCase('12w last2 blank', k, 12, 3000);
// Case B: 12 words, middle gap (words 5,6 blank), rest abandon
k=new Array(12).fill(0); k[5]=null; k[6]=null;
runCase('12w gap(5,6)', k, 12, 3000);
// Case C: 12 words, 3 blank at end
k=new Array(12).fill(0); k[9]=null; k[10]=null; k[11]=null;
runCase('12w last3 blank', k, 12, 3000);
// Case D: 24 words, last 2 blank
k=new Array(24).fill(0); k[22]=null; k[23]=null;
runCase('24w last2 blank', k, 24, 2000);
// Case E: 24 words, gap in middle (words 10,11,12 blank)
k=new Array(24).fill(0); k[10]=null; k[11]=null; k[12]=null;
runCase('24w gap(10,11,12)', k, 24, 2000);
