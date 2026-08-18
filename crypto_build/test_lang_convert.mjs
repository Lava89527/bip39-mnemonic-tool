// Functional test for language-switch conversion (user request #1):
// already-typed known words must remap to the target language's word at the
// SAME BIP39 index. Tests the real logic against the actually-built wordlists.
import fs from 'fs';
const s = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function getlist(k){
  const m = s.match(new RegExp('WORDLIST_' + k + '\\s*=\\s*"([^"]*)"'));
  return m ? m[1].split(' ') : null;
}
const LANGS = ['EN','ZH','ZHT','JA','KO','ES','FR','IT','CS','PT'];
const WL = {};
LANGS.forEach(k => { WL[k] = getlist(k); });
const WLM = {};
for (const k in WL){ const m = {}; WL[k].forEach((w,i)=>{ m[w]=i; }); WLM[k] = m; }
const CJK = { ZH:1, ZHT:1 };
const isCJKLang = l => !!CJK[l];
const listFor = l => WL[l] || WL.EN;
const mapFor = l => WLM[l] || WLM.EN;

// --- exact copy of the shipped convertTextBetweenLangs ---
function convertTextBetweenLangs(text, fromL, toL){
  const fromMap = mapFor(fromL), toList = listFor(toL);
  let tokens;
  if(isCJKLang(fromL)){
    tokens=[];
    const parts = text.trim().split(/\s+/).filter(Boolean);
    for(let i=0;i<parts.length;i++){ const p=parts[i]; for(let j=0;j<p.length;j++) tokens.push(p[j]); }
  } else {
    tokens = text.trim().split(/\s+/).filter(Boolean);
  }
  const out=[];
  for(let i=0;i<tokens.length;i++){
    const idx = fromMap[tokens[i]];
    out.push(idx!==undefined ? toList[idx] : tokens[i]);
  }
  return out.join(' ');
}

let pass=0, fail=0;
function eq(a,b,msg){ if(a===b) pass++; else { fail++; console.log('FAIL', msg, '| got', JSON.stringify(a), 'want', JSON.stringify(b)); } }

// index-0 / index-2047 anchors across languages
eq(convertTextBetweenLangs('abandon ability able', 'EN','ZH'), '的 一 是', 'EN[0,1,2] -> ZH');
eq(convertTextBetweenLangs('zoo', 'EN','ZH'), '歇', 'EN[2047] -> ZH[2047]');
eq(convertTextBetweenLangs('的 一 是', 'ZH','EN'), 'abandon ability able', 'ZH -> EN');
eq(convertTextBetweenLangs('abandon', 'EN','JA'), WL.JA[0], 'EN[0] -> JA[0]');
eq(convertTextBetweenLangs('的', 'ZH','JA'), WL.JA[0], 'ZH[0] -> JA[0]');
eq(convertTextBetweenLangs('abandon', 'EN','KO'), WL.KO[0], 'EN[0] -> KO[0]');
eq(convertTextBetweenLangs('abandon', 'EN','ES'), WL.ES[0], 'EN[0] -> ES[0]');
eq(convertTextBetweenLangs('abandon', 'EN','FR'), WL.FR[0], 'EN[0] -> FR[0]');
eq(convertTextBetweenLangs('abandon', 'EN','IT'), WL.IT[0], 'EN[0] -> IT[0]');
eq(convertTextBetweenLangs('abandon', 'EN','CS'), WL.CS[0], 'EN[0] -> CS[0]');
eq(convertTextBetweenLangs('abandon', 'EN','PT'), WL.PT[0], 'EN[0] -> PT[0]');
eq(convertTextBetweenLangs('abandon', 'EN','ZHT'), WL.ZHT[0], 'EN[0] -> ZHT[0]');
// ZH -> other non-CJK
eq(convertTextBetweenLangs('的', 'ZH','KO'), WL.KO[0], 'ZH[0] -> KO[0]');
// unknown word preserved verbatim
eq(convertTextBetweenLangs('abandon foobar', 'EN','ZH'), '的 foobar', 'unknown word kept');
// ZH no-space input still splits into chars (是 = index 2 -> EN 'able')
eq(convertTextBetweenLangs('的是', 'ZH','EN'), 'abandon able', 'ZH nospace -> EN');
// round trip EN -> ZH -> EN
const rt = convertTextBetweenLangs(convertTextBetweenLangs('abandon ability able about', 'EN','ZH'), 'ZH','EN');
eq(rt, 'abandon ability able about', 'round trip EN->ZH->EN');
// rigorous index alignment: EN[i] -> ZH/JA/KO must yield the i-th word of each
let aligned = true, badAt = -1;
for (let i=0;i<2048;i++){
  if (convertTextBetweenLangs(WL.EN[i],'EN','ZH') !== WL.ZH[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','JA')  !== WL.JA[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','KO')  !== WL.KO[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','ES')  !== WL.ES[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','FR')  !== WL.FR[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','IT')  !== WL.IT[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','CS')  !== WL.CS[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','PT')  !== WL.PT[i]) { aligned=false; badAt=i; break; }
  if (convertTextBetweenLangs(WL.EN[i],'EN','ZHT') !== WL.ZHT[i]){ aligned=false; badAt=i; break; }
}
eq(aligned, true, 'full index alignment EN->all langs (badAt='+badAt+')');

console.log('LANG CONVERT TESTS -> PASS', pass, 'FAIL', fail);
process.exit(fail ? 1 : 0);
