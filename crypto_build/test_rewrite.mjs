import { deriveAccounts, derivePathAddresses } from './derive.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(__dirname, 'golden.json'), 'utf8'));

const COINS = ['BTC', 'ETH', 'SOL', 'SUI'];
let pass = 0, fail = 0;
const failures = [];

function check(label, got, want) {
  if (got === want) { pass++; }
  else { fail++; failures.push({ label, got, want }); }
}

for (const m of [golden.m12, golden.m24]) {
  const got = golden.accounts[m];
  for (const coin of COINS) {
    const accounts = deriveAccounts(m, coin);
    // map by kind
    const byKind = {};
    for (const a of accounts) byKind[a.kind] = a;
    for (const exp of got[coin]) {
      const g = byKind[exp.kind];
      check(`${coin}/${exp.kind} addr (${m.split(' ')[0]}...)`, g && g.address, exp.address);
      check(`${coin}/${exp.kind} priv (${m.split(' ')[0]}...)`, g && g.privHex, exp.privHex);
      if (exp.wif !== undefined) check(`${coin}/${exp.kind} wif (${m.split(' ')[0]}...)`, g && g.wif, exp.wif);
    }
  }
}

// pathSample (BTC native segwit, indices 0..2)
const ps = derivePathAddresses(golden.m12, 'BTC', "m/84'/0'/0'/0/0", 0, 3);
for (let i = 0; i < ps.length; i++) {
  check(`pathSample[${i}] addr`, ps[i].address, golden.pathSample[i].address);
  check(`pathSample[${i}] priv`, ps[i].privHex, golden.pathSample[i].privHex);
}

console.log(`\nPASS=${pass}  FAIL=${fail}`);
if (fail) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`- ${f.label}\n    got : ${f.got}\n    want: ${f.want}`);
  }
  process.exit(1);
} else {
  console.log('ALL GOLDEN VECTORS MATCH ✔');
}
