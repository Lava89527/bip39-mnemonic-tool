// derive.js — offline BIP39/BIP32 + multi-coin address derivation.
// Bundled to an IIFE (global `Derive`) for the single-file HTML app.
//
// Chrome-59 compatible: NO BigInt, NO optional chaining, NO nullish coalescing,
// NO Object.hasOwn, NO globalThis. Crypto primitives come from ES5-friendly
// libraries (elliptic, hash.js, tweetnacl, js-sha3) instead of @noble/@scure.
import elliptic from 'elliptic';
import hash from 'hash.js';
import jsSha3 from 'js-sha3';
import nacl from 'tweetnacl';
import BN from 'bn.js';

const { ec } = elliptic;
const secp = new ec('secp256k1');
const n = secp.curve.n;                       // curve order (BN)
const G = secp.curve.g;                       // generator point
const { keccak256 } = jsSha3;

// ---- low-level helpers -----------------------------------------------------
function bytesToHex(b) { let s = ''; for (const x of b) s += x.toString(16).padStart(2, '0'); return s; }
function hexToBytes(h) {
  h = h.length % 2 ? '0' + h : h;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
  return out;
}
const TD = new TextEncoder();
const utf8 = (s) => TD.encode(s);
function concatBytes() {
  const arrays = [];
  for (let i = 0; i < arguments.length; i++) arrays.push(arguments[i]);
  let len = 0; for (const a of arrays) len += a.length;
  const out = new Uint8Array(len); let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
function u32(num) {
  return new Uint8Array([(num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff]);
}
function pad64(hex) {
  return ('0000000000000000000000000000000000000000000000000000000000000000' + hex).slice(-64);
}
// bn.js accepts a byte array, not necessarily a Uint8Array, so convert.
const bn = (u8) => new BN(Array.from(u8));

// ---- hash primitives (hash.js) --------------------------------------------
function sha256(b) { return new Uint8Array(hash.sha256().update(b).digest()); }
function sha512(b) { return new Uint8Array(hash.sha512().update(b).digest()); }
function ripemd160(b) { return new Uint8Array(hash.ripemd160().update(b).digest()); }
function hmacSha512(key, data) {
  const h = hash.hmac(hash.sha512, key);
  h.update(data);
  return new Uint8Array(h.digest());
}
function keccak_256(b) { return new Uint8Array(keccak256.array(b)); }

function hash160(buf) { return ripemd160(sha256(buf)); }
function taggedHash(tag, data) {
  const th = sha256(utf8(tag));
  return sha256(concatBytes(th, th, data));
}

// ---- PBKDF2-HMAC-SHA512 (BIP39 mnemonic -> seed) --------------------------
function pbkdf2HmacSha512(password, salt, iterations, dkLen) {
  const blocks = Math.ceil(dkLen / 64);
  const out = new Uint8Array(blocks * 64);
  for (let block = 1; block <= blocks; block++) {
    let u = hmacSha512(password, concatBytes(salt, u32(block)));
    const result = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = hmacSha512(password, u);
      for (let j = 0; j < result.length; j++) result[j] ^= u[j];
    }
    out.set(result, (block - 1) * 64);
  }
  return out.slice(0, dkLen);
}
function mnemonicToSeed(mnemonic, passphrase) {
  const password = utf8(mnemonic.normalize('NFKD'));
  const salt = utf8(('mnemonic' + (passphrase || '')).normalize('NFKD'));
  return pbkdf2HmacSha512(password, salt, 2048, 64);
}

// ---- base58 (no Buffer dependency) ----------------------------------------
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58encode(bytes) {
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [];
  let len = 0;
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < len; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; }
    while (carry > 0) { digits[len++] = carry % 58; carry = (carry / 58) | 0; }
  }
  let out = '';
  for (let i = 0; i < zeros; i++) out += B58[0];
  for (let j = len - 1; j >= 0; j--) out += B58[digits[j]];
  return out;
}
function base58check(payload) {
  const cs = sha256(sha256(payload)).slice(0, 4);
  return bs58encode(concatBytes(payload, cs));
}

// ---- secp256k1 helpers (elliptic) -----------------------------------------
function pubPoint(priv32) { return secp.keyFromPrivate(bytesToHex(priv32), 'hex').getPublic(); }
function pubUncompressed(priv32) {
  const p = pubPoint(priv32);
  return hexToBytes('04' + pad64(p.getX().toString('hex')) + pad64(p.getY().toString('hex')));
}
function pubCompressed(priv32) {
  const p = pubPoint(priv32);
  const prefix = p.getY().isOdd() ? '03' : '02';
  return hexToBytes(prefix + pad64(p.getX().toString('hex')));
}

// ---- BIP32 (SLIP-0010 / BIP32) via elliptic + hash.js ----------------------
function masterFromSeed(seed) {
  const I = hmacSha512(utf8('Bitcoin seed'), seed);
  return { k: I.slice(0, 32), c: I.slice(32, 64) };
}
function ckdPriv(kPar, cPar, index) {
  let data;
  if (index >= 0x80000000) {
    data = concatBytes(new Uint8Array([0x00]), kPar, u32(index));
  } else {
    data = concatBytes(pubCompressed(kPar), u32(index));
  }
  const I = hmacSha512(cPar, data);
  const IL = I.slice(0, 32), IR = I.slice(32, 64);
  if (bn(IL).cmp(n) >= 0) return null;
  const ki = bn(IL).add(bn(kPar)).mod(n);
  if (ki.isZero()) return null;
  return { k: ki.toArrayLike(Uint8Array, 'be', 32), c: IR };
}
function deriveBIP32Priv(seed, path) {
  let node = masterFromSeed(seed);
  const segs = path.replace(/^m\//, '').split('/');
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const hardened = seg.endsWith("'");
    const idx = parseInt(seg.replace("'", ''), 10) + (hardened ? 0x80000000 : 0);
    const next = ckdPriv(node.k, node.c, idx);
    if (!next) throw new Error('BIP32 derivation failed at ' + seg);
    node = next;
  }
  return node.k;
}

// ---- bech32 / bech32m (self-contained, ES5) --------------------------------
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function polymod(values) {
  let chk = 1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let j = 0; j < 5; j++) chk ^= ((top >> j) & 1) ? GEN[j] : 0;
  }
  return chk;
}
function hrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}
function createChecksum(hrp, data, constant) {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ constant;
  const ret = [];
  for (let i = 0; i < 6; i++) ret.push((mod >> (5 * (5 - i))) & 31);
  return ret;
}
function bechEncode(hrp, data, constant) {
  const combined = data.concat(createChecksum(hrp, data, constant));
  let ret = hrp + '1';
  for (let i = 0; i < combined.length; i++) ret += CHARSET[combined[i]];
  return ret;
}
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0, bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (let i = 0; i < data.length; i++) {
    acc = (acc << fromBits) | data[i];
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) ret.push((acc << (toBits - bits)) & maxv);
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    return null;
  }
  return ret;
}
const bech32 = {
  encode: (hrp, data) => bechEncode(hrp, data, 1),
  toWords: (bytes) => convertBits(bytes, 8, 5, true)
};
const bech32m = {
  encode: (hrp, data) => bechEncode(hrp, data, 0x2bc830a3),
  toWords: (bytes) => convertBits(bytes, 8, 5, true)
};

// ---- BTC addresses (secp256k1) --------------------------------------------
function btcLegacy(pub) { return base58check(concatBytes(new Uint8Array([0x00]), hash160(pub))); }
function btcNested(pub) {
  const h = hash160(pub);
  const redeem = concatBytes(new Uint8Array([0x00, 0x14]), h);
  return base58check(concatBytes(new Uint8Array([0x05]), hash160(redeem)));
}
function btcSegwit(pub) {
  const h = hash160(pub);
  return bech32.encode('bc', [0].concat(bech32.toWords(h)));
}
function btcTaproot(priv) {
  const p = pubPoint(priv);
  const internalX = hexToBytes(pad64(p.getX().toString('hex')));     // 32-byte x-only internal key
  const tweak = taggedHash('TapTweak', concatBytes(internalX, new Uint8Array(32))); // empty script tree
  const Q = p.add(G.mul(bn(tweak)));
  const xQ = hexToBytes(pad64(Q.getX().toString('hex')));            // 32-byte x-only output key
  return bech32m.encode('bc', [1].concat(bech32m.toWords(xQ)));
}
function btcWIF(priv) {
  return base58check(concatBytes(new Uint8Array([0x80]), priv, new Uint8Array([0x01])));
}

// ---- ETH (secp256k1) -------------------------------------------------------
function ethAddress(priv) {
  const pub = pubUncompressed(priv);
  const addr = keccak_256(pub.slice(1)).slice(12);
  return ethChecksum(addr);
}
function ethChecksum(addr20) {
  const lower = bytesToHex(addr20);
  const hashv = keccak_256(utf8(lower));
  let out = '0x';
  for (let i = 0; i < 40; i++) {
    const c = lower[i];
    const nib = (hashv[i >> 1] >> (i % 2 ? 0 : 4)) & 0x0f;
    out += (nib >= 8 && c >= 'a' && c <= 'f') ? c.toUpperCase() : c;
  }
  return out;
}

// ---- SOL / SUI (ed25519, SLIP-0010) ---------------------------------------
function deriveEd25519Full(seed, path) {
  let I = hmacSha512(utf8('ed25519 seed'), seed);
  let k = I.slice(0, 32), c = I.slice(32);
  const segs = path.replace(/^m\//, '').split('/');
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const hardened = seg.endsWith("'");
    const idx = parseInt(seg.replace("'", ''), 10) + (hardened ? 0x80000000 : 0);
    I = hmacSha512(c, concatBytes(new Uint8Array([0x00]), k, u32(idx)));
    k = I.slice(0, 32); c = I.slice(32);
  }
  return k;
}
function ed25519Pub(priv32) { return nacl.sign.keyPair.fromSeed(priv32).publicKey; }
function solAddress(priv) { return bs58encode(ed25519Pub(priv)); }
function suiAddress(priv) { return '0x' + bytesToHex(ed25519Pub(priv)); }

// ---- coin configuration ----------------------------------------------------
export const COINS = {
  BTC: {
    type: 'secp256k1',
    paths: [
      { label: 'Legacy · P2PKH', path: "m/44'/0'/0'/0/0", kind: 'legacy' },
      { label: 'Nested SegWit · P2SH-P2WPKH', path: "m/49'/0'/0'/0/0", kind: 'nested' },
      { label: 'Native SegWit · P2WPKH', path: "m/84'/0'/0'/0/0", kind: 'segwit' },
      { label: 'Taproot · P2TR', path: "m/86'/0'/0'/0/0", kind: 'taproot' }
    ]
  },
  ETH: {
    type: 'secp256k1',
    paths: [{ label: "Ethereum · m/44'/60'/0'/0/0", path: "m/44'/60'/0'/0/0", kind: 'eth' }]
  },
  SOL: {
    type: 'ed25519',
    paths: [{ label: "Solana · m/44'/501'/0'/0/0", path: "m/44'/501'/0'/0/0", kind: 'sol' }]
  },
  SUI: {
    type: 'ed25519',
    paths: [{ label: "Sui · m/44'/784'/0'/0/0", path: "m/44'/784'/0'/0/0", kind: 'sui' }]
  }
};

function addressFor(kind, priv, pub) {
  switch (kind) {
    case 'legacy':  return btcLegacy(pub);
    case 'nested':  return btcNested(pub);
    case 'segwit':  return btcSegwit(pub);
    case 'taproot': return btcTaproot(priv);
    case 'eth':     return ethAddress(priv);
    case 'sol':     return solAddress(priv);
    case 'sui':     return suiAddress(priv);
  }
  return '';
}

// Derive the first address + private key for every configured path of a coin.
export function deriveAccounts(mnemonic, coin) {
  const seed = mnemonicToSeed(mnemonic, '');
  const cfg = COINS[coin];
  const accounts = [];
  if (cfg.type === 'secp256k1') {
    for (let i = 0; i < cfg.paths.length; i++) {
      const p = cfg.paths[i];
      const priv = deriveBIP32Priv(seed, p.path);
      const pub = pubCompressed(priv);
      accounts.push({
        label: p.label, path: p.path, kind: p.kind, coin,
        address: addressFor(p.kind, priv, pub),
        privHex: '0x' + bytesToHex(priv),
        wif: (p.kind === 'eth' || p.kind === 'sol' || p.kind === 'sui') ? null : btcWIF(priv)
      });
    }
  } else {
    for (let i = 0; i < cfg.paths.length; i++) {
      const p = cfg.paths[i];
      const priv = deriveEd25519Full(seed, p.path);
      accounts.push({
        label: p.label, path: p.path, kind: p.kind, coin,
        address: addressFor(p.kind, priv, null),
        privHex: '0x' + bytesToHex(priv),
        wif: null
      });
    }
  }
  return accounts;
}

// Generate `count` addresses of one path, with the last index running start..start+count-1.
export function derivePathAddresses(mnemonic, coin, path, start, count) {
  const seed = mnemonicToSeed(mnemonic, '');
  const cfg = COINS[coin];
  const def = cfg.paths.find((p) => p.path === path);
  const kind = def ? def.kind : (cfg.paths[0] && cfg.paths[0].kind);
  const parts = path.replace(/^m\//, '').split('/');
  const lastHardened = parts[parts.length - 1].endsWith("'");
  const baseParts = parts.slice(0, -1);
  const results = [];
  if (cfg.type === 'secp256k1') {
    for (let i = start; i < start + count; i++) {
      const last = lastHardened ? i + "'" : String(i);
      const priv = deriveBIP32Priv(seed, 'm/' + baseParts.concat(last).join('/'));
      const pub = pubCompressed(priv);
      results.push({ index: i, address: addressFor(kind, priv, pub), privHex: '0x' + bytesToHex(priv) });
    }
  } else {
    for (let i = start; i < start + count; i++) {
      const last = lastHardened ? i + "'" : String(i);
      const fullPath = 'm/' + baseParts.concat(last).join('/');
      const priv = deriveEd25519Full(seed, fullPath);
      results.push({ index: i, address: addressFor(kind, priv, null), privHex: '0x' + bytesToHex(priv) });
    }
  }
  return results;
}

export const _util = { bytesToHex, sha256, addressFor };
