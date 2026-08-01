const fs = require('fs');
const Core = require('./mnemonic_core.js');

const EN = fs.readFileSync('assets/english.txt', 'utf8').trim().split('\n');
const indexMap = {};
EN.forEach((w, i) => (indexMap[w] = i));

// 1) SHA-256 known vector
function bytesToHex(b) { return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }
const abcHash = bytesToHex(Core.sha256(new Uint8Array([0x61, 0x62, 0x63])));
console.log('SHA256(abc) =', abcHash, abcHash === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' ? 'OK' : 'FAIL');

// 2) 11 known words -> 128 completions, includes BIP39 all-zeros vector
const abandonIdx = EN.indexOf('abandon');
const known11 = new Array(11).fill(abandonIdx);
const gen1 = Core.completeMnemonicGen(known11, EN);
let count1 = 0, foundAbout = false;
for (const m of gen1) {
  count1++;
  if (m === 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about') foundAbout = true;
}
console.log('11->12 count =', count1, count1 === 128 ? 'OK' : 'FAIL', '| contains all-zeros vector:', foundAbout ? 'OK' : 'FAIL');

// 3) 23 known words -> 8 completions
const known23 = new Array(23).fill(abandonIdx);
let count23 = 0;
for (const _ of Core.completeMnemonicGen(known23, EN)) count23++;
console.log('23->24 count =', count23, count23 === 8 ? 'OK' : 'FAIL');

// 4) 10 known -> 262144 completions (count only)
let count10 = 0;
for (const _ of Core.completeMnemonicGen(new Array(10).fill(abandonIdx), EN)) count10++;
console.log('10->12 count =', count10, count10 === 262144 ? 'OK' : 'FAIL');

// 5) 22 known -> 16384 completions (count only)
let count22 = 0;
for (const _ of Core.completeMnemonicGen(new Array(22).fill(abandonIdx), EN)) count22++;
console.log('22->24 count =', count22, count22 === 16384 ? 'OK' : 'FAIL');

// 6) Independent checksum verification on a sample of real completions
function bigIntToBytes(E, nbytes) {
  const out = new Uint8Array(nbytes);
  for (let i = 0; i < nbytes; i++) out[nbytes - 1 - i] = Number((E >> BigInt(8 * i)) & 0xffn);
  return out;
}
function verify(mnemonic, total) {
  const idx = mnemonic.split(' ').map(t => indexMap[t]);
  let cs = 0n;
  for (const i of idx) cs = (cs << 11n) | BigInt(i);
  const entBits = total === 12 ? 128 : 256;
  const csBits = entBits / 32;
  const entropy = cs >> BigInt(csBits);
  const checksum = cs & ((1n << BigInt(csBits)) - 1n);
  const eBytes = bigIntToBytes(entropy, entBits / 8);
  const hash = Core.sha256(eBytes);
  let csVal = 0;
  for (let bit = 0; bit < csBits; bit++) {
    const byteIdx = bit >> 3, bitIdx = 7 - (bit & 7);
    csVal = (csVal << 1) | ((hash[byteIdx] >> bitIdx) & 1);
  }
  return csVal === Number(checksum);
}
let bad = 0, checked = 0;
for (const m of Core.completeMnemonicGen(known11, EN)) {
  checked++;
  if (!verify(m, 12)) bad++;
}
console.log('Checksum verify on', checked, '12-word completions -> invalid:', bad, bad === 0 ? 'OK' : 'FAIL');
