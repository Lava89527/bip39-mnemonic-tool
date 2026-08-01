// derive.js — offline BIP39/BIP32 + multi-coin address derivation.
// Bundled to an IIFE (global `Derive`) for the single-file HTML app.
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { secp256k1 } from '@noble/curves/secp256k1';
import { schnorr } from '@noble/curves/secp256k1';
import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { keccak_256 } from '@noble/hashes/sha3';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { bech32, bech32m } from 'bech32';

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

const TD = new TextEncoder();
const utf8 = (s) => TD.encode(s);
function concatBytes(...arrays) {
  let len = 0; for (const a of arrays) len += a.length;
  const out = new Uint8Array(len); let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
function bytesToHex(b) { let s = ''; for (const x of b) s += x.toString(16).padStart(2, '0'); return s; }
function u32(n) { return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]); }
function hash160(buf) { return ripemd160(sha256(buf)); }
function taggedHash(tag, data) {
  const th = sha256(utf8(tag));
  return sha256(concatBytes(th, th, data));
}
// base58check without Buffer dependency (uses bs58 + double-SHA256 checksum)
function base58check(payload) {
  const cs = sha256(sha256(payload)).slice(0, 4);
  return bs58encode(concatBytes(payload, cs));
}

// ---- BTC addresses (secp256k1) ----
function btcLegacy(pub) { return base58check(concatBytes(new Uint8Array([0x00]), hash160(pub))); }
function btcNested(pub) {
  const h = hash160(pub);
  const redeem = concatBytes(new Uint8Array([0x00, 0x14]), h);
  return base58check(concatBytes(new Uint8Array([0x05]), hash160(redeem)));
}
function btcSegwit(pub) {
  const h = hash160(pub);
  return bech32.encode('bc', [0, ...bech32.toWords(h)]);
}
function btcTaproot(priv) {
  const internalX = schnorr.getPublicKey(priv);            // 32-byte x-only internal key
  const tweak = taggedHash('TapTweak', concatBytes(internalX, new Uint8Array(32))); // empty script tree
  const fullPub = secp256k1.getPublicKey(priv, false);     // 65 bytes uncompressed
  const P = secp256k1.ProjectivePoint.fromHex(fullPub);
  const tG = secp256k1.ProjectivePoint.fromPrivateKey(tweak);
  const Q = P.add(tG);
  const xQ = Q.toRawBytes(true).slice(1);                  // 32-byte x-only output key
  return bech32m.encode('bc', [1, ...bech32m.toWords(xQ)]);
}
function btcWIF(priv) {
  return base58check(concatBytes(new Uint8Array([0x80]), priv, new Uint8Array([0x01])));
}

// ---- ETH (secp256k1) ----
function ethAddress(priv) {
  const pub = secp256k1.getPublicKey(priv, false);
  const addr = keccak_256(pub.slice(1)).slice(12);
  return ethChecksum(addr);
}
function ethChecksum(addr20) {
  const lower = bytesToHex(addr20);
  const hash = keccak_256(utf8(lower));
  let out = '0x';
  for (let i = 0; i < 40; i++) {
    const c = lower[i];
    const nib = (hash[i >> 1] >> (i % 2 ? 0 : 4)) & 0x0f;
    out += (nib >= 8 && c >= 'a' && c <= 'f') ? c.toUpperCase() : c;
  }
  return out;
}

// ---- SOL / SUI (ed25519, SLIP-0010) ----
function deriveEd25519Full(seed, path) {
  let I = hmac(sha512, utf8('ed25519 seed'), seed);
  let k = I.slice(0, 32), c = I.slice(32);
  for (const seg of path.replace(/^m\//, '').split('/')) {
    const hardened = seg.endsWith("'");
    const idx = parseInt(seg.replace("'", ''), 10) + (hardened ? 0x80000000 : 0);
    I = hmac(sha512, c, concatBytes(new Uint8Array([0x00]), k, u32(idx)));
    k = I.slice(0, 32); c = I.slice(32);
  }
  return k;
}
function solAddress(priv) { return bs58encode(ed25519.getPublicKey(priv)); }
function suiAddress(priv) { return '0x' + bytesToHex(ed25519.getPublicKey(priv)); }

// ---- coin configuration ----
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
  const seed = mnemonicToSeedSync(mnemonic, '');
  const cfg = COINS[coin];
  const accounts = [];
  if (cfg.type === 'secp256k1') {
    const master = HDKey.fromMasterSeed(seed);
    for (const p of cfg.paths) {
      const hd = master.derive(p.path);
      const priv = hd.privateKey, pub = hd.publicKey;
      accounts.push({
        label: p.label, path: p.path, kind: p.kind, coin,
        address: addressFor(p.kind, priv, pub),
        privHex: '0x' + bytesToHex(priv),
        wif: (p.kind === 'eth' || p.kind === 'sol' || p.kind === 'sui') ? null : btcWIF(priv)
      });
    }
  } else {
    for (const p of cfg.paths) {
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
  const seed = mnemonicToSeedSync(mnemonic, '');
  const cfg = COINS[coin];
  const def = cfg.paths.find(p => p.path === path);
  const kind = def ? def.kind : (cfg.paths[0] && cfg.paths[0].kind);
  const parts = path.replace(/^m\//, '').split('/');
  const lastHardened = parts[parts.length - 1].endsWith("'");
  const baseParts = parts.slice(0, -1);
  const results = [];
  if (cfg.type === 'secp256k1') {
    const master = HDKey.fromMasterSeed(seed);
    for (let i = start; i < start + count; i++) {
      const last = lastHardened ? i + "'" : String(i);
      const hd = master.derive('m/' + baseParts.concat(last).join('/'));
      const priv = hd.privateKey, pub = hd.publicKey;
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
