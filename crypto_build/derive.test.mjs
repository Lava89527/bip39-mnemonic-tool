import { deriveAccounts, derivePathAddresses, _util } from './derive.js';
import { secp256k1 } from '@noble/curves/secp256k1';

const priv1 = new Uint8Array(32); priv1[31] = 1;
const pub1 = secp256k1.getPublicKey(priv1, true); // compressed pubkey for private key = 1
const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map(b => parseInt(b, 16)));
const seedRFC8032 = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');

const af = _util.addressFor;
const checks = [
  ['legacy',  af('legacy', priv1, pub1) === '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH'],
  ['segwit',  af('segwit', priv1, pub1) === 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
  ['nested',  af('nested', priv1, pub1).startsWith('3')],
  ['taproot', af('taproot', priv1).startsWith('bc1p')],
  ['eth',     af('eth', priv1, null).toLowerCase() === '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf'],
  ['sui',     af('sui', seedRFC8032, null) === '0xd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a']
];
console.log('--- canonical address vectors (priv=1) ---');
let allOk = true;
for (const [k, ok] of checks) { console.log(k.padEnd(8), ok ? 'OK' : 'FAIL'); if (!ok) allOk = false; }

const V1 = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
function show(coin) {
  console.log('\n=== ' + coin + ' (V1 mnemonic) ===');
  const accs = deriveAccounts(V1, coin);
  for (const a of accs) {
    console.log(`[${a.label}] ${a.address}`);
    console.log('   key:', a.privHex, a.wif ? '| wif ' + a.wif : '');
  }
  return accs;
}
show('BTC'); show('ETH'); show('SOL'); show('SUI');

// 100-address batch
const batch = derivePathAddresses(V1, 'BTC', "m/44'/0'/0'/0/0", 0, 3);
console.log('\nBTC legacy batch 0..2:');
batch.forEach(b => console.log('  #' + b.index, b.address, '|', b.privHex.slice(0, 12) + '…'));
console.log('batch count OK:', batch.length === 3);

const solBatch = derivePathAddresses(V1, 'SOL', "m/44'/501'/0'/0/0", 0, 3);
console.log('SOL batch count OK:', solBatch.length === 3);

console.log('\nALL CANONICAL CHECKS PASS:', allOk ? 'YES' : 'NO');
