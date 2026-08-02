/*
 * verify_recover.cjs
 * Independent correctness check of the "缺失恢复" generator (genRecover).
 *
 *  - Extracts freeEntropyBits / countValid / genRecover straight from index.html.
 *  - Validates every generated mnemonic with @scure/bip39.validateMnemonic
 *    (the authoritative standard BIP39 implementation).
 *  - Cross-checks a prefix case against MnemCore.completeMnemonicGen.
 */
const fs = require('fs');
const path = require('path');
const { validateMnemonic } = require('@scure/bip39');
const { wordlist: EN_WL } = require('@scure/bip39/wordlists/english');
let ZH_WL = null;
try { ZH_WL = require('@scure/bip39/wordlists/chinese'); } catch (e) { ZH_WL = null; }

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---- extract the app wordlists ----
function extractWordlist(name) {
  const m = html.match(new RegExp('const ' + name + ' = "([^"]*)"'));
  if (!m) throw new Error('cannot find ' + name);
  return m[1].split(' ');
}
const WORDLIST_EN = extractWordlist('WORDLIST_EN');
const WORDLIST_ZH = extractWordlist('WORDLIST_ZH');

// ---- extract a function body by brace-matching ----
function extractFn(src, name) {
  const start = src.search(new RegExp('function\\*?\\s+' + name + '\\('));
  if (start < 0) throw new Error('not found: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced: ' + name);
}
const src = extractFn(html, 'freeEntropyBits') + '\n' +
            extractFn(html, 'countValid') + '\n' +
            extractFn(html, 'genRecover') + '\n' +
            'return { freeEntropyBits, countValid, genRecover };';
const { freeEntropyBits, countValid, genRecover } = new Function(src)();

const MnemCore = require(path.join(ROOT, 'mnemonic_core.js'));

// ---- helpers ----
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

function toIndices(words) { return words.map(w => WORDLIST_EN.indexOf(w)); }

// =====================================================================
console.log('\n=== Test 1: 12-word, first 10 known, last 2 missing (262144) ===');
{
  const knownWords = WORDLIST_EN.slice(0, 10);            // abandon..access
  const known = toIndices(knownWords).concat([null, null]);
  const cnt = countValid(known, 12);
  check('countValid == 262144', cnt === 262144, 'got ' + cnt);
  let total = 0, invalid = 0, t0 = Date.now();
  for (const m of genRecover(known, WORDLIST_EN, 12, 262144)) {
    total++;
    if (!validateMnemonic(m, EN_WL)) invalid++;
  }
  console.log('  generated ' + total + ' in ' + (Date.now() - t0) + 'ms, invalid=' + invalid);
  check('generated count == 262144', total === 262144, 'got ' + total);
  check('ALL valid BIP39 (scure)', invalid === 0, 'invalid=' + invalid);
}

// =====================================================================
console.log('\n=== Test 2: 24-word, first 22 known, last 2 missing (262144) ===');
{
  const knownWords = WORDLIST_EN.slice(0, 22);
  const known = toIndices(knownWords).concat([null, null]);
  const cnt = countValid(known, 24);
  check('countValid == 16384 (2^14)', cnt === 16384, 'got ' + cnt);
  let total = 0, invalid = 0, t0 = Date.now();
  for (const m of genRecover(known, WORDLIST_EN, 24, 16384)) {
    total++;
    if (!validateMnemonic(m, EN_WL)) invalid++;
  }
  console.log('  generated ' + total + ' in ' + (Date.now() - t0) + 'ms, invalid=' + invalid);
  check('generated count == 16384', total === 16384, 'got ' + total);
  check('ALL valid BIP39 (scure)', invalid === 0, 'invalid=' + invalid);
}

// =====================================================================
console.log('\n=== Test 3: arbitrary internal gap (12-word, word0 & word11 missing) ===');
{
  // known words at positions 1..10, missing 0 and 11
  const known = new Array(12).fill(null);
  for (let i = 1; i <= 10; i++) known[i] = WORDLIST_EN.indexOf(WORDLIST_EN[i]);
  const cnt = countValid(known, 12);          // free entropy = 18 bits -> 262144
  check('countValid == 262144', cnt === 262144, 'got ' + cnt);
  let total = 0, invalid = 0;
  // only sample first 20000 for speed
  for (const m of genRecover(known, WORDLIST_EN, 12, 20000)) {
    total++;
    if (!validateMnemonic(m, EN_WL)) invalid++;
  }
  check('sampled 20000', total === 20000, 'got ' + total);
  check('ALL valid BIP39 (scure) [sampled]', invalid === 0, 'invalid=' + invalid);
}

// =====================================================================
console.log('\n=== Test 4: cross-check prefix case vs completeMnemonicGen (ground truth) ===');
{
  // genRecover: first 10 known, last 2 null  -> compare SET to completeMnemonicGen([0..9])
  const knownWords = WORDLIST_EN.slice(0, 10);
  const known = toIndices(knownWords).concat([null, null]);
  const setA = new Set();
  for (const m of genRecover(known, WORDLIST_EN, 12, 262144)) setA.add(m);
  const setB = new Set();
  for (const m of MnemCore.completeMnemonicGen(toIndices(knownWords), WORDLIST_EN)) setB.add(m);
  check('same cardinality (262144)', setA.size === setB.size, setA.size + ' vs ' + setB.size);
  let mismatch = 0;
  for (const m of setA) if (!setB.has(m)) mismatch++;
  check('sets identical', mismatch === 0, 'mismatch=' + mismatch);
}

// =====================================================================
console.log('\n=== Test 5: ZH mode - 11-word prefix cross-check vs completeMnemonicGen ===');
{
  // completeMnemonicGen works for any wordlist; cross-check the ZH code path the same way as EN.
  const knownWords = WORDLIST_ZH.slice(0, 10);
  const known = knownWords.map(w => WORDLIST_ZH.indexOf(w)).concat([null, null]);
  const setA = new Set();
  for (const m of genRecover(known, WORDLIST_ZH, 12, 262144)) setA.add(m);
  const setB = new Set();
  for (const m of MnemCore.completeMnemonicGen(knownWords.map(w => WORDLIST_ZH.indexOf(w)), WORDLIST_ZH)) setB.add(m);
  check('ZH same cardinality (262144)', setA.size === setB.size, setA.size + ' vs ' + setB.size);
  let mismatch = 0; for (const m of setA) if (!setB.has(m)) mismatch++;
  check('ZH sets identical', mismatch === 0, 'mismatch=' + mismatch);
  // spot-check validity of a few via independent re-derivation using MnemCore.sha256
  let bad = 0;
  for (const m of setA) {
    const ws = m.split(' ');
    const EB = 128, csBits = 4;
    const bits = [];
    for (const w of ws) { const ix = WORDLIST_ZH.indexOf(w); for (let j = 10; j >= 0; j--) bits.push((ix >> j) & 1); }
    const ent = new Uint8Array(16);
    for (let i = 0; i < EB; i++) if (bits[i]) ent[i >> 3] |= (1 << (7 - (i & 7)));
    const h = MnemCore.sha256(ent);
    let ok = true;
    for (let c = 0; c < csBits; c++) if (((h[c >> 3] >> (7 - (c & 7))) & 1) !== bits[EB + c]) ok = false;
    if (!ok) bad++;
  }
  check('ZH independent checksum OK (sampled 262144)', bad === 0, 'bad=' + bad);
}

console.log('\n=== Test 5b: ZH mode - all-zero 11-word prefix, last word valid? ===');
{
  if (!ZH_WL) { console.log('  SKIP  @scure chinese wordlist not available (using cross-check instead)'); }
  else {
    const known = new Array(12).fill(0); known[11] = null;
    let total = 0, invalid = 0;
    for (const m of genRecover(known, WORDLIST_ZH, 12, 128)) {
      total++;
      if (!validateMnemonic(m, ZH_WL)) invalid++;
    }
    check('generated 128', total === 128, 'got ' + total);
    check('ALL valid BIP39 ZH (scure)', invalid === 0, 'invalid=' + invalid);
  }
}

// =====================================================================
console.log('\n=== Test 6: cap behavior (3 missing -> only first cap produced) ===');
{
  const known = new Array(12).fill(0); known[9] = null; known[10] = null; known[11] = null;
  const gen = genRecover(known, WORDLIST_EN, 12, 100);
  let total = 0;
  for (const m of gen) { total++; if (!validateMnemonic(m, EN_WL)) fail++; }
  check('cap=100 yields exactly 100', total === 100, 'got ' + total);
}

console.log('\n========================================');
console.log('RESULT:  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
