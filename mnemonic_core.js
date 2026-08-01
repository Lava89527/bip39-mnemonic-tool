/*
 * mnemonic_core.js
 * Pure BIP39 mnemonic completion logic (no DOM, works in browser and Node).
 *
 * Given the first N words of a BIP39 mnemonic (N = 10, 11, 22 or 23),
 * it enumerates EVERY valid completion whose checksum is correct.
 *
 * Word count mapping:
 *   10 or 11 known  -> 12-word mnemonic (128-bit entropy + 4-bit checksum)
 *   22 or 23 known  -> 24-word mnemonic (256-bit entropy + 8-bit checksum)
 */
(function (global) {
  'use strict';

  // ---- SHA-256 (FIPS 180-4), works on Uint8Array -------------------------
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256(bytes) {
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const l = bytes.length;
    const bitLen = l * 8;
    const withOne = l + 1;
    let k = (56 - (withOne % 64) + 64) % 64;
    const total = withOne + k + 8;
    const msg = new Uint8Array(total);
    msg.set(bytes);
    msg[l] = 0x80;
    const hi = Math.floor(bitLen / 0x100000000);
    const lo = bitLen >>> 0;
    msg[total - 8] = (hi >>> 24) & 0xff;
    msg[total - 7] = (hi >>> 16) & 0xff;
    msg[total - 6] = (hi >>> 8) & 0xff;
    msg[total - 5] = hi & 0xff;
    msg[total - 4] = (lo >>> 24) & 0xff;
    msg[total - 3] = (lo >>> 16) & 0xff;
    msg[total - 2] = (lo >>> 8) & 0xff;
    msg[total - 1] = lo & 0xff;

    const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) {
        const j = off + i * 4;
        w[i] = (msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    const out = new Uint8Array(32);
    const H = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (let i = 0; i < 8; i++) {
      out[i * 4] = (H[i] >>> 24) & 0xff;
      out[i * 4 + 1] = (H[i] >>> 16) & 0xff;
      out[i * 4 + 2] = (H[i] >>> 8) & 0xff;
      out[i * 4 + 3] = H[i] & 0xff;
    }
    return out;
  }

  function bigIntToBytes(E, nbytes) {
    const out = new Uint8Array(nbytes);
    for (let i = 0; i < nbytes; i++) {
      out[nbytes - 1 - i] = Number((E >> BigInt(8 * i)) & 0xffn);
    }
    return out;
  }

  function totalFor(n) {
    if (n === 10 || n === 11) return 12;
    if (n === 22 || n === 23) return 24;
    return 0;
  }

  /*
   * Generator yielding every valid completion as a full mnemonic string.
   * knownIndices: array of integer word indices (the known prefix)
   * wordlist: array of words (same order as indices)
   */
  function* completeMnemonicGen(knownIndices, wordlist) {
    const n = knownIndices.length;
    const total = totalFor(n);
    if (!total) throw new Error('known count must be 10/11/22/23');

    const entBits = total === 12 ? 128 : 256;
    const csBits = entBits / 32;
    const wordBits = 11n;

    // knownHigh = first n*11 bits of the entropy (the known prefix is pure entropy)
    let knownHigh = 0n;
    for (let i = 0; i < n; i++) {
      knownHigh = (knownHigh << wordBits) | BigInt(knownIndices[i]);
    }

    const remEnt = entBits - n * 11;        // free entropy bits still to enumerate
    const ceil = 1n << BigInt(remEnt);

    for (let c = 0n; c < ceil; c++) {
      const E = (knownHigh << BigInt(remEnt)) | c;          // full entropy
      const eBytes = bigIntToBytes(E, entBits / 8);
      const hash = sha256(eBytes);

      // checksum = first csBits bits of SHA256(entropy), big-endian
      let csVal = 0;
      for (let bit = 0; bit < csBits; bit++) {
        const byteIdx = bit >> 3;
        const bitIdx = 7 - (bit & 7);
        const b = (hash[byteIdx] >> bitIdx) & 1;
        csVal = (csVal << 1) | b;
      }

      const checksummed = (E << BigInt(csBits)) | BigInt(csVal);

      const words = new Array(total);
      for (let i = 0; i < n; i++) words[i] = wordlist[knownIndices[i]];
      for (let i = n; i < total; i++) {
        const shift = wordBits * BigInt(total - 1 - i);
        const idx = Number((checksummed >> shift) & 0x7ffn);
        words[i] = wordlist[idx];
      }
      yield words.join(' ');
    }
  }

  const api = { sha256, completeMnemonicGen, totalFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MnemCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
