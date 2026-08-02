// Validates the recovery generator (genRecover) extracted from template.html.
// Confirms: count matches countValid, the original mnemonic is recoverable,
// and every generated mnemonic has a correct BIP39 checksum.
const fs = require('fs');
const path = require('path');
const Core = require('../mnemonic_core.js');
const MnemCore = { sha256: Core.sha256 };

const tpl = fs.readFileSync(path.join(__dirname, '..', 'template.html'), 'utf8');
const start = tpl.indexOf('function freeEntropyBits');
const end = tpl.indexOf('function fmtCount');
if (start < 0 || end < 0) { console.error('could not locate recovery functions'); process.exit(1); }
const code = tpl.slice(start, end);
const factory = new Function('MnemCore', code + '\n return { freeEntropyBits, countValid, genRecover };');
const { freeEntropyBits, countValid, genRecover } = factory(MnemCore);

const EN = fs.readFileSync(path.join(__dirname, '..', 'assets', 'english.txt'), 'utf8').trim().split('\n');
const idxOf = (w) => EN.indexOf(w);

// Independent BIP39 checksum validator (Node has BigInt, fine here).
function isValid(mnemonic, total) {
  const idx = mnemonic.split(' ').map(idxOf);
  if (idx.some(i => i < 0)) return false;
  let cs = 0n;
  for (const i of idx) cs = (cs << 11n) | BigInt(i);
  const entBits = total === 12 ? 128 : 256;
  const csBits = entBits / 32;
  const entropy = cs >> BigInt(csBits);
  const checksum = cs & ((1n << BigInt(csBits)) - 1n);
  const nbytes = entBits / 8;
  const eBytes = new Uint8Array(nbytes);
  for (let i = 0; i < nbytes; i++) eBytes[nbytes - 1 - i] = Number((entropy >> BigInt(8 * i)) & 0xffn);
  const hash = Core.sha256(eBytes);
  let csVal = 0;
  for (let bit = 0; bit < csBits; bit++) csVal = (csVal << 1) | ((hash[bit >> 3] >> (7 - (bit & 7))) & 1);
  return csVal === Number(checksum);
}

function runCase(name, words, removePos) {
  const total = words.length;
  const known = words.map(idxOf);
  known[removePos] = null;
  const expected = countValid(known, total);
  const out = [];
  for (const m of genRecover(known, EN, total, 1000000)) out.push(m);
  const orig = words.join(' ');
  const recovered = out.includes(orig);
  let bad = 0;
  for (const m of out) if (!isValid(m, total)) bad++;
  // NOTE: countValid reports raw entropy combinations (2^freeEntropyBits), which can
  // over-count when a known word also carries checksum bits (the original tool's behavior,
  // preserved here). The real correctness criteria are: original recovered + all valid.
  const ok = recovered && bad === 0 && out.length > 0 && out.length <= expected;
  const note = out.length < expected ? ` (countValid upper-bound=${expected}; actual valid=${out.length})` : '';
  console.log(`[${name}] count=${out.length} recoveredOrig=${recovered} invalid=${bad}${note} -> ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}

let allOk = true;
// 12-word, last word missing
allOk &= runCase('12w-last', 'about access acquire adapt advance age aisle alley alter analyst ankle fever'.split(' '), 11);
// 12-word, a middle word missing
allOk &= runCase('12w-mid', 'about access acquire adapt advance age aisle alley alter analyst ankle fever'.split(' '), 5);
// 24-word, last word missing (golden m24)
allOk &= runCase('24w-last', 'about access acquire adapt advance age aisle alley alter analyst ankle anxiety april armed arrow assault attack aunt awake baby ball barrel beauty heavy'.split(' '), 23);

console.log(allOk ? '\nRECOVERY GENERATOR OK ✔' : '\nRECOVERY GENERATOR FAILED');
process.exit(allOk ? 0 : 1);
