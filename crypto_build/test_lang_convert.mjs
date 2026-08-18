// Faithful functional test for language-switch conversion.
// Extracts the REAL convertTextBetweenLangs / segmentRun from the built
// index.html (so we test shipped code, not a copy) and runs it against the
// real wordlists baked into the file.
import fs from 'fs';
const s = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function getlist(k){
  const m = s.match(new RegExp('WORDLIST_' + k + '\\s*=\\s*"([^"]*)"'));
  return m ? m[1].split(' ') : null;
}
const LANGS = ['EN','ZH','ZHT','JA','KO','ES','FR','IT','CS','PT'];
const WL = {};
LANGS.forEach(k => { WL[k] = getlist(k); });

// --- extract a top-level function by brace matching ---
function extractFn(name){
  const idx = s.indexOf('function ' + name + '(');
  if(idx < 0) throw new Error('function not found: ' + name);
  let depth = 0, started = false;
  for(let i = idx; i < s.length; i++){
    const c = s[i];
    if(c === '{'){ depth++; started = true; }
    else if(c === '}'){ depth--; if(started && depth === 0) return s.slice(idx, i + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
function extractLine(re){
  const m = s.match(re);
  if(!m) throw new Error('line not found: ' + re);
  return m[0];
}

// Rebuild WLM exactly as the page does, then assemble a module from the real
// functions pulled out of the artifact.
const WLM = {};
for(const k in WL){ const m = {}; WL[k].forEach((w,i)=>{ m[w]=i; }); WLM[k] = m; }

const moduleSrc = `
const WL = ${JSON.stringify(WL)};
const WLM = {};
for (var _wlk in WL) { var _wl = WL[_wlk]; var _m = {}; for (var _i = 0; _i < _wl.length; _i++) _m[_wl[_i]] = _i; WLM[_wlk] = _m; }
${extractLine(/var CONCAT_LANGS = \{[^}]*\};/)}
${extractFn('isConcatLang')}
${extractLine(/var MAXWLEN = \{\};/)}
${extractLine(/for \(var _kl in WL\) \{.*/)}
${extractFn('segmentRun')}
${extractFn('mapFor')}
${extractFn('listFor')}
${extractFn('convertTextBetweenLangs')}
return convertTextBetweenLangs;
`;
const convertTextBetweenLangs = new Function(moduleSrc)();

// pull segmentRun out too for direct single-word checks
const segSrc = `
const WL = ${JSON.stringify(WL)};
const WLM = {};
for (var _wlk in WL) { var _wl = WL[_wlk]; var _m = {}; for (var _i = 0; _i < _wl.length; _i++) _m[_wl[_i]] = _i; WLM[_wlk] = _m; }
${extractLine(/var CONCAT_LANGS = \{[^}]*\};/)}
${extractFn('isConcatLang')}
${extractLine(/var MAXWLEN = \{\};/)}
${extractLine(/for \(var _kl in WL\) \{.*/)}
${extractFn('segmentRun')}
return segmentRun;
`;
const segmentRun = new Function(segSrc)();

let pass = 0, fail = 0;
function eq(a, b, msg){ if(a === b) pass++; else { fail++; console.log('FAIL', msg, '| got', JSON.stringify(a), 'want', JSON.stringify(b)); } }

// ---------- previously-working EN<->ZH anchors (regression) ----------
eq(convertTextBetweenLangs('abandon ability able', 'EN','ZH'), '的 一 是', 'EN[0,1,2] -> ZH');
eq(convertTextBetweenLangs('zoo', 'EN','ZH'), '歇', 'EN[2047] -> ZH[2047]');
eq(convertTextBetweenLangs('的 一 是', 'ZH','EN'), 'abandon ability able', 'ZH -> EN');
eq(convertTextBetweenLangs('的是', 'ZH','EN'), 'abandon able', 'ZH nospace -> EN');

// ---------- JA as SOURCE with NO spaces (the reported bug) ----------
const jaConcat = WL.JA.slice(0,12).join('');           // real no-space JA mnemonic (12 words)
const enExpect = WL.EN.slice(0,12).join(' ');          // space-joined EN words
eq(convertTextBetweenLangs(jaConcat, 'JA','EN'), enExpect, 'JA(nospace) -> EN');
eq(convertTextBetweenLangs(jaConcat, 'JA','ZH'), WL.ZH.slice(0,12).join(' '), 'JA(nospace) -> ZH');
eq(convertTextBetweenLangs(jaConcat, 'JA','KO'), WL.KO.slice(0,12).join(' '), 'JA(nospace) -> KO');
eq(convertTextBetweenLangs(jaConcat, 'JA','ES'), WL.ES.slice(0,12).join(' '), 'JA(nospace) -> ES');

// single-word JA segmentation must resolve each word to its own index
let singleOk = true, badSingle = -1;
for(let i=0;i<2048;i++){
  const r = segmentRun(WL.JA[i], WLM.JA, WL.JA[i].length);
  if(!(r && r.length===1 && r[0]===i)){ singleOk=false; badSingle=i; break; }
}
eq(singleOk, true, 'JA single-word segmentation (badAt='+badSingle+')');

// ---------- JA round trips ----------
// (a) JA-with-spaces -> EN -> JA-with-spaces
const jaSpace = WL.JA.slice(0,12).join(' ');
eq(convertTextBetweenLangs(convertTextBetweenLangs(jaSpace,'JA','EN'),'EN','JA'), jaSpace, 'round trip JA(space)->EN->JA');
// (b) JA-no-space -> EN -> JA-no-space (compare concatenated form)
const jaBack = convertTextBetweenLangs(convertTextBetweenLangs(jaConcat,'JA','EN'),'EN','JA').replace(/\s+/g,'');
eq(jaBack, jaConcat, 'round trip JA(nospace)->EN->JA(nospace)');

// ---------- unknown word preserved (JA source) ----------
const jaWithUnknown = WL.JA[0] + WL.JA[1] + 'zzzznotaword' + WL.JA[2];
// 'zzz...' is not segmentable as a run -> preserved literally (still concat, so it stays in output)
const outUnk = convertTextBetweenLangs(WL.JA.slice(0,3).join(''), 'JA','EN');
eq(outUnk, WL.EN.slice(0,3).join(' '), 'JA nospace unknown not present -> clean 3 words');

// ---------- cross conversions among space-delimited langs ----------
eq(convertTextBetweenLangs('abandon', 'EN','JA'), WL.JA[0], 'EN[0] -> JA[0]');
eq(convertTextBetweenLangs('abandon', 'EN','KO'), WL.KO[0], 'EN[0] -> KO[0]');
eq(convertTextBetweenLangs('abandon', 'EN','ES'), WL.ES[0], 'EN[0] -> ES[0]');
eq(convertTextBetweenLangs('abandon', 'EN','FR'), WL.FR[0], 'EN[0] -> FR[0]');
eq(convertTextBetweenLangs('abandon', 'EN','IT'), WL.IT[0], 'EN[0] -> IT[0]');
eq(convertTextBetweenLangs('abandon', 'EN','CS'), WL.CS[0], 'EN[0] -> CS[0]');
eq(convertTextBetweenLangs('abandon', 'EN','PT'), WL.PT[0], 'EN[0] -> PT[0]');
eq(convertTextBetweenLangs('abandon', 'EN','ZHT'), WL.ZHT[0], 'EN[0] -> ZHT[0]');
eq(convertTextBetweenLangs('的', 'ZH','KO'), WL.KO[0], 'ZH[0] -> KO[0]');
eq(convertTextBetweenLangs('abandon foobar', 'EN','ZH'), '的 foobar', 'unknown word kept');

// ES -> FR -> IT -> CS -> PT -> KO -> EN chain round trip
let chain = WL.EN.slice(0,12).join(' ');
let cur = chain, from = 'EN';
for(const to of ['ES','FR','IT','CS','PT','KO','EN']) { cur = convertTextBetweenLangs(cur, from, to); from = to; }
eq(cur, chain, 'EN->ES->FR->IT->CS->PT->KO->EN chain');

// KO -> JA (no-space) -> KO
const koStr = WL.KO.slice(0,12).join(' ');
const koJa = convertTextBetweenLangs(koStr, 'KO','JA');          // space-joined JA
const koJaNo = koJa.replace(/\s+/g,'');
const koBack = convertTextBetweenLangs(koJa, 'JA','KO').replace(/\s+/g,'');
eq(koBack, WL.KO.slice(0,12).join(''), 'KO -> JA(nospace) -> KO');

// rigorous index alignment EN -> every lang (single words)
let aligned = true, badAt = -1;
for (let i=0;i<2048;i++){
  for(const L of ['ZH','ZHT','JA','KO','ES','FR','IT','CS','PT']){
    if (convertTextBetweenLangs(WL.EN[i],'EN',L) !== WL[L][i]) { aligned=false; badAt=i; console.log('  align fail at',i,L); break; }
  }
  if(!aligned) break;
}
eq(aligned, true, 'full index alignment EN->all langs (badAt='+badAt+')');

console.log('LANG CONVERT TESTS -> PASS', pass, 'FAIL', fail);
process.exit(fail ? 1 : 0);
